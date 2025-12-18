import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'

/**
 * GET /api/sicamar/marcaciones
 * 
 * Obtiene marcaciones de una fecha específica
 * Query params:
 *   - fecha: YYYY-MM-DD (requerido)
 *   - legajo: filtrar por legajo (opcional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const fecha = searchParams.get('fecha')
    const legajo = searchParams.get('legajo')

    if (!fecha) {
      return NextResponse.json(
        { error: 'Se requiere el parámetro fecha (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    // Calcular rango del día (en UTC, considerando zona horaria Argentina)
    // Argentina es UTC-3, entonces el día local empieza a las 03:00 UTC
    const fechaInicio = `${fecha}T03:00:00.000Z`
    const fechaSiguiente = new Date(new Date(fecha).getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
    const fechaFin = `${fechaSiguiente}T03:00:00.000Z`

    // Obtener marcaciones del día
    let query = supabaseSicamar
      .from('marcaciones')
      .select('*')
      .gte('fecha_hora', fechaInicio)
      .lt('fecha_hora', fechaFin)
      .order('fecha_hora')

    const { data: marcacionesData, error: marcacionesError } = await query

    if (marcacionesError) {
      console.error('Error fetching marcaciones:', marcacionesError)
      return NextResponse.json(
        { error: 'Error obteniendo marcaciones', details: marcacionesError.message },
        { status: 500 }
      )
    }

    // Obtener todas las identificaciones biométricas para mapear a empleados
    const { data: identificacionesData } = await supabaseSicamar
      .from('empleado_identificaciones')
      .select(`
        id_biometrico,
        empleado_id,
        empleados:empleado_id (
          id,
          legajo,
          nombre,
          apellido,
          sector,
          categoria,
          foto_thumb_url
        )
      `)
      .eq('activo', true)

    // Crear mapa de id_biometrico -> empleado
    const empleadosPorBiometrico = new Map<string, {
      id: number
      legajo: string
      nombre: string
      apellido: string
      sector: string
      categoria: string
      foto_thumb_url: string | null
    }>()

    for (const ident of identificacionesData || []) {
      if (ident.id_biometrico && ident.empleados) {
        const emp = ident.empleados as {
          id: number
          legajo: string
          nombre: string
          apellido: string
          sector: string
          categoria: string
          foto_thumb_url: string | null
        }
        empleadosPorBiometrico.set(ident.id_biometrico, emp)
      }
    }

    // Enriquecer marcaciones con datos del empleado
    const marcacionesEnriquecidas = (marcacionesData || []).map(marc => {
      const empleado = empleadosPorBiometrico.get(marc.id_biometrico)
      
      // Convertir fecha_hora a hora argentina
      const fechaHora = new Date(marc.fecha_hora)
      const horaArg = fechaHora.toLocaleTimeString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })

      return {
        id: marc.id,
        id_biometrico: marc.id_biometrico,
        tipo: marc.tipo, // E o S
        fecha_hora: marc.fecha_hora,
        hora_local: horaArg,
        id_reloj: marc.id_reloj,
        empleado: empleado ? {
          id: empleado.id,
          legajo: empleado.legajo,
          nombre: empleado.nombre,
          apellido: empleado.apellido,
          nombre_completo: `${empleado.apellido}, ${empleado.nombre}`,
          sector: empleado.sector,
          categoria: empleado.categoria,
          foto_thumb_url: empleado.foto_thumb_url
        } : null
      }
    })

    // Filtrar por legajo si se especificó
    let resultado = marcacionesEnriquecidas
    if (legajo) {
      resultado = marcacionesEnriquecidas.filter(m => m.empleado?.legajo === legajo)
    }

    // Agrupar por empleado para resumen
    const porEmpleado = new Map<string, {
      empleado: typeof resultado[0]['empleado']
      marcaciones: typeof resultado
      primera_entrada: string | null
      ultima_salida: string | null
      horas_estimadas: number | null
    }>()

    for (const marc of resultado) {
      const key = marc.empleado?.legajo || marc.id_biometrico
      
      if (!porEmpleado.has(key)) {
        porEmpleado.set(key, {
          empleado: marc.empleado,
          marcaciones: [],
          primera_entrada: null,
          ultima_salida: null,
          horas_estimadas: null
        })
      }
      
      porEmpleado.get(key)!.marcaciones.push(marc)
    }

    // Calcular primera entrada y última salida
    for (const [, grupo] of porEmpleado) {
      const entradas = grupo.marcaciones.filter(m => m.tipo === 'E').map(m => new Date(m.fecha_hora))
      const salidas = grupo.marcaciones.filter(m => m.tipo === 'S').map(m => new Date(m.fecha_hora))
      
      if (entradas.length > 0) {
        grupo.primera_entrada = new Date(Math.min(...entradas.map(d => d.getTime())))
          .toLocaleTimeString('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })
      }
      
      if (salidas.length > 0) {
        grupo.ultima_salida = new Date(Math.max(...salidas.map(d => d.getTime())))
          .toLocaleTimeString('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })
      }
      
      // Calcular horas estimadas
      if (entradas.length > 0 && salidas.length > 0) {
        const primeraEntrada = Math.min(...entradas.map(d => d.getTime()))
        const ultimaSalida = Math.max(...salidas.map(d => d.getTime()))
        const horasTrabajadas = (ultimaSalida - primeraEntrada) / (1000 * 60 * 60)
        
        if (horasTrabajadas > 0 && horasTrabajadas < 24) {
          grupo.horas_estimadas = Math.round(horasTrabajadas * 100) / 100
        }
      }
    }

    return NextResponse.json({
      success: true,
      fecha,
      total_marcaciones: resultado.length,
      total_empleados: porEmpleado.size,
      marcaciones: resultado,
      por_empleado: Array.from(porEmpleado.values()).sort((a, b) => {
        const legajoA = a.empleado?.legajo || '999999'
        const legajoB = b.empleado?.legajo || '999999'
        return legajoA.localeCompare(legajoB, undefined, { numeric: true })
      })
    })

  } catch (error) {
    console.error('Error en API marcaciones:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}


