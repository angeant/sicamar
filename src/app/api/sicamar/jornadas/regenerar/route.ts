import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'
import { calcularHorasExtra } from '@/lib/horas-extra'

// DELETE: Borrar todas las jornadas
export async function DELETE() {
  try {
    const { error } = await supabaseSicamar
      .from('jornadas_diarias')
      .delete()
      .gte('fecha', '2000-01-01') // Borrar todo
    
    if (error) {
      console.error('Error borrando jornadas:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, message: 'Todas las jornadas borradas' })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: Regenerar jornadas de una quincena desde las marcaciones
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { anio, mes, quincena } = body
    
    if (!anio || !mes || !quincena) {
      return NextResponse.json(
        { error: 'Se requiere anio, mes y quincena' },
        { status: 400 }
      )
    }
    
    // Calcular fechas del período
    const ultimoDia = new Date(anio, mes, 0).getDate()
    const desde = quincena === 1 ? 1 : 16
    const hasta = quincena === 1 ? 15 : ultimoDia
    const fechaDesde = `${anio}-${String(mes).padStart(2, '0')}-${String(desde).padStart(2, '0')}`
    const fechaHasta = `${anio}-${String(mes).padStart(2, '0')}-${String(hasta).padStart(2, '0')}`
    
    // Extender rango para capturar turnos nocturnos
    const fechaDesdeExtendida = new Date(fechaDesde + 'T00:00:00')
    fechaDesdeExtendida.setDate(fechaDesdeExtendida.getDate() - 1)
    const fechaHastaExtendida = new Date(fechaHasta + 'T23:59:59')
    fechaHastaExtendida.setDate(fechaHastaExtendida.getDate() + 2)
    
    console.log(`[Regenerar] Período: ${fechaDesde} a ${fechaHasta}`)
    
    // 1. Obtener empleados jornalizados activos
    const { data: empleados } = await supabaseSicamar
      .from('empleados')
      .select('id, legajo, fecha_ingreso')
      .eq('activo', true)
      .eq('clase', 'Jornal')
    
    if (!empleados || empleados.length === 0) {
      return NextResponse.json({ success: true, message: 'No hay empleados jornalizados', count: 0 })
    }
    
    // 2. Obtener identificaciones biométricas
    const { data: identificaciones } = await supabaseSicamar
      .from('empleado_identificaciones')
      .select('empleado_id, id_biometrico')
      .eq('activo', true)
    
    const idBiometricoPorEmpleado = new Map<number, string>()
    const empleadoPorIdBiometrico = new Map<string, number>()
    for (const id of identificaciones || []) {
      idBiometricoPorEmpleado.set(id.empleado_id, id.id_biometrico)
      empleadoPorIdBiometrico.set(id.id_biometrico, id.empleado_id)
    }
    
    // 3. Obtener todas las marcaciones del período extendido (paginado)
    let allMarcaciones: Array<{ id_biometrico: string; tipo: string; fecha_hora: string }> = []
    let page = 0
    const pageSize = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: pageData } = await supabaseSicamar
        .from('marcaciones')
        .select('id_biometrico, tipo, fecha_hora')
        .gte('fecha_hora', fechaDesdeExtendida.toISOString())
        .lte('fecha_hora', fechaHastaExtendida.toISOString())
        .order('fecha_hora')
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (pageData && pageData.length > 0) {
        allMarcaciones = [...allMarcaciones, ...pageData]
        page++
        hasMore = pageData.length === pageSize
      } else {
        hasMore = false
      }
    }
    
    console.log(`[Regenerar] Marcaciones cargadas: ${allMarcaciones.length}`)
    
    // 4. Agrupar marcaciones por empleado
    const marcacionesPorEmpleado = new Map<string, typeof allMarcaciones>()
    for (const marc of allMarcaciones) {
      if (!marcacionesPorEmpleado.has(marc.id_biometrico)) {
        marcacionesPorEmpleado.set(marc.id_biometrico, [])
      }
      marcacionesPorEmpleado.get(marc.id_biometrico)!.push(marc)
    }
    
    // 5. Obtener feriados
    const { data: feriadosDB } = await supabaseSicamar
      .from('feriados')
      .select('*')
      .eq('anio', anio)
    
    const feriadosSet = new Set<string>()
    for (const f of feriadosDB || []) {
      if (!f.es_laborable) {
        feriadosSet.add(f.fecha)
      }
    }
    
    // 6. Borrar jornadas existentes del período
    const { error: deleteError } = await supabaseSicamar
      .from('jornadas_diarias')
      .delete()
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)
    
    if (deleteError) {
      console.error('Error borrando jornadas:', deleteError)
      return NextResponse.json({ error: 'Error borrando jornadas existentes' }, { status: 500 })
    }
    
    // 7. Procesar cada empleado y crear jornadas
    const jornadasAInsertar: Array<{
      empleado_id: number
      fecha: string
      turno_asignado: string
      hora_entrada_real: string | null
      hora_salida_real: string | null
      horas_trabajadas: number
      horas_diurnas: number
      horas_nocturnas: number
      horas_extra_50: number
      horas_extra_100: number
      horas_feriado: number
      origen: string
      tiene_inconsistencia: boolean
      tipo_inconsistencia: string | null
    }> = []
    
    for (const emp of empleados) {
      const idBiometrico = idBiometricoPorEmpleado.get(emp.id)
      if (!idBiometrico) continue
      
      const marcaciones = marcacionesPorEmpleado.get(idBiometrico) || []
      if (marcaciones.length === 0) continue
      
      // Ordenar por fecha/hora
      marcaciones.sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())
      
      // Emparejar entradas con salidas
      let entradaActual: Date | null = null
      
      for (const marc of marcaciones) {
        const fechaMarcacion = new Date(marc.fecha_hora)
        
        if (marc.tipo === 'E') {
          // Si ya hay una entrada pendiente, mantener la primera y descartar esta
          // (fichaje duplicado por error del empleado)
          if (!entradaActual) {
            entradaActual = fechaMarcacion
          }
          // Si ya hay entrada, la ignoramos - usamos la primera
        } else if (marc.tipo === 'S' && entradaActual) {
          const salida = fechaMarcacion
          
          // Validar jornada (máximo 14 horas)
          const horasTotal = (salida.getTime() - entradaActual.getTime()) / (1000 * 60 * 60)
          if (horasTotal <= 0 || horasTotal > 14) {
            entradaActual = null
            continue
          }
          
          // IMPORTANTE: La fecha de trabajo es la fecha de ENTRADA en hora Argentina
          const fechaTrabajoStr = entradaActual.toLocaleDateString('en-CA', { 
            timeZone: 'America/Argentina/Buenos_Aires' 
          })
          
          // Verificar si está en el período
          if (fechaTrabajoStr < fechaDesde || fechaTrabajoStr > fechaHasta) {
            entradaActual = null
            continue
          }
          
          const fecha = new Date(fechaTrabajoStr + 'T12:00:00')
          const diaSemana = fecha.getDay()
          const esFeriado = feriadosSet.has(fechaTrabajoStr)
          const esSabado = diaSemana === 6
          const esDomingo = diaSemana === 0
          
          // Jornada máxima: Domingo 0h (todo es extra), Sábado 7h (o 6h después de 13hs), resto 8h
          // Para domingo, toda la jornada va como extra 100%
          const jornadaMaxima = esDomingo ? 0 : esSabado ? 7 : 8
          
          // Determinar turno basado en hora de entrada
          const horaEntradaArg = parseInt(entradaActual.toLocaleTimeString('en-US', { 
            timeZone: 'America/Argentina/Buenos_Aires',
            hour12: false,
            hour: '2-digit'
          }))
          
          let turno = 'M'
          if (horaEntradaArg >= 20 || horaEntradaArg < 4) {
            turno = 'N'
          } else if (horaEntradaArg >= 12) {
            turno = 'T'
          }
          
          // Usar algoritmo de horas extra para calcular correctamente
          // REGLA FIN DE SEMANA: Sábado desde 13hs y Domingo = todo extra 100%
          const extras = calcularHorasExtra(entradaActual, salida, jornadaMaxima, esFeriado)
          
          const horasExtra50 = extras.extra_50_diu + extras.extra_50_noc
          const horasExtra100 = extras.extra_100_diu + extras.extra_100_noc
          const horasNormalesConvertidas = extras.horas_normales_a_100 || 0
          
          // Horas trabajadas normales = jornada máxima menos las convertidas a extra
          let horasTrabajadas = Math.max(0, Math.min(horasTotal, jornadaMaxima) - horasNormalesConvertidas)
          
          // Para domingo, las horas trabajadas normales son 0 (todo es extra)
          if (esDomingo) {
            horasTrabajadas = 0
          }
          
          let horasDiurnas = turno !== 'N' ? horasTrabajadas : 0
          let horasNocturnas = turno === 'N' ? horasTrabajadas : 0
          
          jornadasAInsertar.push({
            empleado_id: emp.id,
            fecha: fechaTrabajoStr,
            turno_asignado: turno,
            hora_entrada_real: entradaActual.toISOString(),
            hora_salida_real: salida.toISOString(),
            horas_trabajadas: Math.round(horasTrabajadas * 100) / 100,
            horas_diurnas: Math.round(horasDiurnas * 100) / 100,
            horas_nocturnas: Math.round(horasNocturnas * 100) / 100,
            horas_extra_50: Math.round(horasExtra50 * 100) / 100,
            horas_extra_100: Math.round(horasExtra100 * 100) / 100,
            horas_feriado: esFeriado ? horasTotal : 0,
            origen: 'reloj',
            tiene_inconsistencia: false,
            tipo_inconsistencia: null
          })
          
          entradaActual = null
        }
      }
      
      // Si quedó una entrada sin salida al final
      if (entradaActual) {
        const fechaTrabajoStr = entradaActual.toLocaleDateString('en-CA', { 
          timeZone: 'America/Argentina/Buenos_Aires' 
        })
        
        if (fechaTrabajoStr >= fechaDesde && fechaTrabajoStr <= fechaHasta) {
          const fecha = new Date(fechaTrabajoStr + 'T12:00:00')
          const diaSemana = fecha.getDay()
          const esDomingo = diaSemana === 0
          const esSabado = diaSemana === 6
          const esFeriado = feriadosSet.has(fechaTrabajoStr)
          
          const horaEntradaArg = parseInt(entradaActual.toLocaleTimeString('en-US', { 
            timeZone: 'America/Argentina/Buenos_Aires',
            hour12: false,
            hour: '2-digit'
          }))
          
          let turno = 'M'
          if (horaEntradaArg >= 20 || horaEntradaArg < 4) turno = 'N'
          else if (horaEntradaArg >= 12) turno = 'T'
          
          // Para domingo o sábado 13+, todo es extra 100% (horas normales = 0)
          // Para falta de salida usamos enfoque optimista
          const esFinDeSemanaCritico = esDomingo || (esSabado && horaEntradaArg >= 13) || esFeriado
          const horasOptimistas = esDomingo ? 8 : esSabado ? 7 : 8
          
          let horasTrabajadas = esFinDeSemanaCritico ? 0 : horasOptimistas
          let horasExtra100 = esFinDeSemanaCritico ? horasOptimistas : 0
          
          jornadasAInsertar.push({
            empleado_id: emp.id,
            fecha: fechaTrabajoStr,
            turno_asignado: turno,
            hora_entrada_real: entradaActual.toISOString(),
            hora_salida_real: null,
            horas_trabajadas: horasTrabajadas,
            horas_diurnas: turno !== 'N' ? horasTrabajadas : 0,
            horas_nocturnas: turno === 'N' ? horasTrabajadas : 0,
            horas_extra_50: 0,
            horas_extra_100: horasExtra100,
            horas_feriado: esFeriado ? horasOptimistas : 0,
            origen: 'reloj',
            tiene_inconsistencia: true,
            tipo_inconsistencia: 'falta_salida'
          })
        }
      }
    }
    
    console.log(`[Regenerar] Jornadas brutas: ${jornadasAInsertar.length}`)
    
    // 8. Consolidar: si hay múltiples jornadas para el mismo empleado/fecha, combinarlas
    const jornadasConsolidadas = new Map<string, typeof jornadasAInsertar[0]>()
    
    for (const j of jornadasAInsertar) {
      const key = `${j.empleado_id}-${j.fecha}`
      const existing = jornadasConsolidadas.get(key)
      
      if (!existing) {
        jornadasConsolidadas.set(key, j)
      } else {
        // Si hay duplicado, preferir el que tiene salida (datos completos)
        if (j.hora_salida_real && !existing.hora_salida_real) {
          // La nueva tiene salida, la existente no - reemplazar
          jornadasConsolidadas.set(key, j)
        }
        // Si ambas tienen salida, tomar la que tenga más horas (la correcta)
        else if (j.hora_salida_real && existing.hora_salida_real) {
          if (j.horas_trabajadas > existing.horas_trabajadas) {
            jornadasConsolidadas.set(key, j)
          }
        }
        // Si ninguna tiene salida, mantener la existente (primera)
      }
    }
    
    const jornadasFinales = Array.from(jornadasConsolidadas.values())
    console.log(`[Regenerar] Jornadas consolidadas: ${jornadasFinales.length}`)
    
    // 9. Insertar en lotes de 100
    const batchSize = 100
    for (let i = 0; i < jornadasFinales.length; i += batchSize) {
      const batch = jornadasFinales.slice(i, i + batchSize)
      const { error: insertError } = await supabaseSicamar
        .from('jornadas_diarias')
        .upsert(batch, { onConflict: 'empleado_id,fecha' })
      
      if (insertError) {
        console.error('Error insertando jornadas:', insertError)
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Regeneradas ${jornadasFinales.length} jornadas`,
      count: jornadasFinales.length
    })
    
  } catch (error) {
    console.error('Error regenerando jornadas:', error)
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    )
  }
}

