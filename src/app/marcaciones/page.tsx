'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ChevronDown, X, Check, HelpCircle } from 'lucide-react'
import { WebViewWarning } from '@/components/webview-detector'
import { useAuth, useUser, SignInButton } from '@clerk/nextjs'
import MarcacionesChat from './components/marcaciones-chat'

interface Empleado {
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

type EstadoCumplimiento = 
  | 'cumplido'
  | 'no_determinar'
  | 'sin_planificacion'
  | 'franco'
  | 'ausente'

interface AsistenciaDia {
  fecha: string
  planificacion: {
    status: 'WORKING' | 'ABSENT' | 'REST' | null
    absence_reason: string | null
    entrada_planificada: string | null
    salida_planificada: string | null
  } | null
  marcaciones: {
    primera_entrada: string | null
    ultima_salida: string | null
    total_marcaciones: number
  }
  cumplimiento: {
    estado: EstadoCumplimiento
    entrada_ok: boolean | null
    salida_ok: boolean | null
    diferencia_entrada_min: number | null
    diferencia_salida_min: number | null
    manual_override: boolean
    notas: string | null
  }
}

interface EmpleadoAsistencia {
  empleado: Empleado
  dias: Record<string, AsistenciaDia>
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
  asistencia: AsistenciaDia
  rect: { top: number; left: number; width: number }
}

interface EmpleadoSeleccionado {
  id: number
  legajo: string
  nombre: string
}

interface MarcacionDebug {
  id: number
  tipo: 'E' | 'S'
  fecha_hora_utc: string
  fecha_local: string
  hora_local: string
  id_reloj: number | null
  archivo_origen: string | null
}

interface DebugData {
  identificaciones: string[]
  marcaciones_por_fecha: Record<string, MarcacionDebug[]>
  total_marcaciones: number
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

// Badge de rotación
function RotacionBadge({ rotacion_nombre }: { rotacion_nombre: string | null }) {
  if (!rotacion_nombre) return null
  
  const abreviatura = rotacion_nombre
    .split(' ')
    .map(word => word[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 3)
  
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">
      {abreviatura}
    </span>
  )
}

// Icono de check (cumplió)
function CheckIcon() {
  return (
    <div className="w-6 h-6 rounded-full bg-[#C4322F] flex items-center justify-center">
      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
    </div>
  )
}

// Icono de pregunta (no determinar)
function QuestionIcon() {
  return (
    <div className="w-6 h-6 rounded-full bg-neutral-900 flex items-center justify-center">
      <span className="text-white text-xs font-bold">?</span>
    </div>
  )
}

type TipoVista = 'semana' | 'quincena' | 'mes'

// Generar array de fechas según tipo de vista
function getFechasVista(inicio: Date, tipo: TipoVista): string[] {
  const fechas: string[] = []
  let dias = 7
  
  if (tipo === 'quincena') {
    dias = 15
  } else if (tipo === 'mes') {
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

// Helper para obtener el lunes de una semana
function getLunesDeSemana(fecha: Date): Date {
  const d = new Date(fecha)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

const DIAS_CORTOS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
const DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Labels cortos para ausencias
const ABSENCE_LABELS: Record<string, string> = {
  'VACATION': 'Vac',
  'SICK': 'Enf',
  'ACCIDENT': 'Acc',
  'LICENSE': 'Lic',
  'SUSPENDED': 'Sus',
  'ART': 'ART',
  'ABSENT_UNJUSTIFIED': 'Flt',
}

// Formatear diferencia en minutos de forma legible
function formatDiferencia(min: number | null): string {
  if (min === null) return '-'
  const abs = Math.abs(min)
  if (abs === 0) return 'en horario'
  const signo = min > 0 ? '+' : '-'
  if (abs < 60) return `${signo}${abs}min`
  const horas = Math.floor(abs / 60)
  const minutos = abs % 60
  return `${signo}${horas}h${minutos > 0 ? ` ${minutos}m` : ''}`
}

export default function MarcacionesPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const [isSicamarMember, setIsSicamarMember] = useState<boolean | null>(null)
  
  const [empleados, setEmpleados] = useState<EmpleadoAsistencia[]>([])
  const [loading, setLoading] = useState(true)
  const [feriados, setFeriados] = useState<Map<string, Feriado>>(new Map())
  const [tipoVista, setTipoVista] = useState<TipoVista>('quincena')
  const [inicioVista, setInicioVista] = useState<Date>(() => {
    const hoy = new Date()
    const dia = hoy.getDate()
    const inicio = dia <= 15 ? 1 : 16
    return new Date(hoy.getFullYear(), hoy.getMonth(), inicio)
  })
  const [fechas, setFechas] = useState<string[]>([])
  const [celdaSeleccionada, setCeldaSeleccionada] = useState<CeldaSeleccionada | null>(null)
  
  // Selección de empleados
  const [selectedEmpleados, setSelectedEmpleados] = useState<EmpleadoSeleccionado[]>([])
  const [isDraggingEmpleados, setIsDraggingEmpleados] = useState(false)
  const [dragEmpleadoStart, setDragEmpleadoStart] = useState<number | null>(null)
  
  const popoverRef = useRef<HTMLDivElement>(null)
  
  // Estado para debug de marcaciones
  const [debugOpen, setDebugOpen] = useState(false)
  const [debugData, setDebugData] = useState<DebugData | null>(null)
  const [debugLoading, setDebugLoading] = useState(false)
  
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
      
      // Cargar asistencia
      const asistenciaRes = await fetch(`/api/sicamar/asistencia?desde=${fechasVista[0]}&hasta=${fechasVista[fechasVista.length - 1]}`)
      const asistenciaData = await asistenciaRes.json()
      
      if (asistenciaData.success) {
        setEmpleados(asistenciaData.data || [])
      }
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
  
  // Navegación
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
  
  const cambiarVista = (tipo: TipoVista) => {
    setTipoVista(tipo)
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
  
  const getNumeroSemana = () => {
    return Math.ceil((inicioVista.getTime() - new Date(inicioVista.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
  }
  
  const esHoy = (fecha: string) => {
    return fecha === new Date().toISOString().split('T')[0]
  }
  
  // Handlers de selección de empleados
  const handleEmpleadoClick = (emp: EmpleadoAsistencia, index: number, event: React.MouseEvent) => {
    event.stopPropagation()
    const empData: EmpleadoSeleccionado = {
      id: emp.empleado.id,
      legajo: emp.empleado.legajo,
      nombre: `${emp.empleado.apellido}, ${emp.empleado.nombre}`
    }
    const isSelected = selectedEmpleados.some(s => s.id === emp.empleado.id)
    
    if (event.metaKey || event.ctrlKey) {
      if (isSelected) {
        setSelectedEmpleados(prev => prev.filter(s => s.id !== emp.empleado.id))
      } else {
        setSelectedEmpleados(prev => [...prev, empData])
      }
    } else if (event.shiftKey && selectedEmpleados.length > 0) {
      const lastSelectedId = selectedEmpleados[selectedEmpleados.length - 1].id
      const lastIndex = empleados.findIndex(e => e.empleado.id === lastSelectedId)
      const startIdx = Math.min(lastIndex, index)
      const endIdx = Math.max(lastIndex, index)
      
      const rangeSelection = empleados.slice(startIdx, endIdx + 1).map(e => ({
        id: e.empleado.id,
        legajo: e.empleado.legajo,
        nombre: `${e.empleado.apellido}, ${e.empleado.nombre}`
      }))
      
      const existingIds = new Set(selectedEmpleados.map(s => s.id))
      const newSelection = [...selectedEmpleados]
      for (const e of rangeSelection) {
        if (!existingIds.has(e.id)) {
          newSelection.push(e)
        }
      }
      setSelectedEmpleados(newSelection)
    } else {
      if (isSelected && selectedEmpleados.length === 1) {
        setSelectedEmpleados([])
      } else {
        setSelectedEmpleados([empData])
      }
    }
  }
  
  const handleEmpleadoMouseDown = (index: number, event: React.MouseEvent) => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      setIsDraggingEmpleados(true)
      setDragEmpleadoStart(index)
    }
  }
  
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
  
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDraggingEmpleados(false)
      setDragEmpleadoStart(null)
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])
  
  const clearEmpleadoSelection = useCallback(() => {
    setSelectedEmpleados([])
  }, [])
  
  const removeEmpleadoFromSelection = useCallback((id: number) => {
    setSelectedEmpleados(prev => prev.filter(e => e.id !== id))
  }, [])
  
  // Click en celda
  const handleCeldaClick = (empleado: Empleado, fecha: string, asistencia: AsistenciaDia, event: React.MouseEvent<HTMLTableCellElement>) => {
    if (event.shiftKey || event.metaKey || event.ctrlKey) return
    
    const rect = event.currentTarget.getBoundingClientRect()
    
    setCeldaSeleccionada({
      empleado,
      fecha,
      asistencia,
      rect: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width }
    })
    // Reset debug state when selecting a new cell
    setDebugOpen(false)
    setDebugData(null)
  }
  
  // Cargar marcaciones de debug
  const cargarMarcacionesDebug = async () => {
    if (!celdaSeleccionada || debugLoading) return
    
    setDebugLoading(true)
    try {
      const res = await fetch(
        `/api/sicamar/asistencia/marcaciones-debug?empleado_id=${celdaSeleccionada.empleado.id}&fecha=${celdaSeleccionada.fecha}&dias_contexto=3`
      )
      const data = await res.json()
      if (data.success) {
        setDebugData({
          identificaciones: data.identificaciones,
          marcaciones_por_fecha: data.marcaciones_por_fecha,
          total_marcaciones: data.total_marcaciones
        })
      }
    } catch (err) {
      console.error('Error cargando debug:', err)
    } finally {
      setDebugLoading(false)
    }
  }
  
  // Toggle debug dropdown
  const toggleDebug = () => {
    if (!debugOpen && !debugData) {
      cargarMarcacionesDebug()
    }
    setDebugOpen(!debugOpen)
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
            Control de Asistencia
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
        {/* Header */}
        <header className="flex-shrink-0 border-b border-neutral-100">
          <div className="px-8 py-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-1">
                Sicamar
              </p>
              <h1 className="text-2xl font-light text-neutral-300 tracking-wide">
                Control de Asistencia
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
        
        {/* Tabla de asistencia */}
        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-xs font-normal text-neutral-400 pb-4 pr-6 w-48">
                    <div className="flex items-center gap-2">
                      <span>Empleado</span>
                      <span className="text-[9px] text-neutral-300" title="Click para seleccionar">
                        ⌘ click
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
                          <div className="w-6 h-6 bg-neutral-50 rounded-full animate-pulse mx-auto" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : empleados.map(({ empleado, dias }, empleadoIdx) => {
                  const isEmpleadoSelected = selectedEmpleados.some(s => s.id === empleado.id)
                  
                  return (
                    <tr key={empleado.id} className="border-t border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                      <td 
                        className={`py-2 pl-3 pr-6 cursor-pointer select-none transition-colors rounded-l ${
                          isEmpleadoSelected 
                            ? 'bg-[#C4322F]/5' 
                            : 'hover:bg-neutral-100/50'
                        }`}
                        onClick={(e) => handleEmpleadoClick({ empleado, dias }, empleadoIdx, e)}
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
                              <RotacionBadge rotacion_nombre={empleado.rotacion_nombre} />
                            </div>
                          </div>
                        </div>
                      </td>
                      {fechas.map((fecha) => {
                        const asistencia = dias[fecha]
                        const isPopoverSelected = celdaSeleccionada?.empleado.id === empleado.id && celdaSeleccionada?.fecha === fecha
                        const esFeriado = feriados.has(fecha)
                        
                        if (!asistencia) {
                          return (
                            <td 
                              key={fecha}
                              className={`text-center py-2 px-1 ${esHoy(fecha) ? 'bg-[#C4322F]/[0.03]' : ''}`}
                            >
                              <span className="text-neutral-200">—</span>
                            </td>
                          )
                        }
                        
                        const { estado } = asistencia.cumplimiento
                        
                        return (
                          <td 
                            key={fecha}
                            onClick={(e) => handleCeldaClick(empleado, fecha, asistencia, e)}
                            className={`
                              text-center py-2 px-1 cursor-pointer transition-all select-none
                              ${esHoy(fecha) ? 'bg-[#C4322F]/[0.03]' : esFeriado ? 'bg-neutral-100/70' : ''} 
                              ${isPopoverSelected ? 'ring-2 ring-neutral-900 ring-inset' : ''}
                              ${!isPopoverSelected ? 'hover:bg-neutral-100/50' : ''}
                            `}
                          >
                            <div className="flex items-center justify-center">
                              {estado === 'cumplido' ? (
                                <CheckIcon />
                              ) : estado === 'no_determinar' ? (
                                <QuestionIcon />
                              ) : estado === 'franco' ? (
                                <span className="text-[11px] text-neutral-300">F</span>
                              ) : estado === 'ausente' ? (
                                <span className="text-[11px] text-neutral-400">
                                  {asistencia.planificacion?.absence_reason 
                                    ? ABSENCE_LABELS[asistencia.planificacion.absence_reason] || 'Aus'
                                    : 'Aus'}
                                </span>
                              ) : estado === 'sin_planificacion' ? (
                                <span className="text-neutral-200">—</span>
                              ) : (
                                <span className="text-neutral-200">—</span>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
          {/* Leyenda */}
          <div className="mt-8 pt-6 border-t border-neutral-100">
            <div className="flex items-center gap-6 text-[10px] text-neutral-300">
              <span className="flex items-center gap-1.5">
                <CheckIcon />
                cumplió
              </span>
              <span className="flex items-center gap-1.5">
                <QuestionIcon />
                revisar
              </span>
              <span className="text-neutral-200">|</span>
              <span>F · franco</span>
              <span>Vac · vacaciones</span>
              <span>Enf · enfermedad</span>
              <span className="text-neutral-200">|</span>
              <span>Tolerancia: ±30 min</span>
            </div>
          </div>
          
          {/* Stats */}
          <div className="mt-4 flex items-center justify-between text-xs text-neutral-300">
            <span>{empleados.length} empleados</span>
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
        
        {/* Popover de detalle */}
        {celdaSeleccionada && (
          <div 
            ref={popoverRef}
            className="fixed z-50 bg-white border border-neutral-200 rounded-lg shadow-xl p-4 w-80 max-h-[80vh] overflow-y-auto"
            style={{
              top: Math.min(celdaSeleccionada.rect.top + 8, window.innerHeight - 400),
              left: Math.max(10, Math.min(celdaSeleccionada.rect.left - 120, window.innerWidth - 340))
            }}
          >
            {/* Header del popover */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {celdaSeleccionada.empleado.apellido}, {celdaSeleccionada.empleado.nombre}
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
            
            {/* Debug dropdown - marcaciones crudas (al inicio para visibilidad) */}
            <div className="mb-3 pb-3 border-b border-neutral-100">
              <button
                onClick={toggleDebug}
                className="w-full flex items-center justify-between text-[10px] text-neutral-400 hover:text-neutral-600 transition-colors py-1"
              >
                <span>🔍 Debug: Marcaciones crudas</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${debugOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {debugOpen && (
                <div className="mt-2 max-h-48 overflow-y-auto bg-neutral-50 rounded p-2">
                  {debugLoading ? (
                    <p className="text-[10px] text-neutral-400 py-2">Cargando...</p>
                  ) : debugData ? (
                    <div className="space-y-2">
                      {/* Identificaciones */}
                      <div className="text-[9px] text-neutral-400">
                        <span className="font-medium">IDs:</span>{' '}
                        {debugData.identificaciones.join(', ') || 'Ninguno'}
                      </div>
                      
                      {/* Marcaciones por fecha */}
                      {Object.entries(debugData.marcaciones_por_fecha)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([fecha, marcs]) => {
                          const esFechaCentral = fecha === celdaSeleccionada?.fecha
                          return (
                            <div key={fecha} className={`p-1.5 rounded ${esFechaCentral ? 'bg-[#C4322F]/10 border border-[#C4322F]/20' : 'bg-white'}`}>
                              <p className={`text-[9px] font-medium mb-0.5 ${esFechaCentral ? 'text-[#C4322F]' : 'text-neutral-600'}`}>
                                {new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                {esFechaCentral && ' ←'}
                              </p>
                              <div className="space-y-0.5">
                                {marcs.map(m => (
                                  <div key={m.id} className="flex items-center gap-1.5 text-[9px] font-mono">
                                    <span className={`w-2.5 h-2.5 rounded-full flex items-center justify-center text-[7px] text-white ${m.tipo === 'E' ? 'bg-green-600' : 'bg-orange-500'}`}>
                                      {m.tipo}
                                    </span>
                                    <span className="text-neutral-700">{m.hora_local}</span>
                                    <span className="text-neutral-300 text-[8px]">R{m.id_reloj}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      
                      {debugData.total_marcaciones === 0 && (
                        <p className="text-[9px] text-neutral-400 py-1">
                          No hay marcaciones (±3 días)
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[9px] text-neutral-400 py-1">
                      Error cargando
                    </p>
                  )}
                </div>
              )}
            </div>
            
            {/* Estado de cumplimiento */}
            <div className="mb-4 p-3 rounded-lg bg-neutral-50">
              <div className="flex items-center gap-3">
                {celdaSeleccionada.asistencia.cumplimiento.estado === 'cumplido' ? (
                  <>
                    <CheckIcon />
                    <div>
                      <p className="text-sm font-medium text-[#C4322F]">Cumplió</p>
                      <p className="text-xs text-neutral-500">Dentro de tolerancia</p>
                    </div>
                  </>
                ) : celdaSeleccionada.asistencia.cumplimiento.estado === 'no_determinar' ? (
                  <>
                    <QuestionIcon />
                    <div>
                      <p className="text-sm font-medium text-neutral-900">Revisar</p>
                      <p className="text-xs text-neutral-500">
                        {celdaSeleccionada.asistencia.cumplimiento.notas || 'Discrepancia detectada'}
                      </p>
                    </div>
                  </>
                ) : celdaSeleccionada.asistencia.cumplimiento.estado === 'franco' ? (
                  <p className="text-sm text-neutral-500">Franco planificado</p>
                ) : celdaSeleccionada.asistencia.cumplimiento.estado === 'ausente' ? (
                  <p className="text-sm text-neutral-500">
                    Ausencia: {celdaSeleccionada.asistencia.planificacion?.absence_reason 
                      ? ABSENCE_LABELS[celdaSeleccionada.asistencia.planificacion.absence_reason] 
                      : 'Planificada'}
                  </p>
                ) : (
                  <p className="text-sm text-neutral-400">Sin planificación</p>
                )}
              </div>
            </div>
            
            {/* Detalle de horarios */}
            {celdaSeleccionada.asistencia.planificacion?.status === 'WORKING' && (
              <div className="space-y-3">
                {/* Planificación */}
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-neutral-400 mb-1.5">Planificado</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-neutral-600">
                      {celdaSeleccionada.asistencia.planificacion.entrada_planificada || '--:--'}
                    </span>
                    <span className="text-neutral-300">→</span>
                    <span className="text-neutral-600">
                      {celdaSeleccionada.asistencia.planificacion.salida_planificada || '--:--'}
                    </span>
                  </div>
                </div>
                
                {/* Marcaciones reales */}
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-neutral-400 mb-1.5">Marcaciones</p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex flex-col">
                      <span className={`font-mono font-medium ${
                        celdaSeleccionada.asistencia.cumplimiento.entrada_ok 
                          ? 'text-green-600' 
                          : celdaSeleccionada.asistencia.marcaciones.primera_entrada 
                            ? 'text-red-600' 
                            : 'text-neutral-300'
                      }`}>
                        {celdaSeleccionada.asistencia.marcaciones.primera_entrada || '--:--'}
                      </span>
                      {celdaSeleccionada.asistencia.cumplimiento.diferencia_entrada_min !== null && (
                        <span className="text-[10px] text-neutral-400">
                          {formatDiferencia(celdaSeleccionada.asistencia.cumplimiento.diferencia_entrada_min)}
                        </span>
                      )}
                    </div>
                    <span className="text-neutral-300">→</span>
                    <div className="flex flex-col">
                      <span className={`font-mono font-medium ${
                        celdaSeleccionada.asistencia.cumplimiento.salida_ok 
                          ? 'text-green-600' 
                          : celdaSeleccionada.asistencia.marcaciones.ultima_salida 
                            ? 'text-red-600' 
                            : 'text-neutral-300'
                      }`}>
                        {celdaSeleccionada.asistencia.marcaciones.ultima_salida || '--:--'}
                      </span>
                      {celdaSeleccionada.asistencia.cumplimiento.diferencia_salida_min !== null && (
                        <span className="text-[10px] text-neutral-400">
                          {formatDiferencia(celdaSeleccionada.asistencia.cumplimiento.diferencia_salida_min)}
                        </span>
                      )}
                    </div>
                  </div>
                  {celdaSeleccionada.asistencia.marcaciones.total_marcaciones > 2 && (
                    <p className="text-[10px] text-neutral-400 mt-1">
                      {celdaSeleccionada.asistencia.marcaciones.total_marcaciones} marcaciones totales
                    </p>
                  )}
                </div>
                
                {/* Botón para editar manualmente */}
                {celdaSeleccionada.asistencia.cumplimiento.estado === 'no_determinar' && (
                  <div className="pt-3 border-t border-neutral-100">
                    <button
                      className="w-full h-8 text-xs bg-neutral-900 text-white rounded hover:bg-neutral-800 transition-colors"
                    >
                      Corregir manualmente
                    </button>
                    <p className="text-[9px] text-neutral-400 mt-1.5 text-center">
                      Próximamente: edición manual de estado
                    </p>
                  </div>
                )}
                
              </div>
            )}
            
          </div>
        )}
      </div>
      
      {/* Chat de marcaciones */}
      <MarcacionesChat 
        fechas={fechas}
        onDataUpdated={cargarDatos}
        selectedEmpleados={selectedEmpleados}
        onClearEmpleadoSelection={clearEmpleadoSelection}
        onRemoveEmpleado={removeEmpleadoFromSelection}
      />
    </div>
  )
}

