import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { supabaseServer, supabaseSicamar } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

const AGENT_NAME = 'Agente de Nómina - Web'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_CLAUDE_KEY })

const SYSTEM_PROMPT = `Asistente de nómina de Sicamar Metales S.A.

Condiciones de contratación: efectivo, eventual, a_prueba.

REGLAS:
- Ejecutá las acciones directamente, sin pedir confirmación
- Respondé en texto plano, sin markdown (sin tablas, sin negritas, sin bullets)
- Sé breve y directo
- Usá las herramientas para consultar y modificar datos`

// Tools MCP para Nómina
const tools: Anthropic.Tool[] = [
  {
    name: 'sicamar_empleados_buscar',
    description: 'Busca empleados con filtros. Busca en nombre, apellido, legajo, DNI. Puede filtrar por sector, cargo, categoría, condición.',
    input_schema: {
      type: 'object' as const,
      properties: {
        texto: {
          type: 'string',
          description: 'Búsqueda libre en nombre, apellido, legajo, DNI'
        },
        sector: {
          type: 'string',
          description: 'Filtro parcial por sector (ej: FUND, ADM, CHAT)'
        },
        cargo: {
          type: 'string',
          description: 'Filtro parcial por cargo (ej: OPERARIO, SUPERVISOR)'
        },
        categoria: {
          type: 'string',
          description: 'Filtro parcial por categoría del convenio'
        },
        condicion: {
          type: 'string',
          enum: ['efectivo', 'eventual', 'a_prueba'],
          description: 'Filtrar por condición de contratación'
        },
        activo: {
          type: 'boolean',
          description: 'Filtrar por estado activo/inactivo (default: true)'
        },
        limite: {
          type: 'number',
          description: 'Máximo de resultados (default: 20)'
        }
      },
      required: []
    }
  },
  {
    name: 'sicamar_empleados_detalle',
    description: 'Obtiene todos los datos de un empleado específico: datos personales, contacto, laborales, convenio y pago.',
    input_schema: {
      type: 'object' as const,
      properties: {
        empleado_id: {
          type: 'number',
          description: 'ID del empleado'
        },
        legajo: {
          type: 'string',
          description: 'Legajo del empleado'
        }
      },
      required: []
    }
  },
  {
    name: 'sicamar_empleados_dar_baja',
    description: 'Da de baja a un empleado (activo=false). Requiere confirmación previa del usuario.',
    input_schema: {
      type: 'object' as const,
      properties: {
        empleado_id: {
          type: 'number',
          description: 'ID del empleado a dar de baja'
        },
        fecha_egreso: {
          type: 'string',
          description: 'Fecha de egreso YYYY-MM-DD (default: hoy)'
        }
      },
      required: ['empleado_id']
    }
  },
  {
    name: 'sicamar_empleados_cambiar_condicion',
    description: 'Cambia la condición de contratación de un empleado. Requiere confirmación previa del usuario.',
    input_schema: {
      type: 'object' as const,
      properties: {
        empleado_id: {
          type: 'number',
          description: 'ID del empleado'
        },
        condicion: {
          type: 'string',
          enum: ['efectivo', 'eventual', 'a_prueba'],
          description: 'Nueva condición de contratación'
        }
      },
      required: ['empleado_id', 'condicion']
    }
  }
]

