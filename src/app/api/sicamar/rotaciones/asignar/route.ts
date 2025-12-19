import { supabaseSicamar } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { empleado_id, rotacion_id } = body

    if (!empleado_id) {
      return NextResponse.json(
        { error: 'Se requiere empleado_id' },
        { status: 400 }
      )
    }

    const hoy = new Date().toISOString().split('T')[0]

    // Cerrar asignación anterior si existe
    const { error: closeError } = await supabaseSicamar
      .from('empleado_rotacion')
      .update({ fecha_hasta: hoy })
      .eq('empleado_id', empleado_id)
      .is('fecha_hasta', null)

    if (closeError) {
      console.error('Error closing previous assignment:', closeError)
      // Continuar igualmente, puede que no hubiera asignación anterior
    }

    // Si rotacion_id es null, solo cerrar (desasignar)
    if (!rotacion_id) {
      return NextResponse.json({ 
        success: true, 
        message: 'Rotación desasignada' 
      })
    }

    // Crear nueva asignación
    const { data, error: insertError } = await supabaseSicamar
      .from('empleado_rotacion')
      .insert({
        empleado_id,
        rotacion_id,
        fecha_desde: hoy
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting assignment:', insertError)
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      data,
      message: 'Rotación asignada correctamente'
    })

  } catch (error: unknown) {
    console.error('Error in asignar rotacion API:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
