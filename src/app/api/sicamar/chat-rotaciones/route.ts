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
    agent_id: 'sicamar-rotaciones-agent',
    mcp: 'sicamar-mcp',
    tools: [
      'sicamar.empleados.buscar',
      'sicamar.rotaciones.listar',
      'sicamar.rotaciones.crear',
      'sicamar.rotaciones.editar',
      'sicamar.rotaciones.eliminar',
      'sicamar.rotaciones.empleados',
      'sicamar.rotacion.asignar',
      'sicamar.rotacion.quitar'
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
 */
async function callMcpTool(mcpToolName: string, input: Record<string, unknown>): Promise<string> {
  try {
    const baseUrl = process.env.MCP_BASE_URL
    if (!baseUrl) throw new Error('MCP_BASE_URL not configured')
    
    console.error(`[MCP] Calling tool: ${mcpToolName}`, JSON.stringify(input))
    
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
      console.error('[MCP] REST error:', response.status, errorText)
      return JSON.stringify({ 
        success: false, 
        error: `MCP error ${response.status}: ${errorText}` 
      })
    }
    
    const result = await response.json()
    console.error(`[MCP] Tool ${mcpToolName} result:`, JSON.stringify(result).slice(0, 500))
    
    // El endpoint REST devuelve directamente el resultado
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c: { type: string }) => c.type === 'text')
      if (textContent && 'text' in textContent) {
        return textContent.text as string
      }
    }
    
    return typeof result === 'string' ? result : JSON.stringify(result)
    
  } catch (error) {
    console.error('[MCP] Tool error:', error)
    return JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error calling MCP tool' 
    })
  }
}

// ============================================================================
// SYSTEM PROMPT - Contexto de Rotaciones
// ============================================================================

