import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import * as jose from 'jose'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

// Tool result interface
interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

// Generar JWT para el MCP
async function generateMcpToken(): Promise<string> {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  
  const secretKey = new TextEncoder().encode(secret)
  
  const token = await new jose.SignJWT({
    agent_id: 'sicamar-planificacion-agent',
    mcp: 'sicamar-mcp',
    tools: [
      'sicamar.jornadas.editar',
      'sicamar.jornadas.consultar',
      'sicamar.empleados.buscar'
    ],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secretKey)
  
  return token
}

// Cliente MCP singleton para reusar conexión
let mcpClient: Client | null = null
let mcpConnecting: Promise<Client> | null = null

async function getMcpClient(): Promise<Client> {
  if (mcpClient) return mcpClient
  
  // Evitar conexiones paralelas
  if (mcpConnecting) return mcpConnecting
  
  mcpConnecting = (async () => {
    const baseUrl = process.env.MCP_BASE_URL
    if (!baseUrl) throw new Error('MCP_BASE_URL not configured')
    
    const token = await generateMcpToken()
    
    const transport = new SSEClientTransport(
      new URL(`${baseUrl}/sse`),
      {
        requestInit: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    )
    
    const client = new Client({ 
      name: 'sicamar-planificacion', 
      version: '1.0.0' 
    })
    
    await client.connect(transport)
    mcpClient = client
    return client
  })()
  
  return mcpConnecting
}

// Ejecutar tool via MCP
async function ejecutarTool(toolName: string, input: Record<string, unknown>): Promise<ToolResult> {
  try {
    const client = await getMcpClient()
    
    // Mapear nombre de tool de Claude a MCP
    // sicamar_empleados_buscar -> sicamar.empleados.buscar
    // sicamar_jornadas_consultar -> sicamar.jornadas.consultar
    // sicamar_jornadas_editar -> sicamar.jornadas.editar
    const mcpToolName = toolName.replace(/_/g, '.')
    
    const result = await client.callTool({
      name: mcpToolName,
      arguments: input
    })
    
    // El resultado viene en content
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c: { type: string }) => c.type === 'text')
      if (textContent && 'text' in textContent) {
        try {
          const parsed = JSON.parse(textContent.text as string)
          return { success: parsed.success !== false, data: parsed }
        } catch {
          return { success: true, data: textContent.text }
        }
      }
    }
    
    return { success: true, data: result }
  } catch (error) {
    console.error('MCP tool error:', error)
    // Resetear cliente si hay error de conexión
    mcpClient = null
    mcpConnecting = null
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error calling MCP tool' 
    }
  }
}

// System prompt para el agente de planificación
const SYSTEM_PROMPT = `Sos un asistente de planificación de turnos para Sicamar. Tu rol es ayudar a gestionar la asignación de jornadas de los empleados jornalizados.

CONTEXTO:
- Sicamar es una empresa pesquera argentina
- Los empleados trabajan en turnos: Mañana (06:00-14:00), Tarde (14:00-22:00), Noche (22:00-06:00)
- Cada jornada tiene 8 horas normales, lo que exceda son horas extra
- Los estados posibles son: VAC (vacaciones), ENF (enfermedad), ACC (accidente), SUS (suspendido), LIC (licencia), ART, FLT (falta)

HERRAMIENTAS DISPONIBLES:
1. sicamar_empleados_buscar - Para buscar empleados por nombre/apellido y obtener su legajo
   - query: requerido, texto de búsqueda (nombre o apellido)
   - solo_activos: opcional, default true
   - limit: opcional, default 10

2. sicamar_jornadas_consultar - Para ver las jornadas planificadas
   - legajo: opcional, número de legajo del empleado
   - fecha_desde: requerido, formato YYYY-MM-DD
   - fecha_hasta: opcional, formato YYYY-MM-DD
   
3. sicamar_jornadas_editar - Para modificar una jornada
   - legajo: requerido, número de legajo
   - fecha: requerido, formato YYYY-MM-DD
   - turno: opcional (mañana, tarde, noche)
   - hora_entrada: requerido, formato HH:MM
   - hora_salida: requerido, formato HH:MM
   - notas: opcional

INSTRUCCIONES:
- Sé conciso y directo
- Cuando mencionen un empleado por nombre, PRIMERO usá sicamar_empleados_buscar para obtener el legajo
- NO preguntes el legajo si podés buscarlo por nombre
- Siempre mencioná el legajo y nombre cuando hables de un empleado
- Respondé en español argentino informal pero profesional
- NO uses emojis ni formateo excesivo, mantené las respuestas limpias y minimalistas`

