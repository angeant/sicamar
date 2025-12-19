import { supabaseSicamar } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// GET: Obtener posiciones disponibles para el dropdown
export async function GET() {
  try {
    const { data, error } = await supabaseSicamar
      .from('posiciones')
      .select('id, codigo, nombre, planta, rotation_type')
      .eq('activo', true)
      .order('planta')
      .order('nombre')

    if (error) {
      // Si la tabla no existe, retornamos array vacío
      if (error.message.includes('does not exist')) {
        return NextResponse.json({ 
          data: [],
          message: 'Tabla posiciones no existe aún'
        })
      }
      
      console.error('Error fetching posiciones:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error: unknown) {
    console.error('Error in posiciones disponibles API:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

