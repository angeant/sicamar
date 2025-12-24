import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import * as jose from 'jose'
import { supabaseServer } from '@/lib/supabase-server'

// ============================================================================
// MCP CLIENT - REST endpoint (stateless, Cloud Run compatible)
// ============================================================================

async function generateMcpToken(): Promise<string> {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  
  const secretKey = new TextEncoder().encode(secret)
  
  const token = await new jose.SignJWT({
    agent_id: 'sicamar-planificacion-agent',
    mcp: 'sicamar-mcp',
    tools: [
      'sicamar.planning.editar',
      'sicamar.planning.consultar',
      'sicamar.planning.bulk',
      'sicamar.planning.limpiar',
      'sicamar.empleados.buscar'
    ],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secretKey)
  
  return token
}

/**
 * Calls MCP tool via REST endpoint /tools/call
 * This is stateless and works perfectly with Cloud Run (no SSE issues)
 */
async function callMcpTool(mcpToolName: string, input: Record<string, unknown>): Promise<string> {
  try {
    const baseUrl = process.env.MCP_BASE_URL
    if (!baseUrl) throw new Error('MCP_BASE_URL not configured')
    
    const token = await generateMcpToken()
    
    const response = await fetch(`${baseUrl}/tools/call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        tool: mcpToolName, 
        input 
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('MCP REST error:', response.status, errorText)
      return JSON.stringify({ 
        success: false, 
        error: `MCP error ${response.status}: ${errorText}` 
      })
    }
    
    const result = await response.json()
    
    // El endpoint REST devuelve directamente el resultado
    // Si tiene content array (formato MCP), extraer el texto
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c: { type: string }) => c.type === 'text')
      if (textContent && 'text' in textContent) {
        return textContent.text as string
      }
    }
    
    // Si ya es el resultado directo, devolverlo como JSON string
    return typeof result === 'string' ? result : JSON.stringify(result)
    
  } catch (error) {
    console.error('MCP tool error:', error)
    return JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error calling MCP tool' 
    })
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

<estructura_datos>
Cada planificación tiene:
- employee_id: ID del empleado
- operational_date: Fecha de SALIDA (fecha contable)
- status: WORKING, ABSENT, REST
- absence_reason: SICK, VACATION, ACCIDENT, LICENSE, SUSPENDED, ART, ABSENT_UNJUSTIFIED (solo si status=ABSENT)
- normal_entry_at: Datetime de entrada normal (ej: "2025-12-20 06:00")
- normal_exit_at: Datetime de salida normal (ej: "2025-12-20 14:00")
- extra_entry_at: Si entra ANTES de lo normal (horas extra)
- extra_exit_at: Si sale DESPUÉS de lo normal (horas extra)

IMPORTANTE: Para turnos nocturnos (22:00-06:00), normal_entry_at es del día ANTERIOR.
Ejemplo turno noche del martes 20: 
  operational_date: "2025-12-20"
  normal_entry_at: "2025-12-19 22:00" (lunes noche)
  normal_exit_at: "2025-12-20 06:00" (martes mañana)
</estructura_datos>

<comportamiento>
- Sé conciso y directo, como un colega de laburo.
- Español argentino informal pero profesional.
- NO uses emojis ni formateo excesivo.
- Cuando mencionen un empleado por nombre, SIEMPRE buscá primero su legajo.
- Cuando digas día de la semana, usá las fechas del contexto actual.
- Mencioná legajo y nombre cuando hables de alguien.
</comportamiento>

<parallel_tool_calls>
CRÍTICO: Cuando el usuario mencione MÚLTIPLES empleados o pida hacer MÚLTIPLES operaciones:
- LLAMÁ TODAS las tools necesarias EN UNA SOLA RESPUESTA, no una por una.
- Ejemplo: Si dicen "poné a García, López y Pérez de mañana", llamá sicamar_empleados_buscar 3 veces EN PARALELO en la misma respuesta.
- Después de buscar, usá sicamar_planning_bulk para todos juntos, O llamá sicamar_planning_editar para CADA empleado EN PARALELO.
- NUNCA hagas una búsqueda, esperá respuesta, y luego otra búsqueda. Hacé TODAS juntas.

Ejemplo correcto:
Usuario: "Poné a García, López y Pérez turno mañana mañana"
Tu respuesta: [tool_use: sicamar_empleados_buscar "García"], [tool_use: sicamar_empleados_buscar "López"], [tool_use: sicamar_empleados_buscar "Pérez"]
(Todo en una sola respuesta, no 3 respuestas separadas)
</parallel_tool_calls>

<tools_uso>
1. sicamar_empleados_buscar: SIEMPRE primero si mencionan nombre.
2. sicamar_planning_consultar: Ver planificaciones, filtrar por status/absence_reason.
3. sicamar_planning_editar: Modificar UNA planificación (1 empleado, 1 fecha). HACE UPSERT AUTOMÁTICO.
   - status: WORKING, ABSENT, REST
   - Para WORKING: turno (mañana/tarde/noche) O normal_entry_at + normal_exit_at
   - Para ABSENT: absence_reason (SICK, VACATION, ACCIDENT, LICENSE, SUSPENDED, ART, ABSENT_UNJUSTIFIED)
   - Para REST: solo status
   - Para HORAS EXTRA: usá extra_entry_at (si entra antes) o extra_exit_at (si sale después)
4. sicamar_planning_bulk: PREFERÍ ESTA para operaciones masivas.
   - Múltiples empleados: pasá array de legajos ["245", "332", "118"]
   - Rango de fechas: fecha_desde + fecha_hasta
   - Mismo status/turno para todos
5. sicamar_planning_limpiar: SOLO para eliminar/vaciar planificaciones. NO uses para modificar.
</tools_uso>

<horas_extra_importante>
PARA AGREGAR HORAS EXTRA a un turno existente, usá sicamar_planning_editar con:
- Los campos normal_entry_at y normal_exit_at para el horario BASE del turno
- extra_exit_at si sale DESPUÉS del turno normal
- extra_entry_at si entra ANTES del turno normal

EJEMPLO - Turno mañana con 4 horas extra (sale 18:00 en vez de 14:00):
{
  "legajo": "361",
  "operational_date": "2025-12-24",
  "status": "WORKING",
  "normal_entry_at": "2025-12-24 06:00",
  "normal_exit_at": "2025-12-24 14:00",
  "extra_exit_at": "2025-12-24 18:00"
}

⚠️ NUNCA uses sicamar_planning_limpiar para modificar un registro.
   Limpiar BORRA los datos. Para modificar, usá sicamar_planning_editar que hace upsert automático.
</horas_extra_importante>`

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
    name: 'sicamar_planning_consultar',
    description: 'Consulta planificaciones. Puede filtrar por legajo, fechas, status y razón de ausencia.',
    input_schema: {
      type: 'object',
      properties: {
        legajo: { type: 'string', description: 'Legajo del empleado (opcional)' },
        fecha_desde: { type: 'string', description: 'YYYY-MM-DD' },
        fecha_hasta: { type: 'string', description: 'YYYY-MM-DD (opcional)' },
        status: { 
          type: 'string', 
          enum: ['WORKING', 'ABSENT', 'REST'],
          description: 'Filtrar por status' 
        },
        absence_reason: {
          type: 'string',
          enum: ['SICK', 'VACATION', 'ACCIDENT', 'LICENSE', 'SUSPENDED', 'ART', 'ABSENT_UNJUSTIFIED'],
          description: 'Filtrar por razón de ausencia (solo si status=ABSENT)'
        }
      },
      required: ['fecha_desde']
    }
  },
  {
    name: 'sicamar_planning_editar',
    description: 'Edita la planificación de UN empleado para UNA fecha. Hace UPSERT automático (crea o modifica). Para múltiples empleados o fechas, usá sicamar_planning_bulk.',
    input_schema: {
      type: 'object',
      properties: {
        legajo: { type: 'string', description: 'Número de legajo' },
        operational_date: { type: 'string', description: 'Fecha operativa YYYY-MM-DD (fecha de SALIDA para turnos nocturnos)' },
        status: { 
          type: 'string', 
          enum: ['WORKING', 'ABSENT', 'REST'],
          description: 'Estado del empleado para ese día'
        },
        turno: { 
          type: 'string', 
          enum: ['mañana', 'tarde', 'noche'],
          description: 'Turno rápido (solo si status=WORKING): mañana (06-14), tarde (14-22), noche (22-06)'
        },
        normal_entry_at: { type: 'string', description: 'DATETIME de entrada normal: "YYYY-MM-DD HH:MM" (ej: "2025-12-24 06:00")' },
        normal_exit_at: { type: 'string', description: 'DATETIME de salida normal: "YYYY-MM-DD HH:MM" (ej: "2025-12-24 14:00")' },
        extra_entry_at: { type: 'string', description: 'DATETIME si entra ANTES del turno normal (horas extra antes). Ej: "2025-12-24 04:00"' },
        extra_exit_at: { type: 'string', description: 'DATETIME si sale DESPUÉS del turno normal (horas extra después). Ej: "2025-12-24 18:00"' },
        absence_reason: { 
          type: 'string', 
          enum: ['SICK', 'VACATION', 'ACCIDENT', 'LICENSE', 'SUSPENDED', 'ART', 'ABSENT_UNJUSTIFIED'],
          description: 'Razón de ausencia (solo si status=ABSENT)'
        },
        notas: { type: 'string', description: 'Notas opcionales' }
      },
      required: ['legajo', 'operational_date', 'status']
    }
  },
  {
    name: 'sicamar_planning_bulk',
    description: 'Edita planificaciones en MASA para múltiples empleados y/o múltiples fechas en una sola llamada. Ideal para: poner varios empleados de vacaciones, asignar turno a un equipo por toda la semana, cambiar horario de un grupo.',
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
        status: { 
          type: 'string', 
          enum: ['WORKING', 'ABSENT', 'REST'],
          description: 'Estado para todos'
        },
        turno: { 
          type: 'string', 
          enum: ['mañana', 'tarde', 'noche'],
          description: 'Turno rápido para todos (solo si status=WORKING)'
        },
        hora_entrada: { type: 'string', description: 'HH:MM para horario custom' },
        hora_salida: { type: 'string', description: 'HH:MM para horario custom' },
        absence_reason: { 
          type: 'string', 
          enum: ['SICK', 'VACATION', 'ACCIDENT', 'LICENSE', 'SUSPENDED', 'ART', 'ABSENT_UNJUSTIFIED'],
          description: 'Razón de ausencia para todos (solo si status=ABSENT)'
        },
        notas: { type: 'string', description: 'Notas opcionales' }
      },
      required: ['legajos', 'fecha_desde', 'fecha_hasta', 'status']
    }
  },
  {
    name: 'sicamar_planning_limpiar',
    description: 'Elimina planificaciones. El empleado queda sin nada asignado para esa fecha (vacío/disponible). Ideal para: resetear planificación, liberar a alguien de su asignación, borrar asignaciones incorrectas.',
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
  'sicamar_planning_consultar': 'sicamar.planning.consultar',
  'sicamar_planning_editar': 'sicamar.planning.editar',
  'sicamar_planning_bulk': 'sicamar.planning.bulk',
  'sicamar_planning_limpiar': 'sicamar.planning.limpiar'
}

// ============================================================================
// API ROUTE
// ============================================================================

// ============================================================================
// CONVERSATION PERSISTENCE
// ============================================================================

const AGENT_NAME = 'Agente de Planificación - Web'

async function getOrCreateConversation(conversationId: string | null, userEmail?: string): Promise<string> {
  // 1. Si hay un conversation_id válido, verificar que existe Y PERTENECE AL USUARIO
  if (conversationId && userEmail) {
    const { data: existing } = await supabaseServer
      .schema('sicamar')
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_email', userEmail)  // ✅ Verificar que pertenece al usuario
      .single()
    
    if (existing) {
      // Update last_message_at
      await supabaseServer
        .schema('sicamar')
        .from('conversations')
        .update({ 
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)
      
      return conversationId
    }
  }
  
  // 2. Si hay email, buscar la última conversación del usuario para ESTE agente
  if (userEmail) {
    const { data: lastConv } = await supabaseServer
      .schema('sicamar')
      .from('conversations')
      .select('id')
      .eq('user_email', userEmail)
      .eq('agent_name', AGENT_NAME)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .single()
    
    if (lastConv) {
      // Update last_message_at y retornar
      await supabaseServer
        .schema('sicamar')
        .from('conversations')
        .update({ 
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', lastConv.id)
      
      return lastConv.id
    }
  }
  
  // 3. Crear nueva conversación
  const { data: newConv, error } = await supabaseServer
    .schema('sicamar')
    .from('conversations')
    .insert({
      session_id: userEmail || `anon_${Date.now()}`, // Usar email como session_id para mejor tracking
      user_email: userEmail || null,
      agent_name: AGENT_NAME,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString()
    })
    .select('id')
    .single()
  
  if (error || !newConv) {
    console.error('Error creating conversation:', error)
    throw new Error('Failed to create conversation')
  }
  
  return newConv.id
}

interface MessageMetadata {
  request_payload?: {
    model: string
    messages_count: number
    messages_preview: Array<{ role: string; content_length: number }>
    tools_count: number
    system_prompt_length: number
    timestamp?: string
  }
  response_info?: {
    stop_reason: string | null
    tool_calls_count: number
    text_length: number
  }
}

async function saveMessage(
  conversationId: string, 
  role: 'user' | 'assistant', 
  content: string, 
  toolCalls?: Array<{ name: string; input: unknown; result?: unknown }>,
  metadata?: MessageMetadata
) {
  const { error } = await supabaseServer
    .schema('sicamar')
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : null,
      metadata: metadata || null,
      created_at: new Date().toISOString()
    })
  
  if (error) {
    console.error('Error saving message:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { messages, context, conversation_id, user_email } = await request.json()
    
    if (!process.env.ANTHROPIC_CLAUDE_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_CLAUDE_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (!process.env.CLAUDE_MODEL) {
      return new Response(JSON.stringify({ error: 'CLAUDE_MODEL not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_CLAUDE_KEY })
    
    // Get or create conversation for persistence (prioriza email del usuario)
    let activeConversationId: string | null = null
    
    try {
      activeConversationId = await getOrCreateConversation(conversation_id, user_email)
    } catch (e) {
      console.error('Failed to get/create conversation:', e)
      // Continue without persistence - don't block the chat
    }
    
    // Save the user message
    const lastUserMessage = messages[messages.length - 1]
    if (activeConversationId && lastUserMessage?.role === 'user') {
      await saveMessage(activeConversationId, 'user', lastUserMessage.content)
    }
    
    // Construir contexto dinámico con calendario claro
    let userContextPrefix = ''
    
    // Fecha actual con timezone de Argentina
    const hoy = new Date()
    const hoyStr = hoy.toISOString().split('T')[0]
    const añoActual = hoy.getFullYear()
    const mesActual = hoy.getMonth() + 1
    const diaActual = hoy.getDate()
    
    // Nombres de días (getDay: 0=Domingo, 1=Lunes, ... 6=Sábado)
    const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const nombreDiaHoy = DIAS_SEMANA[hoy.getDay()]
    
    // Helper para obtener nombre del día de una fecha string YYYY-MM-DD
    const getNombreDia = (fechaStr: string): string => {
      const fecha = new Date(fechaStr + 'T12:00:00') // Mediodía para evitar problemas de timezone
      return DIAS_SEMANA[fecha.getDay()]
    }
    
    // Calcular el lunes de la semana actual
    const lunesActual = new Date(hoy)
    const diaSemana = lunesActual.getDay()
    const diff = diaSemana === 0 ? -6 : 1 - diaSemana
    lunesActual.setDate(lunesActual.getDate() + diff)
    const lunesActualStr = lunesActual.toISOString().split('T')[0]
    
    // Calcular domingo de la semana actual
    const domingoActual = new Date(lunesActual)
    domingoActual.setDate(domingoActual.getDate() + 6)
    const domingoActualStr = domingoActual.toISOString().split('T')[0]
    
    // Calcular el lunes y domingo de la semana siguiente
    const lunesSiguiente = new Date(lunesActual)
    lunesSiguiente.setDate(lunesSiguiente.getDate() + 7)
    const lunesSiguienteStr = lunesSiguiente.toISOString().split('T')[0]
    const domingoSiguiente = new Date(lunesSiguiente)
    domingoSiguiente.setDate(domingoSiguiente.getDate() + 6)
    const domingoSiguienteStr = domingoSiguiente.toISOString().split('T')[0]
    
    // Generar calendario de las próximas 2 semanas con días explícitos
    const generarCalendarioSemana = (lunesStr: string): string => {
      const lunes = new Date(lunesStr + 'T12:00:00')
      const lineas: string[] = []
      for (let i = 0; i < 7; i++) {
        const fecha = new Date(lunes)
        fecha.setDate(fecha.getDate() + i)
        const fechaStr = fecha.toISOString().split('T')[0]
        const nombreDia = DIAS_SEMANA[fecha.getDay()]
        const dd = fecha.getDate()
        const mm = fecha.getMonth() + 1
        lineas.push(`  ${nombreDia.padEnd(10)} = ${fechaStr} (${dd}/${mm})`)
      }
      return lineas.join('\n')
    }
    
    if (context?.fechasSemana && context.fechasSemana.length >= 7) {
      // Mapear cada fecha de la semana visible con su día de la semana REAL
      const fechasConDiasReales = context.fechasSemana.slice(0, 7).map((f: string) => {
        const nombreDia = getNombreDia(f)
        const fecha = new Date(f + 'T12:00:00')
        const dd = fecha.getDate()
        const mm = fecha.getMonth() + 1
        return `  ${nombreDia.padEnd(10)} = ${f} (${dd}/${mm})`
      })
      
      // Determinar qué semana está viendo el usuario respecto a hoy
      const primerDiaVista = context.fechasSemana[0]
      let descripcionSemana = 'la semana visible en pantalla'
      
      if (primerDiaVista === lunesActualStr) {
        descripcionSemana = 'SEMANA ACTUAL (esta semana)'
      } else if (primerDiaVista === lunesSiguienteStr) {
        descripcionSemana = 'SEMANA SIGUIENTE (la próxima)'
      } else if (primerDiaVista < lunesActualStr) {
        descripcionSemana = 'UNA SEMANA PASADA'
      } else {
        descripcionSemana = 'UNA SEMANA FUTURA'
      }
      
      userContextPrefix = `<calendario>
═══════════════════════════════════════════════════════════════
HOY ES: ${nombreDiaHoy} ${diaActual} de ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][mesActual-1]} de ${añoActual}
FECHA ISO: ${hoyStr}
AÑO ACTUAL: ${añoActual}
═══════════════════════════════════════════════════════════════

SEMANA ACTUAL (donde cae hoy):
${generarCalendarioSemana(lunesActualStr)}

SEMANA SIGUIENTE:
${generarCalendarioSemana(lunesSiguienteStr)}

SEMANA EN PANTALLA (${descripcionSemana}):
${fechasConDiasReales.join('\n')}

⚠️ IMPORTANTE - MAPEO FECHA ↔ DÍA:
Cuando el usuario diga "el miércoles", verificá en el calendario de arriba qué FECHA corresponde.
- Si dice "el miércoles de la semana que viene" → buscá en SEMANA SIGUIENTE
- Si dice "este miércoles" → buscá en SEMANA ACTUAL
- Si dice "el miércoles" sin contexto → asumí SEMANA ACTUAL

NUNCA inventes fechas. SIEMPRE usá las fechas exactas del calendario de arriba.
</calendario>

`
    } else {
      // Sin fechas de semana en el contexto, dar calendario completo
      userContextPrefix = `<calendario>
═══════════════════════════════════════════════════════════════
HOY ES: ${nombreDiaHoy} ${diaActual} de ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][mesActual-1]} de ${añoActual}
FECHA ISO: ${hoyStr}
AÑO ACTUAL: ${añoActual}
═══════════════════════════════════════════════════════════════

SEMANA ACTUAL (${lunesActualStr} a ${domingoActualStr}):
${generarCalendarioSemana(lunesActualStr)}

SEMANA SIGUIENTE (${lunesSiguienteStr} a ${domingoSiguienteStr}):
${generarCalendarioSemana(lunesSiguienteStr)}

⚠️ IMPORTANTE - MAPEO FECHA ↔ DÍA:
Cuando el usuario diga "el miércoles", verificá en el calendario de arriba qué FECHA corresponde.
NUNCA inventes fechas. SIEMPRE usá las fechas exactas del calendario de arriba.
</calendario>

`
    }
    
    // Agregar contexto de selección si existe
    if (context?.seleccion && context.seleccion.legajos?.length > 0) {
      const sel = context.seleccion
      const legajosStr = sel.legajos.join(', ')
      const nombresStr = sel.nombres.join('; ')
      const fechasStr = sel.fechas.join(', ')
      
      userContextPrefix += `<seleccion_usuario>
El usuario ha seleccionado celdas específicas en la tabla de planificación.
APLICÁ LA ACCIÓN QUE PIDA A ESTA SELECCIÓN:

LEGAJOS: [${legajosStr}]
NOMBRES: ${nombresStr}
FECHAS: [${fechasStr}]

INSTRUCCIÓN: Usá estos legajos y fechas directamente en las tools. 
Si dice "turno tarde" o "vacaciones" sin más contexto, aplicalo a TODA la selección usando sicamar_planning_bulk.
</seleccion_usuario>

`
    }
    
    // Preparar mensajes - limitar contexto para evitar que Claude "olvide" las tools
    // Con conversaciones muy largas, Claude pierde contexto de que tiene tools disponibles
    const MAX_MESSAGES = 20  // Últimos 20 mensajes (~10 intercambios user/assistant)
    
    const recentMessages = messages.slice(-MAX_MESSAGES)
    
    // Si hay historial previo, agregar un resumen al principio
    const historyNote = messages.length > MAX_MESSAGES 
      ? `[Nota: Esta conversación tiene ${messages.length} mensajes. Mostrando los últimos ${MAX_MESSAGES}. Tenés herramientas para buscar empleados, consultar/editar planificación, y hacer operaciones masivas.]`
      : null
    
    // Inyectar contexto en el ÚLTIMO mensaje del usuario
    // Así siempre tiene el contexto temporal actualizado aunque cambie la semana en pantalla
    const lastUserIdx = recentMessages.map((m: { role: string }) => m.role).lastIndexOf('user')
    const anthropicMessages: Anthropic.MessageParam[] = recentMessages.map((msg: { role: string; content: string }, idx: number) => {
      let content = msg.content
      
      // En el primer mensaje, agregar nota de historial si corresponde
      if (historyNote && idx === 0 && msg.role === 'user') {
        content = `${historyNote}\n\n${content}`
      }
      
      // En el último mensaje del usuario, agregar contexto temporal
      if (idx === lastUserIdx && msg.role === 'user' && userContextPrefix) {
        content = userContextPrefix + content
      }
      
      return {
        role: msg.role as 'user' | 'assistant',
        content
      }
    })
    
    console.error(`[CHAT-PLANNING] Prepared ${anthropicMessages.length} messages (from ${messages.length} total)`)
    
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    
    // Send conversation_id to client first (so it can maintain persistence)
    const sendConversationId = activeConversationId 
      ? `data: ${JSON.stringify({ type: 'conversation_id', id: activeConversationId })}\n\n`
      : ''
    
    // Track final response for persistence
    let finalAssistantText = ''
    let finalToolCalls: Array<{ name: string; input: unknown; result?: unknown }> = []
    let lastStopReason: string | null = null
    
    // Agentic loop con streaming
    ;(async () => {
      try {
        // Send conversation_id first
        if (sendConversationId) {
          await writer.write(encoder.encode(sendConversationId))
        }
        
        let currentMessages = [...anthropicMessages]
        let continueLoop = true
        
        // Capturar info del request para debugging
        const requestPayloadInfo = {
          model: process.env.CLAUDE_MODEL!,
          messages_count: currentMessages.length,
          messages_preview: currentMessages.map(m => ({ 
            role: m.role, 
            content_length: typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length 
          })),
          tools_count: TOOLS.length,
          system_prompt_length: SYSTEM_PROMPT.length,
          timestamp: new Date().toISOString()
        }
        
        console.error('[CHAT-PLANNING] Request payload:', JSON.stringify(requestPayloadInfo))
        
        while (continueLoop) {
          const response = await anthropic.messages.create({
            model: process.env.CLAUDE_MODEL!,
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
                finalAssistantText += delta.text
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
              lastStopReason = stopReason  // Track for metadata
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
              
              // Track tool calls for persistence
              finalToolCalls.push({
                name: tr.name,
                input: currentToolUses.find(t => t.id === tr.id)?.input,
                result: parsed
              })
              
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
        
        // Save assistant message to database with debugging metadata
        if (activeConversationId && finalAssistantText) {
          await saveMessage(
            activeConversationId, 
            'assistant', 
            finalAssistantText, 
            finalToolCalls.length > 0 ? finalToolCalls : undefined,
            {
              request_payload: requestPayloadInfo,
              response_info: {
                stop_reason: lastStopReason,
                tool_calls_count: finalToolCalls.length,
                text_length: finalAssistantText.length
              }
            }
          )
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
