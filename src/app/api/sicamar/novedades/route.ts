import { supabaseSicamar } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tipos = searchParams.get('tipos') === 'true'
    const estado = searchParams.get('estado')
    const tipo = searchParams.get('tipo')
    const empleadoId = searchParams.get('empleado_id')
    const periodoId = searchParams.get('periodo_id')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Si se piden los tipos de novedad (catálogo)
    if (tipos) {
      const { data, error } = await supabaseSicamar
        .from('tipos_novedad')
        .select('*')
        .order('tipo')
        .order('codigo')

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ tipos: data || [] })
    }

    // Obtener novedades de liquidación
    let query = supabaseSicamar
      .from('novedades_liquidacion')
      .select(`
        *,
        empleados:empleado_id (
          id,
          legajo,
          nombre,
          apellido,
          sector
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (estado && estado !== 'todos') {
      query = query.eq('estado', estado)
    }

    if (tipo && tipo !== 'todos') {
      query = query.eq('tipo', tipo)
    }

    if (empleadoId) {
      query = query.eq('empleado_id', parseInt(empleadoId))
    }

    if (periodoId) {
      query = query.eq('periodo_id', parseInt(periodoId))
    }

    const { data: novedades, error } = await query

    if (error) {
      console.error('Error fetching novedades:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Formatear datos
    const novedadesFormateadas = (novedades || []).map(n => {
      const emp = n.empleados as any
      return {
        id: n.id,
        empleado_id: n.empleado_id,
        legajo: n.legajo,
        concepto_codigo: n.concepto_codigo,
        concepto_descripcion: n.concepto_descripcion,
        tipo: n.tipo,
        cantidad: n.cantidad,
        importe: n.importe,
        estado: n.estado || 'pendiente',
        motivo: n.motivo,
        recurrente: n.recurrente,
        empleado_nombre: emp ? `${emp.apellido}, ${emp.nombre}` : null,
        sector: emp?.sector,
        created_at: n.created_at
      }
    })

    // Calcular resumen
    const resumen = {
      total: novedadesFormateadas.length,
      pendientes: novedadesFormateadas.filter(n => n.estado === 'pendiente').length,
      aprobadas: novedadesFormateadas.filter(n => n.estado === 'aprobada').length,
      procesadas: novedadesFormateadas.filter(n => n.estado === 'procesada').length,
      total_haberes: novedadesFormateadas
        .filter(n => n.tipo === 'haber')
        .reduce((sum, n) => sum + (n.importe || 0), 0),
      total_retenciones: novedadesFormateadas
        .filter(n => n.tipo === 'retencion')
        .reduce((sum, n) => sum + (n.importe || 0), 0)
    }

    return NextResponse.json({ novedades: novedadesFormateadas, resumen })

  } catch (error: unknown) {
    console.error('Error in novedades API:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: Crear novedad
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      empleado_id, 
      legajo, 
      concepto_codigo, 
      concepto_descripcion,
      tipo, 
      cantidad, 
      importe, 
      motivo,
      recurrente,
      periodo_id
    } = body

    if (!empleado_id || !concepto_codigo) {
      return NextResponse.json(
        { error: 'Se requiere empleado_id y concepto_codigo' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseSicamar
      .from('novedades_liquidacion')
      .insert({
        empleado_id,
        legajo,
        concepto_codigo,
        concepto_descripcion,
        tipo: tipo || 'haber',
        cantidad,
        importe,
        motivo,
        recurrente: recurrente || false,
        estado: 'pendiente',
        periodo_id
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

// PUT: Actualizar novedad (cambiar estado, aprobar, etc)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, estado, aprobado_por, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Se requiere id' }, { status: 400 })
    }

    const updateData: any = { ...updates }
    if (estado) {
      updateData.estado = estado
    }
    if (aprobado_por) {
      updateData.aprobado_por = aprobado_por
      updateData.aprobado_at = new Date().toISOString()
    }

    const { data, error } = await supabaseSicamar
      .from('novedades_liquidacion')
      .update(updateData)
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

// DELETE: Eliminar novedad
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Se requiere id' }, { status: 400 })
    }

    const { error } = await supabaseSicamar
      .from('novedades_liquidacion')
      .delete()
      .eq('id', parseInt(id))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}



