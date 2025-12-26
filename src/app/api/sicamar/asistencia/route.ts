import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'

/**
 * GET /api/sicamar/asistencia
 * 
 * Obtiene la comparación entre planificación y marcaciones reales
 * para un período dado. Calcula el estado de cumplimiento con tolerancia.
 * 
 * Query params:
 *   - desde: YYYY-MM-DD (requerido)
 *   - hasta: YYYY-MM-DD (requerido)
 */

interface EmpleadoInfo {
  id: number
  legajo: string
  nombre: string
  apellido: string
  sector: string | null
  categoria: string | null
  foto_thumb_url: string | null
  rotacion_nombre: string | null
  condicion_contratacion: string
}

interface DailyPlanningRow {
  id: number
  employee_id: number
  operational_date: string
  status: 'WORKING' | 'ABSENT' | 'REST'
  absence_reason: string | null
  normal_entry_at: string | null
  normal_exit_at: string | null
}

interface MarcacionRow {
  id_biometrico: string
  tipo: 'E' | 'S'
  fecha_hora: string
}

interface IdentificacionRow {
  id_biometrico: string
  empleado_id: number
}

// Tolerancia en minutos para considerar que cumplió
const TOLERANCIA_ENTRADA = 30 // Puede llegar hasta 30 min antes o después
const TOLERANCIA_SALIDA = 30  // Puede irse hasta 30 min antes o después

// Estado de cumplimiento
type EstadoCumplimiento = 
  | 'cumplido'           // ✓ Rojo - cumplió con tolerancia
  | 'no_determinar'      // ? Negro - no se puede determinar / discrepancia grande
  | 'sin_planificacion'  // Sin planificación para el día
  | 'franco'             // Franco planificado
  | 'ausente'            // Ausencia planificada

interface AsistenciaDia {
  fecha: string
  planificacion: {
    status: 'WORKING' | 'ABSENT' | 'REST' | null
    absence_reason: string | null
    entrada_planificada: string | null // HH:MM
    salida_planificada: string | null  // HH:MM
  } | null
  marcaciones: {
    primera_entrada: string | null // HH:MM
    ultima_salida: string | null   // HH:MM
    total_marcaciones: number
  }
  cumplimiento: {
    estado: EstadoCumplimiento
    entrada_ok: boolean | null
    salida_ok: boolean | null
    diferencia_entrada_min: number | null // positivo = llegó tarde
    diferencia_salida_min: number | null  // positivo = se fue temprano
    manual_override: boolean
    notas: string | null
  }
}

interface EmpleadoAsistencia {
  empleado: EmpleadoInfo
  dias: Record<string, AsistenciaDia>
}

// Extraer HH:MM de un datetime string
function extractHHMM(datetime: string | null): string | null {
  if (!datetime) return null
  try {
    // Formato: "2025-12-20 06:00:00" o "2025-12-20T06:00:00"
    const timePart = datetime.includes('T') 
      ? datetime.split('T')[1] 
      : datetime.split(' ')[1]
    
    if (!timePart) return null
    return timePart.substring(0, 5) // HH:MM
  } catch {
    return null
  }
}

