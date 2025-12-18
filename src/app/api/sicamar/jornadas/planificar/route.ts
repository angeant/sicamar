import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'

// Mapeo de turnos según horario
// 22-06 = N (Noche), 06-14 = M (Mañana), 14-22 = T (Tarde), 08-16 = M (Mañana especial)
type TurnoCode = 'M' | 'T' | 'N'

interface PlanificacionEmpleado {
  nombre: string  // Apellido, Nombre
  turno: TurnoCode
  estado?: 'ENF' | 'VAC' | null
}

// POST: Cargar planificación semanal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { anio, mes, semanaDesde, planificacion } = body as {
      anio: number
      mes: number
      semanaDesde: number // día de inicio (ej: 8 para semana del 8 al 14)
      planificacion: PlanificacionEmpleado[]
    }
    
    if (!anio || !mes || !semanaDesde || !planificacion) {
      return NextResponse.json(
        { error: 'Se requiere anio, mes, semanaDesde y planificacion' },
        { status: 400 }
      )
    }
    
    // 1. Obtener todos los empleados jornalizados
    const { data: empleados } = await supabaseSicamar
      .from('empleados')
      .select('id, legajo, nombre, apellido')
      .eq('activo', true)
      .eq('clase', 'Jornal')
    
    if (!empleados) {
      return NextResponse.json({ error: 'No se encontraron empleados' }, { status: 500 })
    }
    
    // Crear múltiples mapas para buscar por diferentes criterios
    const empleadosPorLegajo = new Map<string, typeof empleados[0]>()
    const empleadosPorApellido = new Map<string, typeof empleados[0]>()
    const empleadosPorNombreCompleto = new Map<string, typeof empleados[0]>()
    
    const normalizar = (s: string) => s
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    
    for (const emp of empleados) {
      // Por legajo
      empleadosPorLegajo.set(emp.legajo, emp)
      
      // Por apellido solo (primer match gana)
      const apellidoNorm = normalizar(emp.apellido)
      if (!empleadosPorApellido.has(apellidoNorm)) {
        empleadosPorApellido.set(apellidoNorm, emp)
      }
      
      // Por nombre completo (apellido + nombre)
      const nombreCompleto = normalizar(`${emp.apellido}, ${emp.nombre}`)
      empleadosPorNombreCompleto.set(nombreCompleto, emp)
      
      // También apellido + primer nombre
      const primerNombre = emp.nombre.split(' ')[0]
      const nombreCorto = normalizar(`${emp.apellido}, ${primerNombre}`)
      if (!empleadosPorNombreCompleto.has(nombreCorto)) {
        empleadosPorNombreCompleto.set(nombreCorto, emp)
      }
    }
    
    // 2. Calcular fechas de la semana (Lun a Sáb, más Dom anterior para noche)
    const fechas: string[] = []
    
    // Verificar si semanaDesde es lunes (para agregar el domingo anterior)
    const primerDia = new Date(anio, mes - 1, semanaDesde)
    if (primerDia.getDay() === 1) { // Es lunes
      // Agregar el domingo anterior para turno noche
      const domingoAnterior = new Date(primerDia)
      domingoAnterior.setDate(domingoAnterior.getDate() - 1)
      const domAnio = domingoAnterior.getFullYear()
      const domMes = domingoAnterior.getMonth() + 1
      const domDia = domingoAnterior.getDate()
      fechas.push(`${domAnio}-${String(domMes).padStart(2, '0')}-${String(domDia).padStart(2, '0')}`)
    }
    
    for (let d = 0; d < 7; d++) {
      const dia = semanaDesde + d
      // Verificar que no exceda el mes
      const ultimoDia = new Date(anio, mes, 0).getDate()
      if (dia <= ultimoDia) {
        fechas.push(`${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`)
      }
    }
    
    console.log(`[Planificar] Semana: ${fechas[0]} a ${fechas[fechas.length - 1]}`)
    console.log(`[Planificar] Empleados a procesar: ${planificacion.length}`)
    
    // 3. Procesar cada empleado de la planificación
    const jornadasAInsertar: Array<{
      empleado_id: number
      fecha: string
      turno_asignado: string
      hora_entrada_asignada: string | null
      hora_salida_asignada: string | null
      horas_asignadas: number
      horas_trabajadas: number
      horas_diurnas: number
      horas_nocturnas: number
      origen: string
      estado_empleado: string | null
      tiene_inconsistencia: boolean
    }> = []
    
    const noEncontrados: string[] = []
    
    for (const plan of planificacion) {
      const nombreNorm = normalizar(plan.nombre)
      const partes = nombreNorm.split(',').map(s => s.trim())
      const apellidoBuscado = partes[0]
      const nombreBuscado = partes[1] || ''
      const primerNombreBuscado = nombreBuscado.split(' ')[0]
      
      let empleado: typeof empleados[0] | undefined
      
      // 1. Si viene con legajo (#123), buscar por legajo
      const legajoMatch = plan.nombre.match(/#(\d+)/)
      if (legajoMatch) {
        empleado = empleadosPorLegajo.get(legajoMatch[1])
      }
      
      // 2. Buscar por nombre completo exacto
      if (!empleado) {
        empleado = empleadosPorNombreCompleto.get(nombreNorm)
      }
      
      // 3. Buscar por apellido + primer nombre
      if (!empleado && nombreBuscado) {
        empleado = empleadosPorNombreCompleto.get(`${apellidoBuscado}, ${primerNombreBuscado}`)
      }
      
      // 4. OPTIMISTA: Buscar por apellido exacto + nombre contenido
      if (!empleado && nombreBuscado) {
        for (const emp of empleados) {
          const empApellido = normalizar(emp.apellido)
          const empNombre = normalizar(emp.nombre)
          
          // Apellido debe coincidir exacto
          if (empApellido !== apellidoBuscado) continue
          
          // Nombre buscado debe estar contenido en el nombre real
          // O el primer nombre debe coincidir
          if (empNombre.includes(primerNombreBuscado) || 
              primerNombreBuscado.includes(empNombre.split(' ')[0])) {
            empleado = emp
            break
          }
        }
      }
      
      // 5. Solo por apellido si no hay nombre especificado
      if (!empleado && !nombreBuscado) {
        empleado = empleadosPorApellido.get(apellidoBuscado)
      }
      
      // 6. Apellido parcial como último recurso
      if (!empleado) {
        for (const emp of empleados) {
          const empApellido = normalizar(emp.apellido)
          if (empApellido.includes(apellidoBuscado) || apellidoBuscado.includes(empApellido)) {
            // Si hay nombre, verificar que también matchee
            if (nombreBuscado) {
              const empNombre = normalizar(emp.nombre)
              if (empNombre.includes(primerNombreBuscado) || primerNombreBuscado.includes(empNombre.split(' ')[0])) {
                empleado = emp
                break
              }
            } else {
              empleado = emp
              break
            }
          }
        }
      }
      
      if (!empleado) {
        noEncontrados.push(plan.nombre)
        continue
      }
      
      // Determinar horarios según turno
      let horaEntrada: string
      let horaSalida: string
      let horasAsignadas: number
      
      switch (plan.turno) {
        case 'M':
          horaEntrada = '06:00:00'
          horaSalida = '14:00:00'
          horasAsignadas = 8
          break
        case 'T':
          horaEntrada = '14:00:00'
          horaSalida = '22:00:00'
          horasAsignadas = 8
          break
        case 'N':
          horaEntrada = '22:00:00'
          horaSalida = '06:00:00'
          horasAsignadas = 8
          break
        default:
          horaEntrada = '06:00:00'
          horaSalida = '14:00:00'
          horasAsignadas = 8
      }
      
      // Estado (ENF, VAC, etc)
      const estadoEmpleado = plan.estado ? plan.estado.toLowerCase() : null
      
      // Crear jornadas para cada día de la semana
      for (const fecha of fechas) {
        const d = new Date(fecha + 'T12:00:00')
        const diaSemana = d.getDay() // 0=Dom, 1=Lun, ..., 6=Sab
        
        // Reglas según turno:
        // - Mañana (M): Lun-Vie 8h, Sab 7h (06-13), Dom libre
        // - Tarde (T): Lun-Vie 8h, Sab y Dom libre
        // - Noche (N): Lun-Vie 8h, Dom 22:00 entra (cuenta como lunes)
        
        let debeTrabajar = false
        let horasDelDia = horasAsignadas
        
        if (plan.turno === 'M') {
          if (diaSemana >= 1 && diaSemana <= 5) debeTrabajar = true
          if (diaSemana === 6) { debeTrabajar = true; horasDelDia = 7 } // Sábado
          // Domingo libre
        } else if (plan.turno === 'T') {
          if (diaSemana >= 1 && diaSemana <= 5) debeTrabajar = true
          // Sábado y Domingo libre
        } else if (plan.turno === 'N') {
          if (diaSemana >= 1 && diaSemana <= 5) debeTrabajar = true
          if (diaSemana === 0) debeTrabajar = true // Domingo 22:00 (turno del lunes)
          // Sábado noche ya se cuenta como viernes
        }
        
        if (!debeTrabajar && !estadoEmpleado) continue
        
        jornadasAInsertar.push({
          empleado_id: empleado.id,
          fecha,
          turno_asignado: plan.turno,
          hora_entrada_asignada: horaEntrada,
          hora_salida_asignada: horaSalida,
          horas_asignadas: estadoEmpleado ? 0 : horasDelDia,
          horas_trabajadas: 0, // No hay marcaciones aún
          horas_diurnas: 0,
          horas_nocturnas: 0,
          origen: 'manual',
          estado_empleado: estadoEmpleado === 'enf' ? 'enfermo' : estadoEmpleado === 'vac' ? 'vacaciones' : estadoEmpleado,
          tiene_inconsistencia: false
        })
      }
    }
    
    console.log(`[Planificar] Jornadas a insertar: ${jornadasAInsertar.length}`)
    if (noEncontrados.length > 0) {
      console.log(`[Planificar] No encontrados: ${noEncontrados.join(', ')}`)
    }
    
    // 4. Insertar/actualizar jornadas
    const batchSize = 100
    for (let i = 0; i < jornadasAInsertar.length; i += batchSize) {
      const batch = jornadasAInsertar.slice(i, i + batchSize)
      const { error } = await supabaseSicamar
        .from('jornadas_diarias')
        .upsert(batch, { onConflict: 'empleado_id,fecha' })
      
      if (error) {
        console.error('Error insertando:', error)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Planificación cargada: ${jornadasAInsertar.length} jornadas`,
      count: jornadasAInsertar.length,
      noEncontrados
    })
    
  } catch (error) {
    console.error('Error planificando:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

