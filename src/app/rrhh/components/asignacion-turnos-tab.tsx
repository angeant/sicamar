'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sun,
  Sunset,
  Moon,
  X,
  Save,
  Filter,
  ChevronDown,
  Building2,
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'

// ============ TIPOS ============

interface Empleado {
  id: number
  legajo: string
  nombre: string
  apellido: string
  nombre_completo: string
  categoria: string | null
  sector: string | null
  activo: boolean
  // Asignación actual
  bloque_id: number | null
  bloque_codigo: string | null
  bloque_nombre: string | null
  turno_fijo_id: number | null
  turno_fijo_codigo: string | null
  planta: string | null
}

// Tipo para respuesta de API de empleados con asignación
interface EmpleadoConAsignacion {
  empleado_id: number
  bloque_id: number | null
  bloque_codigo: string | null
  bloque_nombre: string | null
  turno_fijo: { id: number; codigo: string } | null
  planta: string | null
}

interface Bloque {
  id: number
  codigo: string
  nombre: string
  planta: string
  tipo_rotacion: string
  total_empleados: number
}

interface Turno {
  id: number
  codigo: string
  descripcion: string
  hora_entrada: string
  hora_salida: string
}

// ============ HELPERS ============

const turnoIcons: Record<string, typeof Sun> = {
  'MAÑANA': Sun,
  'TARDE': Sunset,
  'NOCHE': Moon,
  'CENTRAL': Sun,
}

const plantaLabels: Record<string, string> = {
  planta_1: 'Planta 1',
  planta_2: 'Planta 2',
  mantenimiento: 'Mantenimiento',
  administracion: 'Administración',
}

const contexto = {
  descripcion: 'Asignación de empleados a bloques de rotación. Cada empleado debe estar asignado a un bloque para poder calcular sus jornadas.',
  reglas: [
    'Cada empleado puede estar en un solo bloque a la vez',
    'Los bloques determinan qué turno tiene cada semana',
    'Empleados con turno fijo no rotan con el bloque',
    'La asignación queda vigente hasta que se cambie',
  ],
  flujo: [
    '1. Seleccionar empleados sin asignar',
    '2. Elegir el bloque de destino',
    '3. Opcionalmente asignar turno fijo',
    '4. Guardar la asignación',
  ],
  integraciones: [
    'Bloques de Rotación: Define la secuencia de turnos',
    'Jornadas: Usa la asignación para calcular horas',
  ],
  notas: [
    'Revisar que todos los empleados activos tengan asignación',
    'Los cambios de turno se reflejan inmediatamente',
  ],
}

// ============ COMPONENTE PRINCIPAL ============

