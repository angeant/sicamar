import { supabaseSicamar } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const empleadoId = searchParams.get('empleado_id')
    const anio = searchParams.get('anio') || new Date().getFullYear().toString()
    const soloConSaldo = searchParams.get('solo_con_saldo') === 'true'

    let query = supabaseSicamar
      .from('saldos_vacaciones')
      .select(`
        *,
        empleados:empleado_id (
          id,
          legajo,
          nombre,
          apellido,
          fecha_ingreso,
          activo,
          sector
        )
      `)
      .eq('anio', parseInt(anio))
      .order('empleado_id')

    if (empleadoId) {
      query = query.eq('empleado_id', parseInt(empleadoId))
    }

    const { data: saldos, error } = await query

    if (error) {
      console.error('Error fetching saldos vacaciones:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Formatear y calcular campos derivados
    const saldosFormateados = (saldos || [])
      .map(s => {
        const emp = s.empleados as any
        
        // Solo incluir empleados activos
        if (!emp?.activo) return null

        // Calcular días disponibles
        const diasCorridosDisponibles = 
          (s.dias_correspondientes || 0) + 
          (s.dias_pendientes_anterior || 0) - 
          (s.dias_adelantados || 0)
        
        const diasHabilesDisponibles = 
          (s.dias_habiles_tope || 0) - 
          (s.dias_habiles_consumidos || 0)

        return {
          id: s.id,
          empleado_id: s.empleado_id,
          legajo: emp?.legajo,
          nombre_completo: emp ? `${emp.apellido}, ${emp.nombre}` : null,
          sector: emp?.sector,
          fecha_ingreso: emp?.fecha_ingreso,
          anio: s.anio,
          antiguedad_anios: s.antiguedad_anios,
          dias_correspondientes: s.dias_correspondientes,
          dias_pendientes_anterior: s.dias_pendientes_anterior || 0,
          dias_tomados_manual: s.dias_tomados_manual || 0,
          dias_habiles_tope: s.dias_habiles_tope,
          dias_habiles_consumidos: s.dias_habiles_consumidos || 0,
          dias_corridos_disponibles: diasCorridosDisponibles,
          dias_habiles_disponibles: diasHabilesDisponibles,
          francos_compensatorios: s.francos_compensatorios || 0,
          puede_pedir_dia_habil: diasHabilesDisponibles > 0
        }
      })
      .filter(s => s !== null)
      .filter(s => !soloConSaldo || (s.dias_corridos_disponibles > 0 || s.dias_habiles_disponibles > 0))

    // Resumen
    const resumen = {
      total_empleados: saldosFormateados.length,
      con_saldo_pendiente: saldosFormateados.filter(s => s.dias_habiles_disponibles > 0).length,
      dias_totales_disponibles: saldosFormateados.reduce((sum, s) => sum + (s.dias_corridos_disponibles || 0), 0),
      dias_habiles_totales_disponibles: saldosFormateados.reduce((sum, s) => sum + (s.dias_habiles_disponibles || 0), 0)
    }

    return NextResponse.json({ saldos: saldosFormateados, resumen })

  } catch (error: unknown) {
    console.error('Error in vacaciones/saldos API:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: Crear o actualizar saldo de vacaciones
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      empleado_id, 
      anio, 
      antiguedad_anios,
      dias_correspondientes,
      dias_habiles_tope,
      dias_pendientes_anterior
    } = body

    if (!empleado_id || !anio) {
      return NextResponse.json(
        { error: 'Se requiere empleado_id y anio' },
        { status: 400 }
      )
    }

    // Upsert por empleado_id + anio
    const { data, error } = await supabaseSicamar
      .from('saldos_vacaciones')
      .upsert({
        empleado_id,
        anio,
        antiguedad_anios,
        dias_correspondientes,
        dias_habiles_tope,
        dias_pendientes_anterior: dias_pendientes_anterior || 0,
        dias_habiles_consumidos: 0,
        dias_tomados_manual: 0
      }, {
        onConflict: 'empleado_id,anio'
      })
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

// PATCH: Actualizar consumo de días
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, dias_habiles_consumidos, dias_tomados_manual, francos_compensatorios } = body

    if (!id) {
      return NextResponse.json({ error: 'Se requiere id' }, { status: 400 })
    }

    const updates: any = {}
    if (dias_habiles_consumidos !== undefined) {
      updates.dias_habiles_consumidos = dias_habiles_consumidos
    }
    if (dias_tomados_manual !== undefined) {
      updates.dias_tomados_manual = dias_tomados_manual
    }
    if (francos_compensatorios !== undefined) {
      updates.francos_compensatorios = francos_compensatorios
    }

    const { data, error } = await supabaseSicamar
      .from('saldos_vacaciones')
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





