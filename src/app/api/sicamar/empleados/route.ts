import { supabaseSicamar } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const activos = searchParams.get('activos') || searchParams.get('activo')
    const clase = searchParams.get('clase')
    
    // Usar tabla sicamar.empleados directamente
    let query = supabaseSicamar
      .from('empleados')
      .select('*')
      .order('apellido', { ascending: true })
      .order('nombre', { ascending: true })
    
    // Filtrar por activos si se especifica
    if (activos === 'true') {
      query = query.eq('activo', true)
    } else if (activos === 'false') {
      query = query.eq('activo', false)
    }
    
    // Filtrar por clase (Jornal, Mensual)
    if (clase) {
      query = query.eq('clase', clase)
    }

    const { data: empleados, error } = await query

    if (error) {
      console.error('Error fetching empleados:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Devolver en ambos formatos para compatibilidad
    return NextResponse.json({ 
      data: empleados || [],
      empleados: empleados || [] 
    })
  } catch (error: unknown) {
    console.error('Error in empleados API:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH: Actualizar un empleado
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body
    
    if (!id) {
      return NextResponse.json({ error: 'Se requiere id' }, { status: 400 })
    }
    
    const { data, error } = await supabaseSicamar
      .from('empleados')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
