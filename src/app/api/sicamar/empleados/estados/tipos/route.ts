import { NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'

// GET - Obtener todos los tipos de estado disponibles
export async function GET() {
  try {
    const { data, error } = await supabaseSicamar
      .from('tipos_estado_empleado')
      .select('*')
      .eq('activo', true)
      .order('orden')

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching tipos estado:', error)
    return NextResponse.json(
      { error: 'Error al obtener tipos de estado' },
      { status: 500 }
    )
  }
}





