'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { WebViewWarning } from '@/components/webview-detector'
import { useAuth, useUser, SignInButton } from '@clerk/nextjs'
import PlanningChat from './components/planning-chat'

interface Turno {
  nombre: string
  entrada: string
  salida: string
}

type CondicionContratacion = 'efectivo' | 'eventual' | 'a_prueba'

interface Empleado {
  id: number
  legajo: string
  nombre: string
  apellido: string
  sector: string | null
  categoria: string | null
  foto_thumb_url?: string | null
  // Datos de rotación
  rotacion_nombre: string | null
  turnos: Turno[] | null
  frecuencia_semanas: number | null
  // Condición de contratación
  condicion_contratacion: CondicionContratacion
}

// Avatar mini para empleados
function AvatarMini({ foto_thumb_url, nombre, apellido }: { foto_thumb_url?: string | null, nombre: string, apellido: string }) {
  const iniciales = `${nombre?.[0] || ''}${apellido?.[0] || ''}`.toUpperCase()
  
  if (foto_thumb_url) {
    return (
      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
        <img src={foto_thumb_url} alt={`${apellido}, ${nombre}`} className="w-full h-full object-cover grayscale" />
      </div>
    )
  }
  
  return (
    <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs text-neutral-400 flex-shrink-0">
      {iniciales}
    </div>
  )
}

