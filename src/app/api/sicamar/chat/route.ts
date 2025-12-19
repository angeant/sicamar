import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import * as jose from 'jose'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

// ============================================================================
// MCP CLIENT
// ============================================================================

async function generateMcpToken(): Promise<string> {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  
  const secretKey = new TextEncoder().encode(secret)
  
  const token = await new jose.SignJWT({
    agent_id: 'sicamar-planificacion-agent',
    mcp: 'sicamar-mcp',
    tools: [
      'sicamar.jornadas.editar',
      'sicamar.jornadas.bulk',
      'sicamar.jornadas.limpiar',
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
      { requestInit: { headers: { Authorization: `Bearer ${token}` } } }
    )
    
    const client = new Client({ name: 'sicamar-planificacion', version: '1.0.0' })
    await client.connect(transport)
    mcpClient = client
    return client
  })()
  
  return mcpConnecting
}

async function callMcpTool(mcpToolName: string, input: Record<string, unknown>): Promise<string> {
  try {
    const client = await getMcpClient()
    const result = await client.callTool({ name: mcpToolName, arguments: input })
    
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
    return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Error calling MCP tool' })
  }
}

// ============================================================================
// SYSTEM PROMPT - Contexto completo de Sicamar
// ============================================================================

const SYSTEM_PROMPT = `<identity>
Sos el asistente de planificación de turnos de Sicamar, una fundición de metales en Argentina.
Tu rol es ayudar a Rocío (RRHH) a gestionar la planificación semanal de jornadas.
</identity>

<contexto_empresa>
Sicamar opera con producción continua 24/7. Hay 4 áreas principales:

<plantas>
  <planta_1 nombre="Fundición Principal" criticidad="máxima">
    Hornos rotativos y basculantes. Es el corazón de la operación.
    Si falta gente acá, se para la producción de metal líquido.
    Opera los 3 turnos (mañana, tarde, noche).
    Dotación mínima: 18 personas por turno. Óptimo: 19.
  </planta_1>
  
  <planta_2 nombre="Procesos Secundarios">
    Satélite de Planta 1. Dinámica propia.
    Generalmente NO hace turno noche (salvo excepciones de demanda).
    Rotación pendular: solo Mañana ↔ Tarde.
  </planta_2>
  
  <mantenimiento>
    Mantiene todo funcionando.
    Rotación cruzada especial para cobertura técnica continua.
    Supervisores (Diale y Franco) se cruzan: si uno está de mañana, el otro de tarde.
  </mantenimiento>
  
  <pañol>
    Soporte de herramientas y EPP.
    Generalmente turno fijo diurno.
  </pañol>
</plantas>
</contexto_empresa>

<turnos>
Los 3 bloques de 8 horas:

<turno_mañana horario="06:00-14:00">
  Lunes a Viernes: 8 horas normales.
  Sábados: 06:00-13:00 (7 horas). A partir de las 13:00 es hora extra al 100%.
</turno_mañana>

<turno_tarde horario="14:00-22:00">
  Lunes a Viernes.
  14:00-21:00 = horas diurnas.
  21:00-22:00 = hora nocturna (+13.33% valor).
</turno_tarde>

<turno_noche horario="22:00-06:00">
  Inicia DOMINGO a las 22:00 (operativamente es inicio de semana lunes).
  Todas las horas son nocturnas (+13.33%).
</turno_noche>
</turnos>

<rotacion>
Sistema de rotación semanal por "Bloques" o "Squads":

<ciclo_estandar plantas="Planta 1">
  Semana A → Noche
  Semana B → Mañana  
  Semana C → Tarde
  (repite)
</ciclo_estandar>

<ciclo_pendular plantas="Planta 2, algunos sectores">
  Solo Mañana ↔ Tarde. No hacen noche.
</ciclo_pendular>

<enroque_mantenimiento>
  Supervisores Diale y Franco se cruzan.
  Nunca se superponen, nunca hacen noche.
</enroque_mantenimiento>
</rotacion>

<dotacion_planta_1>
Para operar a full capacity se necesitan 19 personas + supervisores:

Hornos Rotativos (Fondo): 3 Horneros + 1 Chofer Pala
Hornos Basculantes (Centro): 2 Horneros + 1 Chofer
Colada (MC1 - Crítica):
  - 1 Colador (CRÍTICO - sin él no sale metal)
  - 1 Asistente
  - 2 Operadores Media Esfera/Huevo
  - 2 Operadores Granalla
Logística:
  - 1 Balancero (CRÍTICO - pesa producción, sin él no despachamos)
  - 1 Apilador
  - 2 Operadores Mesa (Zunchado/Embolsado)
Auxiliares: 2 flotantes para relevos

⚠️ ALERTA si hay menos de 18 personas en P1.
</dotacion_planta_1>

<polivalencia>
No cualquiera puede cubrir cualquier puesto.
Existe una matriz de skills (Nivel 1-4).
Para cubrir un puesto crítico, buscar alguien con Nivel 3 o 4 en esa skill.
</polivalencia>

<horas_extra>
<al_50_porciento>
  Lunes a Viernes fuera de horario normal.
  Sábados de 06:00 a 13:00.
</al_50_porciento>

<al_100_porciento>
  Sábado a partir de las 13:00 ("Sábado Inglés").
  Domingos completos.
  Feriados completos.
  + Recargo nocturno si cae entre 21:00-06:00.
</al_100_porciento>

<regla_bloque_30min>
  Se pagan bloques de 30 minutos cumplidos.
  14:00-14:25 = NO cobra extra.
  14:00-14:35 = cobra 30 min.
  Debe estar autorizado por Supervisor.
</regla_bloque_30min>
</horas_extra>

<viandas>
Vianda pagada solo si jornada ≥ 12 horas (8 normales + 4 extras).
Corte del pedido: 08:00 AM.
</viandas>

<calorias_uom>
Operarios de hornos = trabajo insalubre (Art. 66).
Por ley deberían trabajar 6 horas, trabajan 8.
Compensación: 1.5 horas de su valor hora por cada día en sector caliente.
</calorias_uom>

<estados_ausencia>
trabaja, vacaciones, enfermedad, accidente, suspendido, licencia, art, falta
</estados_ausencia>

<comportamiento>
- Sé conciso y directo, como un colega de laburo.
- Español argentino informal pero profesional.
- NO uses emojis ni formateo excesivo.
- Cuando mencionen un empleado por nombre, SIEMPRE buscá primero su legajo.
- Cuando digas día de la semana, usá las fechas del contexto actual.
- Si vas a hacer múltiples operaciones independientes, ejecutá las tools EN PARALELO.
- Mencioná legajo y nombre cuando hables de alguien.
</comportamiento>

<tools_uso>
1. sicamar_empleados_buscar: SIEMPRE primero si mencionan nombre.
2. sicamar_jornadas_consultar: Ver jornadas, filtrar por estado.
3. sicamar_jornadas_editar: Modificar UNA jornada (1 empleado, 1 fecha).
   - Turno rápido: solo "turno" (mañana/tarde/noche)
   - Horario custom: "hora_entrada" + "hora_salida"
   - Ausencia: solo "estado" (vacaciones, enfermedad, etc.)
4. sicamar_jornadas_bulk: PREFERÍ ESTA para operaciones masivas.
   - Múltiples empleados: pasá array de legajos ["245", "332", "118"]
   - Rango de fechas: fecha_desde + fecha_hasta
   - Mismo turno/estado para todos
   - Ejemplos: "equipo de vacaciones", "turno mañana toda la semana", "3 empleados al turno noche L-V"
5. sicamar_jornadas_limpiar: Elimina/limpia jornadas (el empleado queda sin turno asignado).
   - Un empleado, un día: legajos: ["95"], fecha_desde: "2025-12-15"
   - Un empleado, varios días: legajos: ["95"], fecha_desde + fecha_hasta
   - Varios empleados: legajos: ["95", "245", "332"], fecha_desde + fecha_hasta
</tools_uso>`

