import { supabaseSicamar } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Construir objeto de actualización solo con campos definidos
    const updateData: Record<string, unknown> = {}
    
    if (body.legajo !== undefined) updateData.legajo = body.legajo
    if (body.dni !== undefined) updateData.dni = body.dni
    if (body.nombre !== undefined) updateData.nombre = body.nombre
    if (body.apellido !== undefined) updateData.apellido = body.apellido
    if (body.activo !== undefined) updateData.activo = body.activo
    if (body.fecha_egreso !== undefined) updateData.fecha_egreso = body.fecha_egreso
    if (body.fecha_ingreso !== undefined) updateData.fecha_ingreso = body.fecha_ingreso
    if (body.sector !== undefined) updateData.sector = body.sector
    if (body.categoria !== undefined) updateData.categoria = body.categoria
    if (body.cargo !== undefined) updateData.cargo = body.cargo

    const { data, error } = await supabaseSicamar
      .from('empleados')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single()

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

    const { data, error } = await supabaseSicamar
      .from('empleados')
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

