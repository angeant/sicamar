import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'

type TipoComando = 'BLOQUEAR' | 'DESBLOQUEAR' | 'CREAR'

interface ComandoRequest {
  tipo: TipoComando
  legajo: string
  datos?: {
    nombre?: string
    apellido?: string
    dni?: string
    tarjeta?: string
    eventual?: boolean
  }
}

/**
 * POST /api/sicamar/inweb/comandos
 * 
 * Encola un comando para ejecutar en InWeb SQL Server
 * 
 * Body:
 * {
 *   "tipo": "BLOQUEAR" | "DESBLOQUEAR" | "CREAR",
 *   "legajo": "123",
 *   "datos": { ... }  // Opcional, para CREAR
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseSicamar
    const body: ComandoRequest = await request.json()
    
    // Validar campos requeridos
    if (!body.tipo || !body.legajo) {
      return NextResponse.json(
        { success: false, error: 'Campos requeridos: tipo, legajo' },
        { status: 400 }
      )
    }
    
    // Validar tipo
    const tiposValidos: TipoComando[] = ['BLOQUEAR', 'DESBLOQUEAR', 'CREAR']
    if (!tiposValidos.includes(body.tipo)) {
      return NextResponse.json(
        { success: false, error: `Tipo inválido. Valores permitidos: ${tiposValidos.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Validar datos para CREAR
    if (body.tipo === 'CREAR') {
      if (!body.datos?.nombre || !body.datos?.apellido) {
        return NextResponse.json(
          { success: false, error: 'Para CREAR se requiere: datos.nombre, datos.apellido' },
          { status: 400 }
        )
      }
    }
    
    // Insertar comando en cola
    const { data, error } = await supabase
      .schema('sicamar')
      .from('comandos_inweb')
      .insert({
        tipo: body.tipo,
        legajo: body.legajo,
        datos: body.datos || {},
        estado: 'pendiente',
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error insertando comando:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }
    
    // También actualizar estado en empleados de Supabase si es bloquear/desbloquear
    if (body.tipo === 'BLOQUEAR' || body.tipo === 'DESBLOQUEAR') {
      const activo = body.tipo === 'DESBLOQUEAR'
      await supabase
        .schema('sicamar')
        .from('empleados')
        .update({ 
          activo,
          fecha_egreso: activo ? null : new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('legajo', body.legajo)
    }
    
    return NextResponse.json({
      success: true,
      message: `Comando ${body.tipo} encolado para legajo ${body.legajo}`,
      comando: data,
    })
    
  } catch (error) {
    console.error('Error en /api/sicamar/inweb/comandos:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sicamar/inweb/comandos
 * 
 * Lista comandos (últimos 50)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseSicamar
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    
    let query = supabase
      .schema('sicamar')
      .from('comandos_inweb')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (estado) {
      query = query.eq('estado', estado)
    }
    
    const { data, error } = await query
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, comandos: data })
    
  } catch (error) {
    console.error('Error en GET /api/sicamar/inweb/comandos:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

