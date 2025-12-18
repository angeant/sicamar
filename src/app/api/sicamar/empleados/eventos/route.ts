import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar } from '@/lib/supabase-server'

interface EventoEmpleado {
  id: number
  legajo: string
  nombre: string
  apellido: string
  tipo: 'cumpleaños' | 'aniversario'
  fecha_evento: string
  dias_faltantes: number
  años: number // edad o años en empresa
}

// GET - Obtener próximos eventos (cumpleaños y aniversarios)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const diasAdelante = parseInt(searchParams.get('dias') || '7')

    // Obtener empleados con sus fechas
    const { data: empleados, error } = await supabaseSicamar
      .from('empleados')
      .select('id, legajo, nombre, apellido, fecha_nacimiento, fecha_ingreso')
      .eq('activo', true)

    if (error) throw error

    // Usar fecha local sin problemas de timezone
    const ahora = new Date()
    const hoyStr = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`
    const [añoHoy, mesHoy, diaHoy] = hoyStr.split('-').map(Number)
    
    const eventos: EventoEmpleado[] = []

    // Helper para parsear fecha sin timezone issues
    const parseFecha = (fechaStr: string): { año: number; mes: number; dia: number } | null => {
      if (!fechaStr) return null
      const [año, mes, dia] = fechaStr.split('T')[0].split('-').map(Number)
      return { año, mes, dia }
    }

    // Helper para calcular días entre dos fechas (solo año/mes/día)
    const diasEntre = (desde: { año: number; mes: number; dia: number }, hasta: { año: number; mes: number; dia: number }): number => {
      const d1 = new Date(desde.año, desde.mes - 1, desde.dia)
      const d2 = new Date(hasta.año, hasta.mes - 1, hasta.dia)
      return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
    }

    // Helper para formatear fecha
    const formatFecha = (f: { año: number; mes: number; dia: number }): string => {
      return `${f.año}-${String(f.mes).padStart(2, '0')}-${String(f.dia).padStart(2, '0')}`
    }

    for (const emp of empleados || []) {
      // Procesar cumpleaños
      if (emp.fecha_nacimiento) {
        const fechaNac = parseFecha(emp.fecha_nacimiento)
        if (fechaNac) {
          // Cumpleaños este año
          const proximoCumple = { año: añoHoy, mes: fechaNac.mes, dia: fechaNac.dia }
          
          // Si ya pasó este año, usar el próximo año
          const diasHastaCumple = diasEntre({ año: añoHoy, mes: mesHoy, dia: diaHoy }, proximoCumple)
          if (diasHastaCumple < 0) {
            proximoCumple.año = añoHoy + 1
          }

          const diasFaltantes = diasEntre({ año: añoHoy, mes: mesHoy, dia: diaHoy }, proximoCumple)

          if (diasFaltantes >= 0 && diasFaltantes <= diasAdelante) {
            const edad = proximoCumple.año - fechaNac.año
            eventos.push({
              id: emp.id,
              legajo: emp.legajo,
              nombre: emp.nombre,
              apellido: emp.apellido,
              tipo: 'cumpleaños',
              fecha_evento: formatFecha(proximoCumple),
              dias_faltantes: diasFaltantes,
              años: edad
            })
          }
        }
      }

      // Procesar aniversarios de ingreso
      if (emp.fecha_ingreso) {
        const fechaIng = parseFecha(emp.fecha_ingreso)
        if (fechaIng) {
          // Aniversario este año
          const proximoAniv = { año: añoHoy, mes: fechaIng.mes, dia: fechaIng.dia }
          
          // Si ya pasó este año, usar el próximo año
          const diasHastaAniv = diasEntre({ año: añoHoy, mes: mesHoy, dia: diaHoy }, proximoAniv)
          if (diasHastaAniv < 0) {
            proximoAniv.año = añoHoy + 1
          }

          const diasFaltantes = diasEntre({ año: añoHoy, mes: mesHoy, dia: diaHoy }, proximoAniv)

          if (diasFaltantes >= 0 && diasFaltantes <= diasAdelante) {
            const añosEmpresa = proximoAniv.año - fechaIng.año
            eventos.push({
              id: emp.id,
              legajo: emp.legajo,
              nombre: emp.nombre,
              apellido: emp.apellido,
              tipo: 'aniversario',
              fecha_evento: formatFecha(proximoAniv),
              dias_faltantes: diasFaltantes,
              años: añosEmpresa
            })
          }
        }
      }
    }

    // Ordenar por días faltantes, luego por tipo (cumpleaños primero)
    eventos.sort((a, b) => {
      if (a.dias_faltantes !== b.dias_faltantes) {
        return a.dias_faltantes - b.dias_faltantes
      }
      return a.tipo === 'cumpleaños' ? -1 : 1
    })

    // Agrupar por día
    const eventosPorDia: Record<string, EventoEmpleado[]> = {}
    for (const ev of eventos) {
      if (!eventosPorDia[ev.fecha_evento]) {
        eventosPorDia[ev.fecha_evento] = []
      }
      eventosPorDia[ev.fecha_evento].push(ev)
    }

    return NextResponse.json({
      eventos,
      por_dia: eventosPorDia,
      total_cumpleaños: eventos.filter(e => e.tipo === 'cumpleaños').length,
      total_aniversarios: eventos.filter(e => e.tipo === 'aniversario').length
    })
  } catch (error) {
    console.error('Error fetching eventos:', error)
    return NextResponse.json(
      { error: 'Error al obtener eventos' },
      { status: 500 }
    )
  }
}
