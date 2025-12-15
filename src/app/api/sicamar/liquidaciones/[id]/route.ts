import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'

interface Empleado {
  id: number
  legajo: string
  nombre: string
  apellido: string
  categoria: string | null
  sector: string | null
  cargo: string | null
  codigo_categoria: string | null
  salario_basico: number | null
  foto_url: string | null
  foto_thumb_url: string | null
}

// GET: Obtener detalle de una liquidación específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const searchParams = request.nextUrl.searchParams
  const legajo = searchParams.get('legajo')
  const agrupado = searchParams.get('agrupado') !== 'false'

  try {
    // Obtener período
    const { data: periodo, error: periodoError } = await supabaseSicamar
      .from('periodos_liquidacion')
      .select('*')
      .eq('id', id)
      .single()

    if (periodoError || !periodo) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
    }

    // Obtener detalle - tipos relevantes para el recibo de sueldo completo:
    // 0=haberes remunerativos, 1=no remunerativos, 2=retenciones/deducciones, 4=contribuciones patronales
    // Excluimos tipo 6 (informativos/auxiliares de cálculo)
    let query = supabaseSicamar
      .from('liquidacion_detalle')
      .select(`
        id,
        periodo_id,
        legajo,
        empleado_id,
        concepto_codigo,
        concepto_descripcion,
        concepto_tipo,
        cantidad,
        valor_unitario,
        importe
      `)
      .eq('periodo_id', id)
      .in('concepto_tipo', [0, 1, 2, 4]) // Haberes, no rem, retenciones y contribuciones
      .not('importe', 'is', null) // Solo conceptos con importe
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

    // Obtener datos de empleados para enriquecer el detalle (incluyendo salario_basico)
    const legajosUnicos = [...new Set((detalle || []).map(d => d.legajo.toString()))]
    
    const { data: empleados } = await supabaseSicamar
      .from('empleados')
      .select('id, legajo, nombre, apellido, categoria, sector, cargo, codigo_categoria, salario_basico, foto_url, foto_thumb_url')
      .in('legajo', legajosUnicos)

    // Crear mapa de empleados
    const empleadosMap: Record<string, Empleado> = {}
    for (const emp of empleados || []) {
      empleadosMap[emp.legajo] = emp
    }

    // Obtener fórmulas de conceptos
    const codigosConceptos = [...new Set((detalle || []).map(d => d.concepto_codigo))]
    const { data: conceptos } = await supabaseSicamar
      .from('conceptos_liquidacion')
      .select('codigo, formula')
      .in('codigo', codigosConceptos)
    
    // Crear mapa de fórmulas
    const formulasMap: Record<string, string | null> = {}
    for (const concepto of conceptos || []) {
      formulasMap[concepto.codigo] = concepto.formula
    }

    // Si se pide agrupado por legajo
    if (agrupado) {
      const detalleAgrupado: Record<number, {
        legajo: number
        empleado_id: number | null
        nombre: string
        apellido: string
        nombre_completo: string
        categoria: string | null
        sector: string | null
        cargo: string | null
        salario_basico: number
        foto_url: string | null
        foto_thumb_url: string | null
        conceptos: Array<{
          id: number
          concepto_codigo: string
          concepto_descripcion: string
          concepto_tipo: number
          cantidad: number | null
          valor_unitario: number | null
          importe: number | null
          formula: string | null
        }>
        totales: {
          haberes: number
          no_rem: number
          retenciones: number
          contribuciones: number
          neto: number
          horas_diurnas: number
          horas_nocturnas: number
          horas_extra: number
          presentismo: number
        }
      }> = {}

      for (const row of detalle || []) {
        const leg = row.legajo
        const emp = empleadosMap[leg.toString()]
        
        if (!detalleAgrupado[leg]) {
          detalleAgrupado[leg] = {
            legajo: leg,
            empleado_id: emp?.id || row.empleado_id,
            nombre: emp?.nombre || '',
            apellido: emp?.apellido || '',
            nombre_completo: emp ? `${emp.apellido}, ${emp.nombre}` : `Legajo ${leg}`,
            categoria: emp?.categoria || null,
            sector: emp?.sector || null,
            cargo: emp?.cargo || null,
            salario_basico: emp?.salario_basico ? parseFloat(String(emp.salario_basico)) : 0,
            foto_url: emp?.foto_url || null,
            foto_thumb_url: emp?.foto_thumb_url || null,
            conceptos: [],
            totales: {
              haberes: 0,
              no_rem: 0,
              retenciones: 0,
              contribuciones: 0,
              neto: 0,
              horas_diurnas: 0,
              horas_nocturnas: 0,
              horas_extra: 0,
              presentismo: 0,
            }
          }
        }
        
        // Usar valores directamente de la base de datos
        const cantidad = row.cantidad ? parseFloat(String(row.cantidad)) : 0
        const importe = row.importe ? parseFloat(String(row.importe)) : 0
        const valorUnitario = row.valor_unitario ? parseFloat(String(row.valor_unitario)) : (cantidad > 0 && importe > 0 ? importe / cantidad : 0)
        
        // Agregar concepto
        detalleAgrupado[leg].conceptos.push({
          id: row.id,
          concepto_codigo: row.concepto_codigo,
          concepto_descripcion: row.concepto_descripcion,
          concepto_tipo: row.concepto_tipo,
          cantidad: cantidad > 0 ? cantidad : null,
          valor_unitario: valorUnitario > 0 ? valorUnitario : null,
          importe: importe > 0 ? importe : null,
          formula: formulasMap[row.concepto_codigo] || null,
        })
        
        // Calcular totales por tipo de concepto
        if (row.concepto_tipo === 0) detalleAgrupado[leg].totales.haberes += importe
        if (row.concepto_tipo === 1) detalleAgrupado[leg].totales.no_rem += importe
        if (row.concepto_tipo === 2) detalleAgrupado[leg].totales.retenciones += importe
        if (row.concepto_tipo === 4) detalleAgrupado[leg].totales.contribuciones += importe
        
        if (row.concepto_codigo === '0010') detalleAgrupado[leg].totales.horas_diurnas += cantidad
        if (row.concepto_codigo === '0020') detalleAgrupado[leg].totales.horas_nocturnas += cantidad
        if (['0021', '0025', '0030', '0031', '0015', '0016'].includes(row.concepto_codigo)) {
          detalleAgrupado[leg].totales.horas_extra += cantidad
        }
        if (row.concepto_codigo === '0120') detalleAgrupado[leg].totales.presentismo = cantidad
      }

      // Calcular neto para cada empleado
      for (const emp of Object.values(detalleAgrupado)) {
        emp.totales.neto = emp.totales.haberes + emp.totales.no_rem - emp.totales.retenciones
      }

      const empleadosArray = Object.values(detalleAgrupado)
      
      return NextResponse.json({
        periodo: {
          ...periodo,
          tipo_label: getTipoLabel(periodo.tipo),
        },
        empleados: empleadosArray,
        totalEmpleados: empleadosArray.length,
        resumen: {
          total_horas_diurnas: empleadosArray.reduce((sum, e) => sum + e.totales.horas_diurnas, 0),
          total_horas_nocturnas: empleadosArray.reduce((sum, e) => sum + e.totales.horas_nocturnas, 0),
          total_horas_extra: empleadosArray.reduce((sum, e) => sum + e.totales.horas_extra, 0),
          total_haberes: empleadosArray.reduce((sum, e) => sum + e.totales.haberes, 0),
          total_no_rem: empleadosArray.reduce((sum, e) => sum + e.totales.no_rem, 0),
          total_retenciones: empleadosArray.reduce((sum, e) => sum + e.totales.retenciones, 0),
          total_contribuciones: empleadosArray.reduce((sum, e) => sum + e.totales.contribuciones, 0),
          total_neto: empleadosArray.reduce((sum, e) => sum + e.totales.neto, 0),
        }
      })
    }

    // Detalle sin agrupar
    return NextResponse.json({
      periodo: {
        ...periodo,
        tipo_label: getTipoLabel(periodo.tipo),
      },
      detalle,
      totalRegistros: detalle?.length || 0,
    })

  } catch (error) {
    console.error('Error fetching liquidacion:', error)
    return NextResponse.json(
      { error: 'Error al obtener liquidación', details: error instanceof Error ? error.message : 'Unknown error' },
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

