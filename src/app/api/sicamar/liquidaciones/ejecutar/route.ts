import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'
import { ResultadoLiquidacion } from '@/lib/liquidacion-engine'

interface EjecutarRequest {
  periodo: {
    anio: number
    mes: number
    tipo: string
    descripcion: string
    fecha_desde: string
    fecha_hasta: string
    clase: string | null
  }
  resumen: {
    total_empleados: number
    total_haberes: number
    total_no_remunerativos: number
    total_retenciones: number
    total_contribuciones: number
    total_neto: number
  }
  empleados: ResultadoLiquidacion[]
}

/**
 * POST /api/sicamar/liquidaciones/ejecutar
 * 
 * Guarda la liquidación como histórica (cierra el período)
 */
export async function POST(request: NextRequest) {
  try {
    const body: EjecutarRequest = await request.json()
    const { periodo, resumen, empleados } = body
    
    // Validaciones
    if (!periodo || !resumen || !empleados || empleados.length === 0) {
      return NextResponse.json(
        { error: 'Datos de liquidación incompletos' },
        { status: 400 }
      )
    }
    
    // 1. Verificar que no exista ya una liquidación para este período
    const { data: existente } = await supabaseSicamar
      .from('periodos_liquidacion')
      .select('id')
      .eq('anio', periodo.anio)
      .eq('mes', periodo.mes)
      .eq('tipo', periodo.tipo)
      .eq('estado', 'cerrado')
      .single()
    
    if (existente) {
      return NextResponse.json(
        { error: 'Ya existe una liquidación cerrada para este período' },
        { status: 409 }
      )
    }
    
    // 2. Crear el período de liquidación
    const { data: periodoData, error: periodoError } = await supabaseSicamar
      .from('periodos_liquidacion')
      .insert({
        anio: periodo.anio,
        mes: periodo.mes,
        tipo: periodo.tipo,
        descripcion: periodo.descripcion,
        fecha_desde: periodo.fecha_desde,
        fecha_hasta: periodo.fecha_hasta,
        estado: 'cerrado',
        total_empleados: resumen.total_empleados,
        total_haberes: resumen.total_haberes,
        total_no_remunerativos: resumen.total_no_remunerativos,
        total_retenciones: resumen.total_retenciones,
        total_contribuciones: resumen.total_contribuciones,
        total_neto: resumen.total_neto,
        fecha_cierre: new Date().toISOString(),
        origen: 'kalia',
      })
      .select()
      .single()
    
    if (periodoError) {
      console.error('Error creando período:', periodoError)
      return NextResponse.json(
        { error: 'Error al crear período de liquidación', details: periodoError.message },
        { status: 500 }
      )
    }
    
    const periodoId = periodoData.id
    
    // 3. Eliminar detalle anterior si existe (para reemplazar)
    await supabaseSicamar
      .from('liquidacion_detalle')
      .delete()
      .eq('periodo_id', periodoId)
    
    // 4. Insertar el detalle de cada empleado
    const detalleRecords: {
      periodo_id: number
      legajo: number
      empleado_id: number
      concepto_codigo: string
      concepto_descripcion: string
      concepto_tipo: number
      cantidad: number | null
      valor_unitario: number | null
      importe: number
      formula_aplicada: string
    }[] = []
    
    for (const emp of empleados) {
      for (const concepto of emp.conceptos) {
        detalleRecords.push({
          periodo_id: periodoId,
          legajo: parseInt(emp.legajo),
          empleado_id: emp.empleado_id,
          concepto_codigo: concepto.concepto_codigo,
          concepto_descripcion: concepto.concepto_descripcion,
          concepto_tipo: concepto.concepto_tipo,
          cantidad: concepto.cantidad,
          valor_unitario: concepto.valor_unitario,
          importe: concepto.importe,
          formula_aplicada: concepto.formula_aplicada,
        })
      }
    }
    
    // Insertar en lotes de 500
    const BATCH_SIZE = 500
    for (let i = 0; i < detalleRecords.length; i += BATCH_SIZE) {
      const batch = detalleRecords.slice(i, i + BATCH_SIZE)
      const { error: detalleError } = await supabaseSicamar
        .from('liquidacion_detalle')
        .insert(batch)
      
      if (detalleError) {
        console.error(`Error insertando lote ${i / BATCH_SIZE + 1}:`, detalleError)
        // Intentar continuar con el siguiente lote
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Liquidación ejecutada y guardada correctamente',
      periodo_id: periodoId,
      registros_guardados: detalleRecords.length,
      periodo: {
        ...periodo,
        id: periodoId,
        estado: 'cerrado',
        fecha_cierre: new Date().toISOString(),
      },
    })
    
  } catch (error) {
    console.error('Error ejecutando liquidación:', error)
    return NextResponse.json(
      { error: 'Error al ejecutar liquidación', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
