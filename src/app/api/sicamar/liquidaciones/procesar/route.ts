import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'
import { 
  LiquidacionEngine, 
  EmpleadoLiquidar, 
  NovedadEmpleado,
  ConceptoDefinicion,
  ParametrosLiquidacion,
  ResultadoLiquidacion,
  calcularAntiguedad,
  calcularHorasCalorias,
  TIPOS_LIQUIDACION,
  getFechasPeriodo
} from '@/lib/liquidacion-engine'

interface ProcesarRequest {
  anio: number
  mes: number
  tipo: string // PQN, SQN, MN
}

// Tipos para feriados e incidencias
interface Feriado {
  id: number
  fecha: string
  nombre: string
  tipo: string
  es_laborable: boolean
}

interface IncidenciaCalendario {
  id: number
  fecha: string
  tipo: 'canje_feriado' | 'franco_compensatorio' | 'dia_no_laborable' | 'dia_especial'
  descripcion: string
  feriado_origen_id?: number
  aplica_a: string
  sector_codigo?: string
  empleado_id?: number
  activo: boolean
}

/**
 * POST /api/sicamar/liquidaciones/procesar
 * 
 * Procesa una liquidación completa y devuelve los resultados para revisión
 */
export async function POST(request: NextRequest) {
  try {
    const body: ProcesarRequest = await request.json()
    const { anio, mes, tipo } = body
    
    // Validaciones
    if (!anio || !mes || !tipo) {
      return NextResponse.json(
        { error: 'Se requiere anio, mes y tipo de liquidación' },
        { status: 400 }
      )
    }
    
    const tipoConfig = TIPOS_LIQUIDACION[tipo as keyof typeof TIPOS_LIQUIDACION]
    if (!tipoConfig) {
      return NextResponse.json(
        { error: 'Tipo de liquidación inválido' },
        { status: 400 }
      )
    }
    
    const fechas = getFechasPeriodo(anio, mes, tipo)
    
    // 0. Cargar feriados e incidencias de calendario desde la BD
    const { data: feriadosData } = await supabaseSicamar
      .from('feriados')
      .select('*')
      .gte('fecha', `${anio}-01-01`)
      .lte('fecha', `${anio}-12-31`)
    
    const { data: incidenciasData } = await supabaseSicamar
      .from('incidencias_calendario')
      .select('*')
      .eq('activo', true)
      .gte('fecha', fechas.desde)
      .lte('fecha', fechas.hasta)
    
    // Crear mapas para consulta rápida
    const feriadosMap = new Map<string, Feriado>()
    for (const f of (feriadosData || []) as Feriado[]) {
      feriadosMap.set(f.fecha, f)
    }
    
    const incidenciasMap = new Map<string, IncidenciaCalendario>()
    for (const i of (incidenciasData || []) as IncidenciaCalendario[]) {
      incidenciasMap.set(i.fecha, i)
    }
    
    // Función para determinar si una fecha es feriado efectivo
    // (es feriado de base Y no fue canjeado)
    const esFeriadoEfectivo = (fechaStr: string): boolean => {
      const feriado = feriadosMap.get(fechaStr)
      const incidencia = incidenciasMap.get(fechaStr)
      
      // Si hay incidencia de canje, no es feriado (se trabaja normal)
      if (incidencia?.tipo === 'canje_feriado') {
        return false
      }
      
      // Si es feriado de base y no está canjeado
      return !!feriado
    }
    
    // Función para determinar si es día franco compensatorio
    const esFrancoCompensatorio = (fechaStr: string): boolean => {
      const incidencia = incidenciasMap.get(fechaStr)
      return incidencia?.tipo === 'franco_compensatorio'
    }
    
    // 1. Obtener empleados según tipo
    let empleadosQuery = supabaseSicamar
      .from('empleados')
      .select('*')
      .eq('activo', true)
      .not('salario_basico', 'is', null)
      .order('legajo')
    
    if (tipoConfig.clase === 'Jornal') {
      empleadosQuery = empleadosQuery.eq('clase', 'Jornal').lt('salario_basico', 15000)
    } else if (tipoConfig.clase === 'Mensual') {
      empleadosQuery = empleadosQuery.eq('clase', 'Mensual')
    }
    
    const { data: empleadosData, error: empleadosError } = await empleadosQuery
    
    if (empleadosError) {
      return NextResponse.json(
        { error: 'Error obteniendo empleados', details: empleadosError.message },
        { status: 500 }
      )
    }
    
    if (!empleadosData || empleadosData.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron empleados para este tipo de liquidación' },
        { status: 404 }
      )
    }
    
    // 2. Obtener identificaciones biométricas (para jornalizados)
    const { data: identificacionesData } = await supabaseSicamar
      .from('empleado_identificaciones')
      .select('empleado_id, id_biometrico')
      .eq('activo', true)
    
    const empleadosPorId = new Map<number, typeof empleadosData[0]>()
    const empleadosPorBiometrico = new Map<string, typeof empleadosData[0]>()
    
    for (const emp of empleadosData) {
      empleadosPorId.set(emp.id, emp)
    }
    
    for (const ident of identificacionesData || []) {
      const emp = empleadosPorId.get(ident.empleado_id)
      if (emp && ident.id_biometrico) {
        empleadosPorBiometrico.set(ident.id_biometrico, emp)
      }
    }
    
    // 3. Obtener marcaciones del período (solo para jornalizados)
    // Almacenamos todas las marcaciones ordenadas por empleado
    const marcacionesPorEmpleado = new Map<string, { tipo: string; fecha_hora: string }[]>()
    
    if (tipoConfig.clase === 'Jornal') {
      // Extender el rango para capturar turnos nocturnos que cruzan días
      // Un día antes del inicio y dos días después del fin
      const fechaDesde = new Date(fechas.desde + 'T00:00:00-03:00') // Medianoche Argentina
      const fechaHasta = new Date(fechas.hasta + 'T23:59:59-03:00') // Fin del día Argentina
      
      // Extender para turnos nocturnos
      fechaDesde.setDate(fechaDesde.getDate() - 1)
      fechaHasta.setDate(fechaHasta.getDate() + 1)
      
      // Obtener TODAS las marcaciones del período (sin límite de 1000)
      let allMarcaciones: typeof marcacionesData = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabaseSicamar
          .from('marcaciones')
          .select('*')
          .gte('fecha_hora', fechaDesde.toISOString())
          .lte('fecha_hora', fechaHasta.toISOString())
          .order('fecha_hora')
          .range(page * pageSize, (page + 1) * pageSize - 1)
        
        if (pageError) {
          console.error('Error fetching marcaciones page:', pageError)
          break
        }
        
        if (pageData && pageData.length > 0) {
          allMarcaciones = [...allMarcaciones, ...pageData]
          page++
          hasMore = pageData.length === pageSize
        } else {
          hasMore = false
        }
      }
      
      const marcacionesData = allMarcaciones
      const marcacionesError = null
      
      if (marcacionesError) {
        console.error('Error fetching marcaciones:', marcacionesError)
      }
      
      // Log solo en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Liquidación] Marcaciones: ${marcacionesData?.length || 0}`)
      }
      
      // Agrupar todas las marcaciones por empleado (sin separar por día aún)
      for (const marc of marcacionesData || []) {
        if (!marcacionesPorEmpleado.has(marc.id_biometrico)) {
          marcacionesPorEmpleado.set(marc.id_biometrico, [])
        }
        marcacionesPorEmpleado.get(marc.id_biometrico)!.push(marc)
      }
      
    }
    
    // 4. Obtener período de liquidación (si existe)
    // Determinar quincena según tipo
    const quincena = tipo === 'PQN' ? 1 : tipo === 'SQN' ? 2 : null
    
    let periodoLiq: { id: number } | null = null
    
    if (quincena) {
      const { data } = await supabaseSicamar
        .from('periodos_liquidacion')
        .select('id')
        .eq('anio', anio)
        .eq('mes', mes)
        .eq('quincena', quincena)
        .limit(1)
        .single()
      
      periodoLiq = data
    }
    
    
    // 5. Obtener novedades manuales del período (importadas de Bejerman o cargadas manualmente)
    const novedadesManualesMap = new Map<number, Map<string, number>>() // empleado_id -> concepto_codigo -> cantidad
    
    if (periodoLiq?.id) {
      const { data: novedadesManuales } = await supabaseSicamar
        .from('novedades_liquidacion')
        .select('empleado_id, concepto_codigo, cantidad')
        .eq('periodo_id', periodoLiq.id)
        .in('estado', ['pendiente', 'aprobada', 'procesada'])
      
      for (const nov of novedadesManuales || []) {
        if (!novedadesManualesMap.has(nov.empleado_id)) {
          novedadesManualesMap.set(nov.empleado_id, new Map())
        }
        novedadesManualesMap.get(nov.empleado_id)!.set(nov.concepto_codigo, parseFloat(nov.cantidad) || 0)
      }
    }
    
    // 6. Obtener conceptos
    const { data: conceptosData } = await supabaseSicamar
      .from('conceptos_liquidacion')
      .select('codigo, descripcion, tipo, formula, multiplicador, valor_generico, activo')
      .eq('activo', true)
    
    const conceptos: ConceptoDefinicion[] = (conceptosData || []).map(c => ({
      codigo: c.codigo,
      descripcion: c.descripcion,
      tipo: c.tipo,
      formula: c.formula,
      multiplicador: parseFloat(c.multiplicador) || 1,
      valor_generico: parseFloat(c.valor_generico) || 0,
      activo: c.activo,
    }))
    
    // 7. Configurar motor
    const parametros: ParametrosLiquidacion = {
      fecha_desde: fechas.desde,
      fecha_hasta: fechas.hasta,
      tipo,
    }
    
    const engine = new LiquidacionEngine(parametros, conceptos)
    
    // 8. Procesar cada empleado
    const resultados: (ResultadoLiquidacion & { asistencias?: AsistenciaDia[] })[] = []
    const errores: { legajo: string; error: string }[] = []
    
    // Definir tipo para asistencias
    interface AsistenciaDia {
      dia: number
      diaSemana: string // Lu, Ma, Mi, Ju, Vi, Sa
      turno: 'D' | 'N' | 'V' | 'F' // Diurno, Nocturno, Vespertino, Feriado
      horas: number
      horaEntrada: string // HH:MM
      horaSalida: string  // HH:MM
      feriado?: boolean
    }
    
    const DIAS_SEMANA = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']
    
    for (const empData of empleadosData) {
      try {
        const novedades: NovedadEmpleado[] = []
        const novedadesAgregadas = new Set<string>() // Para evitar duplicados
        const asistencias: AsistenciaDia[] = [] // Registro de asistencias por día
        
        // PRIMERO: Agregar novedades manuales (tienen prioridad)
        const novedadesEmpleado = novedadesManualesMap.get(empData.id)
        if (novedadesEmpleado && novedadesEmpleado.size > 0) {
          for (const [conceptoCodigo, cantidad] of novedadesEmpleado) {
            if (cantidad > 0) {
              novedades.push({ 
                legajo: empData.legajo, 
                concepto_codigo: conceptoCodigo, 
                cantidad, 
                origen: 'manual' 
              })
              novedadesAgregadas.add(conceptoCodigo)
            }
          }
          
        }
        
        // SEGUNDO: Si no hay novedades manuales para un concepto, calcular desde marcaciones
        let horasDiurnas = 0
        let horasNocturnas = 0
        let horasFeriado = 0
        let horasFeriadoNoct = 0
        
        if (tipoConfig.clase === 'Jornal') {
          // Solo calcular desde marcaciones si NO hay novedad manual para ese concepto
          const idBiometrico = (identificacionesData || []).find(i => i.empleado_id === empData.id)?.id_biometrico
          
          if (idBiometrico && marcacionesPorEmpleado.has(idBiometrico)) {
            const marcaciones = marcacionesPorEmpleado.get(idBiometrico)!
            
            // Ordenar por fecha/hora
            marcaciones.sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())
            
            // Emparejar entradas con salidas de forma secuencial
            // Esto maneja correctamente los turnos nocturnos que cruzan días
            let entradaActual: Date | null = null
            
            for (const marc of marcaciones) {
              const fechaMarcacion = new Date(marc.fecha_hora)
              
              if (marc.tipo === 'E') {
                entradaActual = fechaMarcacion
              } else if (marc.tipo === 'S' && entradaActual) {
                const salida = fechaMarcacion
                
                // Verificar que la jornada es válida (máximo 14 horas para evitar errores)
                const horasTotal = (salida.getTime() - entradaActual.getTime()) / (1000 * 60 * 60)
                if (horasTotal <= 0 || horasTotal > 14) {
                  entradaActual = null
                  continue
                }
                
                // Determinar la fecha de trabajo (la fecha de entrada en hora argentina)
                const fechaTrabajoStr = entradaActual.toLocaleDateString('en-CA', { 
                  timeZone: 'America/Argentina/Buenos_Aires' 
                })
                
                // Verificar si esta fecha está dentro del período de liquidación
                if (fechaTrabajoStr < fechas.desde || fechaTrabajoStr > fechas.hasta) {
                  entradaActual = null
                  continue
                }
                
                const fecha = new Date(fechaTrabajoStr + 'T12:00:00')
                const diaSemana = fecha.getDay()
                const esFeriado = esFeriadoEfectivo(fechaTrabajoStr)  // Usa BD + incidencias
                const esFranco = esFrancoCompensatorio(fechaTrabajoStr)
                const esSabado = diaSemana === 6
                const esDomingo = diaSemana === 0
                
                if (esDomingo) {
                  entradaActual = null
                  continue
                }
                
                const jornadaMaxima = esSabado ? 7 : 8
                const horasTrabajadas = Math.min(horasTotal, jornadaMaxima)
                
                // Determinar horas diurnas/nocturnas basándose en la hora de entrada (Argentina)
                let hdDia = 0
                let hnDia = 0
                const horaEntradaArg = parseInt(entradaActual.toLocaleTimeString('en-US', { 
                  timeZone: 'America/Argentina/Buenos_Aires',
                  hour12: false,
                  hour: '2-digit'
                }))
                
                // Determinar turno para el registro de asistencia
                // Turnos rotativos típicos de fábrica:
                //   - Mañana: entrada ~05:00-06:00, salida ~13:00-14:00
                //   - Tarde: entrada ~13:00-14:00, salida ~21:00-22:00
                //   - Noche: entrada ~21:00-22:00, salida ~05:00-06:00
                let turno: 'D' | 'N' | 'V' | 'F' = 'D'
                
                // Turno nocturno: entrada entre 20:00 y 04:00 (antes del amanecer para trabajar de noche)
                // Turno mañana/diurno: entrada entre 04:00 y 12:00
                // Turno tarde/vespertino: entrada entre 12:00 y 20:00
                if (horaEntradaArg >= 20 || horaEntradaArg < 4) {
                  // Turno nocturno completo (21:00 a 06:00)
                  hnDia = horasTrabajadas
                  turno = 'N'
                } else if (horaEntradaArg >= 12) {
                  // Turno vespertino/tarde (13:00 a 21:00)
                  // Si termina después de las 21:00, parte es nocturna
                  const horaSalidaArg = parseInt(salida.toLocaleTimeString('en-US', { 
                    timeZone: 'America/Argentina/Buenos_Aires',
                    hour12: false,
                    hour: '2-digit'
                  }))
                  if (horaSalidaArg >= 21 || horaSalidaArg < 4) {
                    // Parte del turno es nocturna
                    const horasHasta21 = Math.max(0, 21 - horaEntradaArg)
                    hdDia = Math.min(horasHasta21, horasTrabajadas)
                    hnDia = Math.max(0, horasTrabajadas - hdDia)
                  } else {
                    hdDia = horasTrabajadas
                  }
                  turno = 'V'
                } else {
                  // Turno mañana/diurno (05:00 a 14:00)
                  hdDia = horasTrabajadas
                  turno = 'D'
                }
                
                // Franco compensatorio se trata como feriado (si trabajan, paga extra)
                if (esFeriado || esFranco) {
                  turno = 'F'
                  if (hnDia > 0) horasFeriadoNoct += hnDia + hdDia
                  else horasFeriado += hdDia
                } else {
                  horasDiurnas += hdDia
                  horasNocturnas += hnDia
                }
                
                // Registrar asistencia del día con horarios
                const diaDelMes = parseInt(fechaTrabajoStr.split('-')[2])
                
                // Formatear horas en horario argentino
                const horaEntradaStr = entradaActual.toLocaleTimeString('es-AR', { 
                  timeZone: 'America/Argentina/Buenos_Aires',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                })
                const horaSalidaStr = salida.toLocaleTimeString('es-AR', { 
                  timeZone: 'America/Argentina/Buenos_Aires',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                })
                
                asistencias.push({
                  dia: diaDelMes,
                  diaSemana: DIAS_SEMANA[diaSemana],
                  turno,
                  horas: Math.round(horasTrabajadas * 100) / 100,
                  horaEntrada: horaEntradaStr,
                  horaSalida: horaSalidaStr,
                  feriado: esFeriado
                })
                
                entradaActual = null
              }
            }
          }
          
          // Agregar novedades de marcaciones SOLO si no hay novedad manual
          if (!novedadesAgregadas.has('0010') && horasDiurnas > 0) {
            novedades.push({ legajo: empData.legajo, concepto_codigo: '0010', cantidad: Math.round(horasDiurnas * 100) / 100, origen: 'reloj' })
          }
          if (!novedadesAgregadas.has('0020') && horasNocturnas > 0) {
            novedades.push({ legajo: empData.legajo, concepto_codigo: '0020', cantidad: Math.round(horasNocturnas * 100) / 100, origen: 'reloj' })
          }
          if (!novedadesAgregadas.has('0050') && horasFeriado > 0) {
            novedades.push({ legajo: empData.legajo, concepto_codigo: '0050', cantidad: Math.round(horasFeriado * 100) / 100, origen: 'automatico' })
          }
          if (!novedadesAgregadas.has('0051') && horasFeriadoNoct > 0) {
            novedades.push({ legajo: empData.legajo, concepto_codigo: '0051', cantidad: Math.round(horasFeriadoNoct * 100) / 100, origen: 'automatico' })
          }
          
          // Calorías para FUND (solo si no hay manual)
          if (!novedadesAgregadas.has('0054') && empData.sector === 'FUND') {
            // Usar horas de novedades manuales si existen, sino las de marcaciones
            const hdTotal = novedadesAgregadas.has('0010') 
              ? (novedadesEmpleado?.get('0010') || 0) 
              : horasDiurnas
            const hnTotal = novedadesAgregadas.has('0020') 
              ? (novedadesEmpleado?.get('0020') || 0) 
              : horasNocturnas
            const horasCalorias = calcularHorasCalorias(hdTotal, hnTotal)
            if (horasCalorias > 0) {
              novedades.push({ legajo: empData.legajo, concepto_codigo: '0054', cantidad: horasCalorias, origen: 'automatico' })
            }
          }
          
          // Presentismo (solo si no hay manual)
          if (!novedadesAgregadas.has('0120')) {
            const hdTotal = novedadesAgregadas.has('0010') 
              ? (novedadesEmpleado?.get('0010') || 0) 
              : horasDiurnas
            const hnTotal = novedadesAgregadas.has('0020') 
              ? (novedadesEmpleado?.get('0020') || 0) 
              : horasNocturnas
            if (hdTotal + hnTotal >= 40) { // Al menos 5 días
              novedades.push({ legajo: empData.legajo, concepto_codigo: '0120', cantidad: 20, origen: 'automatico' })
            }
          }
        }
        
        // Calcular antigüedad respecto a la fecha del período (no la fecha actual)
        const fechaFinPeriodo = new Date(fechas.hasta)
        
        const empleado: EmpleadoLiquidar = {
          id: empData.id,
          legajo: empData.legajo,
          nombre: empData.nombre,
          apellido: empData.apellido,
          categoria: empData.categoria || '',
          codigo_categoria: empData.codigo_categoria || '',
          sector: empData.sector || '',
          sindicato: empData.sindicato || 'UOM',
          obra_social: empData.obra_social || 'OSUOMRA',
          clase: tipoConfig.clase === 'Jornal' ? 1 : 0,
          salario_basico: parseFloat(empData.salario_basico) || 0,
          antiguedad_anios: calcularAntiguedad(empData.fecha_ingreso || '2025-01-01', fechaFinPeriodo),
          fecha_ingreso: empData.fecha_ingreso || '2025-01-01',
        }
        
        const resultado = engine.liquidarEmpleado(empleado, novedades)
        // Agregar asistencias al resultado
        resultados.push({
          ...resultado,
          asistencias: asistencias.sort((a, b) => a.dia - b.dia)
        })
        
      } catch (err) {
        errores.push({
          legajo: empData.legajo,
          error: err instanceof Error ? err.message : 'Error desconocido'
        })
      }
    }
    
    // 7. Calcular resumen
    const resumen = {
      total_empleados: resultados.length,
      total_haberes: resultados.reduce((s, r) => s + r.totales.haberes, 0),
      total_no_remunerativos: resultados.reduce((s, r) => s + r.totales.no_remunerativos, 0),
      total_retenciones: resultados.reduce((s, r) => s + r.totales.retenciones, 0),
      total_contribuciones: resultados.reduce((s, r) => s + r.totales.contribuciones, 0),
      total_neto: resultados.reduce((s, r) => s + r.totales.neto, 0),
    }
    
    // Generar descripción del período
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    const descripcion = tipo === 'PQN' 
      ? `1era Quincena ${meses[mes - 1]} ${anio}`
      : tipo === 'SQN'
        ? `2da Quincena ${meses[mes - 1]} ${anio}`
        : `${meses[mes - 1]} ${anio}`
    
    return NextResponse.json({
      success: true,
      periodo: {
        anio,
        mes,
        tipo,
        descripcion,
        fecha_desde: fechas.desde,
        fecha_hasta: fechas.hasta,
        clase: tipoConfig.clase,
      },
      resumen,
      empleados: resultados,
      errores: errores.length > 0 ? errores : undefined,
    })
    
  } catch (error) {
    console.error('Error procesando liquidación:', error)
    return NextResponse.json(
      { error: 'Error al procesar liquidación', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
