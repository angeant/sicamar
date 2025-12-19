'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useAuth, useUser, SignInButton } from '@clerk/nextjs'
import PlanningChat from './components/planning-chat'

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

// Tipos de vista
type TipoVista = 'semana' | 'quincena' | 'mes'

// Generar array de fechas según tipo de vista
function getFechasVista(inicio: Date, tipo: TipoVista): string[] {
  const fechas: string[] = []
  let dias = 7
  
  if (tipo === 'quincena') {
    dias = 15
  } else if (tipo === 'mes') {
    // Días hasta fin de mes
    const finMes = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0)
    dias = Math.ceil((finMes.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }
  
  for (let i = 0; i < dias; i++) {
    const d = new Date(inicio)
    d.setDate(inicio.getDate() + i)
    fechas.push(d.toISOString().split('T')[0])
  }
  return fechas
}

// Generar array de fechas para una semana (Lun-Dom) - mantener por compatibilidad
function getFechasSemana(lunes: Date): string[] {
  return getFechasVista(lunes, 'semana')
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

// Calcular horas entre dos tiempos (considerando cruce de día)
function calcularHoras(entrada: string, salida: string): number {
  const [hE, mE] = entrada.split(':').map(Number)
  const [hS, mS] = salida.split(':').map(Number)
  
  let minutosEntrada = hE * 60 + mE
  let minutosSalida = hS * 60 + mS
  
  // Si cruza medianoche (entrada > salida)
  if (minutosEntrada > minutosSalida) {
    minutosSalida += 24 * 60
  }
  
  return (minutosSalida - minutosEntrada) / 60
}

// Generar array de horas entre entrada y salida
function generarHorasArray(entrada: string, salida: string): number[] {
  const [hE] = entrada.split(':').map(Number)
  const [hS] = salida.split(':').map(Number)
  
  const horas: number[] = []
  let h = hE
  
  // Si cruza medianoche
  if (hE > hS) {
    // Desde entrada hasta 24
    while (h < 24) {
      horas.push(h)
      h++
    }
    h = 0
    // Desde 0 hasta salida
    while (h < hS) {
      horas.push(h)
      h++
    }
  } else {
    // Mismo día
    while (h < hS) {
      horas.push(h)
      h++
    }
  }
  
  return horas
}

// Componente de visualización de horas
function HorasVisualizacion({ 
  horaEntrada, 
  horaSalida
}: { 
  horaEntrada: string
  horaSalida: string
}) {
  const totalHoras = calcularHoras(horaEntrada, horaSalida)
  const horasExcedentes = Math.max(0, totalHoras - 8)
  const horasArray = generarHorasArray(horaEntrada, horaSalida)
  
  return (
    <div className="mt-3 pt-3 border-t border-neutral-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-neutral-400">
          {totalHoras}h total
        </span>
        {horasExcedentes > 0 && (
          <span className="text-[10px] text-[#C4322F]">
            +{horasExcedentes}h extras
          </span>
        )}
      </div>
      
      {/* Visualización de cuadraditos */}
      <div className="flex gap-0.5">
        {horasArray.map((hora, idx) => {
          const esNormal = idx < 8
          const esExtra = idx >= 8
          
          return (
            <div key={idx} className="flex flex-col items-center">
              <div 
                className={`w-5 h-5 rounded-sm flex items-center justify-center text-[8px] font-medium ${
                  esNormal 
                    ? 'border border-[#C4322F]/30 bg-white text-neutral-400' 
                    : 'bg-[#C4322F] text-white'
                }`}
              >
                {hora.toString().padStart(2, '0')}
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Leyenda */}
      <div className="flex items-center gap-3 mt-2 text-[9px] text-neutral-300">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 border border-[#C4322F]/30 rounded-sm" /> 8h normales
        </span>
        {horasExcedentes > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-[#C4322F] rounded-sm" /> {horasExcedentes}h extras
          </span>
        )}
      </div>
    </div>
  )
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
  const [tipoVista, setTipoVista] = useState<TipoVista>('semana')
  const [inicioVista, setInicioVista] = useState<Date>(getLunesDeSemana(new Date()))
  const [fechas, setFechas] = useState<string[]>([])
  const [celdaSeleccionada, setCeldaSeleccionada] = useState<CeldaSeleccionada | null>(null)
  const [guardando, setGuardando] = useState(false)
  
  // Form state para edición
  const [formTurno, setFormTurno] = useState<string>('')
  const [formEstado, setFormEstado] = useState<string>('')
  const [formHoraEntrada, setFormHoraEntrada] = useState<string>('')
  const [formHoraSalida, setFormHoraSalida] = useState<string>('')
  
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
    const fechasVista = getFechasVista(inicioVista, tipoVista)
    setFechas(fechasVista)
    
    try {
      // Cargar empleados jornalizados activos
      const empRes = await fetch('/api/sicamar/empleados?activos=true')
      const empData = await empRes.json()
      const empleadosJornal = (empData.empleados || []).filter((e: Empleado & { clase: string }) => e.clase === 'Jornal')
      
      // Cargar jornadas de la vista + día anterior (para turnos nocturnos)
      const fechaAnteriorAlInicio = new Date(fechasVista[0] + 'T12:00:00')
      fechaAnteriorAlInicio.setDate(fechaAnteriorAlInicio.getDate() - 1)
      const fechaAnteriorStr = fechaAnteriorAlInicio.toISOString().split('T')[0]
      
      const jorRes = await fetch(`/api/sicamar/jornadas?desde=${fechaAnteriorStr}&hasta=${fechasVista[fechasVista.length - 1]}&solo_planificado=true`)
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
        
        for (const fecha of fechasVista) {
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
  }, [inicioVista, tipoVista])
  
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
  
  // Navegación según tipo de vista
  const navegarAnterior = () => {
    const nueva = new Date(inicioVista)
    if (tipoVista === 'semana') {
      nueva.setDate(nueva.getDate() - 7)
    } else if (tipoVista === 'quincena') {
      nueva.setDate(nueva.getDate() - 15)
    } else {
      nueva.setMonth(nueva.getMonth() - 1)
    }
    setInicioVista(nueva)
    setCeldaSeleccionada(null)
  }
  
  const navegarSiguiente = () => {
    const nueva = new Date(inicioVista)
    if (tipoVista === 'semana') {
      nueva.setDate(nueva.getDate() + 7)
    } else if (tipoVista === 'quincena') {
      nueva.setDate(nueva.getDate() + 15)
    } else {
      nueva.setMonth(nueva.getMonth() + 1)
    }
    setInicioVista(nueva)
    setCeldaSeleccionada(null)
  }
  
  // Cambiar tipo de vista
  const cambiarVista = (tipo: TipoVista) => {
    setTipoVista(tipo)
    // Ajustar inicio según el tipo
    if (tipo === 'semana') {
      setInicioVista(getLunesDeSemana(new Date()))
    } else if (tipo === 'quincena') {
      const hoy = new Date()
      const dia = hoy.getDate()
      const inicio = dia <= 15 ? 1 : 16
      setInicioVista(new Date(hoy.getFullYear(), hoy.getMonth(), inicio))
    } else {
      setInicioVista(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    }
    setCeldaSeleccionada(null)
  }
  
  // Formatear rango de fechas
  const formatRangoVista = () => {
    if (fechas.length === 0) return ''
    const inicio = new Date(fechas[0] + 'T12:00:00')
    const fin = new Date(fechas[fechas.length - 1] + 'T12:00:00')
    
    if (tipoVista === 'mes') {
      return inicio.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    }
    
    const optsCorto = { day: 'numeric' as const }
    const optsLargo = { day: 'numeric' as const, month: 'short' as const }
    
    if (inicio.getMonth() === fin.getMonth()) {
      return `${inicio.toLocaleDateString('es-AR', optsCorto)} - ${fin.toLocaleDateString('es-AR', optsLargo)}`
    }
    return `${inicio.toLocaleDateString('es-AR', optsLargo)} - ${fin.toLocaleDateString('es-AR', optsLargo)}`
  }
  
  // Calcular número de semana
  const getNumeroSemana = () => {
    return Math.ceil((inicioVista.getTime() - new Date(inicioVista.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
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
      // Calcular horas totales y extras automáticamente
      let horasTotales = 8
      let horasExtra = 0
      if (!formEstado && formHoraEntrada && formHoraSalida) {
        horasTotales = calcularHoras(formHoraEntrada, formHoraSalida)
        horasExtra = Math.max(0, horasTotales - 8)
      }
      
      const payload = {
        empleado_id: celdaSeleccionada.empleado.id,
        fecha: celdaSeleccionada.fecha,
        turno_asignado: formEstado ? null : (formTurno || null),
        estado_empleado: formEstado || null,
        hora_entrada_asignada: formEstado ? null : formHoraEntrada,
        hora_salida_asignada: formEstado ? null : formHoraSalida,
        horas_extra_planificadas: horasExtra, // Calculado automáticamente del horario
        horas_asignadas: formEstado ? 0 : horasTotales,
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
    <div className="h-screen flex overflow-hidden">
      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
        {/* Header ultra minimalista */}
        <header className="flex-shrink-0 border-b border-neutral-100">
          <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-1">
              Sicamar
            </p>
            <h1 className="text-2xl font-light text-neutral-300 tracking-wide">
              Planificación
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Selector de vista */}
            <div className="flex items-center bg-neutral-100 rounded-lg p-0.5">
              {(['semana', 'quincena', 'mes'] as TipoVista[]).map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => cambiarVista(tipo)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                    tipoVista === tipo 
                      ? 'bg-white text-neutral-900 shadow-sm' 
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                </button>
              ))}
            </div>
            
            {/* Navegación */}
            <div className="flex items-center gap-1">
              <button
                onClick={navegarAnterior}
                className="p-2 rounded hover:bg-neutral-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-neutral-400" />
              </button>
              
              <button
                onClick={navegarSiguiente}
                className="p-2 rounded hover:bg-neutral-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
            
            <div className="text-right">
              <p className="text-sm font-medium text-neutral-900">
                {formatRangoVista()}
              </p>
              {tipoVista === 'semana' && (
                <p className="text-xs text-neutral-400">
                  Semana {getNumeroSemana()}
                </p>
              )}
              {tipoVista === 'quincena' && (
                <p className="text-xs text-neutral-400">
                  {fechas.length > 0 && new Date(fechas[0] + 'T12:00:00').getDate() <= 15 ? '1ª' : '2ª'} quincena
                </p>
              )}
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
        <div className="flex-1 overflow-auto px-8 py-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-xs font-normal text-neutral-400 pb-4 pr-6 w-48">
                  Empleado
                </th>
                {fechas.map((fecha) => {
                  const d = new Date(fecha + 'T12:00:00')
                  const dia = d.getDate()
                  const diaSemana = d.getDay()
                  const diaCorto = DIAS_CORTOS[diaSemana === 0 ? 6 : diaSemana - 1]
                  const mes = d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
                  const hoy = esHoy(fecha)
                  
                  return (
                    <th 
                      key={fecha}
                      className={`text-center pb-4 pt-1 px-1.5 min-w-[52px] ${hoy ? 'bg-[#C4322F]/[0.03]' : ''}`}
                    >
                      <p className={`text-[10px] uppercase tracking-wider ${hoy ? 'text-[#C4322F]' : 'text-neutral-400'}`}>
                        {diaCorto}
                      </p>
                      <p className={`text-sm font-light mt-0.5 ${hoy ? 'text-[#C4322F] font-medium' : 'text-neutral-500'}`}>
                        {dia}
                      </p>
                      {(tipoVista !== 'semana' || dia === 1 || fechas.indexOf(fecha) === 0) && (
                        <p className={`text-[9px] ${hoy ? 'text-[#C4322F]/60' : 'text-neutral-300'}`}>
                          {mes}
                        </p>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
              <tbody className={loading ? 'opacity-40 pointer-events-none' : ''}>
                {loading && empleados.length === 0 ? (
                  // Skeleton rows mientras carga por primera vez
                  Array.from({ length: 15 }).map((_, i) => (
                    <tr key={i} className="border-t border-neutral-50">
                      <td className="py-2 pr-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-4 bg-neutral-100 rounded animate-pulse" />
                          <div>
                            <div className="w-24 h-4 bg-neutral-100 rounded animate-pulse mb-1" />
                            <div className="w-16 h-3 bg-neutral-50 rounded animate-pulse" />
                          </div>
                        </div>
                      </td>
                      {fechas.map((fecha) => (
                        <td key={fecha} className="text-center py-2 px-1">
                          <div className="w-12 h-4 bg-neutral-50 rounded animate-pulse mx-auto" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : empleados.map(({ empleado, jornadas }) => (
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
                      // Calcular si tiene horas extra basado en el horario planificado
                      const tieneExtra = j && j.hora_entrada_asignada && j.hora_salida_asignada && 
                        calcularHoras(j.hora_entrada_asignada, j.hora_salida_asignada) > 8
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
                            ${esHoy(fecha) ? 'bg-[#C4322F]/[0.03]' : ''} 
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
                {(() => {
                  const d = new Date(celdaSeleccionada.fecha + 'T12:00:00')
                  const diaSemana = d.getDay()
                  return DIAS_LARGOS[diaSemana === 0 ? 6 : diaSemana - 1]
                })()} {new Date(celdaSeleccionada.fecha + 'T12:00:00').getDate()}
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
                
                {/* Visualización de horas */}
                {formHoraEntrada && formHoraSalida && (
                  <HorasVisualizacion 
                    horaEntrada={formHoraEntrada} 
                    horaSalida={formHoraSalida}
                  />
                )}
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
      
      {/* Popover cierra aquí, el contenido principal cierra antes del chat */}
      </div>
      
      {/* Chat de planificación - siempre visible a la derecha */}
      <PlanningChat 
        fechasSemana={fechas} 
        onJornadaUpdated={cargarDatos}
      />
    </div>
  )
}
