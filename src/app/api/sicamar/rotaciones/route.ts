import { supabaseSicamar } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// GET: Obtener empleados con su rotación actual
export async function GET() {
  try {
    // Intentar usar la vista
    const { data: fromView, error: viewError } = await supabaseSicamar
      .from('v_empleados_rotaciones')
      .select('*')

    if (!viewError && fromView) {
      const data = fromView.map(emp => ({
        empleado_id: emp.empleado_id,
        legajo: emp.legajo,
        nombre_completo: `${emp.apellido}, ${emp.nombre}`,
        dni: emp.dni,
        cargo_actual: emp.cargo,
        sector: emp.sector,
        categoria: emp.categoria,
        activo: emp.activo,
        foto_url: emp.foto_url,
        foto_thumb_url: emp.foto_thumb_url,
        condicion_contratacion: emp.condicion_contratacion || 'efectivo',
        rotacion_id: emp.rotacion_id,
        rotacion_nombre: emp.rotacion_nombre,
        turnos: emp.turnos,
        frecuencia_semanas: emp.frecuencia_semanas,
        cantidad_turnos: emp.cantidad_turnos,
        fecha_desde: emp.fecha_desde,
      }))

      return NextResponse.json({ data, source: 'view' })
    }

    // Fallback: query manual
    const { data: empleados, error: empError } = await supabaseSicamar
      .from('empleados')
      .select('id, legajo, nombre, apellido, dni, categoria, sector, cargo, activo, foto_url, foto_thumb_url, condicion_contratacion')
      .eq('activo', true)
      .order('apellido')
      .order('nombre')

    if (empError) {
      console.error('Error fetching empleados:', empError)
      return NextResponse.json({ error: empError.message }, { status: 500 })
    }

    // Obtener asignaciones activas
    const { data: asignaciones } = await supabaseSicamar
      .from('empleado_rotacion')
      .select(`
        empleado_id,
        fecha_desde,
        rotaciones:rotacion_id (
          id, nombre, turnos, frecuencia_semanas
        )
      `)
      .is('fecha_hasta', null)

    // Mapa de asignaciones
    const asignacionesMap = new Map<number, {
      rotacion: { id: number; nombre: string; turnos: unknown[]; frecuencia_semanas: number } | null
      fecha_desde: string | null
    }>()

    for (const asig of asignaciones || []) {
      // rotaciones puede venir como objeto o array dependiendo de cómo Supabase resuelve el join
      const rotacionData = asig.rotaciones
      const rotacion = Array.isArray(rotacionData) 
        ? rotacionData[0] as { id: number; nombre: string; turnos: unknown[]; frecuencia_semanas: number } | undefined
        : rotacionData as { id: number; nombre: string; turnos: unknown[]; frecuencia_semanas: number } | null
      
      asignacionesMap.set(asig.empleado_id, {
        rotacion: rotacion || null,
        fecha_desde: asig.fecha_desde
      })
    }

    const data = (empleados || []).map(emp => {
      const asig = asignacionesMap.get(emp.id)
      const rot = asig?.rotacion

      return {
        empleado_id: emp.id,
        legajo: emp.legajo,
        nombre_completo: `${emp.apellido}, ${emp.nombre}`,
        dni: emp.dni,
        cargo_actual: emp.cargo,
        sector: emp.sector,
        categoria: emp.categoria,
        activo: emp.activo,
        foto_url: emp.foto_url,
        foto_thumb_url: emp.foto_thumb_url,
        condicion_contratacion: emp.condicion_contratacion || 'efectivo',
        rotacion_id: rot?.id || null,
        rotacion_nombre: rot?.nombre || null,
        turnos: rot?.turnos || null,
        frecuencia_semanas: rot?.frecuencia_semanas || null,
        cantidad_turnos: rot?.turnos ? (rot.turnos as unknown[]).length : 0,
        fecha_desde: asig?.fecha_desde || null,
      }
    })

    return NextResponse.json({ data, source: 'fallback' })
  } catch (error: unknown) {
    console.error('Error in rotaciones API:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
