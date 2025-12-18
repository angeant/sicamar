import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'

// GET: Obtener liquidaciones desde Supabase
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const tipo = searchParams.get('tipo') // MN, PQN, SQN, VAC, etc.
  const anio = searchParams.get('anio')
  const mes = searchParams.get('mes')
  const periodo_id = searchParams.get('periodo_id')
  const legajo = searchParams.get('legajo')

  try {
    // Si se solicita un período específico con su detalle
    if (periodo_id) {
      // Obtener período
      const { data: periodo, error: periodoError } = await supabaseSicamar
        .from('periodos_liquidacion')
        .select('*')
        .eq('id', periodo_id)
        .single()

      if (periodoError || !periodo) {
        return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
      }

      // Obtener detalle
      let query = supabaseSicamar
        .from('liquidacion_detalle')
        .select('*')
        .eq('periodo_id', periodo_id)
        .order('legajo')
        .order('concepto_tipo')
        .order('concepto_codigo')

      if (legajo) {
        query = query.eq('legajo', parseInt(legajo))
      }

      const { data: detalle, error: detalleError } = await query

      if (detalleError) {
        return NextResponse.json({ error: detalleError.message }, { status: 500 })
      }

      // Agrupar por legajo
      const detalleAgrupado: Record<number, typeof detalle> = {}
      for (const row of detalle || []) {
        const leg = row.legajo
        if (!detalleAgrupado[leg]) {
          detalleAgrupado[leg] = []
        }
        detalleAgrupado[leg].push(row)
      }

      return NextResponse.json({
        periodo: {
          ...periodo,
          tipo_label: getTipoLabel(periodo.tipo),
        },
        detalle: detalleAgrupado,
        totalEmpleados: Object.keys(detalleAgrupado).length,
      })
    }

    // Listar períodos con filtros
    let query = supabaseSicamar
      .from('periodos_liquidacion')
      .select('*')
      .order('fecha_liquidacion', { ascending: false })

    if (tipo) {
      query = query.eq('tipo', tipo)
    }
    if (anio) {
      query = query.eq('anio', parseInt(anio))
    }
    if (mes) {
      query = query.eq('mes', parseInt(mes))
    }

    const { data: periodos, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Obtener conteo de empleados por período usando SQL directo
    const periodosIds = (periodos || []).map(p => p.id)
    
    const conteoMap: Record<number, number> = {}
    
    // Obtener todos los detalles para los períodos en una sola consulta
    const { data: detalles } = await supabaseSicamar
      .from('liquidacion_detalle')
      .select('periodo_id, legajo')
      .in('periodo_id', periodosIds)
    
    // Contar legajos distintos por período
    if (detalles) {
      const legajosPorPeriodo: Record<number, Set<number>> = {}
      for (const d of detalles) {
        if (!legajosPorPeriodo[d.periodo_id]) {
          legajosPorPeriodo[d.periodo_id] = new Set()
        }
        legajosPorPeriodo[d.periodo_id].add(d.legajo)
      }
      for (const [periodoId, legajos] of Object.entries(legajosPorPeriodo)) {
        conteoMap[parseInt(periodoId)] = legajos.size
      }
    }

    const liquidaciones = (periodos || []).map(p => ({
      ...p,
      tipo_label: getTipoLabel(p.tipo),
      estado_label: getEstadoLabel(p.estado),
      total_empleados: conteoMap[p.id] || 0,
    }))

    return NextResponse.json({
      liquidaciones,
      total: liquidaciones.length,
    })

  } catch (error) {
    console.error('Error fetching liquidaciones:', error)
    return NextResponse.json(
      { error: 'Error al obtener liquidaciones', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function getTipoLabel(tipo: string): string {
  const tipos: Record<string, string> = {
    'MN': 'Mensual',
    'PQN': '1ra Quincena',
    'SQN': '2da Quincena',
    'VAC': 'Vacaciones',
    'SA1': 'SAC 1er Sem.',
    'SA2': 'SAC 2do Sem.',
    'FID': 'Liquidación Final',
  }
  return tipos[tipo] || tipo
}

function getEstadoLabel(estado: string): string {
  const estados: Record<string, string> = {
    'borrador': 'Borrador',
    'en_proceso': 'En Proceso',
    'cerrada': 'Cerrada',
    'cerrado': 'cerrado',
  }
  return estados[estado] || estado
}
