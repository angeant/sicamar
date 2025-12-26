import { supabaseSicamar } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET: Obtener feriados en un rango de fechas
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')
    
    let query = supabaseSicamar
      .from('feriados')
      .select('id, fecha, nombre, tipo, es_laborable')
      .order('fecha')
    
    if (desde) {
      query = query.gte('fecha', desde)
    }
    
    if (hasta) {
      query = query.lte('fecha', hasta)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching feriados:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data || [],
      count: data?.length || 0
    })
  } catch (error) {
    console.error('Error in feriados API:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