// Ejecutar herramienta
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'sicamar_empleados_buscar': {
        let query = supabaseSicamar
          .from('empleados')
          .select('id, legajo, dni, nombre, apellido, sector, cargo, categoria, condicion_contratacion, activo, fecha_ingreso, email, celular')
        
        // Filtro de texto libre
        if (input.texto) {
          const texto = input.texto as string
          query = query.or(`apellido.ilike.%${texto}%,nombre.ilike.%${texto}%,legajo.ilike.%${texto}%,dni.ilike.%${texto}%`)
        }
        
        // Filtros
        if (input.condicion) {
          query = query.eq('condicion_contratacion', input.condicion as string)
        }
        if (input.activo !== undefined) {
          query = query.eq('activo', input.activo as boolean)
        } else {
          query = query.eq('activo', true)
        }
        if (input.sector) {
          query = query.ilike('sector', `%${input.sector}%`)
        }
        if (input.cargo) {
          query = query.ilike('cargo', `%${input.cargo}%`)
        }
        if (input.categoria) {
          query = query.ilike('categoria', `%${input.categoria}%`)
        }
        
        query = query.order('apellido').limit((input.limite as number) || 20)
        
        const { data, error } = await query
        
        if (error) return `Error: ${error.message}`
        if (!data || data.length === 0) return 'No se encontraron empleados.'
        
        return JSON.stringify(data, null, 2)
      }
      
      case 'sicamar_empleados_detalle': {
        let query = supabaseSicamar.from('empleados').select('*')
        
        if (input.empleado_id) {
          query = query.eq('id', input.empleado_id as number)
        } else if (input.legajo) {
          query = query.eq('legajo', input.legajo as string)
        } else {
          return 'Error: Se requiere empleado_id o legajo'
        }
        
        const { data, error } = await query.single()
        
        if (error) return `Error: ${error.message}`
        if (!data) return 'Empleado no encontrado.'
        
        // Calcular antigüedad
        let antiguedad = '-'
        if (data.fecha_ingreso) {
          const ingreso = new Date(data.fecha_ingreso)
          const hoy = new Date()
          const años = Math.floor((hoy.getTime() - ingreso.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          const meses = Math.floor(((hoy.getTime() - ingreso.getTime()) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000))
          antiguedad = años > 0 ? `${años} años ${meses} meses` : `${meses} meses`
        }
        
        return JSON.stringify({ ...data, antiguedad_calculada: antiguedad }, null, 2)
      }
      
      case 'sicamar_empleados_dar_baja': {
        const empleadoId = input.empleado_id as number
        const fechaEgreso = (input.fecha_egreso as string) || new Date().toISOString().split('T')[0]
        
        const { data, error } = await supabaseSicamar
          .from('empleados')
          .update({ 
            activo: false, 
            fecha_egreso: fechaEgreso 
          })
          .eq('id', empleadoId)
          .select('id, legajo, nombre, apellido, activo, fecha_egreso')
          .single()
        
        if (error) return `Error: ${error.message}`
        
        return `Baja realizada: ${data.apellido}, ${data.nombre} (Legajo ${data.legajo}) - Fecha egreso: ${data.fecha_egreso}`
      }
      
      case 'sicamar_empleados_cambiar_condicion': {
        const empleadoId = input.empleado_id as number
        const condicion = input.condicion as string
        
        const { data, error } = await supabaseSicamar
          .from('empleados')
          .update({ condicion_contratacion: condicion })
          .eq('id', empleadoId)
          .select('id, legajo, nombre, apellido, condicion_contratacion')
          .single()
        
        if (error) return `Error: ${error.message}`
        
        return `Condición actualizada: ${data.apellido}, ${data.nombre} (Legajo ${data.legajo}) → ${data.condicion_contratacion}`
      }
      
      default:
        return `Herramienta desconocida: ${name}`
    }
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    
    const userEmail = user.primaryEmailAddress?.emailAddress
    if (!userEmail) {
      return NextResponse.json({ success: false, error: 'No email found' }, { status: 400 })
    }
    
    const body = await request.json()
    const { message, conversation_id } = body
    
    if (!message) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 })
    }
    
    let conversationId = conversation_id
    
    // Obtener o crear conversación
    if (!conversationId) {
      const { data: existingConv } = await supabaseServer
        .schema('sicamar')
        .from('conversations')
        .select('id')
        .eq('user_email', userEmail)
        .eq('agent_name', AGENT_NAME)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single()
      
      if (existingConv) {
        conversationId = existingConv.id
      } else {
        const { data: newConv, error: convError } = await supabaseServer
          .schema('sicamar')
          .from('conversations')
          .insert({
            user_email: userEmail,
            agent_name: AGENT_NAME,
            session_id: crypto.randomUUID()
          })
          .select()
          .single()
        
        if (convError) {
          return NextResponse.json({ success: false, error: 'Error creating conversation' }, { status: 500 })
        }
        
        conversationId = newConv.id
      }
    }
    
    // Guardar mensaje del usuario
    await supabaseServer
      .schema('sicamar')
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: message
      })
    
    // Cargar historial
    const { data: history } = await supabaseServer
      .schema('sicamar')
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20)
    
    const claudeMessages: Anthropic.MessageParam[] = (history || []).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }))
    
    // Llamar a Claude
    let response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL!,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools,
      messages: claudeMessages
    })
    
    // Procesar tool_use
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      )
      
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      
      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result
        })
      }
      
      claudeMessages.push({ role: 'assistant', content: response.content })
      claudeMessages.push({ role: 'user', content: toolResults })
      
      response = await anthropic.messages.create({
        model: process.env.CLAUDE_MODEL!,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools,
        messages: claudeMessages
      })
    }
    
    const textContent = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    )
    
    const assistantResponse = textContent?.text || 'No pude procesar tu mensaje.'
    
    // Guardar respuesta
    await supabaseServer
      .schema('sicamar')
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantResponse
      })
    
    await supabaseServer
      .schema('sicamar')
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)
    
    return NextResponse.json({
      success: true,
      response: assistantResponse,
      conversation_id: conversationId
    })
    
  } catch (error) {
    console.error('Chat nomina error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