// Claude tools definition
const CLAUDE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'sicamar_empleados_buscar',
    description: 'Busca empleados por nombre o apellido para obtener su legajo. Usá esta tool PRIMERO cuando mencionen a alguien por nombre.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Texto de búsqueda: nombre, apellido o parte de ellos'
        },
        solo_activos: {
          type: 'boolean',
          description: 'Si es true (default), solo busca empleados activos'
        },
        limit: {
          type: 'number',
          description: 'Cantidad máxima de resultados (default: 10)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'sicamar_jornadas_consultar',
    description: 'Consulta las jornadas planificadas de empleados. Puede filtrar por legajo y rango de fechas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        legajo: {
          type: 'string',
          description: 'Número de legajo del empleado (opcional, si no se pasa trae todos)'
        },
        fecha_desde: {
          type: 'string',
          description: 'Fecha inicial en formato YYYY-MM-DD (requerido)'
        },
        fecha_hasta: {
          type: 'string',
          description: 'Fecha final en formato YYYY-MM-DD (opcional, default igual a fecha_desde)'
        }
      },
      required: ['fecha_desde']
    }
  },
  {
    name: 'sicamar_jornadas_editar',
    description: 'Edita la jornada planificada de un empleado para una fecha específica.',
    input_schema: {
      type: 'object' as const,
      properties: {
        legajo: {
          type: 'string',
          description: 'Número de legajo del empleado'
        },
        fecha: {
          type: 'string',
          description: 'Fecha en formato YYYY-MM-DD'
        },
        turno: {
          type: 'string',
          enum: ['mañana', 'tarde', 'noche'],
          description: 'Código de turno'
        },
        hora_entrada: {
          type: 'string',
          description: 'Hora de entrada en formato HH:MM (ej: 06:00)'
        },
        hora_salida: {
          type: 'string',
          description: 'Hora de salida en formato HH:MM (ej: 14:00)'
        },
        notas: {
          type: 'string',
          description: 'Notas opcionales sobre el cambio'
        }
      },
      required: ['legajo', 'fecha', 'hora_entrada', 'hora_salida']
    }
  }
]

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json()
    
    if (!process.env.ANTHROPIC_CLAUDE_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_CLAUDE_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_CLAUDE_KEY,
    })
    
    // Agregar contexto de la semana actual si está disponible
    let systemPrompt = SYSTEM_PROMPT
    if (context?.fechasSemana && context.fechasSemana.length === 7) {
      const diasNombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
      const fechasConDias = context.fechasSemana.map((f: string, i: number) => `  - ${diasNombres[i]}: ${f}`)
      
      systemPrompt += `

CONTEXTO DE LA PANTALLA ACTUAL:
El usuario está viendo la semana con las siguientes fechas:
${fechasConDias.join('\n')}

Fecha de hoy: ${new Date().toISOString().split('T')[0]}

IMPORTANTE: Cuando el usuario diga "el lunes", "el martes", etc., usá las fechas de arriba. NO preguntes qué fecha es, ya sabés cuál es.
Por ejemplo, si dice "poné turno tarde el martes", usá la fecha del martes de esta semana.`
    }
    
    // Mapear mensajes al formato de Anthropic
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }))
    
    // Stream la respuesta
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    
    // Procesar en background
    ;(async () => {
      try {
        let continueLoop = true
        let currentMessages = [...anthropicMessages]
        
        while (continueLoop) {
          const response = await anthropic.messages.create({
            model: 'claude-opus-4-5-20251101',
            max_tokens: 16000,
            thinking: {
              type: 'enabled',
              budget_tokens: 10000,
            },
            system: systemPrompt,
            tools: CLAUDE_TOOLS,
            messages: currentMessages,
          })
          
          // Recolectar todos los tool_use y sus resultados
          const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = []
          
          // Procesar content blocks
          for (const block of response.content) {
            if (block.type === 'thinking') {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'thinking', content: block.thinking })}\n\n`))
            } else if (block.type === 'text') {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: block.text })}\n\n`))
            } else if (block.type === 'tool_use') {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', name: block.name, input: block.input })}\n\n`))
              
              // Ejecutar tool directamente
              const toolResult = await ejecutarTool(block.name, block.input as Record<string, unknown>)
              
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'tool_result', name: block.name, result: toolResult })}\n\n`))
              
              // Agregar a la lista de resultados
              toolResults.push({
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: JSON.stringify(toolResult)
              })
            }
          }
          
          // Si hubo tool calls, agregar los mensajes para continuar
          if (toolResults.length > 0) {
            currentMessages = [
              ...currentMessages,
              {
                role: 'assistant' as const,
                content: response.content
              },
              {
                role: 'user' as const,
                content: toolResults
              }
            ]
          }
          
          // Continuar solo si hay tool_use pendiente
          continueLoop = response.stop_reason === 'tool_use'
        }
        
        await writer.write(encoder.encode('data: [DONE]\n\n'))
      } catch (error) {
        console.error('Stream error:', error)
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' })}\n\n`))
      } finally {
        await writer.close()
      }
    })()
    
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
    
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