// ============================================================================
// TOOL DEFINITIONS (para Claude)
// ============================================================================

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'sicamar_empleados_buscar',
    description: 'Busca empleados por nombre o apellido para obtener su legajo. SIEMPRE usá esta tool primero cuando mencionen a alguien por nombre.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nombre, apellido o parte de ellos' },
        solo_activos: { type: 'boolean', description: 'Default true' },
        limit: { type: 'number', description: 'Máximo resultados (default 10)' }
      },
      required: ['query']
    }
  },
  {
    name: 'sicamar_jornadas_consultar',
    description: 'Consulta jornadas planificadas. Puede filtrar por legajo, fechas y estado.',
    input_schema: {
      type: 'object',
      properties: {
        legajo: { type: 'string', description: 'Legajo del empleado (opcional)' },
        fecha_desde: { type: 'string', description: 'YYYY-MM-DD' },
        fecha_hasta: { type: 'string', description: 'YYYY-MM-DD (opcional)' },
        estado: { 
          type: 'string', 
          enum: ['trabaja', 'vacaciones', 'enfermedad', 'accidente', 'suspendido', 'licencia', 'art', 'falta'],
          description: 'Filtrar por estado' 
        }
      },
      required: ['fecha_desde']
    }
  },
  {
    name: 'sicamar_jornadas_editar',
    description: 'Edita la jornada de UN empleado para UNA fecha. Para múltiples empleados o fechas, usá sicamar_jornadas_bulk.',
    input_schema: {
      type: 'object',
      properties: {
        legajo: { type: 'string', description: 'Número de legajo' },
        fecha: { type: 'string', description: 'YYYY-MM-DD' },
        turno: { 
          type: 'string', 
          enum: ['mañana', 'tarde', 'noche'],
          description: 'Turno rápido: mañana (06-14), tarde (14-22), noche (22-06)'
        },
        hora_entrada: { type: 'string', description: 'HH:MM para horario custom' },
        hora_salida: { type: 'string', description: 'HH:MM para horario custom' },
        estado: { 
          type: 'string', 
          enum: ['trabaja', 'vacaciones', 'enfermedad', 'accidente', 'suspendido', 'licencia', 'art', 'falta'],
          description: 'Estado de ausencia (ignora turno y horarios)'
        },
        notas: { type: 'string', description: 'Notas opcionales' }
      },
      required: ['legajo', 'fecha']
    }
  },
  {
    name: 'sicamar_jornadas_bulk',
    description: 'Edita jornadas en MASA para múltiples empleados y/o múltiples fechas en una sola llamada. Ideal para: poner varios empleados de vacaciones, asignar turno a un equipo por toda la semana, cambiar horario de un grupo.',
    input_schema: {
      type: 'object',
      properties: {
        legajos: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Array de legajos a modificar. Ej: ["245", "332", "118"]'
        },
        fecha_desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        fecha_hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD (inclusive)' },
        turno: { 
          type: 'string', 
          enum: ['mañana', 'tarde', 'noche'],
          description: 'Turno rápido para todos'
        },
        hora_entrada: { type: 'string', description: 'HH:MM para horario custom' },
        hora_salida: { type: 'string', description: 'HH:MM para horario custom' },
        estado: { 
          type: 'string', 
          enum: ['trabaja', 'vacaciones', 'enfermedad', 'accidente', 'suspendido', 'licencia', 'art', 'falta'],
          description: 'Estado de ausencia para todos'
        },
        notas: { type: 'string', description: 'Notas opcionales' }
      },
      required: ['legajos', 'fecha_desde', 'fecha_hasta']
    }
  },
  {
    name: 'sicamar_jornadas_limpiar',
    description: 'Elimina/limpia jornadas planificadas. El empleado queda sin turno asignado (vacío/disponible). Ideal para: resetear planificación, liberar a alguien de su turno, borrar asignaciones incorrectas.',
    input_schema: {
      type: 'object',
      properties: {
        legajos: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Array de legajos a limpiar. Ej: ["95"] o ["95", "245", "332"]'
        },
        fecha_desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD (si es solo un día, no pasés fecha_hasta)' },
        fecha_hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD (opcional, para rango de fechas)' }
      },
      required: ['legajos', 'fecha_desde']
    }
  }
]

