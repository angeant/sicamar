import { supabaseSicamar } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// POST: Actualizar la posición de un empleado
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { empleado_id, posicion_id, is_locked = false } = body
    
    if (!empleado_id) {
      return NextResponse.json({ error: 'Se requiere empleado_id' }, { status: 400 })
    }

    const hoy = new Date().toISOString().split('T')[0]

    // Cerrar asignación anterior (si existe)
    await supabaseSicamar
      .from('empleado_posicion')
      .update({ fecha_hasta: hoy })
      .eq('empleado_id', empleado_id)
      .is('fecha_hasta', null)

    // Si posicion_id es null, solo cerramos la asignación anterior
    if (!posicion_id) {
      return NextResponse.json({ 
        success: true, 
        message: 'Asignación anterior cerrada' 
      })
    }

    // Crear nueva asignación
    const { data, error } = await supabaseSicamar
      .from('empleado_posicion')
      .insert({
        empleado_id,
        posicion_id,
        fecha_desde: hoy,
        is_primary: true,
        is_locked,
        created_by: 'ui:posiciones-page'
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error asignando posición:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    console.error('Error in asignar posición API:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

