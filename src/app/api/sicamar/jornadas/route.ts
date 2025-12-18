import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'

// DELETE: Borrar jornadas específicas o TODAS
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fecha = searchParams.get('fecha')
    const turnoNot = searchParams.get('turno_not') // Borrar los que NO son este turno
    const empleadoIds = searchParams.get('empleado_ids') // Lista de IDs separados por coma
    const truncar = searchParams.get('truncar') === 'true' // Borrar TODAS las jornadas
    
    // Truncar toda la tabla
    if (truncar) {
      const { error, count } = await supabaseSicamar
        .from('jornadas_diarias')
        .delete()
        .gte('id', 0) // Trick para borrar todo
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({ success: true, deleted: count, message: 'Tabla jornadas_diarias vaciada' })
    }
    
    if (!fecha) {
      return NextResponse.json({ error: 'Se requiere fecha o truncar=true' }, { status: 400 })
    }
    
    let query = supabaseSicamar
      .from('jornadas_diarias')
      .delete()
      .eq('fecha', fecha)
    
    if (turnoNot) {
      query = query.neq('turno_asignado', turnoNot)
    }
    
    if (empleadoIds) {
      const ids = empleadoIds.split(',').map(id => parseInt(id.trim()))
      query = query.in('empleado_id', ids)
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

// GET: Obtener jornadas de un período
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')
    const empleadoId = searchParams.get('empleado_id')
    const soloPlanificado = searchParams.get('solo_planificado') === 'true'
    
    if (!desde || !hasta) {
      return NextResponse.json(
        { error: 'Se requiere desde y hasta' },
        { status: 400 }
      )
    }
    
    let query = supabaseSicamar
      .from('jornadas_diarias')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha')
    
    if (empleadoId) {
      query = query.eq('empleado_id', parseInt(empleadoId))
    }
    
    // Filtrar solo planificadas (sin ejecución): hora_entrada_real es null
    if (soloPlanificado) {
      query = query.is('hora_entrada_real', null)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching jornadas:', error)
      return NextResponse.json(
        { error: 'Error obteniendo jornadas', details: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, data })
    
  } catch (error) {
    console.error('Error in jornadas GET:', error)
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    )
  }
}

// POST: Crear o actualizar jornada
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { empleado_id, fecha, ...jornadaData } = body
    
    if (!empleado_id || !fecha) {
      return NextResponse.json(
        { error: 'Se requiere empleado_id y fecha' },
        { status: 400 }
      )
    }
    
    // Verificar si existe
    const { data: existing } = await supabaseSicamar
      .from('jornadas_diarias')
      .select('id')
      .eq('empleado_id', empleado_id)
      .eq('fecha', fecha)
      .single()
    
    const now = new Date().toISOString()
    
    if (existing) {
      // Actualizar
      const { data, error } = await supabaseSicamar
        .from('jornadas_diarias')
        .update({
          ...jornadaData,
          updated_at: now,
        })
        .eq('id', existing.id)
        .select()
        .single()
      
      if (error) {
        console.error('Error updating jornada:', error)
        return NextResponse.json(
          { error: 'Error actualizando jornada', details: error.message },
          { status: 500 }
        )
      }
      
      return NextResponse.json({ success: true, data, action: 'updated' })
    } else {
      // Crear
      const { data, error } = await supabaseSicamar
        .from('jornadas_diarias')
        .insert({
          empleado_id,
          fecha,
          ...jornadaData,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single()
      
      if (error) {
        console.error('Error creating jornada:', error)
        return NextResponse.json(
          { error: 'Error creando jornada', details: error.message },
          { status: 500 }
        )
      }
      
      return NextResponse.json({ success: true, data, action: 'created' })
    }
    
  } catch (error) {
    console.error('Error in jornadas POST:', error)
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    )
  }
}

// PATCH: Copiar turnos N del lunes al domingo anterior (solo planificación, sin horas)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { fechaLunes, limpiarDomingo } = body as { fechaLunes: string; limpiarDomingo?: boolean }
    
    if (!fechaLunes) {
      return NextResponse.json(
        { error: 'Se requiere fechaLunes' },
        { status: 400 }
      )
    }
    
    // Calcular el domingo anterior
    const lunesDate = new Date(fechaLunes + 'T12:00:00')
    if (lunesDate.getDay() !== 1) {
      return NextResponse.json(
        { error: 'fechaLunes debe ser un lunes' },
        { status: 400 }
      )
    }
    
    const domingoDate = new Date(lunesDate)
    domingoDate.setDate(domingoDate.getDate() - 1)
    const fechaDomingo = domingoDate.toISOString().split('T')[0]
    
    // Si solo queremos limpiar el domingo
    if (limpiarDomingo) {
      const { error } = await supabaseSicamar
        .from('jornadas_diarias')
        .update({
          horas_trabajadas: 0,
          horas_diurnas: 0,
          horas_nocturnas: 0,
          hora_salida_real: null,
          tiene_inconsistencia: false,
          tipo_inconsistencia: null
        })
        .eq('fecha', fechaDomingo)
        .eq('turno_asignado', 'N')
      
      if (error) {
        return NextResponse.json({ error: 'Error limpiando domingo' }, { status: 500 })
      }
      
      return NextResponse.json({
        success: true,
        message: `Limpiadas las horas del domingo ${fechaDomingo}`
      })
    }
    
    // Obtener todas las jornadas del lunes con turno N
    const { data: jornadasLunes, error: fetchError } = await supabaseSicamar
      .from('jornadas_diarias')
      .select('*')
      .eq('fecha', fechaLunes)
      .eq('turno_asignado', 'N')
    
    if (fetchError) {
      console.error('Error fetching jornadas lunes:', fetchError)
      return NextResponse.json(
        { error: 'Error obteniendo jornadas del lunes' },
        { status: 500 }
      )
    }
    
    if (!jornadasLunes || jornadasLunes.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay turnos N el lunes',
        count: 0
      })
    }
    
    // Crear jornadas para el domingo (solo planificación, sin horas trabajadas)
    const jornadasDomingo = jornadasLunes.map(j => ({
      empleado_id: j.empleado_id,
      fecha: fechaDomingo,
      turno_asignado: 'N',
      hora_entrada_asignada: j.hora_entrada_asignada,
      hora_salida_asignada: j.hora_salida_asignada,
      horas_asignadas: 0, // El domingo no tiene horas, las horas van al lunes
      horas_trabajadas: 0,
      horas_diurnas: 0,
      horas_nocturnas: 0,
      hora_entrada_real: j.hora_entrada_real, // Solo la entrada
      hora_salida_real: null, // La salida es del lunes
      origen: j.origen,
      estado_empleado: j.estado_empleado,
      tiene_inconsistencia: false,
      tipo_inconsistencia: null
    }))
    
    // Insertar (upsert)
    const { error: insertError } = await supabaseSicamar
      .from('jornadas_diarias')
      .upsert(jornadasDomingo, { onConflict: 'empleado_id,fecha' })
    
    if (insertError) {
      console.error('Error insertando jornadas domingo:', insertError)
      return NextResponse.json(
        { error: 'Error creando jornadas del domingo', details: insertError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: `Copiados ${jornadasDomingo.length} turnos N del lunes ${fechaLunes} al domingo ${fechaDomingo}`,
      count: jornadasDomingo.length
    })
    
  } catch (error) {
    console.error('Error in jornadas PATCH:', error)
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    )
  }
}

