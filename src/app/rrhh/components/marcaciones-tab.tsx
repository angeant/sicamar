'use client'

import { useState, useEffect } from 'react'
import {
  Clock,
  Users,
  LogIn,
  LogOut,
  Search,
  Calendar,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  User,
  Fingerprint,
  List,
  GitCommitHorizontal,
  AlertTriangle,
  X,
  Eye,
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'

const contextoMarcaciones = {
  descripcion: 'Marcaciones biométricas en tiempo real desde los relojes Intelektron. Muestra fichadas de entrada/salida y calcula jornadas trabajadas.',
  reglas: [
    'Relojes: Planta 1, Ingreso Principal, Planta 2',
    'Métodos: Huella dactilar y Reconocimiento facial',
    'Tolerancia de fichada: 5 minutos del horario',
    'Turno Madrugada: 22:00-06:00 (cruza medianoche)',
    'Turno Mañana: 06:00-14:00',
    'Turno Tarde: 14:00-22:00',
    'Sábados: Solo turno mañana 06:00-13:00'
  ],
  flujo: [
    '1. Empleado ficha en reloj biométrico',
    '2. Reloj envía marcación al servidor',
    '3. Sistema sincroniza cada 30 segundos',
    '4. Se cruza con planificación para detectar anomalías',
    '5. Alertas automáticas por ausencias/tardanzas'
  ],
  integraciones: [
    'InWeb: Software de gestión de relojes Intelektron',
    'Turnos: Asignación desde planificación semanal',
    'Alertas: WhatsApp a supervisores por ausencias',
    'Horas Extra: Cálculo automático por jornada'
  ],
  notas: [
    'Empleados Fuera de Convenio: Horario flexible, no se calculan horas extra',
    'Vista Jornadas: Click en empleado para ver historial',
    'Horas Extra: >8h en semana, >7h en sábado',
    'IDs biométricos sin legajo: Empleados pre-efectivos'
  ]
}

interface Marcacion {
  id: number
  id_biometrico: string
  legajo: string | null
  dni: string | null
  apellido: string | null
  nombre: string | null
  nombre_completo: string | null
  fecha_hora: string
  hora_local: string
  tipo: 'E' | 'S'
  tipo_descripcion: string | null
  id_reloj: number | null
  estado_laboral: 'efectivo' | 'pre_efectivo' | 'sin_identificar'
  // Campos para turno noche que cruza días
  es_dia_anterior?: boolean
  es_dia_siguiente?: boolean
  fecha_original?: string
}

interface Stats {
  entradas_hoy: number
  salidas_hoy: number
  empleados_presentes: number
  total_empleados: number
}

interface JornadaEmpleado {
  id_biometrico: string
  legajo: string | null
  nombre_completo: string | null
  estado_laboral: string
  entrada: string | null  // HH:MM
  salida: string | null   // HH:MM
  horasTrabajadas: number | null
  horasExtra: number
  estado: 'completa' | 'sin_salida' | 'sin_entrada' | 'multiple'
  turno: 'madrugada' | 'mañana' | 'tarde' | 'flexible' | null
  turnoNombre: string | null  // Nombre del turno real desde INWeb
  marcaciones: Marcacion[]
}

interface TurnoAsignacion {
  legajo: string
  tipo: 'madrugada' | 'mañana' | 'tarde' | 'flexible' | null
  turNombre: string
}

// Lista de legajos fuera de convenio (administrativos, gerencia, etc.)
// Estos empleados no tienen turnos fijos ni se les calcula horas extra
const LEGAJOS_FUERA_CONVENIO = new Set([
  '000128',  // MOZZONI, PABLO MARTIN - Gerente General
  '000318',  // MEDINA, BAUTISTA PEDRO ALBERTO - Gerente de Planta
  '000031',  // BALERO, JUAN DE DIOS - Supply Chain
  '000280',  // SANTUCHO, JOSE LUIS - Jefe de Impuestos y Administración
  '000208',  // REALE, ROCIO MARIA DE LUJAN - Jefa de Recursos Humanos
  '27-20682909-0',  // NIELSEN, ANDREA - Compra de Insumos
  '372',     // MEDINA, MARVEY - Jefe de Mantenimiento
  '000195',  // SPERANZA, FERNANDO EZEQUIEL - Coordinador Técnico Industrial
  '000246',  // SOSA, GUSTAVO - PCP
  '000295',  // ITURRALDE, JACKELINE AILEN - Auxiliar Administrativo
  '000308',  // LANG, ROXANA AILIN - Auxiliar de Recursos Humanos
  '000238',  // LORENZETTI, SOLEDAD - Auxiliar Administrativo
  '363',     // ALVAREZ, MAGALI - Responsable de Higiene y Seguridad
  '356',     // WHITTY, NICOLE - Auxiliar Compras
  '000310',  // SANTI, LAUTARO - Coordinador
  '000243',  // DIALE, ANGEL NERY - Supervisor de Mantenimiento
  '000281',  // FERNANDEZ, RICARDO JOSE - Cadete
])

// Determinar turno basado en hora de entrada (fallback cuando no hay datos de INWeb)
// Sábados: solo turno mañana (06:00-13:00)
// Otros días: Madrugada (22:00-06:00), Mañana (06:00-14:00), Tarde (14:00-22:00)
const getTurnoEstimado = (horaEntrada: string | null, esSabadoFlag: boolean = false): 'madrugada' | 'mañana' | 'tarde' | null => {
  if (!horaEntrada || horaEntrada === '--:--') return null
  const hora = parseInt(horaEntrada.split(':')[0])
  
  // Sábados: solo turno mañana
  if (esSabadoFlag) {
    return 'mañana' // Todo es turno mañana los sábados (06:00-13:00)
  }
  
  // Turno Madrugada: entradas entre 20:00-23:59 o 00:00-02:00
  if (hora >= 20 || hora < 3) return 'madrugada'
  
  // Turno Mañana: entradas entre 04:00-09:00
  if (hora >= 4 && hora < 10) return 'mañana'
  
  // Turno Tarde: entradas entre 12:00-17:00
  if (hora >= 12 && hora < 18) return 'tarde'
  
  // Casos ambiguos
  if (hora >= 3 && hora < 4) return 'madrugada'
  if (hora >= 9 && hora < 12) return 'mañana'
  if (hora >= 17 && hora < 20) return 'tarde'
  
  return null
}

// Hora de inicio oficial de cada turno
// Días normales: Madrugada 22:00, Mañana 06:00, Tarde 14:00
// Sábados: Solo mañana 06:00-13:00
const INICIO_TURNO = {
  madrugada: 22 * 60,
  mañana: 6 * 60,
  tarde: 14 * 60
}

const getTurnoConfig = (turno: 'madrugada' | 'mañana' | 'tarde' | 'flexible' | null) => {
  switch (turno) {
    case 'madrugada': return { label: 'Madrugada', color: 'bg-slate-100 text-slate-700', barColor: 'bg-slate-600' }
    case 'mañana': return { label: 'Mañana', color: 'bg-slate-100 text-slate-700', barColor: 'bg-slate-600' }
    case 'tarde': return { label: 'Tarde', color: 'bg-slate-100 text-slate-700', barColor: 'bg-slate-600' }
    case 'flexible': return { label: 'Flexible', color: 'bg-blue-100 text-blue-700', barColor: 'bg-blue-600' }
    default: return { label: '-', color: 'bg-gray-100 text-gray-500', barColor: 'bg-gray-300' }
  }
}

// Verificar si hay anomalía en el horario (llegó muy tarde o muy temprano del turno esperado)
const tieneAnomalia = (entrada: string | null, turno: 'madrugada' | 'mañana' | 'tarde' | 'flexible' | null, esSabadoFlag: boolean): boolean => {
  if (!entrada || !turno) return false
  if (turno === 'flexible') return false // Turnos flexibles no tienen anomalías de horario
  const entradaMin = horaAMinutos(entrada)
  if (entradaMin === null) return false
  
  // Rangos esperados por turno (con tolerancia de ~30 min)
  if (esSabadoFlag) {
    // Sábado: 05:30 - 07:00 es normal
    return entradaMin < 330 || entradaMin > 420 // Antes de 5:30 o después de 7:00
  }
  
  switch (turno) {
    case 'madrugada':
      // Normal: 21:30 - 22:30
      return (entradaMin >= 1290 && entradaMin > 1350) || (entradaMin < 180 && entradaMin > 30) // Muy tarde
    case 'mañana':
      // Normal: 05:30 - 06:30
      return entradaMin < 330 || entradaMin > 390 // Antes de 5:30 o después de 6:30
    case 'tarde':
      // Normal: 13:30 - 14:30
      return entradaMin < 810 || entradaMin > 870 // Antes de 13:30 o después de 14:30
    default:
      return false
  }
}

// Formatear nombre para mostrar
const formatNombre = (nombre_completo: string | null, id_biometrico: string) => {
  if (nombre_completo) return nombre_completo
  return `DESCONOCIDO, ID-${id_biometrico}`
}

// Convertir hora HH:MM a minutos desde medianoche
const horaAMinutos = (hora: string | null): number | null => {
  if (!hora || hora === '--:--') return null
  const parts = hora.split(':')
  const h = parseInt(parts[0])
  const m = parseInt(parts[1] || '0')
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

// Calcular posición y ancho del segmento dentro de un turno
interface TurnoSegment {
  turno: 'madrugada' | 'mañana' | 'tarde'
  startPercent: number  // 0-100 dentro del turno
  widthPercent: number  // 0-100 ancho dentro del turno
}

// Cada turno dura 8 horas (480 min)
// Madrugada: 22:00-06:00 (cruza medianoche)
// Mañana: 06:00-14:00 
// Tarde: 14:00-22:00  


// Calcular segmentos - SOLO pinta la barra del turno al que pertenece el empleado
const calcularSegmentosTurno = (entrada: string | null, salida: string | null, turnoEmpleado: 'madrugada' | 'mañana' | 'tarde' | 'flexible' | null): TurnoSegment[] => {
  const segments: TurnoSegment[] = []
  
  if (!turnoEmpleado) return segments
  
  const entradaMin = horaAMinutos(entrada)
  if (entradaMin === null) return segments
  
  let salidaMin = horaAMinutos(salida)
  
  // Si no hay salida, estimar 8 horas
  if (salidaMin === null) {
    const inicios = { madrugada: 1320, mañana: 360, tarde: 840, flexible: 480 }
    salidaMin = (inicios[turnoEmpleado] + 480) % 1440
  }
  
  // Solo pintamos la barra del turno del empleado
  if (turnoEmpleado === 'madrugada') {
    // Turno madrugada: 22:00 - 06:00 (cruza medianoche)
    // La barra representa 8 horas: 22:00 (0%) a 06:00 (100%)
    segments.push({ turno: 'madrugada', startPercent: 0, widthPercent: 100 })
  } 
  else if (turnoEmpleado === 'mañana') {
    // Turno mañana: 06:00 - 14:00
    segments.push({ turno: 'mañana', startPercent: 0, widthPercent: 100 })
  }
  else if (turnoEmpleado === 'tarde') {
    // Turno tarde: 14:00 - 22:00
    segments.push({ turno: 'tarde', startPercent: 0, widthPercent: 100 })
  }
  else if (turnoEmpleado === 'flexible') {
    // Para turnos flexibles, estimar según hora de entrada
    const hora = Math.floor(entradaMin / 60)
    if (hora >= 20 || hora < 6) {
      segments.push({ turno: 'madrugada', startPercent: 0, widthPercent: 100 })
    } else if (hora >= 6 && hora < 14) {
      segments.push({ turno: 'mañana', startPercent: 0, widthPercent: 100 })
    } else {
      segments.push({ turno: 'tarde', startPercent: 0, widthPercent: 100 })
    }
  }
  
  return segments
}

type ViewMode = 'lista' | 'timeline'

// Turnos definidos (orden: Madrugada, Mañana, Tarde)
const TURNOS = {
  madrugada: { inicio: 22, fin: 6, label: 'Madrugada', color: 'bg-indigo-500', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-100' }, // Cruza medianoche
  mañana: { inicio: 6, fin: 14, label: 'Mañana', color: 'bg-amber-400', bgColor: 'bg-amber-50', borderColor: 'border-amber-100' },
  tarde: { inicio: 14, fin: 22, label: 'Tarde', color: 'bg-orange-400', bgColor: 'bg-orange-50', borderColor: 'border-orange-100' },
}

// Umbral para horas extra (más de 8 horas = turno normal)
const UMBRAL_HORAS_EXTRA = 8

// Helper para obtener fecha local en formato YYYY-MM-DD
const getLocalDateString = (date: Date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper para verificar si una fecha es sábado
const esSabado = (fechaStr: string): boolean => {
  const fecha = new Date(fechaStr + 'T12:00:00')
  return fecha.getDay() === 6 // 6 = sábado
}

// Interface para historial de jornadas de un empleado
interface HistorialJornada {
  fecha: string
  diaSemana: string
  entrada: string | null
  salida: string | null
  horasTrabajadas: number | null
  horasExtra: number
  turno: 'madrugada' | 'mañana' | 'tarde' | 'flexible' | null
  marcacionesCrudas: Marcacion[] // Todas las marcaciones del día
}

export function MarcacionesTab() {
  const [marcaciones, setMarcaciones] = useState<Marcacion[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [turnosAsignados, setTurnosAsignados] = useState<Map<string, TurnoAsignacion>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTipo, setFilterTipo] = useState<'all' | 'E' | 'S'>('all')
  // Vista "Jornadas" (timeline) por defecto
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  // Ordenamiento de jornadas
  const [sortBy, setSortBy] = useState<'nombre' | 'turno'>('nombre')
  
  // Estado para el historial de empleado seleccionado
  const [selectedEmpleado, setSelectedEmpleado] = useState<JornadaEmpleado | null>(null)
  const [historialEmpleado, setHistorialEmpleado] = useState<HistorialJornada[]>([])
  const [isLoadingHistorial, setIsLoadingHistorial] = useState(false)
  const [historialPage, setHistorialPage] = useState(0)
  const HISTORIAL_DIAS = 30 // Días a mostrar por página
  
  // Estado para modal de marcaciones crudas
  const [modalMarcaciones, setModalMarcaciones] = useState<{fecha: string, marcaciones: Marcacion[]} | null>(null)
  const [showContexto, setShowContexto] = useState(false)

  // Fetch turnos asignados para los legajos de las marcaciones
  const fetchTurnos = async (legajos: string[]) => {
    if (legajos.length === 0) return

    try {
      const response = await fetch(`/api/sicamar/turnos?fecha=${selectedDate}&legajos=${legajos.join(',')}`)
      const data = await response.json()
      
      if (data.turnos) {
        const turnosMap = new Map<string, TurnoAsignacion>()
        data.turnos.forEach((t: TurnoAsignacion) => {
          turnosMap.set(t.legajo, t)
        })
        setTurnosAsignados(turnosMap)
      }
    } catch (error) {
      console.error('Error fetching turnos:', error)
    }
  }

  const fetchData = async (showLoader = true) => {
    if (showLoader) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const response = await fetch(`/api/sicamar/marcaciones?fecha=${selectedDate}`)
      const data = await response.json()
      
      if (data.marcaciones) {
        setMarcaciones(data.marcaciones)
        
        // Extraer legajos únicos para buscar turnos
        const legajos = [...new Set(
          data.marcaciones
            .map((m: Marcacion) => m.legajo)
            .filter((l: string | null): l is string => l !== null && l !== '')
        )]
        
        // Fetch turnos asignados
        if (legajos.length > 0) {
          fetchTurnos(legajos)
        }
      }
      if (data.stats) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching marcaciones:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedDate])

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedDate === new Date().toISOString().split('T')[0]) {
        fetchData(false)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [selectedDate])

  // Función para obtener historial de un empleado
  const fetchHistorialEmpleado = async (legajo: string, page: number = 0) => {
    setIsLoadingHistorial(true)
    
    try {
      const historial: HistorialJornada[] = []
      const hoy = new Date()
      const diasNombres = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']
      
      // Calcular rango de fechas para esta página
      const startOffset = page * HISTORIAL_DIAS
      
      // Traer datos día por día (últimos N días desde el offset)
      for (let i = startOffset; i < startOffset + HISTORIAL_DIAS; i++) {
        const fecha = new Date(hoy)
        fecha.setDate(fecha.getDate() - i)
        const fechaStr = fecha.toISOString().split('T')[0]
        const diaSemana = diasNombres[fecha.getDay()]
        const esSabadoFlag = fecha.getDay() === 6
        const esDomingo = fecha.getDay() === 0
        
        // Skip domingos
        if (esDomingo) {
          historial.push({
            fecha: fechaStr,
            diaSemana,
            entrada: null,
            salida: null,
            horasTrabajadas: null,
            horasExtra: 0,
            turno: null,
            marcacionesCrudas: []
          })
          continue
        }
        
        try {
          const response = await fetch(`/api/sicamar/marcaciones?fecha=${fechaStr}&legajo=${legajo}`)
          const data = await response.json()
          
          // Todas las marcaciones del día para este empleado
          const todasMarcaciones = data.marcaciones?.filter((m: Marcacion) => m.legajo === legajo) || []
          
          // Marcaciones del día actual (sin flags de día anterior/siguiente)
          const marcacionesDia = todasMarcaciones.filter((m: Marcacion) => 
            !m.es_dia_anterior && !m.es_dia_siguiente
          )
          
          const entradas = marcacionesDia.filter((m: Marcacion) => m.tipo === 'E')
          const salidas = marcacionesDia.filter((m: Marcacion) => m.tipo === 'S')
          
          // Ordenar por hora
          entradas.sort((a: Marcacion, b: Marcacion) => a.hora_local.localeCompare(b.hora_local))
          salidas.sort((a: Marcacion, b: Marcacion) => a.hora_local.localeCompare(b.hora_local))
          
          let entrada: string | null = null
          let salida: string | null = null
          
          // Lógica simple: mostrar las marcaciones del día como son
          // La primera entrada del día
          if (entradas.length > 0) {
            entrada = entradas[0].hora_local.substring(0, 5)
          }
          // La última salida del día
          if (salidas.length > 0) {
            salida = salidas[salidas.length - 1].hora_local.substring(0, 5)
          }
          
          // Calcular horas trabajadas solo si hay entrada Y salida
          let horasTrabajadas: number | null = null
          let horasExtra = 0
          
          if (entrada && salida) {
            const [hE, mE] = entrada.split(':').map(Number)
            const [hS, mS] = salida.split(':').map(Number)
            let minutos = (hS * 60 + mS) - (hE * 60 + mE)
            // Si salida es antes que entrada, es turno que cruza medianoche
            if (minutos < 0) minutos += 24 * 60
            horasTrabajadas = Math.round((minutos / 60) * 100) / 100
            
            const umbral = esSabadoFlag ? 7 : 8
            if (horasTrabajadas > umbral) {
              horasExtra = Math.floor(horasTrabajadas - umbral)
            }
          }
          
          // Determinar turno basado en la hora de entrada
          let turno: 'madrugada' | 'mañana' | 'tarde' | 'flexible' | null = null
          if (LEGAJOS_FUERA_CONVENIO.has(legajo)) {
            turno = 'flexible'
          } else {
            turno = getTurnoEstimado(entrada, esSabadoFlag)
          }
          
          historial.push({
            fecha: fechaStr,
            diaSemana,
            entrada,
            salida,
            horasTrabajadas,
            horasExtra,
            turno,
            marcacionesCrudas: todasMarcaciones
          })
        } catch {
          // Error en este día, agregar vacío
          historial.push({
            fecha: fechaStr,
            diaSemana,
            entrada: null,
            salida: null,
            horasTrabajadas: null,
            horasExtra: 0,
            turno: null,
            marcacionesCrudas: []
          })
        }
      }
      
      setHistorialEmpleado(historial)
    } catch (error) {
      console.error('Error fetching historial:', error)
    } finally {
      setIsLoadingHistorial(false)
    }
  }
  
  // Handler para seleccionar empleado
  const handleSelectEmpleado = (jornada: JornadaEmpleado) => {
    if (selectedEmpleado?.legajo === jornada.legajo && selectedEmpleado?.id_biometrico === jornada.id_biometrico) {
      // Si ya está seleccionado, deseleccionar
      setSelectedEmpleado(null)
      setHistorialEmpleado([])
    } else {
      setSelectedEmpleado(jornada)
      setHistorialPage(0)
      if (jornada.legajo) {
        fetchHistorialEmpleado(jornada.legajo, 0)
      }
    }
  }

  const changeDate = (days: number) => {
    const date = new Date(selectedDate + 'T12:00:00') // Usar mediodía para evitar problemas de timezone
    date.setDate(date.getDate() + days)
    setSelectedDate(getLocalDateString(date))
  }

  const filteredMarcaciones = marcaciones.filter(m => {
    const matchesSearch = searchQuery === '' || 
      (m.nombre_completo?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.legajo?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.dni?.includes(searchQuery))
    
    const matchesTipo = filterTipo === 'all' || m.tipo === filterTipo
    
    return matchesSearch && matchesTipo
  })

  const formatHora = (horaLocal: string) => {
    // hora_local viene como "HH:MM:SS" desde el servidor
    if (!horaLocal) return '--:--'
    return horaLocal.substring(0, 5) // Solo HH:MM
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'efectivo': return 'bg-green-100 text-green-700'
      case 'pre_efectivo': return 'bg-amber-100 text-amber-700'
      case 'sin_identificar': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'efectivo': return 'Efectivo'
      case 'pre_efectivo': return 'Pre-efectivo'
      case 'sin_identificar': return 'Sin identificar'
      default: return estado
    }
  }

  // Calcular jornadas agrupando marcaciones por empleado
  // Maneja turnos nocturnos que cruzan días
  const calcularJornadas = (): JornadaEmpleado[] => {
    const jornadasMap = new Map<string, JornadaEmpleado>()
    
    // Función para obtener la clave de agrupación
    // Priorizar legajo si existe, sino usar id_biometrico
    // Esto evita duplicados cuando un empleado tiene múltiples IDs biométricos
    const getKey = (m: Marcacion) => m.legajo || m.id_biometrico
    
    // Separar marcaciones por tipo
    const marcacionesDelDia = marcaciones.filter(m => !m.es_dia_anterior && !m.es_dia_siguiente)
    const entradasDiaAnterior = marcaciones.filter(m => m.es_dia_anterior && m.tipo === 'E')
    const salidasDiaSiguiente = marcaciones.filter(m => m.es_dia_siguiente && m.tipo === 'S')
    
    // Agrupar marcaciones del día actual por legajo (o id_biometrico si no hay legajo)
    marcacionesDelDia.forEach(m => {
      const key = getKey(m)
      if (!jornadasMap.has(key)) {
        jornadasMap.set(key, {
          id_biometrico: m.id_biometrico,
          legajo: m.legajo,
          nombre_completo: m.nombre_completo,
          estado_laboral: m.estado_laboral,
          entrada: null,
          salida: null,
          horasTrabajadas: null,
          horasExtra: 0,
          estado: 'sin_entrada',
          turno: null,
          turnoNombre: null,
          marcaciones: []
        })
      }
      jornadasMap.get(key)!.marcaciones.push(m)
    })

    // Agregar entradas del día anterior (turno noche) si el empleado tiene salida temprana hoy
    entradasDiaAnterior.forEach(m => {
      const key = getKey(m)
      const horaEntrada = parseInt(m.hora_local?.split(':')[0] || '0')
      
      // Solo considerar entradas después de las 18:00 como turno noche
      if (horaEntrada >= 18) {
        if (!jornadasMap.has(key)) {
          // Si no existe jornada para este empleado, crear una
          jornadasMap.set(key, {
            id_biometrico: m.id_biometrico,
            legajo: m.legajo,
            nombre_completo: m.nombre_completo,
            estado_laboral: m.estado_laboral,
            entrada: null,
            salida: null,
            horasTrabajadas: null,
            horasExtra: 0,
            estado: 'sin_entrada',
            turno: null,
            turnoNombre: null,
            marcaciones: []
          })
        }
        // Agregar la entrada del día anterior
        jornadasMap.get(key)!.marcaciones.push({ ...m, _esEntradaNoche: true } as any)
      }
    })

    // Agregar salidas del día siguiente (turno noche) si el empleado tiene entrada tarde hoy
    salidasDiaSiguiente.forEach(m => {
      const key = getKey(m)
      const horaSalida = parseInt(m.hora_local?.split(':')[0] || '0')
      
      // Solo considerar salidas antes de las 12:00 como fin de turno noche
      if (horaSalida < 12) {
        if (jornadasMap.has(key)) {
          jornadasMap.get(key)!.marcaciones.push({ ...m, _esSalidaNoche: true } as any)
        }
      }
    })

    // Procesar cada jornada
    jornadasMap.forEach((jornada, key) => {
      // Separar entradas y salidas, considerando las del turno noche
      const entradasNormales = jornada.marcaciones
        .filter(m => m.tipo === 'E' && !(m as any)._esEntradaNoche)
        .sort((a, b) => a.hora_local.localeCompare(b.hora_local))
      
      const entradasNoche = jornada.marcaciones
        .filter(m => m.tipo === 'E' && (m as any)._esEntradaNoche)
        .sort((a, b) => a.hora_local.localeCompare(b.hora_local))
      
      const salidasNormales = jornada.marcaciones
        .filter(m => m.tipo === 'S' && !(m as any)._esSalidaNoche)
        .sort((a, b) => a.hora_local.localeCompare(b.hora_local))
      
      const salidasNoche = jornada.marcaciones
        .filter(m => m.tipo === 'S' && (m as any)._esSalidaNoche)
        .sort((a, b) => a.hora_local.localeCompare(b.hora_local))
      
      // Determinar entrada y salida según el escenario
      let entrada: string | null = null
      let salida: string | null = null
      let esTurnoNoche = false
      
      // CASO 1: Entrada del día anterior (turno noche que empezó ayer)
      // Priorizar si hay entrada nocturna del día anterior + salida temprana de hoy
      if (entradasNoche.length > 0 && salidasNormales.length > 0) {
        const salidaTemprana = salidasNormales.find(s => {
          const hora = parseInt(s.hora_local?.split(':')[0] || '0')
          return hora < 12 // Salida antes de mediodía
        })
        
        if (salidaTemprana) {
          // Turno noche que empezó ayer
          entrada = formatHora(entradasNoche[0].hora_local)
          salida = formatHora(salidaTemprana.hora_local)
          esTurnoNoche = true
        }
      }
      
      // CASO 2: Entrada tarde de hoy + salida del día siguiente (turno noche que termina mañana)
      if (!entrada && entradasNormales.length > 0) {
        const entradaTarde = entradasNormales.find(e => {
          const hora = parseInt(e.hora_local?.split(':')[0] || '0')
          return hora >= 18 // Entrada después de las 18:00
        })
        
        if (entradaTarde && salidasNoche.length > 0) {
          // Turno noche que termina mañana
          entrada = formatHora(entradaTarde.hora_local)
          salida = formatHora(salidasNoche[0].hora_local)
          esTurnoNoche = true
        } else if (entradaTarde && salidasNormales.length === 0) {
          // Entrada de turno noche sin salida aún
          entrada = formatHora(entradaTarde.hora_local)
          salida = null
          esTurnoNoche = true
        }
      }
      
      // CASO 3: Jornada normal (no turno noche)
      if (!entrada && !salida) {
        if (entradasNormales.length > 0) {
          entrada = formatHora(entradasNormales[0].hora_local)
        }
        if (salidasNormales.length > 0) {
          salida = formatHora(salidasNormales[salidasNormales.length - 1].hora_local)
        }
      }
      
      jornada.entrada = entrada
      jornada.salida = salida
      
      // PRIMERO verificar si es empleado fuera de convenio (prioridad máxima)
      if (jornada.legajo && LEGAJOS_FUERA_CONVENIO.has(jornada.legajo)) {
        jornada.turno = 'flexible'
        jornada.turnoNombre = 'Fuera de Convenio'
      } else {
        // Usar turno real de INWeb si está disponible, sino estimar por hora de entrada
        const turnoReal = jornada.legajo ? turnosAsignados.get(jornada.legajo) : null
        if (turnoReal && turnoReal.tipo) {
          jornada.turno = turnoReal.tipo
          jornada.turnoNombre = turnoReal.turNombre
        } else {
          jornada.turno = getTurnoEstimado(entrada, esSabado(selectedDate))
          jornada.turnoNombre = null
        }
      }

      // Determinar estado
      const todasEntradas = [...entradasNormales, ...entradasNoche]
      const todasSalidas = [...salidasNormales, ...salidasNoche]
      
      if (jornada.entrada && jornada.salida) {
        jornada.estado = todasEntradas.length > 1 || todasSalidas.length > 1 ? 'multiple' : 'completa'
        
        // Calcular horas trabajadas
        const [hEntrada, mEntrada] = jornada.entrada.split(':').map(Number)
        const [hSalida, mSalida] = jornada.salida.split(':').map(Number)
        const minutosEntrada = hEntrada * 60 + mEntrada
        const minutosSalida = hSalida * 60 + mSalida
        let minutosTotal = minutosSalida - minutosEntrada
        
        // Si es negativo o turno noche, es turno nocturno que cruza medianoche
        if (minutosTotal < 0 || esTurnoNoche) {
          if (minutosTotal < 0) {
            minutosTotal += 1440 // Sumar 24 horas
          }
        }
        
        if (minutosTotal > 0) {
          jornada.horasTrabajadas = Math.round((minutosTotal / 60) * 100) / 100
          // Horas extra: semana 8h, sábados 7h
          const umbral = esSabado(selectedDate) ? 7 : UMBRAL_HORAS_EXTRA
          if (jornada.horasTrabajadas > umbral) {
            jornada.horasExtra = Math.floor(jornada.horasTrabajadas - umbral)
          }
        }
      } else if (jornada.entrada && !jornada.salida) {
        jornada.estado = 'sin_salida'
      } else if (!jornada.entrada && jornada.salida) {
        jornada.estado = 'sin_entrada'
      }
    })

    // Ordenar por nombre
    return Array.from(jornadasMap.values()).sort((a, b) => 
      (a.nombre_completo || '').localeCompare(b.nombre_completo || '')
    )
  }

  const jornadas = calcularJornadas()
  
  // Orden de prioridad de turnos para ordenamiento
  const turnoOrder = { madrugada: 0, mañana: 1, tarde: 2, flexible: 3, null: 4 }
  
  const jornadasFiltradas = jornadas
    .filter(j => 
      searchQuery === '' || 
      j.nombre_completo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.legajo?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'turno') {
        // Ordenar por turno, luego por nombre
        const turnoA = turnoOrder[a.turno ?? 'null'] ?? 4
        const turnoB = turnoOrder[b.turno ?? 'null'] ?? 4
        if (turnoA !== turnoB) return turnoA - turnoB
      }
      // Ordenar por nombre (default o secundario)
      return (a.nombre_completo || '').localeCompare(b.nombre_completo || '')
    })

  const isToday = selectedDate === getLocalDateString()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Marcaciones en Tiempo Real</h2>
          <p className="text-sm text-gray-500">
            Sincronizado con Intelektron
            {isRefreshing && <span className="ml-2 text-[#C4322F]">• Actualizando...</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ContextoButton onClick={() => setShowContexto(true)} />
          <button 
            onClick={() => fetchData(false)}
            disabled={isRefreshing}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
        </div>
      </div>

      {/* Selector de fecha */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          {/* Fecha */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => changeDate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <Calendar className="w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none"
              />
            </div>
            <button 
              onClick={() => changeDate(1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
            {!isToday && (
              <button 
                onClick={() => setSelectedDate(getLocalDateString())}
                className="px-3 py-2 text-sm text-[#C4322F] hover:bg-red-50 rounded-lg"
              >
                Hoy
              </button>
            )}
          </div>

          {/* Filtros (solo para vista lista) */}
          {viewMode === 'lista' && (
            <div className="flex gap-2">
              <button
                onClick={() => setFilterTipo('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterTipo === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilterTipo('E')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  filterTipo === 'E'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <LogIn className="w-4 h-4" />
                Entradas
              </button>
              <button
                onClick={() => setFilterTipo('S')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  filterTipo === 'S'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <LogOut className="w-4 h-4" />
                Salidas
              </button>
            </div>
          )}

          {/* Toggle Vista */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('lista')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'lista'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
              Lista
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'timeline'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <GitCommitHorizontal className="w-4 h-4" />
              Jornadas
            </button>
          </div>
        </div>
      </div>

      {/* Vista Lista */}
      {viewMode === 'lista' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#C4322F]" />
              Detalle de marcaciones
            </h3>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar empleado o legajo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-[#C4322F]/20"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#C4322F]" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left font-semibold text-gray-600 px-5 py-3">Hora</th>
                    <th className="text-left font-semibold text-gray-600 px-3 py-3">Empleado</th>
                    <th className="text-left font-semibold text-gray-600 px-3 py-3">Legajo</th>
                    <th className="text-left font-semibold text-gray-600 px-3 py-3">DNI</th>
                    <th className="text-center font-semibold text-gray-600 px-3 py-3">Tipo</th>
                    <th className="text-left font-semibold text-gray-600 px-3 py-3">ID Biométrico</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMarcaciones.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                        No hay marcaciones para mostrar
                      </td>
                    </tr>
                  ) : (
                    filteredMarcaciones.map((marcacion) => (
                      <tr key={marcacion.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <span className="font-mono font-medium text-gray-900">
                            {formatHora(marcacion.hora_local)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              marcacion.estado_laboral === 'efectivo' 
                                ? 'bg-green-50' 
                                : marcacion.estado_laboral === 'pre_efectivo'
                                ? 'bg-amber-50'
                                : 'bg-gray-100'
                            }`}>
                              <User className={`w-4 h-4 ${
                                marcacion.estado_laboral === 'efectivo' 
                                  ? 'text-green-600' 
                                  : marcacion.estado_laboral === 'pre_efectivo'
                                  ? 'text-amber-600'
                                  : 'text-gray-400'
                              }`} />
                            </div>
                            <div>
                              <span className={`font-medium block ${
                                marcacion.nombre_completo 
                                  ? 'text-gray-900' 
                                  : 'text-gray-500 italic'
                              }`}>
                                {formatNombre(marcacion.nombre_completo, marcacion.id_biometrico)}
                              </span>
                              {marcacion.estado_laboral === 'pre_efectivo' && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${getEstadoColor(marcacion.estado_laboral)}`}>
                                  {getEstadoLabel(marcacion.estado_laboral)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono text-gray-600">
                          {marcacion.legajo || <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-3 font-mono text-gray-600">
                          {marcacion.dni || '-'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                            marcacion.tipo === 'E'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {marcacion.tipo === 'E' ? (
                              <>
                                <LogIn className="w-3 h-3" />
                                Entrada
                              </>
                            ) : (
                              <>
                                <LogOut className="w-3 h-3" />
                                Salida
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-gray-400">
                          {marcacion.id_biometrico}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Vista Timeline / Jornadas */}
      {viewMode === 'timeline' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            {selectedEmpleado ? (
              // Header para Historial de Empleado
              <>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedEmpleado(null)
                      setHistorialEmpleado([])
                    }}
                    className="p-1 rounded hover:bg-gray-100 mr-1"
                    title="Volver a Jornadas del día"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <User className="w-4 h-4 text-[#C4322F]" />
                  Historial de {formatNombre(selectedEmpleado.nombre_completo, selectedEmpleado.id_biometrico)}
                  <span className="text-sm font-normal text-gray-500">
                    (Legajo: {selectedEmpleado.legajo || selectedEmpleado.id_biometrico})
                  </span>
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    Página {historialPage + 1} ({HISTORIAL_DIAS} días)
                  </span>
                  <button
                    onClick={() => {
                      if (historialPage > 0 && selectedEmpleado.legajo) {
                        setHistorialPage(historialPage - 1)
                        fetchHistorialEmpleado(selectedEmpleado.legajo, historialPage - 1)
                      }
                    }}
                    disabled={historialPage === 0 || isLoadingHistorial}
                    className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (selectedEmpleado.legajo) {
                        setHistorialPage(historialPage + 1)
                        fetchHistorialEmpleado(selectedEmpleado.legajo, historialPage + 1)
                      }
                    }}
                    disabled={isLoadingHistorial}
                    className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              // Header para Jornadas del día
              <>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <GitCommitHorizontal className="w-4 h-4 text-[#C4322F]" />
                  Jornadas del día
                  <span className="text-sm font-normal text-gray-500">
                    ({jornadasFiltradas.length} empleados)
                  </span>
                </h3>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar empleado o legajo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-[#C4322F]/20"
                  />
                </div>
              </>
            )}
          </div>

          {/* VISTA HISTORIAL DE EMPLEADO */}
          {selectedEmpleado ? (
            isLoadingHistorial ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#C4322F]" />
                <span className="ml-3 text-gray-500">Cargando historial...</span>
              </div>
            ) : (
              <div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-2 py-1.5 text-left">Fecha</th>
                      <th className="px-2 py-1.5 text-center">Turno</th>
                      <th className="px-2 py-1.5 text-center">Entrada</th>
                      <th className="px-2 py-1.5 text-center">Salida</th>
                      <th className="px-2 py-1.5 text-center">Hs</th>
                      <th className="px-2 py-1.5 text-center">Extra</th>
                      <th className="px-2 py-1.5 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {historialEmpleado.map((dia) => {
                      const fechaParts = dia.fecha.split('-')
                      const fechaDisplay = `${dia.diaSemana} ${fechaParts[2]}/${fechaParts[1]}`
                      const esDomingo = dia.diaSemana === 'Do'
                      const tieneAsistencia = dia.entrada !== null
                      const cantMarcaciones = dia.marcacionesCrudas.length
                      
                      return (
                        <tr 
                          key={dia.fecha} 
                          className={`${
                            esDomingo 
                              ? 'bg-slate-50/50 opacity-50' 
                              : tieneAsistencia 
                                ? 'hover:bg-slate-50' 
                                : 'bg-red-50/30'
                          }`}
                        >
                          <td className="px-2 py-1">
                            <span className={`text-[11px] font-medium ${
                              esDomingo ? 'text-slate-400' : tieneAsistencia ? 'text-slate-700' : 'text-red-500'
                            }`}>
                              {fechaDisplay}
                            </span>
                          </td>
                          
                          <td className="px-2 py-1 text-center">
                            {dia.turno && dia.turno !== 'flexible' ? (
                              <span className="text-[10px] font-medium text-slate-600">
                                {dia.turno.charAt(0).toUpperCase()}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-[10px]">-</span>
                            )}
                          </td>
                          
                          <td className="px-2 py-1 text-center">
                            <span className={`font-mono text-[11px] font-semibold ${
                              dia.entrada ? 'text-green-600' : 'text-gray-300'
                            }`}>
                              {dia.entrada || '--:--'}
                            </span>
                          </td>
                          
                          <td className="px-2 py-1 text-center">
                            <span className={`font-mono text-[11px] font-semibold ${
                              dia.salida ? 'text-orange-600' : 'text-gray-300'
                            }`}>
                              {dia.salida || '--:--'}
                            </span>
                          </td>
                          
                          <td className="px-2 py-1 text-center">
                            {dia.horasTrabajadas !== null ? (
                              <span className={`font-mono text-[11px] font-bold ${
                                dia.horasExtra > 0 ? 'text-green-600' : 'text-gray-900'
                              }`}>
                                {dia.horasTrabajadas.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-[10px]">-</span>
                            )}
                          </td>
                          
                          <td className="px-2 py-1 text-center">
                            {dia.horasExtra > 0 ? (
                              <span className="font-mono text-[10px] font-bold text-red-600">
                                +{dia.horasExtra}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-[10px]">-</span>
                            )}
                          </td>
                          
                          <td className="px-1 py-1 text-center">
                            {cantMarcaciones > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setModalMarcaciones({ fecha: dia.fecha, marcaciones: dia.marcacionesCrudas })
                                }}
                                className="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                                title={`Ver ${cantMarcaciones} marcaciones`}
                              >
                                <span className="text-[9px] font-bold">{cantMarcaciones}</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                
                {/* Resumen del historial */}
                {historialEmpleado.length > 0 && (
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-6 text-xs">
                    <div>
                      <span className="font-semibold text-green-600">
                        {historialEmpleado.filter(d => d.entrada !== null).length}
                      </span>
                      <span className="text-slate-500 ml-1">días con asistencia</span>
                    </div>
                    <div>
                      <span className="font-semibold text-red-500">
                        {historialEmpleado.filter(d => d.entrada === null && d.diaSemana !== 'Do').length}
                      </span>
                      <span className="text-slate-500 ml-1">ausencias</span>
                    </div>
                    <div>
                      <span className="font-semibold text-orange-600">
                        {historialEmpleado.reduce((sum, d) => sum + d.horasExtra, 0)}h
                      </span>
                      <span className="text-slate-500 ml-1">extras en el período</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-600">
                        {historialEmpleado.filter(d => d.horasTrabajadas !== null).reduce((sum, d) => sum + (d.horasTrabajadas || 0), 0).toFixed(1)}h
                      </span>
                      <span className="text-slate-500 ml-1">trabajadas en total</span>
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            /* VISTA JORNADAS DEL DÍA */
            isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#C4322F]" />
              </div>
            ) : jornadasFiltradas.length === 0 ? (
              <div className="px-5 py-12 text-center text-gray-500">
                No hay jornadas para mostrar
              </div>
            ) : (
              <div>
                {/* Header de columnas */}
                <div className="flex items-center px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div 
                    className={`w-[180px] shrink-0 cursor-pointer hover:text-slate-700 flex items-center gap-1 ${sortBy === 'nombre' ? 'text-slate-700' : ''}`}
                    onClick={() => setSortBy('nombre')}
                  >
                    Empleado {sortBy === 'nombre' && '↓'}
                  </div>
                  <div 
                    className={`w-[70px] shrink-0 text-center cursor-pointer hover:text-slate-700 ${sortBy === 'turno' ? 'text-slate-700' : ''}`}
                    onClick={() => setSortBy('turno')}
                  >
                    Turno {sortBy === 'turno' && '↓'}
                  </div>
                  <div className="w-[60px] shrink-0 text-center">Entrada</div>
                  <div className="w-[60px] shrink-0 text-center">Salida</div>
                  <div className="w-[120px] shrink-0 text-center">
                    <div className="text-slate-600 normal-case text-[10px]">Madrugada</div>
                    <div className="text-[9px] font-normal text-slate-400 normal-case">22:00-06:00</div>
                  </div>
                  <div className="w-[120px] shrink-0 text-center">
                    <div className="text-slate-600 normal-case text-[10px]">Mañana</div>
                    <div className="text-[9px] font-normal text-slate-400 normal-case">06:00-14:00</div>
                  </div>
                  <div className="w-[120px] shrink-0 text-center">
                    <div className="text-slate-600 normal-case text-[10px]">Tarde</div>
                    <div className="text-[9px] font-normal text-slate-400 normal-case">14:00-22:00</div>
                  </div>
                  <div className="w-[55px] shrink-0 text-right">Horas</div>
                  <div className="w-[55px] shrink-0 text-right">Extra</div>
                </div>

              {/* Filas */}
              <div className="divide-y divide-gray-100">
                {jornadasFiltradas.map((jornada) => {
                  // Verificar si es sábado
                  const sabado = esSabado(selectedDate)
                  
                  // Empleados fuera de convenio: verificar por legajo O por turno flexible
                  const esFueraConvenio = (jornada.legajo && LEGAJOS_FUERA_CONVENIO.has(jornada.legajo)) || jornada.turno === 'flexible'
                  
                  // Calcular segmentos - solo pinta la barra si tiene turno fijo
                  const segmentos = esFueraConvenio ? [] : calcularSegmentosTurno(jornada.entrada, jornada.salida, jornada.turno)
                  const segmentoMadrugada = segmentos.find(s => s.turno === 'madrugada')
                  const segmentoMañana = segmentos.find(s => s.turno === 'mañana')
                  const segmentoTarde = segmentos.find(s => s.turno === 'tarde')
                  
                  // Calcular horas extra - Solo para empleados CON turno fijo
                  // Semana: turno normal 8h, sábados: turno 7h (6-13)
                  const umbralHoy = sabado ? 7 : UMBRAL_HORAS_EXTRA
                  const horasExtra = !esFueraConvenio && jornada.horasTrabajadas && jornada.horasTrabajadas > umbralHoy
                    ? Math.floor(jornada.horasTrabajadas - umbralHoy)
                    : 0
                  
                  // Colores: siempre gris slate
                  const barColor = '#475569' // slate-600
                  const bgColor = '#f1f5f9' // slate-100
                  
                  // Check if this employee is selected
                  const isSelected = selectedEmpleado?.legajo === jornada.legajo && 
                                     selectedEmpleado?.id_biometrico === jornada.id_biometrico

                  return (
                    <div key={jornada.id_biometrico}>
                      <div 
                        className={`flex items-center px-4 py-2 border-b border-slate-100 cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-pink-50 hover:bg-pink-100' 
                            : 'hover:bg-slate-50'
                        }`}
                        onClick={() => jornada.legajo && handleSelectEmpleado(jornada)}
                      >
                      {/* Empleado */}
                      <div className="w-[180px] shrink-0 flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          jornada.estado_laboral === 'efectivo' 
                            ? 'bg-green-50' 
                            : jornada.estado_laboral === 'pre_efectivo'
                            ? 'bg-amber-50'
                            : 'bg-gray-100'
                        }`}>
                          <User className={`w-3.5 h-3.5 ${
                            jornada.estado_laboral === 'efectivo' 
                              ? 'text-green-600' 
                              : jornada.estado_laboral === 'pre_efectivo'
                              ? 'text-amber-600'
                              : 'text-gray-400'
                          }`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={`font-medium block truncate text-xs ${
                            jornada.nombre_completo 
                              ? 'text-gray-900' 
                              : 'text-gray-500 italic'
                          }`}>
                            {formatNombre(jornada.nombre_completo, jornada.id_biometrico)}
                          </span>
                          <span className="text-[10px] text-gray-400 truncate block">
                            {jornada.legajo || jornada.id_biometrico}
                          </span>
                        </div>
                      </div>

                      {/* Turno */}
                      <div className="w-[70px] shrink-0 text-center" title={jornada.turnoNombre || undefined}>
                        {jornada.turno && jornada.turno !== 'flexible' ? (
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            jornada.turnoNombre 
                              ? 'bg-green-50 text-green-700 ring-1 ring-green-200' 
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {jornada.turno.charAt(0).toUpperCase() + jornada.turno.slice(1)}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </div>

                      {/* Entrada */}
                      <div className="w-[60px] shrink-0 text-center">
                        <span className={`font-mono text-xs font-semibold ${
                          jornada.entrada ? 'text-green-600' : 'text-gray-300'
                        }`}>
                          {jornada.entrada || '--:--'}
                        </span>
                      </div>

                      {/* Salida */}
                      <div className="w-[60px] shrink-0 text-center">
                        <span className={`font-mono text-xs font-semibold ${
                          jornada.salida ? 'text-orange-600' : 'text-gray-300'
                        }`}>
                          {jornada.salida || '--:--'}
                        </span>
                      </div>

                      {/* Área de turnos - diferente para fuera de convenio vs empleados con turno */}
                      {esFueraConvenio ? (
                        // FUERA DE CONVENIO: Una sola barra que muestra duración real
                        <div className="w-[360px] shrink-0 px-1">
                          <div 
                            className="rounded overflow-hidden relative border border-blue-200"
                            style={{ height: '18px', backgroundColor: '#eff6ff' }}
                          >
                            {jornada.entrada && jornada.horasTrabajadas && (
                              <>
                                {/* Barra de duración */}
                                <div 
                                  style={{ 
                                    position: 'absolute',
                                    top: 0,
                                    bottom: 0,
                                    // Posición: hora de entrada como % de 24h
                                    left: `${(horaAMinutos(jornada.entrada)! / 1440) * 100}%`,
                                    // Ancho: horas trabajadas como % de 24h
                                    width: `${(jornada.horasTrabajadas / 24) * 100}%`,
                                    backgroundColor: '#3b82f6',
                                    borderRadius: '3px'
                                  }}
                                />
                                {/* Texto con duración */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-[10px] font-medium text-blue-800">
                                    {jornada.horasTrabajadas.toFixed(1)}h
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        // EMPLEADOS CON TURNO: 3 columnas de turno separadas
                        <>
                          {/* Turno Madrugada (22:00-06:00) - No se muestra los sábados */}
                          <div className="w-[120px] shrink-0 px-1">
                            <div 
                              className="rounded overflow-hidden relative border border-slate-200"
                              style={{ height: '18px', backgroundColor: sabado ? '#e2e8f0' : bgColor }}
                            >
                              {!sabado && segmentoMadrugada && (
                                <div 
                                  style={{ 
                                    position: 'absolute',
                                    top: 0,
                                    bottom: 0,
                                    left: `${segmentoMadrugada.startPercent}%`,
                                    width: `${segmentoMadrugada.widthPercent}%`,
                                    backgroundColor: barColor,
                                    borderRadius: '3px'
                                  }}
                                />
                              )}
                            </div>
                          </div>

                          {/* Turno Mañana (06:00-14:00, sábados 06:00-13:00) */}
                          <div className="w-[120px] shrink-0 px-1">
                            <div 
                              className="rounded overflow-hidden relative border border-slate-200"
                              style={{ height: '18px', backgroundColor: bgColor }}
                            >
                              {segmentoMañana && (
                                <div 
                                  style={{ 
                                    position: 'absolute',
                                    top: 0,
                                    bottom: 0,
                                    left: `${segmentoMañana.startPercent}%`,
                                    width: `${segmentoMañana.widthPercent}%`,
                                    backgroundColor: barColor,
                                    borderRadius: '3px'
                                  }}
                                />
                              )}
                            </div>
                          </div>

                          {/* Turno Tarde (14:00-22:00) - No se muestra los sábados */}
                          <div className="w-[120px] shrink-0 px-1">
                            <div 
                              className="rounded overflow-hidden relative border border-slate-200"
                              style={{ height: '18px', backgroundColor: sabado ? '#e2e8f0' : bgColor }}
                            >
                              {!sabado && segmentoTarde && (
                                <div 
                                  style={{ 
                                    position: 'absolute',
                                    top: 0,
                                    bottom: 0,
                                    left: `${segmentoTarde.startPercent}%`,
                                    width: `${segmentoTarde.widthPercent}%`,
                                    backgroundColor: barColor,
                                    borderRadius: '3px'
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Total Horas */}
                      <div className="w-[55px] shrink-0 text-right">
                        {jornada.horasTrabajadas !== null ? (
                          <span className={`font-mono text-xs font-bold ${
                            horasExtra > 0 ? 'text-green-600' : 'text-gray-900'
                          }`}>
                            {jornada.horasTrabajadas.toFixed(1)}h
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </div>

                      {/* Horas Extra */}
                      <div className="w-[55px] shrink-0 text-right">
                        {horasExtra > 0 ? (
                          <span className="font-mono text-[10px] font-bold text-red-600 bg-red-50 px-1 py-0.5 rounded">
                            +{horasExtra}h
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de marcaciones crudas */}
      {modalMarcaciones && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModalMarcaciones(null)}>
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#C4322F]" />
                Marcaciones del {modalMarcaciones.fecha.split('-').reverse().join('/')}
              </h3>
              <button
                onClick={() => setModalMarcaciones(null)}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              {modalMarcaciones.marcaciones.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  No hay marcaciones en este día
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase">
                      <th className="px-4 py-2 text-left">Hora</th>
                      <th className="px-4 py-2 text-center">Tipo</th>
                      <th className="px-4 py-2 text-left">ID Reloj</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {modalMarcaciones.marcaciones
                      .sort((a, b) => a.hora_local.localeCompare(b.hora_local))
                      .map((m, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <span className="font-mono text-sm font-semibold text-gray-900">
                              {formatHora(m.hora_local)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                              m.tipo === 'E'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {m.tipo === 'E' ? (
                                <>
                                  <LogIn className="w-3 h-3" />
                                  Entrada
                                </>
                              ) : (
                                <>
                                  <LogOut className="w-3 h-3" />
                                  Salida
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-xs text-gray-500 font-mono">
                              {m.id_reloj || '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
              Total: {modalMarcaciones.marcaciones.length} marcaciones
            </div>
          </div>
        </div>
      )}

      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Contexto: Marcaciones en Tiempo Real"
        contenido={contextoMarcaciones}
      />
    </div>
  )
}

