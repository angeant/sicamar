import { supabaseSicamar } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET: Obtener rotaciones disponibles
export async function GET() {
  try {
    const { data, error } = await supabaseSicamar
      .from('rotaciones')
      .select('id, nombre, turnos, frecuencia_semanas, notas, activo')
      .eq('activo', true)
      .order('nombre')

    if (error) {
      if (error.message.includes('does not exist')) {
        return NextResponse.json({ 
          data: [],
          message: 'Tabla rotaciones no existe aún. Ejecutar migración.'
        })
      }
      console.error('Error fetching rotaciones:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error: unknown) {
    console.error('Error in rotaciones disponibles API:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: Crear nueva rotación
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nombre, turnos, frecuencia_semanas = 1, notas = '' } = body

    if (!nombre || !turnos || !Array.isArray(turnos) || turnos.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere nombre y turnos (array)' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseSicamar
      .from('rotaciones')
      .insert({
        nombre,
        turnos,
        frecuencia_semanas,
        notas: notas || null,
        activo: true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating rotacion:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    console.error('Error in POST rotaciones:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT: Actualizar rotación existente
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, nombre, turnos, frecuencia_semanas, notas } = body

    if (!id) {
      return NextResponse.json({ error: 'Se requiere id' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (nombre !== undefined) updates.nombre = nombre
    if (turnos !== undefined) updates.turnos = turnos
    if (frecuencia_semanas !== undefined) updates.frecuencia_semanas = frecuencia_semanas
    if (notas !== undefined) updates.notas = notas || null

    const { data, error } = await supabaseSicamar
      .from('rotaciones')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating rotacion:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    console.error('Error in PUT rotaciones:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE: Desactivar rotación (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Se requiere id' }, { status: 400 })
    }

    const { error } = await supabaseSicamar
      .from('rotaciones')
      .update({ activo: false })
      .eq('id', id)

    if (error) {
      console.error('Error deleting rotacion:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Cerrar asignaciones de empleados con esta rotación
    const hoy = new Date().toISOString().split('T')[0]
    await supabaseSicamar
      .from('empleado_rotacion')
      .update({ fecha_hasta: hoy })
      .eq('rotacion_id', id)
      .is('fecha_hasta', null)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error in DELETE rotaciones:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
