import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'
import { calcularHorasExtra } from '@/lib/horas-extra'

// POST: Procesar un turno de un día específico
// El turno N del domingo = entrada domingo 22:00, salida lunes 06:00, horas van al DOMINGO
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fecha, turno } = body as {
      fecha: string  // YYYY-MM-DD
      turno: 'M' | 'T' | 'N'
    }
    
    if (!fecha || !turno) {
      return NextResponse.json(
        { error: 'Se requiere fecha y turno' },
        { status: 400 }
      )
    }
    
    console.log(`[Procesar] ${fecha} turno ${turno}`)
    
    // 1. Obtener jornadas planificadas para ESTE día y turno
    const { data: jornadasPlanificadas } = await supabaseSicamar
      .from('jornadas_diarias')
      .select('*')
      .eq('fecha', fecha)
      .eq('turno_asignado', turno)
      .is('estado_empleado', null) // Solo los que no tienen estado (trabajan)
    
    if (!jornadasPlanificadas || jornadasPlanificadas.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: `No hay jornadas planificadas para ${fecha} turno ${turno}`,
        count: 0 
      })
    }
    
    console.log(`[Procesar] Jornadas planificadas: ${jornadasPlanificadas.length}`)
    
    // 2. Obtener empleados y sus IDs biométricos
    const empleadoIds = [...new Set(jornadasPlanificadas.map(j => j.empleado_id))]
    
    const { data: identificaciones } = await supabaseSicamar
      .from('empleado_identificaciones')
      .select('empleado_id, id_biometrico')
      .in('empleado_id', empleadoIds)
      .eq('activo', true)
    
    // Un empleado puede tener MÚLTIPLES IDs biométricos
    const idsBiometricosPorEmpleado = new Map<number, string[]>()
    const empleadoPorIdBiometrico = new Map<string, number>()
    for (const id of identificaciones || []) {
      if (!idsBiometricosPorEmpleado.has(id.empleado_id)) {
        idsBiometricosPorEmpleado.set(id.empleado_id, [])
      }
      idsBiometricosPorEmpleado.get(id.empleado_id)!.push(id.id_biometrico)
      empleadoPorIdBiometrico.set(id.id_biometrico, id.empleado_id)
    }
    
    console.log(`[Procesar] Empleados con ID biométrico: ${idsBiometricosPorEmpleado.size} de ${empleadoIds.length}`)
    
    // Debug: mostrar empleados sin ID biométrico
    const empleadosSinId = empleadoIds.filter(id => !idsBiometricosPorEmpleado.has(id))
    if (empleadosSinId.length > 0) {
      console.log(`[Procesar] Empleados sin ID biométrico: ${empleadosSinId.join(', ')}`)
    }
    
    // 3. Definir ventana de búsqueda según turno en UTC
    // Calcular día siguiente para turno noche
    const fechaObj = new Date(fecha + 'T12:00:00Z')
    const diaSiguiente = new Date(fechaObj)
    diaSiguiente.setDate(diaSiguiente.getDate() + 1)
    const fechaSiguiente = diaSiguiente.toISOString().split('T')[0]
    
    // Las marcaciones están guardadas en UTC
    // Las fechas creadas con 'T04:00:00' son interpretadas como hora LOCAL del servidor
    // Para Argentina (UTC-3): 04:00 Argentina = 07:00 UTC
    // El servidor puede estar en UTC o en hora local, así que usamos un approach más seguro
    
    // Crear fechas explícitamente en hora Argentina y convertir a UTC
    // Argentina es UTC-3, así que sumamos 3 horas para obtener UTC
    let ventanaInicioUTC: string, ventanaFinUTC: string
    
    if (turno === 'M') {
      // Mañana: buscar desde 04:00 hasta 22:00 hora Argentina (extendido para capturar extras)
      // = 07:00 a 01:00+1 UTC
      ventanaInicioUTC = `${fecha}T07:00:00Z`
      ventanaFinUTC = `${fechaSiguiente}T01:00:00Z`
    } else if (turno === 'T') {
      // Tarde: buscar desde 12:00 hasta 04:00+1 hora Argentina (extendido para extras)
      // = 15:00 a 07:00+1 UTC
      ventanaInicioUTC = `${fecha}T15:00:00Z`
      ventanaFinUTC = `${fechaSiguiente}T07:00:00Z`
    } else {
      // Noche: buscar desde 20:00 hasta 12:00+1 hora Argentina
      // = 23:00 a 15:00+1 UTC
      ventanaInicioUTC = `${fecha}T23:00:00Z`
      ventanaFinUTC = `${fechaSiguiente}T15:00:00Z`
    }
    
    console.log(`[Procesar] Ventana UTC: ${ventanaInicioUTC} a ${ventanaFinUTC}`)
    
    // 4. Obtener marcaciones en la ventana
    // Obtener TODOS los IDs biométricos (algunos empleados tienen múltiples)
    const idsBiometricos: string[] = []
    for (const ids of idsBiometricosPorEmpleado.values()) {
      idsBiometricos.push(...ids)
    }
    
    console.log(`[Procesar] Total IDs biométricos a buscar: ${idsBiometricos.length}`)
    
    if (idsBiometricos.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No hay IDs biométricos para los empleados planificados`,
        count: 0
      })
    }
    
    const { data: marcaciones } = await supabaseSicamar
      .from('marcaciones')
      .select('id_biometrico, tipo, fecha_hora')
      .in('id_biometrico', idsBiometricos)
      .gte('fecha_hora', ventanaInicioUTC)
      .lte('fecha_hora', ventanaFinUTC)
      .order('fecha_hora')
    
    console.log(`[Procesar] Marcaciones en ventana: ${marcaciones?.length || 0}`)
    
    // Debug: ver qué IDs biométricos tienen marcaciones
    const idsMarcaciones = [...new Set((marcaciones || []).map(m => m.id_biometrico))]
    const matching = idsMarcaciones.filter(id => idsBiometricos.includes(id))
    console.log(`[Procesar] IDs en marcaciones: ${idsMarcaciones.length}, matching: ${matching.length}`)
    
    // 5. Agrupar marcaciones por empleado
    const marcacionesPorEmpleado = new Map<number, typeof marcaciones>()
    for (const marc of marcaciones || []) {
      const empleadoId = empleadoPorIdBiometrico.get(marc.id_biometrico)
      if (!empleadoId) continue
      
      if (!marcacionesPorEmpleado.has(empleadoId)) {
        marcacionesPorEmpleado.set(empleadoId, [])
      }
      marcacionesPorEmpleado.get(empleadoId)!.push(marc)
    }
    
    // Debug: verificar cuántos empleados planificados tienen marcaciones
    const empPlanificados = new Set(jornadasPlanificadas.map(j => j.empleado_id))
    const empConMarcaciones = [...marcacionesPorEmpleado.keys()]
    const empPlanificadosConMarcaciones = empConMarcaciones.filter(id => empPlanificados.has(id))
    console.log(`[Procesar] Empleados planificados: ${empPlanificados.size}, con marcaciones: ${empConMarcaciones.length}, match: ${empPlanificadosConMarcaciones.length}`)
    
    // Debug: contar entradas y salidas
    let totalEntradas = 0, totalSalidas = 0
    for (const [, marcs] of marcacionesPorEmpleado) {
      totalEntradas += marcs!.filter(m => m.tipo === 'E').length
      totalSalidas += marcs!.filter(m => m.tipo === 'S').length
    }
    console.log(`[Procesar] Total entradas: ${totalEntradas}, salidas: ${totalSalidas}`)
    
    // 6. Procesar cada jornada
    let actualizados = 0
    let conFichaje = 0
    let conInconsistencia = 0
    
    const diaSemana = fechaObj.getDay()
    // Domingo = 6h, Sábado = 7h, resto = 8h
    const jornadaEsperada = diaSemana === 0 ? 6 : diaSemana === 6 ? 7 : 8
    
    for (const jornada of jornadasPlanificadas) {
      const marcs = marcacionesPorEmpleado.get(jornada.empleado_id) || []
      
      // Buscar primera entrada y última salida
      const entradas = marcs.filter(m => m.tipo === 'E').sort((a, b) => 
        new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
      )
      const salidas = marcs.filter(m => m.tipo === 'S').sort((a, b) => 
        new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
      )
      
      const entrada = entradas[0]?.fecha_hora || null
      const salida = salidas[salidas.length - 1]?.fecha_hora || null
      
      // Calcular horas trabajadas
      let horasTrabajadas = 0
      let horasExtra50 = 0
      let horasExtra100 = 0
      let tieneInconsistencia = false
      let tipoInconsistencia: string | null = null
      
      if (entrada && salida) {
        const fechaEntrada = new Date(entrada)
        const fechaSalida = new Date(salida)
        const horasBrutas = (fechaSalida.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60)
        
        // Verificar si es feriado (TODO: consultar tabla de feriados)
        const esFeriado = false
        
        // Usar algoritmo de Grid de 30 minutos para horas extra
        // REGLA FIN DE SEMANA: Sábado desde 13hs y Domingo completo = todo extra 100%
        const extras = calcularHorasExtra(fechaEntrada, fechaSalida, jornadaEsperada, esFeriado)
        
        // Sumar extras 50% (diurnas + nocturnas) y 100% (diurnas + nocturnas)
        horasExtra50 = extras.extra_50_diu + extras.extra_50_noc
        horasExtra100 = extras.extra_100_diu + extras.extra_100_noc
        
        // Si hay horas normales que pasaron a ser extra 100% (fin de semana crítico),
        // esas horas NO cuentan como "trabajadas normales" sino como extra
        const horasNormalesConvertidas = extras.horas_normales_a_100 || 0
        
        // Horas trabajadas = jornada esperada menos las que se convirtieron a extra 100%
        if (horasNormalesConvertidas > 0) {
          // Fin de semana crítico: las horas normales se pagan como extra 100%
          horasTrabajadas = Math.max(0, jornadaEsperada - horasNormalesConvertidas)
        } else if (horasExtra50 > 0 || horasExtra100 > 0) {
          horasTrabajadas = jornadaEsperada
        } else {
          horasTrabajadas = Math.round(Math.min(horasBrutas, jornadaEsperada))
        }
        
        conFichaje++
      } else if (entrada && !salida) {
        // Falta salida - enfoque optimista
        horasTrabajadas = jornadaEsperada
        tieneInconsistencia = true
        tipoInconsistencia = 'falta_salida'
        conFichaje++
        conInconsistencia++
      } else if (!entrada && salida) {
        // Falta entrada
        tieneInconsistencia = true
        tipoInconsistencia = 'falta_entrada'
        conInconsistencia++
      } else if (!entrada && !salida) {
        // Sin fichajes - inconsistencia
        tieneInconsistencia = true
        tipoInconsistencia = 'sin_fichaje'
        conInconsistencia++
      }
      
      // Actualizar jornada EN ESTE DÍA
      const { error } = await supabaseSicamar
        .from('jornadas_diarias')
        .update({
          hora_entrada_real: entrada,
          hora_salida_real: salida,
          horas_trabajadas: Math.round(horasTrabajadas * 100) / 100,
          horas_diurnas: turno !== 'N' ? Math.round(horasTrabajadas * 100) / 100 : 0,
          horas_nocturnas: turno === 'N' ? Math.round(horasTrabajadas * 100) / 100 : 0,
          horas_extra_50: Math.round(horasExtra50 * 100) / 100,
          horas_extra_100: Math.round(horasExtra100 * 100) / 100,
          tiene_inconsistencia: tieneInconsistencia,
          tipo_inconsistencia: tipoInconsistencia,
          origen: entrada || salida ? 'reloj' : 'manual'
        })
        .eq('empleado_id', jornada.empleado_id)
        .eq('fecha', fecha) // Siempre actualizar en ESTE día
      
      if (!error) actualizados++
    }
    
    return NextResponse.json({
      success: true,
      message: `${fecha} ${turno}: ${conFichaje}/${jornadasPlanificadas.length} ficharon, ${conInconsistencia} inconsistencias`,
      count: actualizados,
      conFichaje,
      conInconsistencia
    })
    
  } catch (error) {
    console.error('Error procesando turno:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