const SYSTEM_PROMPT = `<identity>
Sos el asistente de gestión de rotaciones de Sicamar, una fundición de metales en Argentina.
Tu rol es ayudar a gestionar las asignaciones de rotaciones de los empleados.
</identity>

<contexto_rotaciones>
Sicamar asigna a cada empleado UNA rotación que define:
1. Los turnos que rota (mañana, tarde, noche, u otros horarios custom)
2. El horario de entrada/salida de cada turno
3. La frecuencia de rotación (semanal, quincenal, etc.)
4. Notas/excepciones que el sistema de planificación debe considerar

<estructura_rotacion>
Una rotación tiene:
- nombre: Nombre descriptivo (ej: "3 Turnos Estándar")
- turnos: Array de turnos, cada uno con {nombre, entrada, salida}
  Ejemplos: [
    {nombre: "Mañana", entrada: "06:00", salida: "14:00"},
    {nombre: "Tarde", entrada: "14:00", salida: "22:00"},
    {nombre: "Noche", entrada: "22:00", salida: "06:00"}
  ]
- frecuencia_semanas: Cada cuántas semanas rota (1=semanal, 2=quincenal)
- notas: Excepciones y reglas especiales (para el LLM de planificación)
</estructura_rotacion>

<tipos_rotacion>
- 3T (3 Turnos): Mañana → Tarde → Noche, rotando cada semana
- 2T (2 Turnos): Mañana ↔ Tarde, sin turno noche
- Fijo: Un solo turno, siempre el mismo horario
</tipos_rotacion>

<comportamiento>
- Sé conciso y directo, como un colega de laburo.
- Español argentino informal pero profesional.
- NO uses emojis ni formateo excesivo.
- Cuando mencionen un empleado por nombre, SIEMPRE buscá primero su legajo.
- Mencioná legajo y nombre cuando hables de alguien.
- Si vas a hacer múltiples operaciones independientes, ejecutá las tools EN PARALELO.
- SIEMPRE respondé con texto DESPUÉS de usar tools. Nunca termines sin una respuesta.
- Si el usuario pregunta por "rotaciones disponibles" o "qué rotaciones hay", usá sicamar_rotaciones_listar.
- Si pregunta por "empleados con rotación X" o "quién tiene tal rotación", usá sicamar_rotaciones_empleados.
</comportamiento>

<tools_uso>
1. sicamar_empleados_buscar: SIEMPRE primero si mencionan nombre.

Catálogo de rotaciones:
2. sicamar_rotaciones_listar: Ver todas las rotaciones del catálogo.
3. sicamar_rotaciones_crear: Crear nueva rotación.
4. sicamar_rotaciones_editar: Modificar rotación existente.
5. sicamar_rotaciones_eliminar: Eliminar rotación (soft delete).

Asignación empleados:
6. sicamar_rotaciones_empleados: Ver empleados con sus rotaciones.
7. sicamar_rotacion_asignar: Asignar rotación a un empleado.
8. sicamar_rotacion_quitar: Quitar rotación de un empleado.
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
        solo_activos: { type: 'boolean', description: 'Solo empleados activos. Default true' },
        limit: { type: 'number', description: 'Máximo resultados (default 10)' }
      },
      required: ['query']
    }
  },
  // ========== Catálogo de Rotaciones ==========
  {
    name: 'sicamar_rotaciones_listar',
    description: 'Lista todas las rotaciones del catálogo. Muestra id, nombre, turnos con horarios, frecuencia y notas. Usá esta tool cuando pregunten "qué rotaciones hay" o "rotaciones disponibles".',
    input_schema: {
      type: 'object',
      properties: {
        activo: { type: 'boolean', description: 'Filtrar por activas (true) o inactivas (false). Default: solo activas.' }
      },
      required: []
    }
  },
  {
    name: 'sicamar_rotaciones_crear',
    description: 'Crea una nueva rotación en el catálogo.',
    input_schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre de la rotación (ej: "3 Turnos Estándar")' },
        turnos: { 
          type: 'array', 
          description: 'Array de turnos: [{nombre, entrada, salida}, ...]',
          items: {
            type: 'object',
            properties: {
              nombre: { type: 'string', description: 'Nombre del turno (Mañana, Tarde, Noche, etc.)' },
              entrada: { type: 'string', description: 'Hora de entrada (HH:MM)' },
              salida: { type: 'string', description: 'Hora de salida (HH:MM)' }
            },
            required: ['nombre', 'entrada', 'salida']
          }
        },
        frecuencia_semanas: { type: 'number', description: 'Cada cuántas semanas rota (1=semanal, 2=quincenal). Default 1.' },
        notas: { type: 'string', description: 'Notas/excepciones para el LLM de planificación' }
      },
      required: ['nombre', 'turnos']
    }
  },
  {
    name: 'sicamar_rotaciones_editar',
    description: 'Modifica una rotación existente. Solo pasá los campos que querés cambiar.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'ID de la rotación a editar' },
        nombre: { type: 'string', description: 'Nuevo nombre' },
        turnos: { 
          type: 'array', 
          description: 'Nuevos turnos [{nombre, entrada, salida}, ...]',
          items: {
            type: 'object',
            properties: {
              nombre: { type: 'string' },
              entrada: { type: 'string' },
              salida: { type: 'string' }
            }
          }
        },
        frecuencia_semanas: { type: 'number', description: 'Nueva frecuencia en semanas' },
        notas: { type: 'string', description: 'Nuevas notas' },
        activo: { type: 'boolean', description: 'Activar/desactivar' }
      },
      required: ['id']
    }
  },
  {
    name: 'sicamar_rotaciones_eliminar',
    description: 'Desactiva una rotación (soft delete). Los empleados con esta rotación quedan sin asignar.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'ID de la rotación a eliminar' }
      },
      required: ['id']
    }
  },
  // ========== Asignación Empleados ==========
  {
    name: 'sicamar_rotaciones_empleados',
    description: 'Lista empleados con sus rotaciones asignadas. Usá esta tool cuando pregunten "quién tiene X rotación" o "empleados sin rotación".',
    input_schema: {
      type: 'object',
      properties: {
        legajo: { type: 'string', description: 'Buscar por legajo específico' },
        sector: { type: 'string', description: 'Filtrar por sector' },
        rotacion_id: { type: 'number', description: 'Filtrar por rotación específica (ID)' },
        sin_rotacion: { type: 'boolean', description: 'true = solo empleados SIN rotación asignada' },
        limit: { type: 'number', description: 'Máximo de resultados (default 50)' }
      },
      required: []
    }
  },
  {
    name: 'sicamar_rotacion_asignar',
    description: 'Asigna una rotación a un empleado. Cierra la asignación anterior automáticamente.',
    input_schema: {
      type: 'object',
      properties: {
        legajo: { type: 'string', description: 'Legajo del empleado' },
        rotacion_id: { type: 'number', description: 'ID de la rotación a asignar' },
        fecha_desde: { type: 'string', description: 'Fecha desde (YYYY-MM-DD). Default: hoy' }
      },
      required: ['legajo', 'rotacion_id']
    }
  },
  {
    name: 'sicamar_rotacion_quitar',
    description: 'Quita la rotación asignada a un empleado (lo deja sin rotación).',
    input_schema: {
      type: 'object',
      properties: {
        legajo: { type: 'string', description: 'Legajo del empleado' },
        fecha_hasta: { type: 'string', description: 'Fecha hasta (YYYY-MM-DD). Default: hoy' }
      },
      required: ['legajo']
    }
  }
]

// Mapeo de tools a MCP
const TOOL_TO_MCP: Record<string, string> = {
  'sicamar_empleados_buscar': 'sicamar.empleados.buscar',
  // Catálogo de rotaciones
  'sicamar_rotaciones_listar': 'sicamar.rotaciones.listar',
  'sicamar_rotaciones_crear': 'sicamar.rotaciones.crear',
  'sicamar_rotaciones_editar': 'sicamar.rotaciones.editar',
  'sicamar_rotaciones_eliminar': 'sicamar.rotaciones.eliminar',
  // Asignación empleados
  'sicamar_rotaciones_empleados': 'sicamar.rotaciones.empleados',
  'sicamar_rotacion_asignar': 'sicamar.rotacion.asignar',
  'sicamar_rotacion_quitar': 'sicamar.rotacion.quitar'
}

// ============================================================================
// CONVERSATION PERSISTENCE
// ============================================================================

const AGENT_NAME = 'Agente de Rotaciones - Web'

async function getOrCreateConversation(conversationId: string | null, userEmail?: string): Promise<string> {
  // 1. Si hay un conversation_id válido, verificar que existe y usarlo
  if (conversationId) {
    const { data: existing } = await supabaseServer
      .schema('sicamar')
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .single()
    
    if (existing) {
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
      session_id: userEmail || `anon_${Date.now()}`,
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

async function saveMessage(conversationId: string, role: 'user' | 'assistant', content: string, toolCalls?: Array<{ name: string; input: unknown; result?: unknown }>) {
  const { error } = await supabaseServer
    .schema('sicamar')
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : null,
      created_at: new Date().toISOString()
    })
  
  if (error) {
    console.error('Error saving message:', error)
  }
}

// ============================================================================
// API ROUTE
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { messages, conversation_id, user_email } = await request.json()
    
    if (!process.env.ANTHROPIC_CLAUDE_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_CLAUDE_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_CLAUDE_KEY })
    
    // Get or create conversation for persistence
    let activeConversationId: string | null = null
    
    try {
      activeConversationId = await getOrCreateConversation(conversation_id, user_email)
    } catch (e) {
      console.error('Failed to get/create conversation:', e)
    }
    
    // Save the user message
    const lastUserMessage = messages[messages.length - 1]
    if (activeConversationId && lastUserMessage?.role === 'user') {
      await saveMessage(activeConversationId, 'user', lastUserMessage.content)
    }
    
    // Preparar mensajes
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }))
    
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    
    // Send conversation_id to client first
    const sendConversationId = activeConversationId 
      ? `data: ${JSON.stringify({ type: 'conversation_id', id: activeConversationId })}\n\n`
      : ''
    
    // Track final response for persistence
    let finalAssistantText = ''
    const finalToolCalls: Array<{ name: string; input: unknown; result?: unknown }> = []
    
    // Agentic loop con streaming
    ;(async () => {
      try {
        if (sendConversationId) {
          await writer.write(encoder.encode(sendConversationId))
        }
        
        const currentMessages = [...anthropicMessages]
        let continueLoop = true
        
        console.error('[CHAT] Starting with messages:', JSON.stringify(currentMessages.map(m => ({ role: m.role, contentLength: typeof m.content === 'string' ? m.content.length : 'array' }))))
        
        while (continueLoop) {
          console.error('[CHAT] Calling Claude with', currentMessages.length, 'messages')
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16000,
            system: SYSTEM_PROMPT,
            messages: currentMessages,
            tools: TOOLS,
            stream: true,
          })
          
          let currentText = ''
          const currentToolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
          let currentInputJson = ''
          let currentToolId = ''
          let currentToolName = ''
          let stopReason: string | null = null
          
          for await (const event of response) {
            // Debug: log all event types
            if (event.type === 'content_block_start') {
              console.error('[STREAM] content_block_start:', event.content_block.type)
            }
            
            if (event.type === 'content_block_start') {
              if (event.content_block.type === 'thinking') {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`))
              } else if (event.content_block.type === 'tool_use') {
                currentToolId = event.content_block.id
                currentToolName = event.content_block.name
                currentInputJson = ''
                console.error('[STREAM] Tool use started:', currentToolName, currentToolId)
              }
            }
            
            if (event.type === 'content_block_delta') {
              const delta = event.delta
              
              if ('thinking' in delta && delta.thinking) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'thinking', content: delta.thinking })}\n\n`))
              }
              
              if ('text' in delta && delta.text) {
                currentText += delta.text
                finalAssistantText += delta.text
                await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: delta.text })}\n\n`))
              }
              
              if ('partial_json' in delta && delta.partial_json) {
                currentInputJson += delta.partial_json
              }
            }
            
            if (event.type === 'content_block_stop') {
              console.error('[STREAM] content_block_stop. toolName:', currentToolName, 'inputJson length:', currentInputJson.length)
              if (currentToolName) {
                try {
                  // Si no hay input JSON, usar objeto vacío (para tools sin parámetros required)
                  const input = currentInputJson ? JSON.parse(currentInputJson) as Record<string, unknown> : {}
                  currentToolUses.push({ id: currentToolId, name: currentToolName, input })
                  console.error('[STREAM] Tool parsed successfully:', currentToolName)
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', name: currentToolName, input })}\n\n`))
                } catch (e) {
                  console.error('[STREAM] Failed to parse tool input:', currentInputJson, e)
                }
                currentToolId = ''
                currentToolName = ''
                currentInputJson = ''
              }
            }
            
            if (event.type === 'message_delta') {
              stopReason = event.delta.stop_reason
            }
          }
          
          console.error('[CHAT] Response done. stopReason:', stopReason, 'text length:', currentText.length, 'tools:', currentToolUses.length)
          
          if (currentToolUses.length > 0 && stopReason === 'tool_use') {
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
              
              finalToolCalls.push({
                name: tr.name,
                input: currentToolUses.find(t => t.id === tr.id)?.input,
                result: parsed
              })
              
              toolResultContents.push({
                type: 'tool_result',
                tool_use_id: tr.id,
                content: tr.result || JSON.stringify({ success: true, data: null })
              })
            }
            
            if (toolResultContents.length > 0) {
              currentMessages.push({ role: 'user', content: toolResultContents })
              continueLoop = true
            } else {
              continueLoop = false
            }
          } else {
            continueLoop = false
          }
        }
        
        // Si hubo tool calls pero no texto, agregar mensaje de confirmación
        if (finalToolCalls.length > 0 && !finalAssistantText.trim()) {
          const fallbackText = 'Listo.'
          await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: fallbackText })}\n\n`))
          finalAssistantText = fallbackText
        }
        
        // Save assistant message to database
        if (activeConversationId && finalAssistantText) {
          await saveMessage(
            activeConversationId, 
            'assistant', 
            finalAssistantText, 
            finalToolCalls.length > 0 ? finalToolCalls : undefined
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
