import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'

// Tipos
interface DailyPlanning {
  id?: number
  employee_id: number
  operational_date: string
  status: 'WORKING' | 'ABSENT' | 'REST'
  absence_reason?: 'SICK' | 'VACATION' | 'ACCIDENT' | 'LICENSE' | 'SUSPENDED' | 'ART' | 'ABSENT_UNJUSTIFIED' | null
  normal_entry_at?: string | null
  normal_exit_at?: string | null
  extra_entry_at?: string | null
  extra_exit_at?: string | null
  notes?: string | null
  origin?: string | null
  modified_by?: string | null
}

// GET: Obtener planificaciones de un período
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')
    const employeeId = searchParams.get('employee_id')
    
    if (!desde || !hasta) {
      return NextResponse.json(
        { error: 'Se requiere desde y hasta' },
        { status: 400 }
      )
    }
    
    let query = supabaseSicamar
      .from('daily_planning')
      .select('*')
      .gte('operational_date', desde)
      .lte('operational_date', hasta)
      .order('operational_date')
    
    if (employeeId) {
      query = query.eq('employee_id', parseInt(employeeId))
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching planning:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('Error en GET planning:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: Crear o actualizar planificación (upsert)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plannings } = body as { plannings: DailyPlanning[] }
    
    if (!plannings || !Array.isArray(plannings) || plannings.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere array de plannings' },
        { status: 400 }
      )
    }
    
    // Preparar datos para upsert
    // Los timestamps se guardan sin timezone, siempre en hora de Argentina
    const dataToUpsert = plannings.map(p => ({
      employee_id: p.employee_id,
      operational_date: p.operational_date,
      status: p.status,
      absence_reason: p.status === 'ABSENT' ? p.absence_reason : null,
      normal_entry_at: p.status === 'WORKING' ? p.normal_entry_at : null,
      normal_exit_at: p.status === 'WORKING' ? p.normal_exit_at : null,
      extra_entry_at: p.status === 'WORKING' ? p.extra_entry_at : null,
      extra_exit_at: p.status === 'WORKING' ? p.extra_exit_at : null,
      notes: p.notes || null,
      origin: p.origin || 'web',
      modified_by: p.modified_by || null,
      updated_at: new Date().toISOString()
    }))
    
    // Upsert por employee_id + operational_date
    const { data, error } = await supabaseSicamar
      .from('daily_planning')
      .upsert(dataToUpsert, {
        onConflict: 'employee_id,operational_date',
        ignoreDuplicates: false
      })
      .select()
    
    if (error) {
      console.error('Error upserting planning:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      data,
      count: dataToUpsert.length 
    })
  } catch (error) {
    console.error('Error en POST planning:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: Borrar planificaciones
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fecha = searchParams.get('fecha')
    const employeeId = searchParams.get('employee_id')
    const truncar = searchParams.get('truncar') === 'true'
    
    // Truncar toda la tabla
    if (truncar) {
      const { error, count } = await supabaseSicamar
        .from('daily_planning')
        .delete()
        .gte('id', 0)
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({ success: true, deleted: count, message: 'Tabla daily_planning vaciada' })
    }
    
    if (!fecha && !employeeId) {
      return NextResponse.json({ error: 'Se requiere fecha, employee_id o truncar=true' }, { status: 400 })
    }
    
    let query = supabaseSicamar
      .from('daily_planning')
      .delete()
    
    if (fecha) {
      query = query.eq('operational_date', fecha)
    }
    
    if (employeeId) {
      query = query.eq('employee_id', parseInt(employeeId))
    }
    
    const { error, count } = await query
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, deleted: count })
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