// Badge de condición de contratación (eventual / a prueba)
function CondicionBadge({ condicion }: { condicion: CondicionContratacion }) {
  if (condicion === 'efectivo') return null
  
  const config = {
    eventual: { label: 'Eventual', color: 'bg-amber-100 text-amber-700' },
    a_prueba: { label: 'A prueba', color: 'bg-blue-100 text-blue-700' },
  }
  
  const { label, color } = config[condicion] || { label: condicion, color: 'bg-neutral-100 text-neutral-500' }
  
  return (
    <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${color}`}>
      {label}
    </span>
  )
}

// Badge de rotación con tooltip
function RotacionBadge({ rotacion_nombre, turnos, frecuencia_semanas }: { 
  rotacion_nombre: string | null
  turnos: Turno[] | null
  frecuencia_semanas: number | null 
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  if (!rotacion_nombre) return null
  
  // Abreviar el nombre de la rotación (ej: "3 Turnos" -> "3T", "Mañana Fijo" -> "MF")
  const abreviatura = rotacion_nombre
    .split(' ')
    .map(word => word[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 3)
  
  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 transition-colors cursor-pointer"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => {
          e.stopPropagation()
          setShowTooltip(!showTooltip)
        }}
      >
        {abreviatura}
      </button>
      
      {showTooltip && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-neutral-200 rounded-lg shadow-lg p-3 min-w-[200px]">
          <p className="text-xs font-medium text-neutral-700 mb-2">{rotacion_nombre}</p>
          
          {turnos && turnos.length > 0 && (
            <div className="space-y-1">
              {turnos.map((turno, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px]">
                  <span className="text-neutral-500">{turno.nombre}</span>
                  <span className="text-neutral-400 font-mono">
                    {turno.entrada?.slice(0, 5)} → {turno.salida?.slice(0, 5)}
                  </span>
                </div>
              ))}
            </div>
          )}
          
          {frecuencia_semanas && frecuencia_semanas > 1 && (
            <p className="text-[9px] text-neutral-400 mt-2 pt-2 border-t border-neutral-100">
              Rota cada {frecuencia_semanas} semanas
            </p>
          )}
        </div>
      )}
    </div>
  )
}

type PlanningStatus = 'WORKING' | 'ABSENT' | 'REST'
type AbsenceReason = 'SICK' | 'VACATION' | 'ACCIDENT' | 'LICENSE' | 'SUSPENDED' | 'ART' | 'ABSENT_UNJUSTIFIED'

interface DailyPlanning {
  id?: number
  employee_id: number
  operational_date: string
  status: PlanningStatus
  absence_reason?: AbsenceReason | null
  normal_entry_at?: string | null
  normal_exit_at?: string | null
  extra_entry_at?: string | null
  extra_exit_at?: string | null
  notes?: string | null
}

interface EmpleadoConPlanificacion {
  empleado: Empleado
  planificacion: Record<string, DailyPlanning>
}

interface Feriado {
  fecha: string
  nombre: string
  tipo: string
  es_laborable: boolean
}

interface CeldaSeleccionada {
  empleado: Empleado
  fecha: string
  planning: DailyPlanning | null
  rect: { top: number; left: number; width: number }
}

// Horarios por turno
const HORARIOS_TURNO: Record<string, { entrada: string; salida: string }> = {
  'M': { entrada: '06:00', salida: '14:00' },
  'T': { entrada: '14:00', salida: '22:00' },
  'N': { entrada: '22:00', salida: '06:00' },
}

// Opciones de status
const STATUS_OPTIONS: { value: PlanningStatus | ''; label: string }[] = [
  { value: 'WORKING', label: 'Trabaja' },
  { value: 'ABSENT', label: 'Ausente' },
  { value: 'REST', label: 'Franco' },
]

// Opciones de ausencia (solo si status = ABSENT)
const ABSENCE_REASONS: { value: AbsenceReason; label: string }[] = [
  { value: 'VACATION', label: 'Vacaciones' },
  { value: 'SICK', label: 'Enfermedad' },
  { value: 'ACCIDENT', label: 'Accidente' },
  { value: 'LICENSE', label: 'Licencia' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'ART', label: 'ART' },
  { value: 'ABSENT_UNJUSTIFIED', label: 'Falta injustificada' },
]

// Labels cortos para mostrar en celdas
const ABSENCE_LABELS: Record<AbsenceReason, string> = {
  'VACATION': 'Vac',
  'SICK': 'Enf',
  'ACCIDENT': 'Acc',
  'LICENSE': 'Lic',
  'SUSPENDED': 'Sus',
  'ART': 'ART',
  'ABSENT_UNJUSTIFIED': 'Flt',
}

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

// Extraer hora HH:MM de un datetime
// Los timestamps vienen sin timezone desde Postgres (ej: "2025-12-20 06:00:00")
// Ya están en hora de Argentina, solo extraemos la parte de tiempo
function extractTimeFromDatetime(datetime: string): string {
  if (!datetime) return '00:00'
  
  try {
    // Formato: "2025-12-20 06:00:00" o "2025-12-20T06:00:00"
    const timePart = datetime.includes('T') 
      ? datetime.split('T')[1] 
      : datetime.split(' ')[1]
    
    if (!timePart) return '00:00'
    
    const [hours, minutes] = timePart.split(':')
    return `${hours?.padStart(2, '0') || '00'}:${minutes?.padStart(2, '0') || '00'}`
  } catch {
    return '00:00'
  }
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

export default function PlanificacionPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const [isSicamarMember, setIsSicamarMember] = useState<boolean | null>(null)
  
  const [empleados, setEmpleados] = useState<EmpleadoConPlanificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [feriados, setFeriados] = useState<Map<string, Feriado>>(new Map())
  const [tipoVista, setTipoVista] = useState<TipoVista>('quincena')
  const [inicioVista, setInicioVista] = useState<Date>(() => {
    // Iniciar en quincena por defecto
    const hoy = new Date()
    const dia = hoy.getDate()
    const inicio = dia <= 15 ? 1 : 16
    return new Date(hoy.getFullYear(), hoy.getMonth(), inicio)
  })
  const [fechas, setFechas] = useState<string[]>([])
  const [celdaSeleccionada, setCeldaSeleccionada] = useState<CeldaSeleccionada | null>(null)
  const [guardando, setGuardando] = useState(false)
  
  // Animación de celdas modificadas
  const [celdasAnimadas, setCeldasAnimadas] = useState<Set<string>>(new Set())
  const empleadosRef = useRef<EmpleadoConPlanificacion[]>([])
  
  // Selección múltiple para el chat (celdas = empleados + fechas)
  interface ChatSelection {
    empleados: { id: number; legajo: string; nombre: string }[]
    fechas: string[]
  }
  const [chatSelection, setChatSelection] = useState<ChatSelection | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ empleadoIdx: number; fechaIdx: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ empleadoIdx: number; fechaIdx: number } | null>(null)
  
  // Selección de empleados (solo empleados, sin fechas) - estilo rotaciones
  interface EmpleadoSeleccionado {
    id: number
    legajo: string
    nombre: string
  }
  const [selectedEmpleados, setSelectedEmpleados] = useState<EmpleadoSeleccionado[]>([])
  const [isDraggingEmpleados, setIsDraggingEmpleados] = useState(false)
  const [dragEmpleadoStart, setDragEmpleadoStart] = useState<number | null>(null)
  
  // Form state para edición
  const [formStatus, setFormStatus] = useState<PlanningStatus>('WORKING')
  const [formAbsenceReason, setFormAbsenceReason] = useState<string>('')
  const [formHoraEntrada, setFormHoraEntrada] = useState<string>('06:00')
  const [formHoraSalida, setFormHoraSalida] = useState<string>('14:00')
  // Horas extra
  const [formExtraEntrada, setFormExtraEntrada] = useState<string>('') // Entrada antes del turno
  const [formExtraSalida, setFormExtraSalida] = useState<string>('')   // Salida después del turno
  
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
      // Cargar feriados del período
      const feriadosRes = await fetch(`/api/sicamar/feriados?desde=${fechasVista[0]}&hasta=${fechasVista[fechasVista.length - 1]}`)
      const feriadosData = await feriadosRes.json()
      const feriadosMap = new Map<string, Feriado>()
      for (const f of feriadosData.data || []) {
        feriadosMap.set(f.fecha, f)
      }
      setFeriados(feriadosMap)
      
      // Cargar empleados con rotación asignada (solo los que tienen turno rotativo)
      const empRes = await fetch('/api/sicamar/rotaciones')
      const empData = await empRes.json()
      
      // Filtrar solo empleados que tienen rotación asignada y mapear al formato esperado
      const empleadosConRotacion: Empleado[] = (empData.data || [])
        .filter((e: { rotacion_id: number | null }) => e.rotacion_id !== null)
        .map((e: { 
          empleado_id: number
          legajo: string
          nombre_completo: string
          sector: string | null
          categoria: string | null
          foto_thumb_url: string | null
          rotacion_nombre: string | null
          turnos: Turno[] | null
          frecuencia_semanas: number | null
          condicion_contratacion: CondicionContratacion
        }) => {
          // nombre_completo viene como "Apellido, Nombre" - separar
          const [apellido, nombre] = (e.nombre_completo || '').split(', ')
          return {
            id: e.empleado_id,
            legajo: e.legajo,
            nombre: nombre || '',
            apellido: apellido || '',
            sector: e.sector,
            categoria: e.categoria,
            foto_thumb_url: e.foto_thumb_url,
            rotacion_nombre: e.rotacion_nombre,
            turnos: e.turnos,
            frecuencia_semanas: e.frecuencia_semanas,
            condicion_contratacion: e.condicion_contratacion || 'efectivo',
          }
        })
      
      // Cargar planificaciones del período
      const planRes = await fetch(`/api/sicamar/planning?desde=${fechasVista[0]}&hasta=${fechasVista[fechasVista.length - 1]}`)
      const planData = await planRes.json()
      
      // Mapear planificaciones por employee_id y operational_date
      const planningMap = new Map<number, Map<string, DailyPlanning>>()
      for (const p of planData.data || []) {
        if (!planningMap.has(p.employee_id)) {
          planningMap.set(p.employee_id, new Map())
        }
        planningMap.get(p.employee_id)!.set(p.operational_date, p)
      }
      
      // Combinar empleados con sus planificaciones
      const result: EmpleadoConPlanificacion[] = empleadosConRotacion.map((emp: Empleado) => {
        const planningEmp = planningMap.get(emp.id) || new Map()
        
        const planificacion: Record<string, DailyPlanning> = {}
        
        for (const fecha of fechasVista) {
          const plan = planningEmp.get(fecha)
          if (plan) {
            planificacion[fecha] = plan
          }
        }
        
        return { empleado: emp, planificacion }
      })
      
      // Ordenar por apellido
      result.sort((a, b) => a.empleado.apellido.localeCompare(b.empleado.apellido))
      
      setEmpleados(result)
      empleadosRef.current = result
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }, [inicioVista, tipoVista])
  
  // Función para detectar cambios y animar celdas (usada por el chat)
  const cargarDatosConAnimacion = useCallback(async () => {
    // Crear snapshot del estado actual antes de recargar
    const snapshotAnterior = new Map<string, string>()
    for (const emp of empleadosRef.current) {
      for (const [fecha, plan] of Object.entries(emp.planificacion)) {
        const key = `${emp.empleado.id}_${fecha}`
        // Hash simple del contenido de la planificación
        const hash = JSON.stringify({
          status: plan.status,
          absence_reason: plan.absence_reason,
          normal_entry_at: plan.normal_entry_at,
          normal_exit_at: plan.normal_exit_at
        })
        snapshotAnterior.set(key, hash)
      }
    }
    
    // Recargar datos
    await cargarDatos()
    
    // Comparar y detectar cambios
    const nuevasAnimaciones = new Set<string>()
    
    // Esperar un tick para que el estado se actualice
    setTimeout(() => {
      for (const emp of empleadosRef.current) {
        for (const [fecha, plan] of Object.entries(emp.planificacion)) {
          const key = `${emp.empleado.id}_${fecha}`
          const hashNuevo = JSON.stringify({
            status: plan.status,
            absence_reason: plan.absence_reason,
            normal_entry_at: plan.normal_entry_at,
            normal_exit_at: plan.normal_exit_at
          })
          const hashAnterior = snapshotAnterior.get(key)
          
          // Si es nuevo o cambió, animar
          if (!hashAnterior || hashAnterior !== hashNuevo) {
            nuevasAnimaciones.add(key)
          }
        }
      }
      
      if (nuevasAnimaciones.size > 0) {
        setCeldasAnimadas(nuevasAnimaciones)
        
        // Limpiar animaciones después de 2.5 segundos
        setTimeout(() => {
          setCeldasAnimadas(new Set())
        }, 2500)
      }
    }, 100)
  }, [cargarDatos])
  
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
  
  // Calcular celdas seleccionadas durante drag
  const getSelectedCells = useCallback(() => {
    if (!dragStart || !dragEnd) return new Set<string>()
    
    const minEmp = Math.min(dragStart.empleadoIdx, dragEnd.empleadoIdx)
    const maxEmp = Math.max(dragStart.empleadoIdx, dragEnd.empleadoIdx)
    const minFecha = Math.min(dragStart.fechaIdx, dragEnd.fechaIdx)
    const maxFecha = Math.max(dragStart.fechaIdx, dragEnd.fechaIdx)
    
    const selected = new Set<string>()
    for (let e = minEmp; e <= maxEmp; e++) {
      for (let f = minFecha; f <= maxFecha; f++) {
        if (empleados[e] && fechas[f]) {
          selected.add(`${empleados[e].empleado.id}_${fechas[f]}`)
        }
      }
    }
    return selected
  }, [dragStart, dragEnd, empleados, fechas])
  
  // Finalizar selección y crear ChatSelection
  const finalizarSeleccion = useCallback(() => {
    if (!dragStart || !dragEnd) return
    
    const minEmp = Math.min(dragStart.empleadoIdx, dragEnd.empleadoIdx)
    const maxEmp = Math.max(dragStart.empleadoIdx, dragEnd.empleadoIdx)
    const minFecha = Math.min(dragStart.fechaIdx, dragEnd.fechaIdx)
    const maxFecha = Math.max(dragStart.fechaIdx, dragEnd.fechaIdx)
    
    const empleadosSeleccionados: ChatSelection['empleados'] = []
    for (let e = minEmp; e <= maxEmp; e++) {
      if (empleados[e]) {
        empleadosSeleccionados.push({
          id: empleados[e].empleado.id,
          legajo: empleados[e].empleado.legajo,
          nombre: `${empleados[e].empleado.apellido}, ${empleados[e].empleado.nombre}`
        })
      }
    }
    
    const fechasSeleccionadas: string[] = []
    for (let f = minFecha; f <= maxFecha; f++) {
      if (fechas[f]) {
        fechasSeleccionadas.push(fechas[f])
      }
    }
    
    if (empleadosSeleccionados.length > 0 && fechasSeleccionadas.length > 0) {
      setChatSelection({
        empleados: empleadosSeleccionados,
        fechas: fechasSeleccionadas
      })
    }
    
    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }, [dragStart, dragEnd, empleados, fechas])
  
  // Handlers de mouse para drag selection
  const handleCellMouseDown = (empleadoIdx: number, fechaIdx: number, event: React.MouseEvent) => {
    // Solo con click izquierdo y sin modificadores para popover
    if (event.button !== 0) return
    
    // Si tiene shift, iniciamos drag selection
    if (event.shiftKey) {
      event.preventDefault()
      setIsDragging(true)
      setDragStart({ empleadoIdx, fechaIdx })
      setDragEnd({ empleadoIdx, fechaIdx })
      setCeldaSeleccionada(null) // Cerrar popover si está abierto
    }
  }
  
  const handleCellMouseEnter = (empleadoIdx: number, fechaIdx: number) => {
    if (isDragging) {
      setDragEnd({ empleadoIdx, fechaIdx })
    }
  }
  
  const handleCellMouseUp = () => {
    if (isDragging) {
      finalizarSeleccion()
    }
  }
  
  // Limpiar selección del chat
  const clearChatSelection = useCallback(() => {
    setChatSelection(null)
  }, [])
  
  // === FUNCIONES PARA SELECCIÓN DE EMPLEADOS (estilo rotaciones) ===
  
  // Manejar click en nombre de empleado
  const handleEmpleadoClick = (emp: EmpleadoConPlanificacion, index: number, event: React.MouseEvent) => {
    event.stopPropagation()
    const empData: EmpleadoSeleccionado = {
      id: emp.empleado.id,
      legajo: emp.empleado.legajo,
      nombre: `${emp.empleado.apellido}, ${emp.empleado.nombre}`
    }
    const isSelected = selectedEmpleados.some(s => s.id === emp.empleado.id)
    
    if (event.metaKey || event.ctrlKey) {
      // Cmd/Ctrl+Click: toggle individual
      if (isSelected) {
        setSelectedEmpleados(prev => prev.filter(s => s.id !== emp.empleado.id))
      } else {
        setSelectedEmpleados(prev => [...prev, empData])
      }
    } else if (event.shiftKey && selectedEmpleados.length > 0) {
      // Shift+Click: seleccionar rango
      const lastSelectedId = selectedEmpleados[selectedEmpleados.length - 1].id
      const lastIndex = empleados.findIndex(e => e.empleado.id === lastSelectedId)
      const startIdx = Math.min(lastIndex, index)
      const endIdx = Math.max(lastIndex, index)
      
      const rangeSelection = empleados.slice(startIdx, endIdx + 1).map(e => ({
        id: e.empleado.id,
        legajo: e.empleado.legajo,
        nombre: `${e.empleado.apellido}, ${e.empleado.nombre}`
      }))
      
      // Merge sin duplicados
      const existingIds = new Set(selectedEmpleados.map(s => s.id))
      const newSelection = [...selectedEmpleados]
      for (const e of rangeSelection) {
        if (!existingIds.has(e.id)) {
          newSelection.push(e)
        }
      }
      setSelectedEmpleados(newSelection)
    } else {
      // Click simple
      if (isSelected && selectedEmpleados.length === 1) {
        setSelectedEmpleados([])
      } else {
        setSelectedEmpleados([empData])
      }
    }
  }
  
  // Manejar inicio de drag en empleado
  const handleEmpleadoMouseDown = (index: number, event: React.MouseEvent) => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      setIsDraggingEmpleados(true)
      setDragEmpleadoStart(index)
    }
  }
  
  // Manejar mouse enter durante drag de empleados
  const handleEmpleadoMouseEnter = (index: number) => {
    if (isDraggingEmpleados && dragEmpleadoStart !== null) {
      const startIdx = Math.min(dragEmpleadoStart, index)
      const endIdx = Math.max(dragEmpleadoStart, index)
      
      const rangeSelection = empleados.slice(startIdx, endIdx + 1).map(e => ({
        id: e.empleado.id,
        legajo: e.empleado.legajo,
        nombre: `${e.empleado.apellido}, ${e.empleado.nombre}`
      }))
      setSelectedEmpleados(rangeSelection)
    }
  }
  
  // Efecto para terminar drag de empleados
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDraggingEmpleados(false)
      setDragEmpleadoStart(null)
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])
  
  // Limpiar selección de empleados
  const clearEmpleadoSelection = useCallback(() => {
    setSelectedEmpleados([])
  }, [])
  
  // Quitar un empleado de la selección
  const removeEmpleadoFromSelection = useCallback((id: number) => {
    setSelectedEmpleados(prev => prev.filter(e => e.id !== id))
  }, [])
  
  // Efecto para limpiar drag si se suelta el mouse fuera
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        finalizarSeleccion()
      }
    }
    
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [isDragging, finalizarSeleccion])
  
  // Click en celda (sin shift = popover, con shift = inicio de selección, con cmd = agregar a chatSelection)
  const handleCeldaClick = (empleado: Empleado, fecha: string, planning: DailyPlanning | null, event: React.MouseEvent<HTMLTableCellElement>) => {
    // Si es shift+click, no abrir popover (se maneja en mouseDown para drag)
    if (event.shiftKey) return
    
    // Cmd/Ctrl+Click: agregar/quitar celda de la selección para el chat
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault()
      const empData = {
        id: empleado.id,
        legajo: empleado.legajo,
        nombre: `${empleado.apellido}, ${empleado.nombre}`
      }
      
      setChatSelection(prev => {
        if (!prev) {
          // Primera celda seleccionada
          return {
            empleados: [empData],
            fechas: [fecha]
          }
        }
        
        // Verificar si esta celda ya está en la selección
        const empleadoExists = prev.empleados.some(e => e.id === empleado.id)
        const fechaExists = prev.fechas.includes(fecha)
        
        // Si tanto el empleado como la fecha ya están, verificamos si es la misma "celda"
        // Para esto usamos un enfoque diferente: mantenemos un registro de celdas individuales
        const cellKey = `${empleado.id}_${fecha}`
        
        // Creamos una lista de celdas seleccionadas para verificar
        // Pero como la estructura actual es empleados[] + fechas[], 
        // vamos a agregar el empleado si no existe Y la fecha si no existe
        let newEmpleados = [...prev.empleados]
        let newFechas = [...prev.fechas]
        
        if (!empleadoExists) {
          newEmpleados.push(empData)
        }
        if (!fechaExists) {
          newFechas.push(fecha)
        }
        
        // Si ambos ya existían, los quitamos (toggle)
        if (empleadoExists && fechaExists) {
          // Solo quitar si quedan otros
          if (prev.empleados.length > 1 || prev.fechas.length > 1) {
            // Quitar este empleado si no hay otras fechas que lo necesiten
            // Por simplicidad, solo quitamos si es el único en su combinación
            newEmpleados = prev.empleados.filter(e => e.id !== empleado.id)
            newFechas = prev.fechas.filter(f => f !== fecha)
            
            // Si queda vacío, retornar null
            if (newEmpleados.length === 0 || newFechas.length === 0) {
              return null
            }
          } else {
            // Si es la única celda, limpiar todo
            return null
          }
        }
        
        return {
          empleados: newEmpleados,
          fechas: newFechas
        }
      })
      return
    }
    
    // Click normal: abrir popover de edición
    const rect = event.currentTarget.getBoundingClientRect()
    
    setCeldaSeleccionada({
      empleado,
      fecha,
      planning,
      rect: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width }
    })
    
    // Inicializar form con valores actuales o defaults
    if (planning) {
      setFormStatus(planning.status)
      setFormAbsenceReason(planning.absence_reason || '')
      // Extraer hora de datetime
      setFormHoraEntrada(planning.normal_entry_at ? extractTime(planning.normal_entry_at) : '06:00')
      setFormHoraSalida(planning.normal_exit_at ? extractTime(planning.normal_exit_at) : '14:00')
      // Horas extra
      setFormExtraEntrada(planning.extra_entry_at ? extractTime(planning.extra_entry_at) : '')
      setFormExtraSalida(planning.extra_exit_at ? extractTime(planning.extra_exit_at) : '')
    } else {
      setFormStatus('WORKING')
      setFormAbsenceReason('')
      setFormHoraEntrada('06:00')
      setFormHoraSalida('14:00')
      setFormExtraEntrada('')
      setFormExtraSalida('')
    }
  }
  
  // Extraer hora de un datetime ISO
  // Extraer hora HH:MM de datetime (ya viene en hora Argentina)
  const extractTime = (datetime: string): string => {
    return extractTimeFromDatetime(datetime) || '06:00'
  }
  
  // Aplicar turno rápido (preset de horarios)
  const handleTurnoRapido = (entrada: string, salida: string) => {
    setFormHoraEntrada(entrada)
    setFormHoraSalida(salida)
  }
  
  // Guardar cambios
  const guardarCambios = async () => {
    if (!celdaSeleccionada) return
    
    setGuardando(true)
    try {
      const fecha = celdaSeleccionada.fecha
      
      // Construir datetimes completos
      let normalEntryAt: string | null = null
      let normalExitAt: string | null = null
      let extraEntryAt: string | null = null
      let extraExitAt: string | null = null
      
      if (formStatus === 'WORKING') {
        // Detectar si es turno nocturno (entrada > salida = cruza medianoche)
        const esNocturno = formHoraEntrada > formHoraSalida
        
        if (esNocturno) {
          // Entrada es del día anterior
          const fechaAnterior = new Date(fecha + 'T12:00:00')
          fechaAnterior.setDate(fechaAnterior.getDate() - 1)
          const fechaAnteriorStr = fechaAnterior.toISOString().split('T')[0]
          normalEntryAt = `${fechaAnteriorStr} ${formHoraEntrada}`
          normalExitAt = `${fecha} ${formHoraSalida}`
        } else {
          normalEntryAt = `${fecha} ${formHoraEntrada}`
          normalExitAt = `${fecha} ${formHoraSalida}`
        }
        
        // Horas extra antes del turno
        if (formExtraEntrada) {
          // Extra entrada es antes del turno normal, mismo día que normal_entry
          const fechaEntrada = esNocturno 
            ? new Date(fecha + 'T12:00:00').setDate(new Date(fecha + 'T12:00:00').getDate() - 1) && 
              new Date(new Date(fecha + 'T12:00:00').setDate(new Date(fecha + 'T12:00:00').getDate() - 1)).toISOString().split('T')[0]
            : fecha
          extraEntryAt = `${fechaEntrada} ${formExtraEntrada}`
        }
        
        // Horas extra después del turno
        if (formExtraSalida) {
          // Extra salida es después del turno normal, mismo día que normal_exit
          extraExitAt = `${fecha} ${formExtraSalida}`
        }
      }
      
      const payload = {
        plannings: [{
          employee_id: celdaSeleccionada.empleado.id,
          operational_date: fecha,
          status: formStatus,
          absence_reason: formStatus === 'ABSENT' ? formAbsenceReason : null,
          normal_entry_at: normalEntryAt,
          normal_exit_at: normalExitAt,
          extra_entry_at: extraEntryAt,
          extra_exit_at: extraExitAt,
          origin: 'web'
        }]
      }
      
      const res = await fetch('/api/sicamar/planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (res.ok) {
        // Recargar datos
        await cargarDatos()
        setCeldaSeleccionada(null)
      } else {
        console.error('Error guardando planificación')
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setGuardando(false)
    }
  }
  
  // Eliminar planificación
  const eliminarPlanificacion = async () => {
    if (!celdaSeleccionada?.planning?.id) {
      setCeldaSeleccionada(null)
      return
    }
    
    setGuardando(true)
    try {
      const res = await fetch(`/api/sicamar/planning?fecha=${celdaSeleccionada.fecha}&employee_id=${celdaSeleccionada.empleado.id}`, {
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
        <div className="text-center px-4 max-w-sm">
          <p className="text-sm font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-4">
            Sicamar
          </p>
          <h1 className="text-2xl font-light text-neutral-300 mb-4">
            Acceso Restringido
          </h1>
          <p className="text-sm text-neutral-400 mb-6">
            No tenés permisos para acceder a esta página.
          </p>
          
          {/* Aviso de WebView */}
          <WebViewWarning className="mb-6 text-left" />
          
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
                  <div className="flex items-center gap-2">
                    <span>Empleado</span>
                    <span className="text-[9px] text-neutral-300" title="Click para seleccionar, ⌘+click para agregar, arrastrar para múltiples">
                      ⌘ click · drag
                    </span>
                  </div>
                </th>
                {fechas.map((fecha) => {
                  const d = new Date(fecha + 'T12:00:00')
                  const dia = d.getDate()
                  const diaSemana = d.getDay()
                  const diaCorto = DIAS_CORTOS[diaSemana === 0 ? 6 : diaSemana - 1]
                  const mes = d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
                  const hoy = esHoy(fecha)
                  const feriado = feriados.get(fecha)
                  
                  return (
                    <th 
                      key={fecha}
                      className={`text-center pb-4 pt-1 px-1.5 min-w-[52px] ${
                        hoy ? 'bg-[#C4322F]/[0.03]' : 
                        feriado ? 'bg-neutral-100/70' : ''
                      }`}
                      title={feriado ? feriado.nombre : undefined}
                    >
                      <p className={`text-[10px] uppercase tracking-wider ${
                        hoy ? 'text-[#C4322F]' : 
                        feriado ? 'text-neutral-500' : 'text-neutral-400'
                      }`}>
                        {diaCorto}
                      </p>
                      <p className={`text-sm font-light mt-0.5 ${
                        hoy ? 'text-[#C4322F] font-medium' : 
                        feriado ? 'text-neutral-600' : 'text-neutral-500'
                      }`}>
                        {dia}
                      </p>
                      {feriado ? (
                        <span 
                          className="inline-block bg-neutral-800 text-white text-[8px] px-1.5 py-0.5 rounded mt-0.5 cursor-help"
                          title={feriado.nombre}
                        >
                          fer
                        </span>
                      ) : (tipoVista !== 'semana' || dia === 1 || fechas.indexOf(fecha) === 0) && (
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
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-neutral-100 rounded-full animate-pulse" />
                          <div className="flex flex-col gap-1">
                            <div className="w-28 h-3.5 bg-neutral-100 rounded animate-pulse" />
                            <div className="w-12 h-2.5 bg-neutral-50 rounded animate-pulse" />
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
                ) : empleados.map(({ empleado, planificacion }, empleadoIdx) => {
                  const isEmpleadoSelected = selectedEmpleados.some(s => s.id === empleado.id)
                  
                  return (
                  <tr key={empleado.id} className="border-t border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                    <td 
                      className={`py-2 pl-3 pr-6 cursor-pointer select-none transition-colors rounded-l ${
                        isEmpleadoSelected 
                          ? 'bg-[#C4322F]/5' 
                          : 'hover:bg-neutral-100/50'
                      }`}
                      onClick={(e) => handleEmpleadoClick({ empleado, planificacion }, empleadoIdx, e)}
                      onMouseDown={(e) => handleEmpleadoMouseDown(empleadoIdx, e)}
                      onMouseEnter={() => handleEmpleadoMouseEnter(empleadoIdx)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <AvatarMini 
                            foto_thumb_url={empleado.foto_thumb_url} 
                            nombre={empleado.nombre} 
                            apellido={empleado.apellido} 
                          />
                          {isEmpleadoSelected && (
                            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#C4322F] rounded-full flex items-center justify-center">
                              <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={`text-sm truncate max-w-[140px] ${isEmpleadoSelected ? 'text-[#C4322F]' : 'text-neutral-700'}`}>
                            {empleado.apellido}, {empleado.nombre}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-neutral-500 font-mono">{empleado.legajo}</span>
                            <RotacionBadge 
                              rotacion_nombre={empleado.rotacion_nombre}
                              turnos={empleado.turnos}
                              frecuencia_semanas={empleado.frecuencia_semanas}
                            />
                            <CondicionBadge condicion={empleado.condicion_contratacion} />
                          </div>
                        </div>
                      </div>
                    </td>
                    {fechas.map((fecha, fechaIdx) => {
                      const p = planificacion[fecha]
                      const isPopoverSelected = celdaSeleccionada?.empleado.id === empleado.id && celdaSeleccionada?.fecha === fecha
                      const isAnimated = celdasAnimadas.has(`${empleado.id}_${fecha}`)
                      const isDragSelected = getSelectedCells().has(`${empleado.id}_${fecha}`)
                      const isChatSelected = chatSelection?.empleados.some(e => e.id === empleado.id) && chatSelection?.fechas.includes(fecha)
                      const esFeriado = feriados.has(fecha)
                      
                      // Extraer horas de los datetimes
                      const horaEntrada = p?.normal_entry_at ? extractTimeFromDatetime(p.normal_entry_at) : null
                      const horaSalida = p?.normal_exit_at ? extractTimeFromDatetime(p.normal_exit_at) : null
                      const extraEntrada = p?.extra_entry_at ? extractTimeFromDatetime(p.extra_entry_at) : null
                      const extraSalida = p?.extra_exit_at ? extractTimeFromDatetime(p.extra_exit_at) : null
                      
                      // Calcular si tiene horas extra (basado en campos extra o jornada > 8h)
                      const tieneExtra = extraEntrada || extraSalida || (horaEntrada && horaSalida && calcularHoras(horaEntrada, horaSalida) > 8)
                      
                      return (
                        <td 
                          key={fecha}
                          onClick={(e) => handleCeldaClick(empleado, fecha, p || null, e)}
                          onMouseDown={(e) => handleCellMouseDown(empleadoIdx, fechaIdx, e)}
                          onMouseEnter={() => handleCellMouseEnter(empleadoIdx, fechaIdx)}
                          onMouseUp={handleCellMouseUp}
                          className={`
                            text-center py-2 px-1 cursor-pointer transition-all select-none
                            ${esHoy(fecha) ? 'bg-[#C4322F]/[0.03]' : esFeriado ? 'bg-neutral-100/70' : ''} 
                            ${isPopoverSelected ? 'ring-2 ring-[#C4322F] ring-inset' : ''}
                            ${isDragSelected ? 'bg-[#C4322F]/10 ring-1 ring-[#C4322F]/30 ring-inset' : ''}
                            ${isChatSelected && !isDragSelected && !isPopoverSelected ? 'bg-[#C4322F]/10 ring-1 ring-[#C4322F]/40 ring-inset' : ''}
                            ${!isPopoverSelected && !isDragSelected && !isChatSelected ? 'hover:bg-neutral-100/50' : ''}
                            ${isAnimated ? 'celda-animada' : ''}
                          `}
                        >
                          {p?.status === 'REST' ? (
                            // Franco
                            <span className="text-[11px] text-neutral-300">F</span>
                          ) : p?.status === 'ABSENT' && p.absence_reason ? (
                            // Mostrar razón de ausencia
                            <span className="text-[11px] text-neutral-400">
                              {ABSENCE_LABELS[p.absence_reason] || '?'}
                            </span>
                          ) : p?.status === 'WORKING' && horaEntrada && horaSalida ? (
                            // Mostrar horario desde-hasta con horas extra
                            <div className="inline-flex items-center justify-center gap-0.5">
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
                              {/* Indicador de horas extra con flecha y hora */}
                              {extraSalida && (
                                <span className="text-[11px] text-[#C4322F] font-medium flex items-center">
                                  <span className="text-[9px]">→</span>
                                  {formatHora(extraSalida, true)}
                                </span>
                              )}
                              {extraEntrada && (
                                <span className="text-[11px] text-[#C4322F] font-medium flex items-center order-first">
                                  {formatHora(extraEntrada, true)}
                                  <span className="text-[9px]">→</span>
                                </span>
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
                )})}
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
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-neutral-100" />
              feriado
            </span>
            <span className="text-neutral-200">|</span>
            <span><span className="text-neutral-500">⌘+click</span> agregar celdas al chat</span>
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
        <div className="mt-4 flex items-center justify-between text-xs text-neutral-300">
          <span>{empleados.length} empleados jornalizados</span>
          {selectedEmpleados.length > 0 && (
            <span className="text-[#C4322F]">
              {selectedEmpleados.length} seleccionado{selectedEmpleados.length > 1 ? 's' : ''} 
              <button 
                onClick={clearEmpleadoSelection} 
                className="ml-2 text-neutral-400 hover:text-neutral-600"
              >
                (limpiar)
              </button>
            </span>
          )}
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
          
          {/* Status selector */}
          <div className="mb-4">
            <label className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1.5 block">
              Estado
            </label>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as PlanningStatus)}
              className="w-full h-8 text-sm border border-neutral-200 rounded px-2 focus:outline-none focus:border-neutral-400"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          
          {/* Razón de ausencia (solo si status = ABSENT) */}
          {formStatus === 'ABSENT' && (
            <div className="mb-4">
              <label className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1.5 block">
                Razón
              </label>
              <select
                value={formAbsenceReason}
                onChange={(e) => setFormAbsenceReason(e.target.value)}
                className="w-full h-8 text-sm border border-neutral-200 rounded px-2 focus:outline-none focus:border-neutral-400"
              >
                <option value="">Seleccionar...</option>
                {ABSENCE_REASONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          )}
          
          {/* Horario (solo si status = WORKING) */}
          {formStatus === 'WORKING' && (
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
                      onClick={() => handleTurnoRapido(t.entrada, t.salida)}
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
                    horaEntrada={formExtraEntrada || formHoraEntrada} 
                    horaSalida={formExtraSalida || formHoraSalida}
                  />
                )}
              </div>
              
              {/* Horas Extra */}
              <div className="mb-4 p-3 bg-neutral-50 rounded-lg">
                <label className="text-[10px] uppercase tracking-wide text-neutral-500 mb-2 block flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C4322F]" />
                  Horas Extra (opcional)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-neutral-400 block mb-0.5">
                      Entra antes
                    </label>
                    <input
                      type="time"
                      value={formExtraEntrada}
                      onChange={(e) => setFormExtraEntrada(e.target.value)}
                      placeholder="--:--"
                      className="w-full h-7 text-xs border border-neutral-200 rounded px-2 focus:outline-none focus:border-[#C4322F] bg-white"
                    />
                    {formExtraEntrada && (
                      <button 
                        onClick={() => setFormExtraEntrada('')}
                        className="text-[9px] text-neutral-400 hover:text-red-500 mt-0.5"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="text-[9px] text-neutral-400 block mb-0.5">
                      Sale después
                    </label>
                    <input
                      type="time"
                      value={formExtraSalida}
                      onChange={(e) => setFormExtraSalida(e.target.value)}
                      placeholder="--:--"
                      className="w-full h-7 text-xs border border-neutral-200 rounded px-2 focus:outline-none focus:border-[#C4322F] bg-white"
                    />
                    {formExtraSalida && (
                      <button 
                        onClick={() => setFormExtraSalida('')}
                        className="text-[9px] text-neutral-400 hover:text-red-500 mt-0.5"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
                {(formExtraEntrada || formExtraSalida) && (
                  <p className="text-[9px] text-[#C4322F] mt-2">
                    {(() => {
                      let horasExtra = 0
                      if (formExtraEntrada && formHoraEntrada) {
                        horasExtra += calcularHoras(formExtraEntrada, formHoraEntrada)
                      }
                      if (formExtraSalida && formHoraSalida) {
                        horasExtra += calcularHoras(formHoraSalida, formExtraSalida)
                      }
                      return `+${horasExtra.toFixed(1)}h extra`
                    })()}
                  </p>
                )}
              </div>
            </>
          )}
          
          {/* Acciones */}
          <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
            {celdaSeleccionada.planning?.id && (
              <button
                onClick={eliminarPlanificacion}
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
              disabled={guardando || (formStatus === 'ABSENT' && !formAbsenceReason)}
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
        feriados={Array.from(feriados.values())}
        onJornadaUpdated={cargarDatosConAnimacion}
        selection={chatSelection}
        onClearSelection={clearChatSelection}
        selectedEmpleados={selectedEmpleados}
        onClearEmpleadoSelection={clearEmpleadoSelection}
        onRemoveEmpleado={removeEmpleadoFromSelection}
      />
    </div>
  )
}
