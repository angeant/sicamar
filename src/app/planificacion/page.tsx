'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useAuth, useUser, SignInButton } from '@clerk/nextjs'

interface Empleado {
  id: number
  legajo: string
  nombre: string
  apellido: string
  sector: string | null
  categoria: string | null
}

interface JornadaDiaria {
  id?: number
  empleado_id: number
  fecha: string
  turno_asignado: string | null
  estado_empleado: string | null
  horas_asignadas: number
  horas_extra_50: number
  horas_extra_100: number
  hora_entrada_asignada?: string | null
  hora_salida_asignada?: string | null
}

interface EmpleadoConJornadas {
  empleado: Empleado
  jornadas: Record<string, JornadaDiaria>
}

interface CeldaSeleccionada {
  empleado: Empleado
  fecha: string
  jornada: JornadaDiaria | null
  rect: { top: number; left: number; width: number }
}

// Horarios por turno
const HORARIOS_TURNO: Record<string, { entrada: string; salida: string }> = {
  'M': { entrada: '06:00', salida: '14:00' },
  'T': { entrada: '14:00', salida: '22:00' },
  'N': { entrada: '22:00', salida: '06:00' },
}

// Opciones de estado
const ESTADOS_EMPLEADO = [
  { value: '', label: 'Trabaja' },
  { value: 'VAC', label: 'Vacaciones' },
  { value: 'ENF', label: 'Enfermedad' },
  { value: 'ACC', label: 'Accidente' },
  { value: 'SUS', label: 'Suspendido' },
  { value: 'LIC', label: 'Licencia' },
  { value: 'ART', label: 'ART' },
  { value: 'FLT', label: 'Falta' },
]

// Helper para obtener el lunes de una semana
function getLunesDeSemana(fecha: Date): Date {
  const d = new Date(fecha)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

// Generar array de fechas para una semana (Lun-Dom)
function getFechasSemana(lunes: Date): string[] {
  const fechas: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    fechas.push(d.toISOString().split('T')[0])
  }
  return fechas
}

// Formato corto de día
const DIAS_CORTOS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
const DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Formatear horario como "HH:MM" o solo "HH"
function formatHora(hora: string | null | undefined, soloHora: boolean = false): string {
  if (!hora) return ''
  return soloHora ? hora.slice(0, 2) : hora.slice(0, 5)
}

// Detectar si el horario cruza al día siguiente (entrada > salida = entrada es del día anterior)
function esHorarioNocturno(entrada: string | null | undefined, salida: string | null | undefined): boolean {
  if (!entrada || !salida) return false
  return entrada > salida // ej: 22:00 > 06:00
}

// Obtener estilo por estado
function getEstadoStyle(estado: string): { text: string; label: string } {
  const e = estado.toLowerCase()
  if (e.includes('vac')) return { text: 'text-neutral-400', label: 'vac' }
  if (e.includes('enf')) return { text: 'text-neutral-400', label: 'enf' }
  if (e.includes('acc')) return { text: 'text-neutral-400', label: 'acc' }
  if (e.includes('sus')) return { text: 'text-neutral-400', label: 'sus' }
  if (e.includes('lic')) return { text: 'text-neutral-400', label: 'lic' }
  if (e.includes('art')) return { text: 'text-neutral-400', label: 'art' }
  if (e.includes('flt')) return { text: 'text-neutral-400', label: 'flt' }
  return { text: 'text-neutral-400', label: estado.slice(0, 3).toLowerCase() }
}