// Mapeo de tools a MCP
const TOOL_TO_MCP: Record<string, string> = {
  'sicamar_empleados_buscar': 'sicamar.empleados.buscar',
  'sicamar_jornadas_consultar': 'sicamar.jornadas.consultar',
  'sicamar_jornadas_editar': 'sicamar.jornadas.editar',
  'sicamar_jornadas_bulk': 'sicamar.jornadas.bulk',
  'sicamar_jornadas_limpiar': 'sicamar.jornadas.limpiar'
}

// ============================================================================
// API ROUTE
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json()
    
    if (!process.env.ANTHROPIC_CLAUDE_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_CLAUDE_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_CLAUDE_KEY })
    
    // Construir contexto dinámico (va en user message según best practices)
    let userContextPrefix = ''
    if (context?.fechasSemana && context.fechasSemana.length === 7) {
      const diasNombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
      const fechasConDias = context.fechasSemana.map((f: string, i: number) => `${diasNombres[i]}: ${f}`)
      const hoy = new Date().toISOString().split('T')[0]
      
      userContextPrefix = `<contexto_pantalla>
Semana que está viendo el usuario:
${fechasConDias.join('\n')}

Fecha de hoy: ${hoy}
Cuando diga "el lunes", "el martes", etc., usá estas fechas directamente.
</contexto_pantalla>

`
    }
    
    // Preparar mensajes - inyectar contexto en el primer mensaje del usuario
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg: { role: string; content: string }, idx: number) => ({
      role: msg.role as 'user' | 'assistant',
      content: idx === 0 && msg.role === 'user' && userContextPrefix 
        ? userContextPrefix + msg.content 
        : msg.content
    }))
    
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    
    // Agentic loop con streaming
    ;(async () => {
      try {
        let currentMessages = [...anthropicMessages]
        let continueLoop = true
        
        while (continueLoop) {
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16000,
            system: SYSTEM_PROMPT,
            messages: currentMessages,
            tools: TOOLS,
            stream: true,
          })
          
          let currentText = ''
          let currentToolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
          let currentInputJson = ''
          let currentToolId = ''
          let currentToolName = ''
          let stopReason: string | null = null
          
          for await (const event of response) {
            // Content block start - detectar tipo
            if (event.type === 'content_block_start') {
              if (event.content_block.type === 'thinking') {
                // Iniciar bloque de thinking
                await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`))
              } else if (event.content_block.type === 'tool_use') {
                currentToolId = event.content_block.id
                currentToolName = event.content_block.name
                currentInputJson = ''
              }
            }
            
            // Content block delta
            if (event.type === 'content_block_delta') {
              const delta = event.delta
              
              // Thinking delta
              if ('thinking' in delta && delta.thinking) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'thinking', content: delta.thinking })}\n\n`))
              }
              
              // Text delta
              if ('text' in delta && delta.text) {
                currentText += delta.text
                await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: delta.text })}\n\n`))
              }
              
              // Tool input delta (partial JSON)
              if ('partial_json' in delta && delta.partial_json) {
                currentInputJson += delta.partial_json
              }
            }
            
            // Content block stop
            if (event.type === 'content_block_stop') {
              // Si estábamos construyendo una tool call, finalizarla
              if (currentToolName && currentInputJson) {
                try {
                  const input = JSON.parse(currentInputJson) as Record<string, unknown>
                  currentToolUses.push({ id: currentToolId, name: currentToolName, input })
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', name: currentToolName, input })}\n\n`))
                } catch (e) {
                  console.error('Failed to parse tool input:', currentInputJson, e)
                }
                currentToolId = ''
                currentToolName = ''
                currentInputJson = ''
              }
            }
            
            // Message delta - capturar stop reason
            if (event.type === 'message_delta') {
              stopReason = event.delta.stop_reason
            }
          }
          
          // Si hay tool uses, ejecutarlos EN PARALELO y continuar el loop
          if (currentToolUses.length > 0 && stopReason === 'tool_use') {
            // Agregar el assistant message con los tool uses al historial
            currentMessages.push({
              role: 'assistant',
              content: [
                ...(currentText ? [{ type: 'text' as const, text: currentText }] : []),
                ...currentToolUses.map(tu => ({
                  type: 'tool_use' as const,
                  id: tu.id,
                  name: tu.name,
                  input: tu.input
                }))
              ]
            })
            
            // Ejecutar TODAS las tools EN PARALELO
            const toolResults = await Promise.all(
              currentToolUses.map(async (toolUse) => {
                const mcpToolName = TOOL_TO_MCP[toolUse.name]
                if (!mcpToolName) {
                  return { 
                    id: toolUse.id, 
                    name: toolUse.name, 
                    result: JSON.stringify({ success: false, error: 'Unknown tool' }) 
                  }
                }
                
                const result = await callMcpTool(mcpToolName, toolUse.input)
                return { id: toolUse.id, name: toolUse.name, result }
              })
            )
            
            // Enviar resultados al stream
            const toolResultContents: Anthropic.ToolResultBlockParam[] = []
            
            for (const tr of toolResults) {
              let parsed: { success?: boolean }
              try {
                parsed = JSON.parse(tr.result) as { success?: boolean }
              } catch {
                parsed = { success: true }
              }
              
              await writer.write(encoder.encode(`data: ${JSON.stringify({ 
                type: 'tool_result', 
                name: tr.name, 
                result: { success: parsed.success !== false, data: parsed }
              })}\n\n`))
              
              toolResultContents.push({
                type: 'tool_result',
                tool_use_id: tr.id,
                content: tr.result
              })
            }
            
            // Agregar resultados al historial
            currentMessages.push({ role: 'user', content: toolResultContents })
            continueLoop = true
          } else {
            // No hay más tool calls, terminamos
            continueLoop = false
          }
        }
        
        await writer.write(encoder.encode('data: [DONE]\n\n'))
      } catch (error) {
        console.error('Stream error:', error)
        await writer.write(encoder.encode(`data: ${JSON.stringify({ 
          type: 'error', 
          message: error instanceof Error ? error.message : 'Unknown error' 
        })}\n\n`))
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
