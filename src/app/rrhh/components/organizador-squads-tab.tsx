'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users,
  UserPlus,
  UserMinus,
  GripVertical,
  Sun,
  Sunset,
  Moon,
  ChevronLeft,
  ChevronRight,
  Check,
  Send,
  AlertCircle,
  RefreshCw,
  Calendar,
  Building2,
  Star,
  X,
  Plus,
  Filter,
  Search,
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'
import { EmpleadoAvatar } from './empleado-avatar'

// ============ TIPOS ============

interface EstadoEmpleado {
  tipo_estado: string
  estado_nombre: string
  estado_color: string
  fecha_inicio: string
  fecha_fin: string | null
}

interface Empleado {
  id: number
  legajo: string
  nombre: string
  apellido: string
  categoria: string | null
  sector: string | null
  estado?: EstadoEmpleado | null
  foto_url?: string | null
  foto_thumb_url?: string | null
}

interface GrupoMiembro {
  id: number
  empleado_id: number
  es_lider: boolean
  empleado: Empleado
}

interface Grupo {
  id: number
  codigo: string
  nombre: string
  color: string
  orden: number
  bloque_id: number
  bloque?: {
    id: number
    nombre: string
    planta: string
    tipo_rotacion: string
  }
  miembros: GrupoMiembro[]
  total_miembros: number
}

interface Turno {
  id: number
  codigo: string
  descripcion: string
  hora_entrada: string | null
  hora_salida: string | null
}

interface GrupoSemana {
  grupo_id: number
  grupo_codigo: string
  grupo_nombre: string
  grupo_color: string
  bloque_id: number
  bloque_nombre: string
  turno_id: number
  turno_codigo: string
  turno_descripcion: string
  hora_entrada: string | null
  hora_salida: string | null
  estado: 'proyectado' | 'confirmado' | 'ejecutado'
  confirmado_at: string | null
}

interface SemanaCalendario {
  semana_inicio: string
  semana_numero: number
  grupos: GrupoSemana[]
}

// ============ HELPERS ============

const turnoIcons: Record<string, typeof Sun> = {
  'MAÑANA': Sun,
  'TARDE': Sunset,
  'NOCHE': Moon,
  'CENTRAL': Sun,
}

// Badge de estado del empleado
function EstadoBadge({ estado }: { estado: EstadoEmpleado | null | undefined }) {
  if (!estado) return null
  
  return (
    <span 
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide"
      style={{ 
        backgroundColor: `${estado.estado_color}20`,
        color: estado.estado_color
      }}
      title={`${estado.estado_nombre} - Desde ${estado.fecha_inicio}${estado.fecha_fin ? ` hasta ${estado.fecha_fin}` : ''}`}
    >
      {estado.tipo_estado}
    </span>
  )
}

const turnoColors: Record<string, string> = {
  'MAÑANA': 'bg-gray-50 text-gray-700 border-gray-200',
  'TARDE': 'bg-gray-100 text-gray-700 border-gray-200',
  'NOCHE': 'bg-gray-200 text-gray-800 border-gray-300',
  'CENTRAL': 'bg-gray-50 text-gray-700 border-gray-200',
}

const plantaLabels: Record<string, string> = {
  planta_1: 'Planta 1',
  planta_2: 'Planta 2',
  mantenimiento: 'Mantenimiento',
  administracion: 'Administración',
}

