'use client'

import { useState, useEffect } from 'react'
import {
  Palmtree,
  Plus,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  XCircle,
  Factory,
  CalendarRange,
  Filter,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'

const contextoVacaciones = {
  descripcion: 'Gestión de vacaciones según convenio colectivo. Control de saldos, solicitudes y asignación masiva para paradas de planta.',
  reglas: [
    'Días por antigüedad: <5 años=14d, 5-10=21d, 10-20=28d, >20=35d (corridos)',
    'Tope días hábiles: Varía según convenio (UOM, ASIMRA)',
    'Arrastre: Días no tomados del año anterior se suman',
    'Fines de semana: Se descuentan como días corridos, no hábiles',
    'Francos a favor: Feriados trabajados generan días compensatorios'
  ],
  flujo: [
    '1. Empleado solicita vacaciones (verbal o sistema)',
    '2. RRHH verifica saldo disponible',
    '3. Supervisor aprueba según necesidad operativa',
    '4. Se registra en sistema con fechas',
    '5. Sistema descuenta días del saldo'
  ],
  integraciones: [
    'Bejerman: Sincronización mensual de días tomados',
    'Asistencia: Días de vacaciones no cuentan como ausencia',
    'Liquidación: Pago de vacaciones según convenio'
  ],
  notas: [
    'Parada de planta: Enero, se asignan vacaciones masivas',
    'Solicitudes pendientes: Requieren aprobación de supervisor',
    'Saldo negativo: Empleado debe días (adelantó vacaciones)',
    'Métrica: % de personal con vacaciones tomadas en el año'
  ]
}

// Types
interface SaldoVacaciones {
  empleado_id: number
  legajo: string
  nombre_completo: string
  fecha_ingreso: string
  anio: number
  antiguedad_calculada: number
  dias_corridos_legales: number
  dias_corridos_arrastre: number
  dias_corridos_total: number
  dias_corridos_tomados: number
  dias_corridos_programados: number
  dias_corridos_disponibles: number
  dias_habiles_tope: number
  dias_habiles_tomados: number
  dias_habiles_programados: number
  dias_habiles_disponibles: number
  dias_finde_residuales: number
  francos_a_favor: number
  francos_disponibles: number
  puede_pedir_dia_habil: boolean
}

interface EventoVacaciones {
  id: number
  empleado_id: number
  empleado?: {
    legajo: string
    nombre: string
    apellido: string
  }
  tipo: string
  fecha_inicio: string
  fecha_fin: string
  dias_corridos: number
  dias_habiles: number
  dias_finde: number
  dias_feriados: number
  estado: string
  solicitado_por: string
  fecha_solicitud: string
  aprobado_por: string
  fecha_aprobacion: string
  observaciones: string
  origen: string
}

type TabView = 'saldos' | 'solicitudes' | 'asignacion'

export function VacacionesTab() {
  const [activeView, setActiveView] = useState<TabView>('saldos')
  const [saldos, setSaldos] = useState<SaldoVacaciones[]>([])
  const [eventos, setEventos] = useState<EventoVacaciones[]>([])
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<EventoVacaciones[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSaldo] = useState<'todos'>('todos')
  const [showContexto, setShowContexto] = useState(false)
  
  // Modal states
  const [showAsignacionMasiva, setShowAsignacionMasiva] = useState(false)
  const [showNuevaSolicitud, setShowNuevaSolicitud] = useState(false)

  // Fetch data
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch saldos
      const saldosRes = await fetch('/api/sicamar/vacaciones/saldos')
      const saldosData = await saldosRes.json()
      if (saldosData.saldos) {
        setSaldos(saldosData.saldos)
      }

      // Fetch eventos del año
      const eventosRes = await fetch('/api/sicamar/vacaciones/eventos?tipo=vacaciones')
      const eventosData = await eventosRes.json()
      if (eventosData.eventos) {
        setEventos(eventosData.eventos)
        setSolicitudesPendientes(
          eventosData.eventos.filter((e: EventoVacaciones) => 
            e.estado === 'pendiente_aprobacion'
          )
        )
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Contadores para tabs
  const totalSaldos = saldos.length
  const totalSolicitudesPendientes = solicitudesPendientes.length
  const totalProgramadas = eventos.filter(e => ['programado', 'en_curso', 'completado'].includes(e.estado)).length

  // Filtrado de saldos (solo por búsqueda)
  const filteredSaldos = saldos.filter(s =>
    s.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.legajo.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#C4322F]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Gestión de Vacaciones</h2>
          <p className="text-sm text-gray-500">Saldos, solicitudes y asignación</p>
        </div>
        <div className="flex items-center gap-2">
          <ContextoButton onClick={() => setShowContexto(true)} />
          <button 
            onClick={() => fetchData()}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
            title="Actualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setShowAsignacionMasiva(true)}
            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1.5"
          >
            <Factory className="w-3.5 h-3.5" />
            Parada planta
          </button>
          <button 
            onClick={() => setShowNuevaSolicitud(true)}
            className="px-3 py-1.5 text-xs text-white bg-gray-900 hover:bg-gray-800 rounded flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva solicitud
          </button>
        </div>
      </div>

      {/* Alerta de solicitudes pendientes */}
      {totalSolicitudesPendientes > 0 && (
        <div 
          className="bg-amber-50 border border-amber-200 rounded-xl p-4 cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => setActiveView('solicitudes')}
        >
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-500 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-800">
                {totalSolicitudesPendientes} solicitud(es) pendiente(s) de aprobación
              </h4>
              <p className="text-sm text-amber-600 mt-1">
                Click para revisar y aprobar/rechazar
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-500" />
          </div>
        </div>
      )}


      {/* Tabs de navegación */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: 'saldos' as TabView, label: 'Saldos', icon: Users, count: totalSaldos },
          { id: 'solicitudes' as TabView, label: 'Solicitudes', icon: Clock, count: totalSolicitudesPendientes },
          { id: 'asignacion' as TabView, label: 'Programadas', icon: Calendar, count: totalProgramadas },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === tab.id
                ? 'bg-white text-[#C4322F] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeView === tab.id ? 'bg-[#C4322F]/10 text-[#C4322F]' : 'bg-gray-200 text-gray-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Vista de Saldos */}
      {activeView === 'saldos' && (
        <SaldosView 
          saldos={filteredSaldos}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          totalSaldos={saldos.length}
        />
      )}

      {/* Vista de Solicitudes Pendientes */}
      {activeView === 'solicitudes' && (
        <SolicitudesView 
          solicitudes={solicitudesPendientes}
          onRefresh={fetchData}
        />
      )}

      {/* Vista de Vacaciones Programadas */}
      {activeView === 'asignacion' && (
        <ProgramadasView 
          eventos={eventos.filter(e => ['programado', 'en_curso', 'completado'].includes(e.estado))}
        />
      )}


      {/* Modales */}
      {showAsignacionMasiva && (
        <AsignacionMasivaModal 
          onClose={() => setShowAsignacionMasiva(false)}
          onSuccess={() => {
            setShowAsignacionMasiva(false)
            fetchData()
          }}
        />
      )}

      {showNuevaSolicitud && (
        <NuevaSolicitudModal 
          saldos={saldos}
          onClose={() => setShowNuevaSolicitud(false)}
          onSuccess={() => {
            setShowNuevaSolicitud(false)
            fetchData()
          }}
        />
      )}

      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Contexto: Gestión de Vacaciones"
        contenido={contextoVacaciones}
      />
    </div>
  )
}

// ============ SALDOS VIEW ============

type SortField = 'nombre' | 'antiguedad' | 'dias_por_ano' | 'ano_anterior' | 'tomados' | 'programados' | 'disponible'
type SortDirection = 'asc' | 'desc'

function SaldosView({ 
  saldos, 
  searchQuery, 
  setSearchQuery, 
  totalSaldos 
}: {
  saldos: SaldoVacaciones[]
  searchQuery: string
  setSearchQuery: (q: string) => void
  totalSaldos: number
}) {
  const [sortField, setSortField] = useState<SortField>('nombre')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedSaldos = [...saldos].sort((a, b) => {
    let aValue: any
    let bValue: any

    switch (sortField) {
      case 'nombre':
        aValue = a.nombre_completo
        bValue = b.nombre_completo
        break
      case 'antiguedad':
        aValue = a.antiguedad_calculada
        bValue = b.antiguedad_calculada
        break
      case 'dias_por_ano':
        aValue = a.dias_corridos_legales
        bValue = b.dias_corridos_legales
        break
      case 'ano_anterior':
        aValue = a.dias_corridos_arrastre
        bValue = b.dias_corridos_arrastre
        break
      case 'tomados':
        aValue = a.dias_habiles_tomados
        bValue = b.dias_habiles_tomados
        break
      case 'programados':
        aValue = a.dias_habiles_programados
        bValue = b.dias_habiles_programados
        break
      case 'disponible':
        aValue = a.dias_corridos_disponibles
        bValue = b.dias_corridos_disponibles
        break
    }

    if (typeof aValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue)
    }
    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
  })

  const SortHeader = ({ field, children, align = 'center' }: { field: SortField, children: React.ReactNode, align?: 'left' | 'center' }) => (
    <th 
      className={`px-4 py-3 text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 select-none ${align === 'left' ? 'text-left' : 'text-center'}`}
      onClick={() => handleSort(field)}
    >
      <div className={`flex items-center gap-0.5 ${align === 'center' ? 'justify-center' : ''}`}>
        {children}
        {sortField === field && (
          <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />
        )}
      </div>
    </th>
  )

  return (
    <div className="space-y-4">
      {/* Búsqueda */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{saldos.length} de {totalSaldos} empleados</p>
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

      {/* Tabla de saldos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortHeader field="nombre" align="left">Empleado</SortHeader>
                <SortHeader field="antiguedad">Antigüedad</SortHeader>
                <SortHeader field="dias_por_ano">Días por año</SortHeader>
                <SortHeader field="ano_anterior">Año anterior</SortHeader>
                <SortHeader field="tomados">Tomados</SortHeader>
                <SortHeader field="programados">Programados</SortHeader>
                <SortHeader field="disponible">Disponible</SortHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedSaldos.map(saldo => (
                <tr key={saldo.empleado_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold">
                        {saldo.nombre_completo.split(',')[0]?.slice(0, 2).toUpperCase() || '??'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{saldo.nombre_completo}</p>
                        <p className="text-xs text-gray-500">Legajo: {saldo.legajo}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-700">{saldo.antiguedad_calculada} años</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-gray-900">{saldo.dias_corridos_legales}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {saldo.dias_corridos_arrastre === 0 ? (
                      <span className="text-sm text-gray-400">—</span>
                    ) : saldo.dias_corridos_arrastre > 0 ? (
                      <span className="text-sm text-green-600">+{saldo.dias_corridos_arrastre} a favor</span>
                    ) : (
                      <span className="text-sm text-red-600">{saldo.dias_corridos_arrastre} debe</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-700">{saldo.dias_habiles_tomados}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-blue-600">{saldo.dias_habiles_programados}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-lg font-bold text-gray-900">{saldo.dias_corridos_disponibles}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ============ SOLICITUDES VIEW ============

function SolicitudesView({ 
  solicitudes, 
  onRefresh 
}: { 
  solicitudes: EventoVacaciones[]
  onRefresh: () => void 
}) {
  const [procesando, setProcesando] = useState<number | null>(null)

  const handleAprobar = async (id: number) => {
    setProcesando(id)
    try {
      const res = await fetch(`/api/sicamar/vacaciones/eventos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'programado',
          aprobado_por: 'Rocío Barrera' // TODO: usuario actual
        })
      })
      if (res.ok) {
        onRefresh()
      }
    } catch (error) {
      console.error('Error aprobando:', error)
    } finally {
      setProcesando(null)
    }
  }

  const handleRechazar = async (id: number, motivo: string) => {
    setProcesando(id)
    try {
      const res = await fetch(`/api/sicamar/vacaciones/eventos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'rechazado',
          rechazado_por: 'Rocío Barrera', // TODO: usuario actual
          motivo_rechazo: motivo
        })
      })
      if (res.ok) {
        onRefresh()
      }
    } catch (error) {
      console.error('Error rechazando:', error)
    } finally {
      setProcesando(null)
    }
  }

  if (solicitudes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin solicitudes pendientes</h3>
        <p className="text-sm text-gray-500">Todas las solicitudes han sido procesadas</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {solicitudes.map(sol => (
        <div key={sol.id} className="bg-white rounded-xl border border-amber-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {sol.empleado?.apellido}, {sol.empleado?.nombre}
                </h3>
                <p className="text-sm text-gray-500">Legajo: {sol.empleado?.legajo}</p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="flex items-center gap-1 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    {new Date(sol.fecha_inicio).toLocaleDateString('es-AR')} - {new Date(sol.fecha_fin).toLocaleDateString('es-AR')}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{sol.dias_habiles}</div>
              <div className="text-xs text-gray-500">días hábiles</div>
              <div className="text-xs text-gray-400">{sol.dias_corridos} corridos</div>
            </div>
          </div>

          {sol.observaciones && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">{sol.observaciones}</p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              Solicitado: {sol.fecha_solicitud ? new Date(sol.fecha_solicitud).toLocaleDateString('es-AR') : 'N/A'}
              {sol.solicitado_por && ` por ${sol.solicitado_por}`}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRechazar(sol.id, 'Sin disponibilidad en esas fechas')}
                disabled={procesando === sol.id}
                className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Rechazar
              </button>
              <button
                onClick={() => handleAprobar(sol.id)}
                disabled={procesando === sol.id}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
              >
                {procesando === sol.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Aprobar
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ============ PROGRAMADAS VIEW ============

function ProgramadasView({ eventos }: { eventos: EventoVacaciones[] }) {
  const estadoColors: Record<string, string> = {
    programado: 'bg-blue-100 text-blue-700',
    en_curso: 'bg-green-100 text-green-700',
    completado: 'bg-gray-100 text-gray-700',
  }

  if (eventos.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin vacaciones programadas</h3>
        <p className="text-sm text-gray-500">No hay vacaciones programadas para este año</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Empleado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Período</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Días</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Origen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {eventos.map(evento => (
              <tr key={evento.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 text-sm">
                    {evento.empleado?.apellido}, {evento.empleado?.nombre}
                  </p>
                  <p className="text-xs text-gray-500">Legajo: {evento.empleado?.legajo}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-gray-900">
                    {new Date(evento.fecha_inicio).toLocaleDateString('es-AR')} - {new Date(evento.fecha_fin).toLocaleDateString('es-AR')}
                  </p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-semibold text-gray-900">{evento.dias_habiles}</span>
                  <span className="text-xs text-gray-400 ml-1">háb.</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoColors[evento.estado] || 'bg-gray-100 text-gray-700'}`}>
                    {evento.estado.charAt(0).toUpperCase() + evento.estado.slice(1).replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-500">
                    {evento.origen === 'asignacion_masiva' ? '🏭 Parada planta' : '📝 Manual'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============ MODAL: ASIGNACIÓN MASIVA ============

function AsignacionMasivaModal({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void
  onSuccess: () => void 
}) {
  const [fechaInicio, setFechaInicio] = useState('2025-01-02')
  const [fechaFin, setFechaFin] = useState('2025-01-15')
  const [empleados, setEmpleados] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingEmpleados, setLoadingEmpleados] = useState(true)

  useEffect(() => {
    fetchEmpleadosPlanta()
  }, [])

  const fetchEmpleadosPlanta = async () => {
    setLoadingEmpleados(true)
    try {
      const res = await fetch('/api/sicamar/vacaciones/asignacion-masiva?solo_planta=true')
      const data = await res.json()
      if (data.empleados) {
        setEmpleados(data.empleados)
        // Seleccionar todos por defecto
        setSelectedIds(data.empleados.map((e: any) => e.id))
      }
    } catch (error) {
      console.error('Error fetching empleados:', error)
    } finally {
      setLoadingEmpleados(false)
    }
  }

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return

    setLoading(true)
    try {
      const res = await fetch('/api/sicamar/vacaciones/asignacion-masiva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_ids: selectedIds,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          asignado_por: 'Rocío Barrera', // TODO: usuario actual
          motivo: 'Parada de planta - Enero 2025'
        })
      })

      if (res.ok) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error en asignación masiva:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleAll = () => {
    if (selectedIds.length === empleados.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(empleados.map(e => e.id))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C4322F]/10 flex items-center justify-center">
                <Factory className="w-5 h-5 text-[#C4322F]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Asignación Masiva - Parada de Planta</h2>
                <p className="text-sm text-gray-500">Asignar vacaciones a empleados de planta</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C4322F]/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C4322F]/20"
              />
            </div>
          </div>

          {/* Lista de empleados */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Empleados a asignar ({selectedIds.length} de {empleados.length})
              </label>
              <button
                onClick={toggleAll}
                className="text-sm text-[#C4322F] hover:underline"
              >
                {selectedIds.length === empleados.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>

            {loadingEmpleados ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                {empleados.map(emp => (
                  <label
                    key={emp.id}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(emp.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds([...selectedIds, emp.id])
                        } else {
                          setSelectedIds(selectedIds.filter(id => id !== emp.id))
                        }
                      }}
                      className="w-4 h-4 text-[#C4322F] rounded border-gray-300 focus:ring-[#C4322F]"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{emp.apellido}, {emp.nombre}</p>
                      <p className="text-xs text-gray-500">Legajo: {emp.legajo} · {emp.sector || 'Sin sector'}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedIds.length === 0}
            className="px-4 py-2 text-sm bg-[#C4322F] text-white rounded-lg hover:bg-[#A52A27] disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Asignar a {selectedIds.length} empleados
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ MODAL: NUEVA SOLICITUD ============

function NuevaSolicitudModal({ 
  saldos,
  onClose, 
  onSuccess 
}: { 
  saldos: SaldoVacaciones[]
  onClose: () => void
  onSuccess: () => void 
}) {
  const [empleadoId, setEmpleadoId] = useState<number | null>(null)
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchEmpleado, setSearchEmpleado] = useState('')

  const empleadoSeleccionado = saldos.find(s => s.empleado_id === empleadoId)

  const filteredSaldos = saldos.filter(s => 
    s.nombre_completo.toLowerCase().includes(searchEmpleado.toLowerCase()) ||
    s.legajo.toLowerCase().includes(searchEmpleado.toLowerCase())
  )

  const handleSubmit = async () => {
    if (!empleadoId || !fechaInicio || !fechaFin) return

    setLoading(true)
    try {
      const res = await fetch('/api/sicamar/vacaciones/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_id: empleadoId,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          estado: 'pendiente_aprobacion',
          solicitado_por: 'Rocío Barrera', // TODO: usuario actual
          observaciones,
          origen: 'manual'
        })
      })

      if (res.ok) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error creando solicitud:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C4322F]/10 flex items-center justify-center">
                <CalendarRange className="w-5 h-5 text-[#C4322F]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Nueva Solicitud de Vacaciones</h2>
                <p className="text-sm text-gray-500">Crear solicitud para un empleado</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {/* Selección de empleado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empleado</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar empleado..."
                value={searchEmpleado}
                onChange={(e) => setSearchEmpleado(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C4322F]/20"
              />
            </div>
            {searchEmpleado && !empleadoId && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                {filteredSaldos.slice(0, 10).map(s => (
                  <button
                    key={s.empleado_id}
                    onClick={() => {
                      setEmpleadoId(s.empleado_id)
                      setSearchEmpleado(s.nombre_completo)
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <p className="text-sm font-medium text-gray-900">{s.nombre_completo}</p>
                    <p className="text-xs text-gray-500">Legajo: {s.legajo} · Disponible: {s.dias_corridos_disponibles} días</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info del empleado seleccionado */}
          {empleadoSeleccionado && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-900">{empleadoSeleccionado.nombre_completo}</p>
                  <p className="text-sm text-gray-500">Legajo: {empleadoSeleccionado.legajo}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#C4322F]">{empleadoSeleccionado.dias_corridos_disponibles}</p>
                  <p className="text-xs text-gray-500">días disponibles</p>
                </div>
              </div>
              {!empleadoSeleccionado.puede_pedir_dia_habil && (
                <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600">
                  ⚠️ Este empleado agotó sus días hábiles. Solo puede tomar días en bloque con fines de semana.
                </div>
              )}
            </div>
          )}

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C4322F]/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C4322F]/20"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones (opcional)</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Motivo o notas adicionales..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C4322F]/20 resize-none"
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !empleadoId || !fechaInicio || !fechaFin}
            className="px-4 py-2 text-sm bg-[#C4322F] text-white rounded-lg hover:bg-[#A52A27] disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear solicitud
          </button>
        </div>
      </div>
    </div>
  )
}
