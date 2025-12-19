import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema'
import * as jose from 'jose'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

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
async function callMcpTool(mcpToolName: string, input: Record<string, unknown>): Promise<string> {
  try {
    const client = await getMcpClient()
    
    const result = await client.callTool({
      name: mcpToolName,
      arguments: input
    })
    
    // El resultado viene en content
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c: { type: string }) => c.type === 'text')
      if (textContent && 'text' in textContent) {
        return textContent.text as string
      }
    }
    
    return JSON.stringify(result)
  } catch (error) {
    console.error('MCP tool error:', error)
    mcpClient = null
    mcpConnecting = null
    return JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error calling MCP tool' 
    })
  }
}

// System prompt para el agente de planificación
const SYSTEM_PROMPT = `Sos un asistente de planificación de turnos para Sicamar. Tu rol es ayudar a gestionar la asignación de jornadas de los empleados jornalizados.

CONTEXTO:
- Sicamar es una empresa pesquera argentina
- Los empleados trabajan en turnos: Mañana (06:00-14:00), Tarde (14:00-22:00), Noche (22:00-06:00)
- Cada jornada tiene 8 horas normales, lo que exceda son horas extra
- Los estados posibles son: VAC (vacaciones), ENF (enfermedad), ACC (accidente), SUS (suspendido), LIC (licencia), ART, FLT (falta)

INSTRUCCIONES:
- Sé conciso y directo
- Cuando mencionen un empleado por nombre, PRIMERO usá sicamar_empleados_buscar para obtener el legajo
- NO preguntes el legajo si podés buscarlo por nombre
- Siempre mencioná el legajo y nombre cuando hables de un empleado
- Respondé en español argentino informal pero profesional
- NO uses emojis ni formateo excesivo, mantené las respuestas limpias y minimalistas`

// Crear tools runnable con betaTool
function createRunnableTools(onToolCall?: (name: string, input: unknown) => void, onToolResult?: (name: string, result: string) => void) {
  return [
    betaTool({
      name: 'sicamar_empleados_buscar',
      description: 'Busca empleados por nombre o apellido para obtener su legajo. Usá esta tool PRIMERO cuando mencionen a alguien por nombre.',
      inputSchema: {
        type: 'object',
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
      },
      run: async (input) => {
        onToolCall?.('sicamar_empleados_buscar', input)
        const result = await callMcpTool('sicamar.empleados.buscar', input as Record<string, unknown>)
        onToolResult?.('sicamar_empleados_buscar', result)
        return result
      }
    }),
    betaTool({
      name: 'sicamar_jornadas_consultar',
      description: 'Consulta las jornadas planificadas de empleados. Puede filtrar por legajo y rango de fechas.',
      inputSchema: {
        type: 'object',
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
      },
      run: async (input) => {
        onToolCall?.('sicamar_jornadas_consultar', input)
        const result = await callMcpTool('sicamar.jornadas.consultar', input as Record<string, unknown>)
        onToolResult?.('sicamar_jornadas_consultar', result)
        return result
      }
    }),
    betaTool({
      name: 'sicamar_jornadas_editar',
      description: 'Edita la jornada planificada de un empleado para una fecha específica.',
      inputSchema: {
        type: 'object',
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
      },
      run: async (input) => {
        onToolCall?.('sicamar_jornadas_editar', input)
        const result = await callMcpTool('sicamar.jornadas.editar', input as Record<string, unknown>)
        onToolResult?.('sicamar_jornadas_editar', result)
        return result
      }
    })
  ]
}

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
    
    // Agregar contexto de la semana actual
    let systemPrompt = SYSTEM_PROMPT
    if (context?.fechasSemana && context.fechasSemana.length === 7) {
      const diasNombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
      const fechasConDias = context.fechasSemana.map((f: string, i: number) => `  - ${diasNombres[i]}: ${f}`)
      
      systemPrompt += `

CONTEXTO DE LA PANTALLA ACTUAL:
El usuario está viendo la semana con las siguientes fechas:
${fechasConDias.join('\n')}

Fecha de hoy: ${new Date().toISOString().split('T')[0]}

IMPORTANTE: Cuando el usuario diga "el lunes", "el martes", etc., usá las fechas de arriba. NO preguntes qué fecha es, ya sabés cuál es.`
    }
    
    // Mapear mensajes
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }))
    
    // Stream la respuesta
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    
    // Procesar en background con toolRunner
    ;(async () => {
      try {
        // Crear tools con callbacks para streaming
        const tools = createRunnableTools(
          (name, input) => {
            writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', name, input })}\n\n`))
          },
          (name, result) => {
            try {
              const parsed = JSON.parse(result)
              writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'tool_result', name, result: { success: parsed.success !== false, data: parsed } })}\n\n`))
            } catch {
              writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'tool_result', name, result: { success: true, data: result } })}\n\n`))
            }
          }
        )
        
        // Usar toolRunner con streaming
        const runner = anthropic.beta.messages.toolRunner({
          model: 'claude-opus-4-5-20251101',
          max_tokens: 16000,
          system: systemPrompt,
          messages: anthropicMessages,
          tools,
          stream: true,
        })
        
        // Iterar sobre los message streams
        for await (const messageStream of runner) {
          for await (const event of messageStream) {
            if (event.type === 'content_block_delta') {
              const delta = event.delta
              if ('text' in delta && delta.text) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: delta.text })}\n\n`))
              }
            }
          }
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
