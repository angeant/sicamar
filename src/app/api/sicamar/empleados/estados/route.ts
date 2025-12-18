import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'

// GET - Obtener estados actuales de empleados
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const empleadoId = searchParams.get('empleado_id')
    const soloVigentes = searchParams.get('vigentes') !== 'false'

    // Primero obtener los tipos de estado
    const { data: tiposData } = await supabaseSicamar
      .from('tipos_estado_empleado')
      .select('codigo, nombre, color')

    const tiposMap = new Map(
      (tiposData || []).map(t => [t.codigo, { nombre: t.nombre, color: t.color }])
    )

    // Luego obtener los estados
    let query = supabaseSicamar
      .from('empleado_estados')
      .select(`
        id,
        empleado_id,
        tipo_estado,
        fecha_inicio,
        fecha_fin,
        motivo,
        certificado_url,
        reportado_por,
        reportado_desde,
        created_at
      `)
      .order('fecha_inicio', { ascending: false })

    if (empleadoId) {
      query = query.eq('empleado_id', empleadoId)
    }

    if (soloVigentes) {
      const today = new Date().toISOString().split('T')[0]
      query = query
        .lte('fecha_inicio', today)
        .or(`fecha_fin.is.null,fecha_fin.gte.${today}`)
    }

    const { data, error } = await query

    if (error) throw error

    // Enriquecer con datos del tipo
    const estadosConTipo = (data || []).map(estado => ({
      ...estado,
      tipos_estado_empleado: tiposMap.get(estado.tipo_estado) || { 
        nombre: estado.tipo_estado, 
        color: '#6B7280' 
      }
    }))

    return NextResponse.json(estadosConTipo)
  } catch (error) {
    console.error('Error fetching estados:', error)
    return NextResponse.json(
      { error: 'Error al obtener estados' },
      { status: 500 }
    )
  }
}

// POST - Crear nuevo estado
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      empleado_id,
      tipo_estado,
      fecha_inicio,
      fecha_fin,
      motivo,
      certificado_url,
      reportado_por = 'sistema',
      reportado_desde = 'web'
    } = body

    if (!empleado_id || !tipo_estado || !fecha_inicio) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: empleado_id, tipo_estado, fecha_inicio' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseSicamar
      .from('empleado_estados')
      .insert({
        empleado_id,
        tipo_estado,
        fecha_inicio,
        fecha_fin,
        motivo,
        certificado_url,
        reportado_por,
        reportado_desde
      })
      .select(`
        *,
        tipos_estado_empleado (
          codigo,
          nombre,
          color
        )
      `)
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating estado:', error)
    return NextResponse.json(
      { error: 'Error al crear estado' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar estado (ej: cerrar fecha_fin)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, fecha_fin, motivo } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Se requiere el ID del estado' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (fecha_fin !== undefined) updateData.fecha_fin = fecha_fin
    if (motivo !== undefined) updateData.motivo = motivo

    const { data, error } = await supabaseSicamar
      .from('empleado_estados')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating estado:', error)
    return NextResponse.json(
      { error: 'Error al actualizar estado' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar estado
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Se requiere el ID del estado' },
        { status: 400 }
      )
    }

    const { error } = await supabaseSicamar
      .from('empleado_estados')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting estado:', error)
    return NextResponse.json(
      { error: 'Error al eliminar estado' },
      { status: 500 }
    )
  }
}
