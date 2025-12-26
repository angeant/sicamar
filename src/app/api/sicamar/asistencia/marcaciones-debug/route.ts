import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'

/**
 * GET /api/sicamar/asistencia/marcaciones-debug
 * 
 * Devuelve marcaciones crudas de un empleado en un rango de días para debug.
 * Incluye días anteriores y posteriores para ver el contexto completo.
 * 
 * Query params:
 *   - empleado_id: ID del empleado (requerido)
 *   - fecha: Fecha central YYYY-MM-DD (requerido)
 *   - dias_contexto: Días antes/después a incluir (default: 3)
 */

interface MarcacionCruda {
  id: number
  tipo: 'E' | 'S'
  fecha_hora_utc: string
  fecha_local: string
  hora_local: string
  id_reloj: number | null
  archivo_origen: string | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const empleadoId = searchParams.get('empleado_id')
    const fecha = searchParams.get('fecha')
    const diasContexto = parseInt(searchParams.get('dias_contexto') || '3')
    
    if (!empleadoId || !fecha) {
      return NextResponse.json(
        { error: 'Se requiere empleado_id y fecha' },
        { status: 400 }
      )
    }
    
    // Obtener identificaciones biométricas del empleado
    const { data: identData, error: identError } = await supabaseSicamar
      .from('empleado_identificaciones')
      .select('id_biometrico')
      .eq('empleado_id', parseInt(empleadoId))
      .eq('activo', true)
    
    if (identError) {
      return NextResponse.json({ error: identError.message }, { status: 500 })
    }
    
    const idsBiometricos = (identData || []).map(i => i.id_biometrico)
    
    if (idsBiometricos.length === 0) {
      return NextResponse.json({
        success: true,
        empleado_id: empleadoId,
        fecha_central: fecha,
        identificaciones: [],
        marcaciones: [],
        mensaje: 'No hay identificaciones biométricas activas para este empleado'
      })
    }
    
    // Calcular rango de fechas
    const fechaCentral = new Date(fecha + 'T12:00:00')
    const fechaDesde = new Date(fechaCentral)
    fechaDesde.setDate(fechaDesde.getDate() - diasContexto)
    const fechaHasta = new Date(fechaCentral)
    fechaHasta.setDate(fechaHasta.getDate() + diasContexto + 1)
    
    // Convertir a UTC (Argentina es UTC-3)
    const desdeUTC = `${fechaDesde.toISOString().split('T')[0]}T03:00:00Z`
    const hastaUTC = `${fechaHasta.toISOString().split('T')[0]}T03:00:00Z`
    
    // Obtener marcaciones
    const { data: marcData, error: marcError } = await supabaseSicamar
      .from('marcaciones')
      .select('id, id_biometrico, tipo, fecha_hora, id_reloj, archivo_origen')
      .in('id_biometrico', idsBiometricos)
      .gte('fecha_hora', desdeUTC)
      .lt('fecha_hora', hastaUTC)
      .order('fecha_hora')
    
    if (marcError) {
      return NextResponse.json({ error: marcError.message }, { status: 500 })
    }
    
    // Formatear marcaciones con hora local
    const marcaciones: MarcacionCruda[] = (marcData || []).map(m => {
      const fechaHora = new Date(m.fecha_hora)
      
      const fechaLocal = fechaHora.toLocaleDateString('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires'
      })
      
      const horaLocal = fechaHora.toLocaleTimeString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      
      return {
        id: m.id,
        tipo: m.tipo as 'E' | 'S',
        fecha_hora_utc: m.fecha_hora,
        fecha_local: fechaLocal,
        hora_local: horaLocal,
        id_reloj: m.id_reloj,
        archivo_origen: m.archivo_origen
      }
    })
    
    // Agrupar por fecha para facilitar visualización
    const marcacionesPorFecha: Record<string, MarcacionCruda[]> = {}
    for (const m of marcaciones) {
      if (!marcacionesPorFecha[m.fecha_local]) {
        marcacionesPorFecha[m.fecha_local] = []
      }
      marcacionesPorFecha[m.fecha_local].push(m)
    }
    
    return NextResponse.json({
      success: true,
      empleado_id: parseInt(empleadoId),
      fecha_central: fecha,
      rango: {
        desde: fechaDesde.toISOString().split('T')[0],
        hasta: fechaHasta.toISOString().split('T')[0]
      },
      identificaciones: idsBiometricos,
      total_marcaciones: marcaciones.length,
      marcaciones_por_fecha: marcacionesPorFecha,
      marcaciones // Array plano ordenado por fecha_hora
    })
    
  } catch (error) {
    console.error('Error en marcaciones-debug:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}


