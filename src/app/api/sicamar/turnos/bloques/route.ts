import { supabaseSicamar } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const incluirEmpleados = searchParams.get('incluirEmpleados') === 'true'
    const semana = searchParams.get('semana') // formato: YYYY-MM-DD (lunes de la semana)
    const planta = searchParams.get('planta')

    // Obtener bloques de rotación
    let query = supabaseSicamar
      .from('bloques_rotacion')
      .select('*')
      .eq('activo', true)
      .order('planta')
      .order('codigo')

    if (planta) {
      query = query.eq('planta', planta)
    }

    const { data: bloques, error } = await query

    if (error) {
      console.error('Error fetching bloques:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Si no hay semana, devolver bloques sin turno actual
    if (!semana || !bloques || bloques.length === 0) {
      return NextResponse.json({ 
        bloques: bloques?.map(b => ({
          ...b,
          total_empleados: 0,
          turno_actual: null,
          empleados: []
        })) || []
      })
    }

    // Obtener rotaciones semanales para la semana especificada
    const { data: rotaciones } = await supabaseSicamar
      .from('rotaciones_semanales')
      .select(`
        bloque_id,
        turno_id,
        confirmado,
        turnos:turno_id (
          id,
          codigo,
          hora_entrada,
          hora_salida
        )
      `)
      .eq('semana_inicio', semana)

    // Crear mapa de rotaciones por bloque
    const rotacionesMap = new Map<number, { turno_id: number; turno: any; confirmado: boolean }>()
    for (const r of rotaciones || []) {
      rotacionesMap.set(r.bloque_id, {
        turno_id: r.turno_id,
        turno: r.turnos,
        confirmado: r.confirmado
      })
    }

    // Si se piden empleados, obtener asignaciones
    let empleadosMap = new Map<number, any[]>()
    
    if (incluirEmpleados) {
      // Obtener grupos de rotación con sus miembros
      const { data: grupos } = await supabaseSicamar
        .from('grupos_rotacion')
        .select(`
          id,
          bloque_id,
          codigo,
          nombre,
          grupo_miembros (
            id,
            empleado_id,
            es_lider,
            activo,
            empleados:empleado_id (
              id,
              legajo,
              nombre,
              apellido,
              categoria,
              sector,
              turno_fijo_id
            )
          )
        `)
        .eq('activo', true)

      // Agrupar empleados por bloque
      for (const grupo of grupos || []) {
        if (!empleadosMap.has(grupo.bloque_id)) {
          empleadosMap.set(grupo.bloque_id, [])
        }
        
        for (const miembro of grupo.grupo_miembros || []) {
          if (miembro.activo && miembro.empleados) {
            const emp = miembro.empleados as any
            empleadosMap.get(grupo.bloque_id)!.push({
              id: miembro.id,
              empleado_id: miembro.empleado_id,
              legajo: emp.legajo,
              nombre: emp.nombre,
              apellido: emp.apellido,
              nombre_completo: `${emp.apellido}, ${emp.nombre}`,
              turno_fijo_id: emp.turno_fijo_id,
              turno_fijo_codigo: null, // Se podría obtener si es necesario
              es_lider: miembro.es_lider
            })
          }
        }
      }
    }

    // Combinar datos
    const bloquesConDatos = bloques.map(bloque => {
      const rotacion = rotacionesMap.get(bloque.id)
      const empleados = empleadosMap.get(bloque.id) || []
      
      return {
        ...bloque,
        total_empleados: empleados.length,
        turno_actual: rotacion?.turno || null,
        empleados: incluirEmpleados ? empleados : undefined
      }
    })

    return NextResponse.json({ bloques: bloquesConDatos })

  } catch (error: unknown) {
    console.error('Error in turnos/bloques API:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: Crear rotación semanal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bloque_id, semana_inicio, turno_id } = body

    if (!bloque_id || !semana_inicio || !turno_id) {
      return NextResponse.json(
        { error: 'Se requiere bloque_id, semana_inicio y turno_id' },
        { status: 400 }
      )
    }

    // Upsert: actualizar si existe, crear si no
    const { data, error } = await supabaseSicamar
      .from('rotaciones_semanales')
      .upsert(
        { bloque_id, semana_inicio, turno_id, confirmado: true },
        { onConflict: 'bloque_id,semana_inicio' }
      )
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