function formatFecha(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

function formatSemana(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const fin = new Date(d)
  fin.setDate(fin.getDate() + 6)
  return `${d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} - ${fin.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}`
}

const contexto = {
  descripcion: 'Organizador de Squads: Gestiona los grupos de trabajo que rotan juntos. Arrastra empleados entre grupos y confirma turnos semanales.',
  reglas: [
    'Los grupos rotan como unidad - todos en el grupo tienen el mismo turno',
    'Hay 3 tipos de rotación: 3 turnos (M-T-N), 2 turnos (M-T) y Fijo',
    'Al confirmar una semana, se notifica a cada miembro del grupo',
    'Los líderes de grupo aparecen con estrella dorada',
  ],
  flujo: [
    '1. Crear/editar grupos dentro de cada bloque',
    '2. Arrastrar empleados a sus grupos',
    '3. Revisar proyección de turnos semanales',
    '4. Confirmar semana para activar notificaciones',
  ],
  integraciones: [
    'Marcaciones: Se validan contra el turno del grupo',
    'Jornadas: Se calculan según el turno asignado',
    'Notificaciones: Se envían al confirmar semana',
  ],
  notas: [
    'El color de cada grupo facilita identificación visual',
    'La proyección se calcula automáticamente según el tipo de rotación',
  ],
}

// ============ COMPONENTE PRINCIPAL ============

export function OrganizadorSquadsTab() {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [empleadosSinGrupo, setEmpleadosSinGrupo] = useState<Empleado[]>([])
  const [calendario, setCalendario] = useState<SemanaCalendario[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showContexto, setShowContexto] = useState(false)
  
  // Vista
  const [vista, setVista] = useState<'grupos' | 'calendario'>('grupos')
  const [filtroPlanta, setFiltroPlanta] = useState<string>('todas')
  const [busqueda, setBusqueda] = useState('')
  
  // Drag & Drop
  const [draggingEmpleado, setDraggingEmpleado] = useState<Empleado | null>(null)
  const [dragOverGrupo, setDragOverGrupo] = useState<number | null>(null)
  
  // Confirmar semana
  const [semanaSeleccionada, setSemanaSeleccionada] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  // Cargar datos
  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [gruposRes, empRes, calRes, estadosRes] = await Promise.all([
        fetch('/api/sicamar/grupos?incluir_miembros=true'),
        fetch('/api/sicamar/empleados?activos=true'),
        fetch('/api/sicamar/grupos/semanas?semanas_adelante=6'),
        fetch('/api/sicamar/empleados/estados?vigentes=true'),
      ])

      const gruposData = await gruposRes.json()
      const empData = await empRes.json()
      const calData = await calRes.json()
      const estadosData = await estadosRes.json()

      // Crear mapa de estados por empleado_id
      const estadosMap = new Map<number, EstadoEmpleado>()
      for (const est of estadosData || []) {
        estadosMap.set(est.empleado_id, {
          tipo_estado: est.tipo_estado,
          estado_nombre: est.tipos_estado_empleado?.nombre || est.tipo_estado,
          estado_color: est.tipos_estado_empleado?.color || '#6B7280',
          fecha_inicio: est.fecha_inicio,
          fecha_fin: est.fecha_fin,
        })
      }

      // Agregar estado a los miembros de grupos
      const gruposConEstado = (gruposData.grupos || []).map((g: Grupo) => ({
        ...g,
        miembros: (g.miembros || []).map((m: GrupoMiembro) => ({
          ...m,
          empleado: {
            ...m.empleado,
            estado: estadosMap.get(m.empleado?.id || m.empleado_id) || null
          }
        }))
      }))
      
      setGrupos(gruposConEstado)
      setCalendario(calData.calendario || [])
      setTurnos(calData.turnos || [])

      // Encontrar empleados sin grupo
      const empleadosEnGrupos = new Set<number>()
      for (const g of gruposConEstado) {
        for (const m of g.miembros || []) {
          empleadosEnGrupos.add(m.empleado_id)
        }
      }
      
      // Agregar estado a empleados sin grupo
      const sinGrupo = (empData.empleados || [])
        .filter((e: Empleado) => !empleadosEnGrupos.has(e.id))
        .map((e: Empleado) => ({
          ...e,
          estado: estadosMap.get(e.id) || null
        }))
      setEmpleadosSinGrupo(sinGrupo)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // Agrupar grupos por planta
  const gruposPorPlanta = useMemo(() => {
    const result: Record<string, Grupo[]> = {}
    for (const g of grupos) {
      const planta = g.bloque?.planta || 'otros'
      if (filtroPlanta !== 'todas' && planta !== filtroPlanta) continue
      if (!result[planta]) result[planta] = []
      result[planta].push(g)
    }
    return result
  }, [grupos, filtroPlanta])

  // Empleados filtrados
  const empleadosFiltrados = useMemo(() => {
    if (!busqueda) return empleadosSinGrupo
    const search = busqueda.toLowerCase()
    return empleadosSinGrupo.filter(e =>
      e.legajo.toLowerCase().includes(search) ||
      e.nombre.toLowerCase().includes(search) ||
      e.apellido.toLowerCase().includes(search)
    )
  }, [empleadosSinGrupo, busqueda])

  // Drag handlers
  const handleDragStart = (empleado: Empleado) => {
    setDraggingEmpleado(empleado)
  }

  const handleDragOver = (e: React.DragEvent, grupoId: number) => {
    e.preventDefault()
    setDragOverGrupo(grupoId)
  }

  const handleDragLeave = () => {
    setDragOverGrupo(null)
  }

  const handleDrop = async (grupoId: number) => {
    if (!draggingEmpleado) return

    try {
      const res = await fetch('/api/sicamar/grupos/miembros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grupo_id: grupoId,
          empleado_id: draggingEmpleado.id,
          es_lider: false,
        }),
      })

      if (res.ok) {
        await cargarDatos()
      }
    } catch (err) {
      console.error('Error al mover empleado:', err)
    }

    setDraggingEmpleado(null)
    setDragOverGrupo(null)
  }

  const handleRemoverMiembro = async (empleadoId: number) => {
    try {
      const res = await fetch(`/api/sicamar/grupos/miembros?empleado_id=${empleadoId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await cargarDatos()
      }
    } catch (err) {
      console.error('Error al remover miembro:', err)
    }
  }

  // Confirmar semana
  const handleConfirmarSemana = async (semanaInicio: string) => {
    setConfirmando(true)
    try {
      const semana = calendario.find(s => s.semana_inicio === semanaInicio)
      if (!semana) return

      const asignaciones = semana.grupos.map(g => ({
        grupo_id: g.grupo_id,
        turno_id: g.turno_id,
      }))

      const res = await fetch('/api/sicamar/grupos/semanas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semana_inicio: semanaInicio,
          asignaciones,
          usuario: 'admin', // TODO: obtener usuario actual
        }),
      })

      if (res.ok) {
        await cargarDatos()
        setSemanaSeleccionada(null)
      }
    } catch (err) {
      console.error('Error al confirmar semana:', err)
    } finally {
      setConfirmando(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Organizador de Squads</h2>
          <p className="text-sm text-gray-500">Gestiona grupos de trabajo y turnos semanales</p>
        </div>
        <div className="flex items-center gap-2">
          <ContextoButton onClick={() => setShowContexto(true)} />
          <button
            onClick={cargarDatos}
            disabled={loading}
            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs de vista */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => setVista('grupos')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              vista === 'grupos'
                ? 'border-[#C4322F] text-[#C4322F]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 inline-block mr-2" />
            Grupos
          </button>
          <button
            onClick={() => setVista('calendario')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              vista === 'calendario'
                ? 'border-[#C4322F] text-[#C4322F]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar className="w-4 h-4 inline-block mr-2" />
            Calendario Semanal
          </button>
        </div>

        {vista === 'grupos' && (
          <div className="flex items-center gap-2 pb-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filtroPlanta}
              onChange={e => setFiltroPlanta(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1"
            >
              <option value="todas">Todas las plantas</option>
              <option value="planta_1">Planta 1</option>
              <option value="planta_2">Planta 2</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="administracion">Administración</option>
            </select>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      )}

      {/* Vista Grupos */}
      {!loading && vista === 'grupos' && (
        <div className="flex gap-6">
          {/* Panel izquierdo: Empleados sin grupo */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900 text-sm">
                  Sin asignar ({empleadosSinGrupo.length})
                </h3>
              </div>
              
              <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg"
                />
              </div>

              <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                {empleadosFiltrados.map(emp => (
                  <div
                    key={emp.id}
                    draggable
                    onDragStart={() => handleDragStart(emp)}
                    className="bg-white rounded-lg border border-gray-200 p-2 cursor-grab hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-2"
                  >
                    <GripVertical className="w-3 h-3 text-gray-300" />
                    <EmpleadoAvatar 
                      foto_url={emp.foto_url}
                      foto_thumb_url={emp.foto_thumb_url}
                      nombre={emp.nombre}
                      apellido={emp.apellido}
                      legajo={emp.legajo}
                      size="xs"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {emp.apellido}, {emp.nombre}
                        </p>
                        <EstadoBadge estado={emp.estado} />
                      </div>
                      <p className="text-[10px] text-gray-400 truncate">
                        {emp.sector || emp.categoria || 'Sin sector'}
                      </p>
                    </div>
                  </div>
                ))}
                {empleadosFiltrados.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">
                    {busqueda ? 'Sin resultados' : 'Todos asignados'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Panel derecho: Grupos */}
          <div className="flex-1 space-y-6">
            {Object.entries(gruposPorPlanta).map(([planta, gruposPlanta]) => (
              <div key={planta}>
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <h3 className="font-medium text-gray-700">
                    {plantaLabels[planta] || planta}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {gruposPlanta.length} grupos
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gruposPlanta.map(grupo => (
                    <GrupoCard
                      key={grupo.id}
                      grupo={grupo}
                      isDragOver={dragOverGrupo === grupo.id}
                      onDragOver={e => handleDragOver(e, grupo.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={() => handleDrop(grupo.id)}
                      onRemoverMiembro={handleRemoverMiembro}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vista Calendario */}
      {!loading && vista === 'calendario' && (
        <CalendarioSemanal
          calendario={calendario}
          turnos={turnos}
          grupos={grupos}
          onConfirmar={handleConfirmarSemana}
          confirmando={confirmando}
        />
      )}

      {/* Contexto Modal */}
      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Contexto: Organizador de Squads"
        contenido={contexto}
      />
    </div>
  )
}

// ============ COMPONENTE GRUPO CARD ============

interface GrupoCardProps {
  grupo: Grupo
  isDragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: () => void
  onRemoverMiembro: (empleadoId: number) => void
}

function GrupoCard({
  grupo,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemoverMiembro,
}: GrupoCardProps) {
  const tipoRotacion = grupo.bloque?.tipo_rotacion === 'tres_turnos' 
    ? '3T' 
    : grupo.bloque?.tipo_rotacion === 'dos_turnos' 
      ? '2T' 
      : 'F'

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`bg-white rounded-xl border-2 transition-all ${
        isDragOver 
          ? 'border-[#C4322F] bg-red-50/30 shadow-lg' 
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Header */}
      <div 
        className="px-3 py-2 border-b rounded-t-xl"
        style={{ backgroundColor: `${grupo.color}15` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: grupo.color }}
            />
            <span className="font-medium text-gray-900 text-sm">
              {grupo.nombre}
            </span>
          </div>
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
            {tipoRotacion}
          </span>
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {grupo.bloque?.nombre}
        </p>
      </div>

      {/* Miembros */}
      <div className="p-2 space-y-1 min-h-[80px]">
        {grupo.miembros.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-gray-400">
            <p className="text-xs">Arrastra empleados aquí</p>
          </div>
        ) : (
          grupo.miembros.map(m => (
            <div
              key={m.id}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 group"
            >
              {m.es_lider && (
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              )}
              <EmpleadoAvatar 
                foto_url={m.empleado.foto_url}
                foto_thumb_url={m.empleado.foto_thumb_url}
                nombre={m.empleado.nombre}
                apellido={m.empleado.apellido}
                legajo={m.empleado.legajo}
                size="xs"
                className="w-5 h-5"
              />
              <span className="flex-1 text-xs text-gray-700 truncate">
                {m.empleado.apellido}
              </span>
              <EstadoBadge estado={m.empleado.estado} />
              <button
                onClick={() => onRemoverMiembro(m.empleado_id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded transition-opacity"
              >
                <X className="w-3 h-3 text-red-500" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">
            {grupo.miembros.length} miembros
          </span>
          <button className="text-[10px] text-[#C4322F] hover:underline">
            + Agregar
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ COMPONENTE CALENDARIO SEMANAL ============

interface CalendarioSemanalProps {
  calendario: SemanaCalendario[]
  turnos: Turno[]
  grupos: Grupo[]
  onConfirmar: (semana: string) => void
  confirmando: boolean
}

// Días de la semana
const diasSemana = [
  { key: 'dom', label: 'Domingo', short: 'Dom' },
  { key: 'lun', label: 'Lunes', short: 'Lun' },
  { key: 'mar', label: 'Martes', short: 'Mar' },
  { key: 'mie', label: 'Miércoles', short: 'Mié' },
  { key: 'jue', label: 'Jueves', short: 'Jue' },
  { key: 'vie', label: 'Viernes', short: 'Vie' },
  { key: 'sab', label: 'Sábado', short: 'Sáb' },
]

// Feriados de diciembre 2025 (ejemplo)
const feriados: Record<string, string> = {
  '2025-12-08': 'Inmaculada Concepción',
  '2025-12-25': 'Navidad',
}

function CalendarioSemanal({
  calendario,
  turnos,
  grupos,
  onConfirmar,
  confirmando,
}: CalendarioSemanalProps) {
  const [semanaIdx, setSemanaIdx] = useState(0)
  const semana = calendario[semanaIdx]

  if (!semana) {
    return (
      <div className="text-center py-12 text-gray-500">
        No hay datos de calendario
      </div>
    )
  }

  // Generar los 7 días de la semana (domingo a sábado)
  const lunesDate = new Date(semana.semana_inicio + 'T00:00:00')
  // Ajustar para que empiece en domingo (el lunes - 1 día)
  const domingoDate = new Date(lunesDate)
  domingoDate.setDate(domingoDate.getDate() - 1)
  
  const diasDeLaSemana = diasSemana.map((dia, idx) => {
    const fecha = new Date(domingoDate)
    fecha.setDate(fecha.getDate() + idx)
    const fechaStr = fecha.toISOString().split('T')[0]
    const esFeriado = feriados[fechaStr]
    const esHoy = fechaStr === new Date().toISOString().split('T')[0]
    const esDomingo = idx === 0
    const esSabado = idx === 6
    
    return {
      ...dia,
      fecha,
      fechaStr,
      fechaDisplay: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
      esFeriado,
      esHoy,
      esDomingo,
      esSabado,
    }
  })

  // Agrupar grupos por turno
  const gruposPorTurno: Record<string, GrupoSemana[]> = {
    'MAÑANA': [],
    'TARDE': [],
    'NOCHE': [],
  }
  
  for (const g of semana.grupos) {
    const turnoKey = g.turno_codigo || 'OTRO'
    if (gruposPorTurno[turnoKey]) {
      gruposPorTurno[turnoKey].push(g)
    }
  }

  const esConfirmada = semana.grupos.every(g => g.estado === 'confirmado')
  const esSemanaActual = semanaIdx === 0

  // Componente de celda de turno
  const CeldaTurno = ({ 
    turnoKey, 
    dia, 
    compact = false 
  }: { 
    turnoKey: string
    dia: typeof diasDeLaSemana[0]
    compact?: boolean 
  }) => {
    const gruposTurno = gruposPorTurno[turnoKey] || []
    const TurnoIcon = turnoIcons[turnoKey] || Sun
    
    // Casos especiales
    const esDomingoNoche = dia.esDomingo && turnoKey === 'NOCHE'
    const esDomingoMañana = dia.esDomingo && turnoKey === 'MAÑANA'
    const noTrabaja = dia.esSabado && turnoKey === 'NOCHE'
    
    // En domingo mañana no hay producción normal (solo arranque si es noche)
    const esArranqueHornos = esDomingoNoche
    
    return (
      <div 
        className={`min-h-[60px] p-1.5 border-r border-b border-gray-100 h-full ${
          dia.esFeriado ? 'bg-red-50/30' : 
          dia.esHoy ? 'bg-gray-50' : 
          dia.esDomingo || dia.esSabado ? 'bg-gray-50/50' : ''
        }`}
      >
        {noTrabaja ? (
          <div className="h-full flex items-center justify-center">
            <span className="text-[10px] text-gray-300">—</span>
          </div>
        ) : esArranqueHornos ? (
          <div className="h-full flex flex-col items-center justify-center">
            <span className="text-[9px] font-medium text-gray-600">Arranque</span>
            <span className="text-[8px] text-gray-400">00:00</span>
          </div>
        ) : esDomingoMañana ? (
          <div className="h-full flex items-center justify-center">
            <span className="text-[9px] text-gray-400">—</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {gruposTurno.slice(0, compact ? 3 : 4).map(g => {
              const grupoFull = grupos.find(gr => gr.id === g.grupo_id)
              return (
                <div
                  key={g.grupo_id}
                  className="text-[9px] truncate text-gray-600 flex items-center gap-1"
                  title={`${g.grupo_nombre} - ${grupoFull?.miembros.length || 0} miembros`}
                >
                  <span 
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: g.grupo_color }}
                  />
                  <span>{g.grupo_nombre.split(' ')[0]}</span>
                </div>
              )
            })}
            {gruposTurno.length > (compact ? 3 : 4) && (
              <span className="text-[8px] text-gray-400">+{gruposTurno.length - (compact ? 3 : 4)}</span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Navegación semanas */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
        <button
          onClick={() => setSemanaIdx(Math.max(0, semanaIdx - 1))}
          disabled={semanaIdx === 0}
          className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">
            Semana del {diasDeLaSemana[1].fechaDisplay} al {diasDeLaSemana[6].fechaDisplay}
          </p>
          <div className="flex items-center justify-center gap-2 mt-1">
            {esSemanaActual && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                Semana actual
              </span>
            )}
            {esConfirmada ? (
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" />
                Confirmada
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                Proyectada
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setSemanaIdx(Math.min(calendario.length - 1, semanaIdx + 1))}
          disabled={semanaIdx === calendario.length - 1}
          className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-6 text-[11px] text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-gray-400" />
          <span>Domingo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-gray-300" />
          <span>Sábado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span>Feriado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-gray-900" />
          <span>Hoy</span>
        </div>
      </div>

      {/* Grilla semanal */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          {/* Header de días */}
          <thead>
            <tr className="border-b border-gray-200">
              <th className="p-2 bg-gray-50 border-r border-gray-200 w-24">
                <span className="text-xs font-medium text-gray-500">Turno</span>
              </th>
              {diasDeLaSemana.map(dia => (
                <th 
                  key={dia.key}
                  className={`p-2 text-center border-r border-gray-100 last:border-r-0 w-[100px] ${
                    dia.esFeriado ? 'bg-red-50/50' : 
                    dia.esHoy ? 'bg-gray-100' :
                    dia.esDomingo || dia.esSabado ? 'bg-gray-50' : 'bg-white'
                  }`}
                >
                  <p className={`text-[11px] font-medium uppercase tracking-wide ${
                    dia.esFeriado ? 'text-red-600' :
                    dia.esHoy ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {dia.short}
                  </p>
                  <p className={`text-sm font-semibold ${
                    dia.esHoy ? 'text-gray-900' : 'text-gray-700'
                  }`}>
                    {dia.fecha.getDate()}
                  </p>
                  {dia.esFeriado && (
                    <p className="text-[9px] text-red-500 mt-0.5">Feriado</p>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {/* Filas por turno */}
          <tbody>
            {['MAÑANA', 'TARDE', 'NOCHE'].map(turnoKey => {
              const TurnoIcon = turnoIcons[turnoKey] || Sun
              
              return (
                <tr key={turnoKey}>
                  {/* Header del turno */}
                  <td className={`p-2 border-r border-b border-gray-200 ${turnoColors[turnoKey] || 'bg-gray-100'}`}>
                    <div className="flex items-center gap-1.5">
                      <TurnoIcon className="w-4 h-4" />
                      <div>
                        <p className="text-xs font-semibold">{turnoKey}</p>
                        <p className="text-[9px] opacity-75">
                          {turnoKey === 'NOCHE' && '22:00-06:00'}
                          {turnoKey === 'MAÑANA' && '06:00-14:00'}
                          {turnoKey === 'TARDE' && '14:00-22:00'}
                        </p>
                      </div>
                    </div>
                  </td>
                  
                  {/* Celdas por día */}
                  {diasDeLaSemana.map(dia => (
                    <td key={`${turnoKey}-${dia.key}`}>
                      <CeldaTurno 
                        turnoKey={turnoKey} 
                        dia={dia}
                        compact={true}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Nota sobre domingo */}
      <div className="border-l-2 border-gray-300 pl-3 py-1 text-xs text-gray-500">
        <span className="font-medium">Domingo noche:</span> Arranque hornos 00:00. Producción inicia lunes 06:00.
      </div>

      {/* Resumen de grupos por turno */}
      <div className="flex gap-8 text-xs text-gray-500 border-t border-gray-100 pt-4">
        {['MAÑANA', 'TARDE', 'NOCHE'].map(turnoKey => {
          const gruposTurno = gruposPorTurno[turnoKey] || []
          const totalPersonas = gruposTurno.reduce((acc, g) => {
            const grupoFull = grupos.find(gr => gr.id === g.grupo_id)
            return acc + (grupoFull?.miembros.length || 0)
          }, 0)
          
          return (
            <div key={turnoKey} className="flex items-center gap-2">
              <span className="font-medium text-gray-700">{turnoKey}:</span>
              <span>{gruposTurno.length} grupos</span>
              <span className="text-gray-300">·</span>
              <span>{totalPersonas} personas</span>
            </div>
          )
        })}
      </div>

      {/* Botón confirmar */}
      {!esConfirmada && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => onConfirmar(semana.semana_inicio)}
            disabled={confirmando}
            className="px-6 py-3 bg-[#C4322F] hover:bg-[#A52A27] text-white rounded-xl font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            {confirmando ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            Confirmar Turnos de Esta Semana
          </button>
        </div>
      )}

      {esConfirmada && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-green-800 font-medium">Semana confirmada</p>
          <p className="text-green-600 text-sm">Las notificaciones fueron enviadas a todos los miembros</p>
        </div>
      )}
    </div>
  )
}