export function AsignacionTurnosTab() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [bloques, setBloques] = useState<Bloque[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showContexto, setShowContexto] = useState(false)
  
  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [filtroAsignacion, setFiltroAsignacion] = useState<'todos' | 'sin_asignar' | 'asignados'>('sin_asignar')
  const [filtroPlanta, setFiltroPlanta] = useState<string>('todas')
  
  // Selección para asignación masiva
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  const [showAsignarModal, setShowAsignarModal] = useState(false)

  // Cargar datos
  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Cargar datos en paralelo
      const [empRes, blqRes, trnRes, sinAsignarRes] = await Promise.all([
        fetch('/api/sicamar/turnos/empleados?activos=true'),
        fetch('/api/sicamar/turnos/bloques'),
        fetch('/api/sicamar/turnos/lista'),
        fetch('/api/sicamar/empleados?activos=true'),
      ])
      
      const empData = await empRes.json()
      const blqData = await blqRes.json()
      const trnData = await trnRes.json()
      const sinAsignarData = await sinAsignarRes.json()
      
      // Combinar: empleados con asignación + empleados sin asignar
      const empleadosConAsignacion = empData.empleados || []
      const todosEmpleados = sinAsignarData.empleados || []
      
      // Crear mapa de empleados asignados
      const asignadosMap = new Map<number, EmpleadoConAsignacion>()
      for (const emp of empleadosConAsignacion) {
        asignadosMap.set(emp.empleado_id, emp)
      }
      
      // Combinar todos los empleados
      const empleadosCombinados: Empleado[] = todosEmpleados.map((emp: { id: number; legajo: string; nombre: string; apellido: string; categoria: string | null; sector: string | null; activo: boolean }) => {
        const asignacion = asignadosMap.get(emp.id)
        return {
          id: emp.id,
          legajo: emp.legajo,
          nombre: emp.nombre,
          apellido: emp.apellido,
          nombre_completo: `${emp.apellido}, ${emp.nombre}`,
          categoria: emp.categoria,
          sector: emp.sector,
          activo: emp.activo,
          bloque_id: asignacion?.bloque_id || null,
          bloque_codigo: asignacion?.bloque_codigo || null,
          bloque_nombre: asignacion?.bloque_nombre || null,
          turno_fijo_id: asignacion?.turno_fijo?.id || null,
          turno_fijo_codigo: asignacion?.turno_fijo?.codigo || null,
          planta: asignacion?.planta || null,
        }
      })
      
      setEmpleados(empleadosCombinados)
      setBloques(blqData.bloques || [])
      setTurnos(trnData.turnos || [])
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // Filtrar empleados
  const empleadosFiltrados = useMemo(() => {
    return empleados.filter(emp => {
      // Filtro de búsqueda
      if (busqueda) {
        const search = busqueda.toLowerCase()
        const match = emp.legajo.toLowerCase().includes(search) ||
          emp.nombre_completo.toLowerCase().includes(search) ||
          emp.categoria?.toLowerCase().includes(search) ||
          emp.sector?.toLowerCase().includes(search)
        if (!match) return false
      }
      
      // Filtro de asignación
      if (filtroAsignacion === 'sin_asignar' && emp.bloque_id) return false
      if (filtroAsignacion === 'asignados' && !emp.bloque_id) return false
      
      // Filtro de planta
      if (filtroPlanta !== 'todas') {
        if (!emp.planta || emp.planta !== filtroPlanta) return false
      }
      
      return true
    })
  }, [empleados, busqueda, filtroAsignacion, filtroPlanta])

  // Estadísticas
  const stats = useMemo(() => ({
    total: empleados.length,
    sinAsignar: empleados.filter(e => !e.bloque_id).length,
    asignados: empleados.filter(e => e.bloque_id).length,
  }), [empleados])

  // Selección
  const toggleSeleccion = (id: number) => {
    setSeleccionados(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const seleccionarTodos = () => {
    const ids = empleadosFiltrados.filter(e => !e.bloque_id).map(e => e.id)
    setSeleccionados(ids)
  }

  const deseleccionarTodos = () => {
    setSeleccionados([])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Asignación de Turnos</h2>
          <p className="text-sm text-gray-500">Asignar empleados a bloques de rotación</p>
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

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500">Total empleados</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
        </div>
        <div className={`rounded-lg p-4 ${stats.sinAsignar > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
          <p className={`text-xs ${stats.sinAsignar > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            Sin asignar
          </p>
          <p className={`text-2xl font-semibold ${stats.sinAsignar > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {stats.sinAsignar}
          </p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-xs text-blue-600">Asignados</p>
          <p className="text-2xl font-semibold text-blue-700">{stats.asignados}</p>
        </div>
      </div>

      {/* Alerta si hay sin asignar */}
      {stats.sinAsignar > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">
              {stats.sinAsignar} empleados sin turno asignado
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Estos empleados no podrán ser liquidados hasta que se les asigne un bloque de rotación.
            </p>
          </div>
        </div>
      )}

      {/* Filtros y acciones */}
      <div className="flex items-center justify-between gap-4 py-3 border-y border-gray-100">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar empleado..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </div>
          
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-gray-400" />
            {(['todos', 'sin_asignar', 'asignados'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltroAsignacion(f)}
                className={`px-2 py-1 text-xs rounded ${
                  filtroAsignacion === f ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {f === 'todos' ? 'Todos' : f === 'sin_asignar' ? 'Sin asignar' : 'Asignados'}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {seleccionados.length > 0 && (
            <>
              <span className="text-sm text-gray-500">
                {seleccionados.length} seleccionados
              </span>
              <button
                onClick={deseleccionarTodos}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Limpiar
              </button>
              <button
                onClick={() => setShowAsignarModal(true)}
                className="px-3 py-1.5 text-xs text-white bg-[#C4322F] hover:bg-[#A52A27] rounded flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Asignar a bloque
              </button>
            </>
          )}
          {seleccionados.length === 0 && filtroAsignacion === 'sin_asignar' && empleadosFiltrados.length > 0 && (
            <button
              onClick={seleccionarTodos}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200"
            >
              Seleccionar todos ({empleadosFiltrados.length})
            </button>
          )}
        </div>
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

      {/* Lista de empleados */}
      {!loading && empleadosFiltrados.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={seleccionados.length > 0 && seleccionados.length === empleadosFiltrados.filter(e => !e.bloque_id).length}
                    onChange={e => e.target.checked ? seleccionarTodos() : deseleccionarTodos()}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="text-left font-medium text-gray-600 px-3 py-2.5">Empleado</th>
                <th className="text-left font-medium text-gray-600 px-3 py-2.5 w-32">Categoría</th>
                <th className="text-left font-medium text-gray-600 px-3 py-2.5 w-32">Sector</th>
                <th className="text-left font-medium text-gray-600 px-3 py-2.5 w-48">Bloque asignado</th>
                <th className="text-center font-medium text-gray-600 px-3 py-2.5 w-24">Turno</th>
              </tr>
            </thead>
            <tbody>
              {empleadosFiltrados.map(emp => {
                const TurnoIcon = emp.turno_fijo_codigo ? turnoIcons[emp.turno_fijo_codigo] : null
                
                return (
                  <tr 
                    key={emp.id} 
                    className={`border-t border-gray-100 hover:bg-gray-50/50 ${
                      seleccionados.includes(emp.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-3 py-3">
                      {!emp.bloque_id && (
                        <input
                          type="checkbox"
                          checked={seleccionados.includes(emp.id)}
                          onChange={() => toggleSeleccion(emp.id)}
                          className="rounded border-gray-300"
                        />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                          {emp.legajo.slice(-2)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{emp.nombre_completo}</p>
                          <p className="text-xs text-gray-400">Leg. {emp.legajo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs">
                      {emp.categoria || '-'}
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs">
                      {emp.sector || '-'}
                    </td>
                    <td className="px-3 py-3">
                      {emp.bloque_id ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-gray-900 text-xs font-medium">{emp.bloque_nombre}</p>
                            <p className="text-gray-400 text-xs">{plantaLabels[emp.planta || ''] || emp.planta}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-amber-600 text-xs flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Sin asignar
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {emp.turno_fijo_codigo ? (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          {TurnoIcon && <TurnoIcon className="w-3.5 h-3.5" />}
                          {emp.turno_fijo_codigo}
                        </span>
                      ) : emp.bloque_id ? (
                        <span className="text-xs text-gray-400">Rotativo</span>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && empleadosFiltrados.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {filtroAsignacion === 'sin_asignar' 
              ? 'Todos los empleados tienen turno asignado'
              : 'No hay empleados que coincidan con el filtro'}
          </p>
        </div>
      )}

      {/* Modal asignar */}
      {showAsignarModal && (
        <AsignarBloqueModal
          empleadosIds={seleccionados}
          bloques={bloques}
          turnos={turnos}
          onClose={() => setShowAsignarModal(false)}
          onAsignado={() => {
            setShowAsignarModal(false)
            setSeleccionados([])
            cargarDatos()
          }}
        />
      )}

      {/* Contexto */}
      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Contexto: Asignación de Turnos"
        contenido={contexto}
      />
    </div>
  )
}

// ============ MODAL ASIGNAR BLOQUE ============

interface AsignarBloqueModalProps {
  empleadosIds: number[]
  bloques: Bloque[]
  turnos: Turno[]
  onClose: () => void
  onAsignado: () => void
}

function AsignarBloqueModal({ empleadosIds, bloques, turnos, onClose, onAsignado }: AsignarBloqueModalProps) {
  const [bloqueId, setBloqueId] = useState<number | ''>('')
  const [turnoFijoId, setTurnoFijoId] = useState<number | ''>('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const bloqueSeleccionado = bloques.find(b => b.id === bloqueId)

  const handleGuardar = async () => {
    if (!bloqueId) {
      setError('Selecciona un bloque')
      return
    }

    setGuardando(true)
    setError('')

    try {
      // Asignar cada empleado
      for (const empId of empleadosIds) {
        const response = await fetch('/api/sicamar/turnos/empleados', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empleado_id: empId,
            bloque_id: bloqueId,
            turno_fijo_id: turnoFijoId || null,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Error al asignar')
        }
      }

      onAsignado()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Asignar a Bloque</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {empleadosIds.length} empleado{empleadosIds.length > 1 ? 's' : ''} seleccionado{empleadosIds.length > 1 ? 's' : ''}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bloque de rotación *
            </label>
            <select
              value={bloqueId}
              onChange={e => setBloqueId(e.target.value ? parseInt(e.target.value) : '')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Seleccionar bloque...</option>
              {Object.entries(
                bloques.reduce((acc, b) => {
                  const p = b.planta || 'otros'
                  if (!acc[p]) acc[p] = []
                  acc[p].push(b)
                  return acc
                }, {} as Record<string, Bloque[]>)
              ).map(([planta, blqs]) => (
                <optgroup key={planta} label={plantaLabels[planta] || planta}>
                  {blqs.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.nombre} ({b.tipo_rotacion === 'fijo' ? 'Fijo' : b.tipo_rotacion === 'dos_turnos' ? '2T' : '3T'})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {bloqueSeleccionado && bloqueSeleccionado.tipo_rotacion !== 'fijo' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Turno fijo (opcional)
              </label>
              <select
                value={turnoFijoId}
                onChange={e => setTurnoFijoId(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Rotar con el bloque</option>
                {turnos.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.codigo} ({t.hora_entrada?.slice(0, 5)} - {t.hora_salida?.slice(0, 5)})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Si seleccionas un turno fijo, el empleado NO rotará con el bloque
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando || !bloqueId}
            className="px-4 py-2 text-sm text-white bg-[#C4322F] hover:bg-[#A52A27] rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {guardando ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {guardando ? 'Guardando...' : 'Asignar'}
          </button>
        </div>
      </div>
    </div>
  )
}

