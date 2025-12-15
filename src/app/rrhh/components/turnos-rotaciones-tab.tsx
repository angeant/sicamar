'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  Lock,
  Eye,
  UserCog,
  Settings,
  Download,
  RefreshCw,
  Users,
  AlertCircle,
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'

// ============ TIPOS ============

interface BloqueRotacion {
  id: number
  codigo: string
  nombre: string
  planta: 'planta_1' | 'planta_2' | 'mantenimiento' | 'administracion'
  tipo_rotacion: 'tres_turnos' | 'dos_turnos' | 'fijo'
  secuencia_turnos: number[] | null
  activo: boolean
  descripcion: string | null
  total_empleados: number
  turno_actual: {
    id: number
    codigo: string
    hora_entrada: string
    hora_salida: string
  } | null
  empleados?: EmpleadoBloque[]
}

interface EmpleadoBloque {
  id: number
  empleado_id: number
  legajo: string
  nombre: string
  apellido: string
  nombre_completo: string
  turno_fijo_id: number | null
  turno_fijo_codigo: string | null
  estado_especial?: string | null
}

// ============ HELPERS ============

const turnoInfo: Record<string, { label: string; horario: string; icon: typeof Sun }> = {
  'MAÑANA': { label: 'Mañana', horario: '06:00-14:00', icon: Sun },
  'TARDE': { label: 'Tarde', horario: '14:00-22:00', icon: Sunset },
  'NOCHE': { label: 'Noche', horario: '22:00-06:00', icon: Moon },
  'CENTRAL': { label: 'Central', horario: '08:00-17:00', icon: Sun },
}

const plantaLabel: Record<string, string> = {
  planta_1: 'Planta 1',
  planta_2: 'Planta 2',
  mantenimiento: 'Mantenimiento',
  administracion: 'Administración',
}

function getWeekDates(baseDate: Date): Date[] {
  const monday = new Date(baseDate)
  const day = monday.getDay()
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1)
  monday.setDate(diff)
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d)
  }
  return dates
}

function formatWeekRange(dates: Date[]): string {
  const start = dates[0].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  const end = dates[6].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  return `${start} - ${end}`
}

function getLunesSemana(fecha: Date): string {
  const day = fecha.getDay()
  const diff = fecha.getDate() - day + (day === 0 ? -6 : 1)
  const lunes = new Date(fecha)
  lunes.setDate(diff)
  return lunes.toISOString().split('T')[0]
}

// Contexto de la sección
const contextoTurnos = {
  descripcion: 'Gestión de rotación semanal por bloques y plantas. El sistema maneja una lógica de rotación compleja que varía según la planta y el puesto.',
  reglas: [
    'Supervisores y Analistas P1: Rotan en bloque semanalmente (Mañana → Tarde → Noche)',
    'Operarios Bloque 1 (P1): Rotación completa de 3 turnos',
    'Operarios Bloque 2 (P1): Solo rotan Mañana y Tarde',
    'Pañol y Administración: Turno fijo',
    'Mantenimiento Supervisores: Rotación de 2 turnos',
    'Operarios P2: 3 turnos con secuencias desfasadas',
  ],
  flujo: [
    'El sistema genera automáticamente el calendario de rotaciones',
    'Cada lunes se actualiza el turno según la secuencia del bloque',
    'Los empleados se asignan a bloques de rotación',
    'El supervisor puede ajustar rotaciones manualmente si es necesario',
  ],
  integraciones: [
    'Marcaciones: Se usa el turno asignado para calcular horas',
    'Jornadas: Cruza marcaciones con turno para calcular HD/HN/EX',
    'Liquidación: Las horas calculadas se usan para generar conceptos',
  ],
  notas: [
    'Los turnos y bloques se configuran desde la base de datos',
    'Las rotaciones se generan automáticamente cada semana',
  ],
}

// ============ COMPONENTE PRINCIPAL ============