export default function PlanificacionPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const [isSicamarMember, setIsSicamarMember] = useState<boolean | null>(null)
  
  const [empleados, setEmpleados] = useState<EmpleadoConJornadas[]>([])
  const [loading, setLoading] = useState(true)
  const [semanaActual, setSemanaActual] = useState<Date>(getLunesDeSemana(new Date()))
  const [fechas, setFechas] = useState<string[]>([])
  const [celdaSeleccionada, setCeldaSeleccionada] = useState<CeldaSeleccionada | null>(null)
  const [guardando, setGuardando] = useState(false)
  
  // Form state para edición
  const [formTurno, setFormTurno] = useState<string>('')
  const [formEstado, setFormEstado] = useState<string>('')
  const [formHoraEntrada, setFormHoraEntrada] = useState<string>('')
  const [formHoraSalida, setFormHoraSalida] = useState<string>('')
  const [formExtra50, setFormExtra50] = useState<number>(0)
  const [formExtra100, setFormExtra100] = useState<number>(0)
  
  const popoverRef = useRef<HTMLDivElement>(null)
  
  // Verificar membresía a Sicamar
  useEffect(() => {
    async function checkMembership() {
      if (!user?.id) return
      try {
        const email = user.primaryEmailAddress?.emailAddress || ''
        const res = await fetch(`/api/auth/check-sicamar?userId=${user.id}&email=${encodeURIComponent(email)}`)
        const data = await res.json()
        setIsSicamarMember(data.isMember)
      } catch {
        setIsSicamarMember(false)
      }
    }
    if (isSignedIn && user) {
      checkMembership()
    }
  }, [isSignedIn, user])
  
  const cargarDatos = useCallback(async () => {
    setLoading(true)
    const fechasSemana = getFechasSemana(semanaActual)
    setFechas(fechasSemana)
    
    try {
      // Cargar empleados jornalizados activos
      const empRes = await fetch('/api/sicamar/empleados?activos=true')
      const empData = await empRes.json()
      const empleadosJornal = (empData.empleados || []).filter((e: Empleado & { clase: string }) => e.clase === 'Jornal')
      
      // Cargar jornadas de la semana + día anterior (para turnos nocturnos que salen el lunes)
      const fechaAnteriorAlLunes = new Date(fechasSemana[0] + 'T12:00:00')
      fechaAnteriorAlLunes.setDate(fechaAnteriorAlLunes.getDate() - 1)
      const fechaAnteriorStr = fechaAnteriorAlLunes.toISOString().split('T')[0]
      
      const jorRes = await fetch(`/api/sicamar/jornadas?desde=${fechaAnteriorStr}&hasta=${fechasSemana[6]}&solo_planificado=true`)
      const jorData = await jorRes.json()
      
      // Mapear jornadas por empleado_id y fecha
      const jornadasMap = new Map<number, Map<string, JornadaDiaria>>()
      for (const j of jorData.data || []) {
        if (!jornadasMap.has(j.empleado_id)) {
          jornadasMap.set(j.empleado_id, new Map())
        }
        jornadasMap.get(j.empleado_id)!.set(j.fecha, j)
      }
      
      // Cargar estados de empleados (VAC, ENF, etc)
      const estRes = await fetch('/api/sicamar/empleados/estados?vigentes=true')
      const estData = await estRes.json()
      
      // Mapear estados por empleado_id
      const estadosMap = new Map<number, { tipo: string; desde: string; hasta: string }[]>()
      for (const e of estData || []) {
        if (!estadosMap.has(e.empleado_id)) {
          estadosMap.set(e.empleado_id, [])
        }
        estadosMap.get(e.empleado_id)!.push({
          tipo: e.tipo_estado,
          desde: e.fecha_inicio,
          hasta: e.fecha_fin || '2099-12-31'
        })
      }
      
      // Combinar - IMPORTANTE: Los turnos nocturnos se almacenan con fecha = día de ENTRADA
      // pero se deben MOSTRAR en el día de SALIDA (día siguiente)
      const result: EmpleadoConJornadas[] = empleadosJornal.map((emp: Empleado) => {
        const jornadasEmp = jornadasMap.get(emp.id) || new Map()
        const estadosEmp = estadosMap.get(emp.id) || []
        
        const jornadas: Record<string, JornadaDiaria> = {}
        
        for (const fecha of fechasSemana) {
          // Buscar jornada normal para esta fecha
          let jornada = jornadasEmp.get(fecha)
          
          // Para turnos nocturnos, buscar la jornada del día ANTERIOR
          // porque la fecha almacenada es el día de entrada, pero se muestra en el día de salida
          const fechaAnterior = new Date(fecha + 'T12:00:00')
          fechaAnterior.setDate(fechaAnterior.getDate() - 1)
          const fechaAnteriorStr = fechaAnterior.toISOString().split('T')[0]
          
          const jornadaNocheAnterior = jornadasEmp.get(fechaAnteriorStr)
          if (jornadaNocheAnterior && esHorarioNocturno(jornadaNocheAnterior.hora_entrada_asignada, jornadaNocheAnterior.hora_salida_asignada)) {
            // Esta es una jornada nocturna del día anterior que SALE hoy
            // La mostramos en este día con indicador de entrada del día anterior
            jornada = {
              ...jornadaNocheAnterior,
              fecha: fecha, // Cambiar fecha para mostrar correctamente
              _entradaDiaAnterior: true // Flag interno
            } as JornadaDiaria & { _entradaDiaAnterior?: boolean }
          }
          
          // Si la jornada actual es nocturna (entrada > salida), NO la mostramos hoy
          // porque se mostrará mañana (en el día de salida)
          if (jornada && !('_entradaDiaAnterior' in jornada) && esHorarioNocturno(jornada.hora_entrada_asignada, jornada.hora_salida_asignada)) {
            jornada = undefined // No mostrar hoy, se mostrará mañana
          }
          
          if (!jornada) {
            // Verificar si tiene estado para esa fecha
            const estado = estadosEmp.find(e => fecha >= e.desde && fecha <= e.hasta)
            if (estado) {
              jornada = {
                empleado_id: emp.id,
                fecha,
                turno_asignado: null,
                estado_empleado: estado.tipo,
                horas_asignadas: 0,
                horas_extra_50: 0,
                horas_extra_100: 0
              }
            }
          }
          
          if (jornada) {
            jornadas[fecha] = jornada
          }
        }
        
        return { empleado: emp, jornadas }
      })
      
      // Ordenar por apellido
      result.sort((a, b) => a.empleado.apellido.localeCompare(b.empleado.apellido))
      
      setEmpleados(result)
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }, [semanaActual])
  
  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])
  
  // Cerrar popover al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setCeldaSeleccionada(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Navegación de semanas
  const semanaAnterior = () => {
    const nueva = new Date(semanaActual)
    nueva.setDate(nueva.getDate() - 7)
    setSemanaActual(nueva)
    setCeldaSeleccionada(null)
  }
  
  const semanaSiguiente = () => {
    const nueva = new Date(semanaActual)
    nueva.setDate(nueva.getDate() + 7)
    setSemanaActual(nueva)
    setCeldaSeleccionada(null)
  }
  
  const irAHoy = () => {
    setSemanaActual(getLunesDeSemana(new Date()))
    setCeldaSeleccionada(null)
  }
  
  // Formatear rango de fechas
  const formatRangoSemana = () => {
    if (fechas.length === 0) return ''
    const inicio = new Date(fechas[0] + 'T12:00:00')
    const fin = new Date(fechas[6] + 'T12:00:00')
    const optsCorto = { day: 'numeric' as const }
    const optsLargo = { day: 'numeric' as const, month: 'short' as const }
    
    if (inicio.getMonth() === fin.getMonth()) {
      return `${inicio.toLocaleDateString('es-AR', optsCorto)} - ${fin.toLocaleDateString('es-AR', optsLargo)}`
    }
    return `${inicio.toLocaleDateString('es-AR', optsLargo)} - ${fin.toLocaleDateString('es-AR', optsLargo)}`
  }
  
  // Verificar si es hoy
  const esHoy = (fecha: string) => {
    return fecha === new Date().toISOString().split('T')[0]
  }
  
  // Click en celda
  const handleCeldaClick = (empleado: Empleado, fecha: string, jornada: JornadaDiaria | null, event: React.MouseEvent<HTMLTableCellElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    
    setCeldaSeleccionada({
      empleado,
      fecha,
      jornada,
      rect: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width }
    })
    
    // Inicializar form
    setFormTurno(jornada?.turno_asignado || '')
    setFormEstado(jornada?.estado_empleado || '')
    setFormHoraEntrada(jornada?.hora_entrada_asignada || HORARIOS_TURNO[jornada?.turno_asignado || 'M']?.entrada || '06:00')
    setFormHoraSalida(jornada?.hora_salida_asignada || HORARIOS_TURNO[jornada?.turno_asignado || 'M']?.salida || '14:00')
    setFormExtra50(jornada?.horas_extra_50 || 0)
    setFormExtra100(jornada?.horas_extra_100 || 0)
  }
  
  // Cambiar turno actualiza horarios
  const handleTurnoChange = (turno: string) => {
    setFormTurno(turno)
    if (turno && HORARIOS_TURNO[turno]) {
      setFormHoraEntrada(HORARIOS_TURNO[turno].entrada)
      setFormHoraSalida(HORARIOS_TURNO[turno].salida)
    }
  }
  
  // Guardar cambios
  const guardarCambios = async () => {
    if (!celdaSeleccionada) return
    
    setGuardando(true)
    try {
      const payload = {
        empleado_id: celdaSeleccionada.empleado.id,
        fecha: celdaSeleccionada.fecha,
        turno_asignado: formEstado ? null : (formTurno || null),
        estado_empleado: formEstado || null,
        hora_entrada_asignada: formEstado ? null : formHoraEntrada,
        hora_salida_asignada: formEstado ? null : formHoraSalida,
        horas_extra_50: formExtra50,
        horas_extra_100: formExtra100,
        horas_asignadas: formEstado ? 0 : 8, // Default 8 horas
      }
      
      const res = await fetch('/api/sicamar/jornadas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (res.ok) {
        // Recargar datos
        await cargarDatos()
        setCeldaSeleccionada(null)
      } else {
        console.error('Error guardando jornada')
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setGuardando(false)
    }
  }
  
  // Eliminar jornada
  const eliminarJornada = async () => {
    if (!celdaSeleccionada?.jornada?.id) {
      setCeldaSeleccionada(null)
      return
    }
    
    setGuardando(true)
    try {
      const res = await fetch(`/api/sicamar/jornadas?fecha=${celdaSeleccionada.fecha}&empleado_ids=${celdaSeleccionada.empleado.id}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        await cargarDatos()
        setCeldaSeleccionada(null)
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setGuardando(false)
    }
  }

  // Auth checks
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-neutral-300 text-sm">Cargando...</div>
      </div>
    )
  }
  
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-sm font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-4">
            Sicamar
          </p>
          <h1 className="text-2xl font-light text-neutral-300 mb-4">
            Planificación
          </h1>
          <p className="text-sm text-neutral-400 mb-8">
            Iniciá sesión para acceder
          </p>
          <SignInButton mode="modal">
            <button className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-[#C4322F] transition-colors cursor-pointer">
              <span>Acceder</span>
              <span>→</span>
            </button>
          </SignInButton>
        </div>
      </div>
    )
  }
  
  if (isSicamarMember === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-neutral-300 text-sm">Verificando acceso...</div>
      </div>
    )
  }
  
  if (!isSicamarMember) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-sm font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-4">
            Sicamar
          </p>
          <h1 className="text-2xl font-light text-neutral-300 mb-4">
            Acceso Restringido
          </h1>
          <p className="text-sm text-neutral-400 mb-8">
            No tenés permisos para acceder a esta página.
          </p>
          <Link href="/" className="text-sm text-neutral-400 hover:text-[#C4322F]">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header ultra minimalista */}
      <header className="border-b border-neutral-100">
        <div className="max-w-[1800px] mx-auto px-8 py-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-1">
              Sicamar
            </p>
            <h1 className="text-2xl font-light text-neutral-300 tracking-wide">
              Planificación
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Navegación de semana */}
            <div className="flex items-center gap-3">
              <button
                onClick={semanaAnterior}
                className="p-2 rounded hover:bg-neutral-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-neutral-400" />
              </button>
              
              <button
                onClick={irAHoy}
                className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors px-3 py-1 rounded hover:bg-neutral-50"
              >
                Hoy
              </button>
              
              <button
                onClick={semanaSiguiente}
                className="p-2 rounded hover:bg-neutral-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
            
            <div className="text-right">
              <p className="text-sm font-medium text-neutral-900">
                {formatRangoSemana()}
              </p>
              <p className="text-xs text-neutral-400">
                Semana {Math.ceil((semanaActual.getTime() - new Date(semanaActual.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}
              </p>
            </div>
            
            <Link
              href="/"
              className="text-xs text-neutral-400 hover:text-[#C4322F] transition-colors"
            >
              ← Inicio
            </Link>
          </div>
        </div>
      </header>
      
      {/* Tabla de planificación */}
      <div className="max-w-[1800px] mx-auto px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-neutral-300 text-sm">Cargando planificación...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-xs font-normal text-neutral-400 pb-4 pr-6 w-48">
                    Empleado
                  </th>
                  {fechas.map((fecha, idx) => {
                    const d = new Date(fecha + 'T12:00:00')
                    const mes = d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
                    
                    return (
                      <th 
                        key={fecha}
                        className={`text-center pb-4 px-2 min-w-[60px] ${esHoy(fecha) ? 'bg-neutral-100/50 rounded-t-lg' : ''}`}
                      >
                        <p className={`text-[10px] uppercase tracking-wider ${esHoy(fecha) ? 'text-neutral-900 font-medium' : 'text-neutral-400'}`}>
                          {DIAS_CORTOS[idx]}
                        </p>
                        <p className="text-[9px] text-neutral-300 mt-0.5">
                          {mes}
                        </p>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {empleados.map(({ empleado, jornadas }) => (
                  <tr key={empleado.id} className="border-t border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                    <td className="py-2 pr-6">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-neutral-300 font-mono w-8">
                          {empleado.legajo}
                        </span>
                        <div>
                          <p className="text-sm text-neutral-700">
                            {empleado.apellido}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            {empleado.nombre}
                          </p>
                        </div>
                      </div>
                    </td>
                    {fechas.map((fecha) => {
                      const j = jornadas[fecha]
                      const tieneExtra = j && (j.horas_extra_50 > 0 || j.horas_extra_100 > 0)
                      const isSelected = celdaSeleccionada?.empleado.id === empleado.id && celdaSeleccionada?.fecha === fecha
                      
                      // Determinar qué mostrar
                      const tieneEstado = j?.estado_empleado
                      const tieneTurno = j?.turno_asignado || j?.hora_entrada_asignada
                      const estadoStyle = tieneEstado ? getEstadoStyle(j.estado_empleado!) : null
                      
                      // Obtener horarios (del turno o personalizados)
                      const horaEntrada = j?.hora_entrada_asignada || (j?.turno_asignado ? HORARIOS_TURNO[j.turno_asignado]?.entrada : null)
                      const horaSalida = j?.hora_salida_asignada || (j?.turno_asignado ? HORARIOS_TURNO[j.turno_asignado]?.salida : null)
                      
                      return (
                        <td 
                          key={fecha}
                          onClick={(e) => handleCeldaClick(empleado, fecha, j || null, e)}
                          className={`
                            text-center py-2 px-1 cursor-pointer transition-all
                            ${esHoy(fecha) ? 'bg-neutral-50/50' : ''} 
                            ${isSelected ? 'ring-2 ring-[#C4322F] ring-inset' : 'hover:bg-neutral-100/50'}
                          `}
                        >
                          {tieneEstado ? (
                            // Mostrar estado (vac, enf, etc.)
                            <span className={`text-[11px] ${estadoStyle?.text}`}>
                              {estadoStyle?.label}
                            </span>
                          ) : tieneTurno ? (
                            // Mostrar horario desde-hasta
                            <div className="relative inline-flex items-center justify-center">
                              {esHorarioNocturno(horaEntrada, horaSalida) ? (
                                // Horario nocturno: entrada del día anterior
                                <span className="text-[11px] text-neutral-600 font-medium flex items-center gap-0.5">
                                  <span className="text-[#C4322F] text-[8px]">←</span>
                                  <span className="text-neutral-400">{formatHora(horaEntrada, true)}</span>
                                  <span className="text-neutral-200">·</span>
                                  {formatHora(horaSalida, true)}
                                </span>
                              ) : (
                                // Horario normal: todo en el mismo día
                                <span className="text-[11px] text-neutral-600 font-medium">
                                  {formatHora(horaEntrada, true)}<span className="text-neutral-200">·</span>{formatHora(horaSalida, true)}
                                </span>
                              )}
                              {/* Indicador de horas extra */}
                              {tieneExtra && (
                                <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-[#C4322F]" />
                              )}
                            </div>
                          ) : (
                            // Celda vacía
                            <span className="text-neutral-200">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Leyenda minimalista */}
        <div className="mt-8 pt-6 border-t border-neutral-100">
          <div className="flex items-center gap-6 text-[10px] text-neutral-300">
            <span><span className="text-neutral-600">06·14</span> mañana</span>
            <span><span className="text-neutral-600">14·22</span> tarde</span>
            <span><span className="text-[#C4322F]">←</span><span className="text-neutral-500">22·06</span> noche (entrada día anterior)</span>
            <span className="text-neutral-200">|</span>
            <span>vac · vacaciones</span>
            <span>enf · enfermedad</span>
            <span>acc · accidente</span>
            <span>sus · suspendido</span>
            <span className="text-neutral-200">|</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C4322F]" />
              horas extra
            </span>
          </div>
        </div>
        
        {/* Stats */}
        <div className="mt-4 text-xs text-neutral-300">
          {empleados.length} empleados jornalizados
        </div>
      </div>
      
      {/* Popover de edición */}
      {celdaSeleccionada && (
        <div 
          ref={popoverRef}
          className="fixed z-50 bg-white border border-neutral-200 rounded-lg shadow-xl p-4 w-72"
          style={{
            top: Math.min(celdaSeleccionada.rect.top + 8, window.innerHeight - 400),
            left: Math.max(10, Math.min(celdaSeleccionada.rect.left - 100, window.innerWidth - 300))
          }}
        >
          {/* Header del popover */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-neutral-900">
                {celdaSeleccionada.empleado.apellido}
              </p>
              <p className="text-xs text-neutral-400">
                {DIAS_LARGOS[fechas.indexOf(celdaSeleccionada.fecha)]} {new Date(celdaSeleccionada.fecha + 'T12:00:00').getDate()}
              </p>
            </div>
            <button 
              onClick={() => setCeldaSeleccionada(null)}
              className="p-1 hover:bg-neutral-100 rounded"
            >
              <X className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
          
          {/* Estado (prioridad sobre turno) */}
          <div className="mb-4">
            <label className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1.5 block">
              Estado
            </label>
            <select
              value={formEstado}
              onChange={(e) => setFormEstado(e.target.value)}
              className="w-full h-8 text-sm border border-neutral-200 rounded px-2 focus:outline-none focus:border-neutral-400"
            >
              {ESTADOS_EMPLEADO.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
          
          {/* Horario (solo si trabaja) */}
          {!formEstado && (
            <>
              {/* Atajos de turno */}
              <div className="mb-3">
                <label className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1.5 block">
                  Turno rápido
                </label>
                <div className="flex gap-2">
                  {[
                    { label: 'Mañana', entrada: '06:00', salida: '14:00' },
                    { label: 'Tarde', entrada: '14:00', salida: '22:00' },
                    { label: 'Noche', entrada: '22:00', salida: '06:00' },
                  ].map(t => (
                    <button
                      key={t.label}
                      onClick={() => {
                        setFormHoraEntrada(t.entrada)
                        setFormHoraSalida(t.salida)
                        setFormTurno(t.label[0])
                      }}
                      className={`
                        flex-1 h-7 text-[10px] rounded transition-colors
                        ${formHoraEntrada === t.entrada && formHoraSalida === t.salida
                          ? 'bg-neutral-900 text-white' 
                          : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}
                      `}
                    >
                      {t.entrada.slice(0,2)}-{t.salida.slice(0,2)}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Horario personalizado */}
              <div className="mb-4">
                <label className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1.5 block">
                  Horario
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[9px] text-neutral-400 block mb-0.5">
                      Desde {esHorarioNocturno(formHoraEntrada, formHoraSalida) && <span className="text-neutral-300">(día anterior)</span>}
                    </label>
                    <input
                      type="time"
                      value={formHoraEntrada}
                      onChange={(e) => setFormHoraEntrada(e.target.value)}
                      className={`w-full h-8 text-sm border rounded px-2 focus:outline-none focus:border-neutral-400 ${
                        esHorarioNocturno(formHoraEntrada, formHoraSalida) ? 'border-neutral-300 bg-neutral-50' : 'border-neutral-200'
                      }`}
                    />
                  </div>
                  <span className="text-neutral-300 mt-4">→</span>
                  <div className="flex-1">
                    <label className="text-[9px] text-neutral-400 block mb-0.5">
                      Hasta <span className="text-neutral-300">(este día)</span>
                    </label>
                    <input
                      type="time"
                      value={formHoraSalida}
                      onChange={(e) => setFormHoraSalida(e.target.value)}
                      className="w-full h-8 text-sm border border-neutral-200 rounded px-2 focus:outline-none focus:border-neutral-400"
                    />
                  </div>
                </div>
                {esHorarioNocturno(formHoraEntrada, formHoraSalida) && (
                  <p className="text-[9px] text-neutral-400 mt-1.5">
                    ⚑ Turno nocturno: entrada del día anterior
                  </p>
                )}
              </div>
              
              {/* Horas extra */}
              <div className="mb-4">
                <label className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1.5 block">
                  Horas extra
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[9px] text-neutral-400 block mb-0.5">50%</label>
                    <input
                      type="number"
                      min="0"
                      max="12"
                      value={formExtra50}
                      onChange={(e) => setFormExtra50(parseInt(e.target.value) || 0)}
                      className="w-full h-8 text-sm border border-neutral-200 rounded px-2 focus:outline-none focus:border-neutral-400"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] text-neutral-400 block mb-0.5">100%</label>
                    <input
                      type="number"
                      min="0"
                      max="12"
                      value={formExtra100}
                      onChange={(e) => setFormExtra100(parseInt(e.target.value) || 0)}
                      className="w-full h-8 text-sm border border-neutral-200 rounded px-2 focus:outline-none focus:border-neutral-400"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
          
          {/* Acciones */}
          <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
            {celdaSeleccionada.jornada?.id && (
              <button
                onClick={eliminarJornada}
                disabled={guardando}
                className="h-8 px-3 text-xs text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                Borrar
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setCeldaSeleccionada(null)}
              disabled={guardando}
              className="h-8 px-3 text-xs text-neutral-500 hover:bg-neutral-100 rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={guardarCambios}
              disabled={guardando || (!formTurno && !formEstado)}
              className="h-8 px-4 text-xs bg-neutral-900 text-white rounded hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {guardando ? '...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
        <img 
          src="/kalia_logo_black.svg" 
          alt="Kalia" 
          className="h-4 opacity-10 hover:opacity-30 transition-opacity cursor-pointer"
        />
      </div>
    </div>
  )
}