// Convertir HH:MM a minutos desde medianoche
function horaAMinutos(hora: string | null): number | null {
  if (!hora) return null
  const [h, m] = hora.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

// Calcular diferencia en minutos (real - planificado)
function calcularDiferencia(planificado: string | null, real: string | null): number | null {
  const minPlan = horaAMinutos(planificado)
  const minReal = horaAMinutos(real)
  if (minPlan === null || minReal === null) return null
  
  // Manejar cruce de medianoche
  let diff = minReal - minPlan
  if (diff > 720) diff -= 1440  // Si diff > 12h, probablemente cruzó medianoche
  if (diff < -720) diff += 1440
  
  return diff
}

// Evaluar si cumple con tolerancia
function evaluarCumplimiento(
  planificacion: DailyPlanningRow | null,
  primeraEntrada: string | null,
  ultimaSalida: string | null
): AsistenciaDia['cumplimiento'] {
  // Sin planificación
  if (!planificacion) {
    return {
      estado: 'sin_planificacion',
      entrada_ok: null,
      salida_ok: null,
      diferencia_entrada_min: null,
      diferencia_salida_min: null,
      manual_override: false,
      notas: null
    }
  }
  
  // Franco
  if (planificacion.status === 'REST') {
    return {
      estado: 'franco',
      entrada_ok: null,
      salida_ok: null,
      diferencia_entrada_min: null,
      diferencia_salida_min: null,
      manual_override: false,
      notas: null
    }
  }
  
  // Ausencia planificada
  if (planificacion.status === 'ABSENT') {
    return {
      estado: 'ausente',
      entrada_ok: null,
      salida_ok: null,
      diferencia_entrada_min: null,
      diferencia_salida_min: null,
      manual_override: false,
      notas: planificacion.absence_reason
    }
  }
  
  // WORKING - evaluar cumplimiento
  const entradaPlan = extractHHMM(planificacion.normal_entry_at)
  const salidaPlan = extractHHMM(planificacion.normal_exit_at)
  
  const diffEntrada = calcularDiferencia(entradaPlan, primeraEntrada)
  const diffSalida = calcularDiferencia(salidaPlan, ultimaSalida)
  
  // Entrada OK si llegó dentro de tolerancia (puede llegar antes o hasta 30 min tarde)
  // Negativo = llegó antes, positivo = llegó tarde
  const entradaOk = diffEntrada !== null && diffEntrada >= -60 && diffEntrada <= TOLERANCIA_ENTRADA
  
  // Salida OK si se fue dentro de tolerancia (puede irse hasta 30 min antes o después)
  // Negativo = se fue antes, positivo = se fue después
  const salidaOk = diffSalida !== null && diffSalida >= -TOLERANCIA_SALIDA && diffSalida <= 120
  
  // Sin marcaciones = no determinar
  if (primeraEntrada === null && ultimaSalida === null) {
    return {
      estado: 'no_determinar',
      entrada_ok: false,
      salida_ok: false,
      diferencia_entrada_min: null,
      diferencia_salida_min: null,
      manual_override: false,
      notas: 'Sin marcaciones'
    }
  }
  
  // Solo entrada sin salida = no determinar
  if (primeraEntrada !== null && ultimaSalida === null) {
    return {
      estado: 'no_determinar',
      entrada_ok: entradaOk,
      salida_ok: false,
      diferencia_entrada_min: diffEntrada,
      diferencia_salida_min: null,
      manual_override: false,
      notas: 'Sin salida registrada'
    }
  }
  
  // Evaluar cumplimiento completo
  if (entradaOk && salidaOk) {
    return {
      estado: 'cumplido',
      entrada_ok: true,
      salida_ok: true,
      diferencia_entrada_min: diffEntrada,
      diferencia_salida_min: diffSalida,
      manual_override: false,
      notas: null
    }
  }
  
  // No cumplió
  return {
    estado: 'no_determinar',
    entrada_ok: entradaOk,
    salida_ok: salidaOk,
    diferencia_entrada_min: diffEntrada,
    diferencia_salida_min: diffSalida,
    manual_override: false,
    notas: !entradaOk && !salidaOk 
      ? 'Discrepancia en entrada y salida'
      : !entradaOk 
        ? 'Discrepancia en entrada'
        : 'Discrepancia en salida'
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')
    
    if (!desde || !hasta) {
      return NextResponse.json(
        { error: 'Se requiere desde y hasta (YYYY-MM-DD)' },
        { status: 400 }
      )
    }
    
    // 1. Obtener empleados con rotación usando la vista
    const { data: empleadosData, error: empError } = await supabaseSicamar
      .from('v_empleados_rotaciones')
      .select('*')
    
    if (empError) {
      console.error('Error fetching empleados:', empError)
      return NextResponse.json({ error: empError.message }, { status: 500 })
    }
    
    // Mapear empleados
    const empleadosMap = new Map<number, EmpleadoInfo>()
    for (const emp of empleadosData || []) {
      if (emp.activo) {
        empleadosMap.set(emp.empleado_id, {
          id: emp.empleado_id,
          legajo: emp.legajo,
          nombre: emp.nombre,
          apellido: emp.apellido,
          sector: emp.sector,
          categoria: emp.categoria,
          foto_thumb_url: emp.foto_thumb_url,
          rotacion_nombre: emp.rotacion_nombre || null,
          condicion_contratacion: emp.condicion_contratacion || 'efectivo'
        })
      }
    }
    
    const empleadoIds = Array.from(empleadosMap.keys())
    
    if (empleadoIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        desde,
        hasta
      })
    }
    
    // 2. Obtener planificaciones del período
    const { data: planningData, error: planError } = await supabaseSicamar
      .from('daily_planning')
      .select('*')
      .in('employee_id', empleadoIds)
      .gte('operational_date', desde)
      .lte('operational_date', hasta)
    
    if (planError) {
      console.error('Error fetching planning:', planError)
      return NextResponse.json({ error: planError.message }, { status: 500 })
    }
    
    // Mapear planificaciones por employee_id + fecha
    const planningMap = new Map<string, DailyPlanningRow>()
    for (const p of (planningData || []) as DailyPlanningRow[]) {
      const key = `${p.employee_id}_${p.operational_date}`
      planningMap.set(key, p)
    }
    
    // 3. Obtener identificaciones biométricas
    const { data: identData, error: identError } = await supabaseSicamar
      .from('empleado_identificaciones')
      .select('id_biometrico, empleado_id')
      .in('empleado_id', empleadoIds)
      .eq('activo', true)
    
    if (identError) {
      console.error('Error fetching identificaciones:', identError)
      return NextResponse.json({ error: identError.message }, { status: 500 })
    }
    
    // Mapear ID biométrico -> empleado_id
    const biometricoToEmpleado = new Map<string, number>()
    for (const i of (identData || []) as IdentificacionRow[]) {
      biometricoToEmpleado.set(i.id_biometrico, i.empleado_id)
    }
    
    const idsBiometricos = Array.from(biometricoToEmpleado.keys())
    
    // 4. Obtener marcaciones del período
    // Extender el rango para capturar turnos noche
    const desdeUTC = `${desde}T03:00:00Z`
    const hastaDate = new Date(hasta + 'T12:00:00Z')
    hastaDate.setDate(hastaDate.getDate() + 1)
    const hastaUTC = hastaDate.toISOString().split('T')[0] + 'T06:00:00Z'
    
    let marcaciones: MarcacionRow[] = []
    
    if (idsBiometricos.length > 0) {
      const { data: marcData, error: marcError } = await supabaseSicamar
        .from('marcaciones')
        .select('id_biometrico, tipo, fecha_hora')
        .in('id_biometrico', idsBiometricos)
        .gte('fecha_hora', desdeUTC)
        .lte('fecha_hora', hastaUTC)
        .order('fecha_hora')
      
      if (marcError) {
        console.error('Error fetching marcaciones:', marcError)
        return NextResponse.json({ error: marcError.message }, { status: 500 })
      }
      
      marcaciones = (marcData || []) as MarcacionRow[]
    }
    
    // Agrupar marcaciones por empleado_id y fecha (hora argentina)
    const marcacionesPorEmpleadoFecha = new Map<string, { entradas: string[], salidas: string[] }>()
    
    for (const m of marcaciones) {
      const empleadoId = biometricoToEmpleado.get(m.id_biometrico)
      if (!empleadoId) continue
      
      // Convertir a hora argentina
      const fechaHora = new Date(m.fecha_hora)
      const horaArg = fechaHora.toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
      const fechaArg = fechaHora.toLocaleDateString('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires'
      })
      
      const key = `${empleadoId}_${fechaArg}`
      
      if (!marcacionesPorEmpleadoFecha.has(key)) {
        marcacionesPorEmpleadoFecha.set(key, { entradas: [], salidas: [] })
      }
      
      const grupo = marcacionesPorEmpleadoFecha.get(key)!
      if (m.tipo === 'E') {
        grupo.entradas.push(horaArg)
      } else {
        grupo.salidas.push(horaArg)
      }
    }
    
    // 5. Generar fechas del período
    const fechas: string[] = []
    const fechaActual = new Date(desde + 'T12:00:00')
    const fechaFin = new Date(hasta + 'T12:00:00')
    
    while (fechaActual <= fechaFin) {
      fechas.push(fechaActual.toISOString().split('T')[0])
      fechaActual.setDate(fechaActual.getDate() + 1)
    }
    
    // 6. Construir resultado
    const resultado: EmpleadoAsistencia[] = []
    
    for (const [empleadoId, empleado] of empleadosMap) {
      const dias: Record<string, AsistenciaDia> = {}
      
      for (const fecha of fechas) {
        const keyPlan = `${empleadoId}_${fecha}`
        const planificacion = planningMap.get(keyPlan) || null
        
        const keyMarc = `${empleadoId}_${fecha}`
        const marcs = marcacionesPorEmpleadoFecha.get(keyMarc)
        
        // Ordenar y obtener primera entrada y última salida
        const entradas = marcs?.entradas.sort() || []
        const salidas = marcs?.salidas.sort() || []
        
        const primeraEntrada = entradas.length > 0 ? entradas[0] : null
        const ultimaSalida = salidas.length > 0 ? salidas[salidas.length - 1] : null
        
        const cumplimiento = evaluarCumplimiento(planificacion, primeraEntrada, ultimaSalida)
        
        dias[fecha] = {
          fecha,
          planificacion: planificacion ? {
            status: planificacion.status,
            absence_reason: planificacion.absence_reason,
            entrada_planificada: extractHHMM(planificacion.normal_entry_at),
            salida_planificada: extractHHMM(planificacion.normal_exit_at)
          } : null,
          marcaciones: {
            primera_entrada: primeraEntrada,
            ultima_salida: ultimaSalida,
            total_marcaciones: entradas.length + salidas.length
          },
          cumplimiento
        }
      }
      
      resultado.push({ empleado, dias })
    }
    
    // Ordenar por apellido
    resultado.sort((a, b) => a.empleado.apellido.localeCompare(b.empleado.apellido))
    
    return NextResponse.json({
      success: true,
      data: resultado,
      desde,
      hasta,
      total_empleados: resultado.length
    })
    
  } catch (error) {
    console.error('Error en API asistencia:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