export function TurnosRotacionesTab() {
  const [selectedWeek, setSelectedWeek] = useState(new Date())
  const [selectedPlanta, setSelectedPlanta] = useState<string>('todas')
  const [showContexto, setShowContexto] = useState(false)
  const [bloques, setBloques] = useState<BloqueRotacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedBloque, setExpandedBloque] = useState<number | null>(null)

  const weekDates = useMemo(() => getWeekDates(selectedWeek), [selectedWeek])
  const semanaStr = useMemo(() => getLunesSemana(selectedWeek), [selectedWeek])

  // Cargar bloques
  const cargarBloques = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        incluirEmpleados: 'true',
        semana: semanaStr,
      })
      if (selectedPlanta !== 'todas') {
        params.append('planta', selectedPlanta)
      }

      const response = await fetch(`/api/sicamar/turnos/bloques?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar bloques')
      }

      setBloques(data.bloques || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setBloques([])
    } finally {
      setLoading(false)
    }
  }, [selectedPlanta, semanaStr])

  useEffect(() => {
    cargarBloques()
  }, [cargarBloques])

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedWeek)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    setSelectedWeek(newDate)
  }

  // Agrupar bloques por planta
  const bloquesPorPlanta = useMemo(() => {
    const grouped: Record<string, BloqueRotacion[]> = {}
    for (const bloque of bloques) {
      const planta = bloque.planta || 'sin_planta'
      if (!grouped[planta]) {
        grouped[planta] = []
      }
      grouped[planta].push(bloque)
    }
    return grouped
  }, [bloques])

  const getTurnoIcon = (codigo: string | undefined) => {
    if (!codigo) return null
    const info = turnoInfo[codigo]
    return info?.icon || Sun
  }

  const getTurnoLabel = (codigo: string | undefined) => {
    if (!codigo) return '-'
    const info = turnoInfo[codigo]
    return info?.label || codigo
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Turnos y Rotaciones</h2>
          <p className="text-sm text-gray-500">Gestión de rotación semanal por bloques</p>
        </div>
        <div className="flex items-center gap-2">
          <ContextoButton onClick={() => setShowContexto(true)} />
          <button 
            onClick={cargarBloques}
            disabled={loading}
            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
          <button className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5" />
            Configurar
          </button>
        </div>
      </div>

      {/* Navegación de semana */}
      <div className="flex items-center justify-between py-3 border-y border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => navigateWeek('prev')} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">
            {formatWeekRange(weekDates)}
          </span>
          <button onClick={() => navigateWeek('next')} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => setSelectedWeek(new Date())}
            className="px-2 py-1 text-xs text-[#C4322F] hover:bg-red-50 rounded"
          >
            Hoy
          </button>
        </div>

        <div className="flex gap-1">
          {(['todas', 'planta_1', 'planta_2', 'mantenimiento', 'administracion'] as const).map(p => (
            <button
              key={p}
              onClick={() => setSelectedPlanta(p)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                selectedPlanta === p
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p === 'todas' ? 'Todas' : plantaLabel[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
          <span className="ml-2 text-gray-500">Cargando turnos...</span>
        </div>
      )}

      {/* Tabla de bloques */}
      {!loading && bloques.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left font-medium text-gray-600 px-4 py-2.5 w-1/4">Bloque</th>
                <th className="text-left font-medium text-gray-600 px-4 py-2.5 w-24">Tipo</th>
                <th className="text-left font-medium text-gray-600 px-4 py-2.5 w-32">Turno actual</th>
                <th className="text-center font-medium text-gray-600 px-4 py-2.5 w-24">Empleados</th>
                <th className="text-left font-medium text-gray-600 px-4 py-2.5">Personal</th>
                <th className="text-center font-medium text-gray-600 px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(bloquesPorPlanta).map(([planta, bloquesPlanta]) => (
                <>
                  {/* Header de planta */}
                  <tr key={`header-${planta}`} className="bg-gray-50/50">
                    <td colSpan={6} className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {plantaLabel[planta] || planta}
                    </td>
                  </tr>
                  {/* Bloques */}
                  {bloquesPlanta.map(bloque => {
                    const TurnoIcon = getTurnoIcon(bloque.turno_actual?.codigo)
                    const isExpanded = expandedBloque === bloque.id
                    
                    return (
                      <>
                        <tr 
                          key={bloque.id} 
                          className="border-t border-gray-100 hover:bg-gray-50/50 cursor-pointer"
                          onClick={() => setExpandedBloque(isExpanded ? null : bloque.id)}
                        >
                          <td className="px-4 py-3">
                            <span className="text-gray-900 font-medium">{bloque.nombre}</span>
                            <span className="text-xs text-gray-400 ml-2">({bloque.codigo})</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              bloque.tipo_rotacion === 'fijo' 
                                ? 'bg-gray-100 text-gray-500' 
                                : bloque.tipo_rotacion === 'dos_turnos'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {bloque.tipo_rotacion === 'fijo' ? 'Fijo' : 
                               bloque.tipo_rotacion === 'dos_turnos' ? '2T' : '3T'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {bloque.turno_actual && TurnoIcon ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                                <TurnoIcon className="w-3.5 h-3.5 text-gray-400" />
                                {getTurnoLabel(bloque.turno_actual.codigo)}
                                <span className="text-gray-400">
                                  ({bloque.turno_actual.hora_entrada?.slice(0, 5)}-{bloque.turno_actual.hora_salida?.slice(0, 5)})
                                </span>
                              </span>
                            ) : bloque.tipo_rotacion === 'fijo' ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                                <Lock className="w-3 h-3" />
                                Fijo
                              </span>
                            ) : (
                              <span className="text-gray-300">Sin asignar</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                              <Users className="w-3.5 h-3.5 text-gray-400" />
                              {bloque.total_empleados}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1 max-w-md">
                              {(bloque.empleados || []).slice(0, 5).map(emp => (
                                <span key={emp.id} className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {emp.apellido}
                                </span>
                              ))}
                              {(bloque.empleados?.length || 0) > 5 && (
                                <span className="text-xs text-gray-400">
                                  +{(bloque.empleados?.length || 0) - 5} más
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                                <UserCog className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Detalle expandido */}
                        {isExpanded && bloque.empleados && bloque.empleados.length > 0 && (
                          <tr key={`detail-${bloque.id}`}>
                            <td colSpan={6} className="bg-gray-50 px-4 py-3 border-t border-gray-100">
                              <div className="grid grid-cols-4 gap-2">
                                {bloque.empleados.map(emp => (
                                  <div key={emp.id} className="flex items-center gap-2 text-xs">
                                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                                      {emp.legajo.slice(-2)}
                                    </div>
                                    <div>
                                      <p className="text-gray-900">{emp.nombre_completo}</p>
                                      <p className="text-gray-400">Leg. {emp.legajo}</p>
                                    </div>
                                    {emp.turno_fijo_codigo && (
                                      <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                        {emp.turno_fijo_codigo}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && bloques.length === 0 && !error && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay bloques configurados</p>
          <p className="text-sm text-gray-400 mt-1">
            Configura los bloques de rotación desde la base de datos
          </p>
        </div>
      )}

      {/* Leyenda minimalista */}
      <div className="flex items-center gap-6 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Sun className="w-3 h-3" /> M: 06-14
        </span>
        <span className="flex items-center gap-1">
          <Sunset className="w-3 h-3" /> T: 14-22
        </span>
        <span className="flex items-center gap-1">
          <Moon className="w-3 h-3" /> N: 22-06
        </span>
        <span className="border-l border-gray-200 pl-6">
          <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">3T</span> = 3 turnos
          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-3">2T</span> = 2 turnos
          <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded ml-3">Fijo</span> = Sin rotación
        </span>
      </div>

      {/* Modal de contexto */}
      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Contexto: Turnos y Rotaciones"
        contenido={contextoTurnos}
      />
    </div>
  )
}
