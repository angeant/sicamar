import { supabaseServer } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const { data, error } = await supabaseServer.rpc('update_empleado_sicamar', {
      p_id: parseInt(id),
      p_legajo: body.legajo || null,
      p_dni: body.dni || null,
      p_nombre: body.nombre || null,
      p_apellido: body.apellido || null,
      p_estado_laboral: body.estado_laboral || null,
      p_activo: body.activo !== undefined ? body.activo : null,
    })

    if (error) {
      console.error('Error updating empleado:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ empleado: data })
  } catch (error: unknown) {
    console.error('Error in empleados PATCH API:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data, error } = await supabaseServer
      .from('sicamar_empleados')
      .select('*')
      .eq('id', parseInt(id))
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ empleado: data })
  } catch (error: unknown) {
    console.error('Error in empleados GET API:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

