import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'

// POST: Procesar un turno específico - comparar planificado vs marcaciones
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { anio, mes, quincena, turno } = body as {
      anio: number
      mes: number
      quincena: 1 | 2
      turno: 'M' | 'T' | 'N'
    }
    
    if (!anio || !mes || !quincena || !turno) {
      return NextResponse.json(
        { error: 'Se requiere anio, mes, quincena y turno' },
        { status: 400 }
      )
    }
    
    // Calcular fechas del período
    const ultimoDia = new Date(anio, mes, 0).getDate()
    const desde = quincena === 1 ? 1 : 16
    const hasta = quincena === 1 ? 15 : ultimoDia
    const fechaDesde = `${anio}-${String(mes).padStart(2, '0')}-${String(desde).padStart(2, '0')}`
    const fechaHasta = `${anio}-${String(mes).padStart(2, '0')}-${String(hasta).padStart(2, '0')}`
    
    // Para turno noche, necesitamos el día anterior al inicio
    // porque la entrada del domingo 22:00 pertenece a la jornada del lunes
    let fechaMarcacionesDesde = fechaDesde
    if (turno === 'N' && desde === 1) {
      // Primer día del mes, necesitamos el último día del mes anterior
      const mesAnterior = mes === 1 ? 12 : mes - 1
      const anioAnterior = mes === 1 ? anio - 1 : anio
      const ultimoDiaMesAnterior = new Date(anioAnterior, mesAnterior, 0).getDate()
      fechaMarcacionesDesde = `${anioAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(ultimoDiaMesAnterior).padStart(2, '0')}`
    }
    
    console.log(`[Procesar ${turno}] Período: ${fechaDesde} a ${fechaHasta}, marcaciones desde ${fechaMarcacionesDesde}`)
    
    // 1. Obtener jornadas planificadas para este turno
    const { data: jornadasPlanificadas } = await supabaseSicamar
      .from('jornadas_diarias')
      .select('*')
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)
      .eq('turno_asignado', turno)
      .is('estado_empleado', null) // Solo los que no tienen estado (trabajan)
    
    if (!jornadasPlanificadas || jornadasPlanificadas.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: `No hay jornadas planificadas para turno ${turno}`,
        count: 0 
      })
    }
    
    console.log(`[Procesar ${turno}] Jornadas planificadas: ${jornadasPlanificadas.length}`)
    
    // 2. Obtener empleados y sus IDs biométricos
    const empleadoIds = [...new Set(jornadasPlanificadas.map(j => j.empleado_id))]
    
    const { data: identificaciones } = await supabaseSicamar
      .from('empleado_identificaciones')
      .select('empleado_id, id_biometrico')
      .in('empleado_id', empleadoIds)
      .eq('activo', true)
    
    const idBiometricoPorEmpleado = new Map<number, string>()
    const empleadoPorIdBiometrico = new Map<string, number>()
    for (const id of identificaciones || []) {
      idBiometricoPorEmpleado.set(id.empleado_id, id.id_biometrico)
      empleadoPorIdBiometrico.set(id.id_biometrico, id.empleado_id)
    }
    
    // 3. Calcular rango de horas para buscar marcaciones según turno
    // M: 04:00 - 16:00, T: 12:00 - 00:00, N: 20:00 - 08:00 (día siguiente)
    let horaDesde: number, horaHasta: number
    switch (turno) {
      case 'M':
        horaDesde = 4
        horaHasta = 16
        break
      case 'T':
        horaDesde = 12
        horaHasta = 24
        break
      case 'N':
        horaDesde = 20
        horaHasta = 8 // del día siguiente
        break
    }
    
    // 4. Obtener todas las marcaciones del período
    const idsBiometricos = [...idBiometricoPorEmpleado.values()]
    
    // Extender fechas para marcaciones
    const fechaMarcDesde = new Date(fechaMarcacionesDesde + 'T00:00:00')
    fechaMarcDesde.setDate(fechaMarcDesde.getDate() - 1)
    const fechaMarcHasta = new Date(fechaHasta + 'T23:59:59')
    fechaMarcHasta.setDate(fechaMarcHasta.getDate() + 1)
    
    let allMarcaciones: Array<{ id_biometrico: string; tipo: string; fecha_hora: string }> = []
    let page = 0
    const pageSize = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: pageData } = await supabaseSicamar
        .from('marcaciones')
        .select('id_biometrico, tipo, fecha_hora')
        .in('id_biometrico', idsBiometricos)
        .gte('fecha_hora', fechaMarcDesde.toISOString())
        .lte('fecha_hora', fechaMarcHasta.toISOString())
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
    
    console.log(`[Procesar ${turno}] Marcaciones cargadas: ${allMarcaciones.length}`)
    
    // 5. Agrupar marcaciones por empleado
    const marcacionesPorEmpleado = new Map<number, typeof allMarcaciones>()
    for (const marc of allMarcaciones) {
      const empleadoId = empleadoPorIdBiometrico.get(marc.id_biometrico)
      if (!empleadoId) continue
      
      if (!marcacionesPorEmpleado.has(empleadoId)) {
        marcacionesPorEmpleado.set(empleadoId, [])
      }
      marcacionesPorEmpleado.get(empleadoId)!.push(marc)
    }
    
    // 6. Procesar cada jornada planificada
    const actualizaciones: Array<{
      empleado_id: number
      fecha: string
      hora_entrada_real: string | null
      hora_salida_real: string | null
      horas_trabajadas: number
      horas_diurnas: number
      horas_nocturnas: number
      tiene_inconsistencia: boolean
      tipo_inconsistencia: string | null
      origen: string
    }> = []
    
    for (const jornada of jornadasPlanificadas) {
      const marcaciones = marcacionesPorEmpleado.get(jornada.empleado_id) || []
      
      // Buscar entrada y salida para esta jornada
      const fechaJornada = jornada.fecha
      const fechaObj = new Date(fechaJornada + 'T12:00:00')
      
      // Definir ventana de búsqueda según turno
      let ventanaInicio: Date, ventanaFin: Date
      
      if (turno === 'M') {
        // Mañana: entrada 04:00-08:00, salida 12:00-16:00 del mismo día
        ventanaInicio = new Date(fechaJornada + 'T04:00:00')
        ventanaFin = new Date(fechaJornada + 'T16:00:00')
      } else if (turno === 'T') {
        // Tarde: entrada 12:00-16:00, salida 20:00-00:00 del mismo día
        ventanaInicio = new Date(fechaJornada + 'T12:00:00')
        ventanaFin = new Date(fechaJornada + 'T23:59:59')
      } else {
        // Noche: entrada 20:00-00:00 del día ANTERIOR, salida 04:00-08:00 de este día
        // La fecha de la jornada es el día de la SALIDA (mañana siguiente)
        const diaAnterior = new Date(fechaObj)
        diaAnterior.setDate(diaAnterior.getDate() - 1)
        const fechaDiaAnterior = diaAnterior.toISOString().split('T')[0]
        
        ventanaInicio = new Date(fechaDiaAnterior + 'T20:00:00')
        ventanaFin = new Date(fechaJornada + 'T08:00:00')
      }
      
      // Convertir a Argentina timezone para comparar
      const ventanaInicioTS = ventanaInicio.getTime()
      const ventanaFinTS = ventanaFin.getTime()
      
      // Filtrar marcaciones en la ventana
      const marcacionesEnVentana = marcaciones.filter(m => {
        const ts = new Date(m.fecha_hora).getTime()
        return ts >= ventanaInicioTS && ts <= ventanaFinTS
      })
      
      // Buscar primera entrada y última salida
      const entradas = marcacionesEnVentana.filter(m => m.tipo === 'E').sort((a, b) => 
        new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
      )
      const salidas = marcacionesEnVentana.filter(m => m.tipo === 'S').sort((a, b) => 
        new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
      )
      
      const entrada = entradas[0]?.fecha_hora || null
      const salida = salidas[salidas.length - 1]?.fecha_hora || null
      
      // Calcular horas trabajadas
      let horasTrabajadas = 0
      let tieneInconsistencia = false
      let tipoInconsistencia: string | null = null
      
      if (entrada && salida) {
        horasTrabajadas = (new Date(salida).getTime() - new Date(entrada).getTime()) / (1000 * 60 * 60)
        // Cap a jornada máxima (8h o 7h sábado)
        const diaSemana = fechaObj.getDay()
        const jornadaMaxima = diaSemana === 6 ? 7 : 8
        horasTrabajadas = Math.min(Math.max(horasTrabajadas, 0), jornadaMaxima + 4) // Permitir hasta 4h extra
      } else if (entrada && !salida) {
        // Falta salida - enfoque optimista
        const diaSemana = fechaObj.getDay()
        horasTrabajadas = diaSemana === 6 ? 7 : 8
        tieneInconsistencia = true
        tipoInconsistencia = 'falta_salida'
      } else if (!entrada && salida) {
        // Falta entrada
        tieneInconsistencia = true
        tipoInconsistencia = 'falta_entrada'
      }
      // Si no hay ni entrada ni salida, dejar en 0 sin marcar inconsistencia
      // (puede ser que aún no ocurrió el turno)
      
      actualizaciones.push({
        empleado_id: jornada.empleado_id,
        fecha: jornada.fecha,
        hora_entrada_real: entrada,
        hora_salida_real: salida,
        horas_trabajadas: Math.round(horasTrabajadas * 100) / 100,
        horas_diurnas: turno !== 'N' ? Math.round(horasTrabajadas * 100) / 100 : 0,
        horas_nocturnas: turno === 'N' ? Math.round(horasTrabajadas * 100) / 100 : 0,
        tiene_inconsistencia: tieneInconsistencia,
        tipo_inconsistencia: tipoInconsistencia,
        origen: entrada || salida ? 'reloj' : 'manual'
      })
    }
    
    console.log(`[Procesar ${turno}] Actualizaciones: ${actualizaciones.length}`)
    
    // 7. Actualizar jornadas
    for (const act of actualizaciones) {
      const { error } = await supabaseSicamar
        .from('jornadas_diarias')
        .update({
          hora_entrada_real: act.hora_entrada_real,
          hora_salida_real: act.hora_salida_real,
          horas_trabajadas: act.horas_trabajadas,
          horas_diurnas: act.horas_diurnas,
          horas_nocturnas: act.horas_nocturnas,
          tiene_inconsistencia: act.tiene_inconsistencia,
          tipo_inconsistencia: act.tipo_inconsistencia,
          origen: act.origen
        })
        .eq('empleado_id', act.empleado_id)
        .eq('fecha', act.fecha)
      
      if (error) {
        console.error('Error actualizando:', error)
      }
    }
    
    // Contar cuántos tienen datos
    const conDatos = actualizaciones.filter(a => a.hora_entrada_real || a.hora_salida_real).length
    const conInconsistencia = actualizaciones.filter(a => a.tiene_inconsistencia).length
    
    return NextResponse.json({
      success: true,
      message: `Turno ${turno}: ${conDatos}/${actualizaciones.length} con fichajes, ${conInconsistencia} inconsistencias`,
      count: actualizaciones.length,
      conDatos,
      conInconsistencia
    })
    
  } catch (error) {
    console.error('Error procesando turno:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}


