'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  RefreshCw,
  Download,
  Filter,
  AlertCircle,
  CheckCircle2,
  Clock,
  Ban,
  Trash2,
  Edit,
  DollarSign,
  TrendingDown,
  Gift,
  Search,
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'

// ============ TIPOS ============

interface Novedad {
  id: number
  empleado_id: number
  legajo: number
  concepto_codigo: string
  concepto_descripcion: string | null
  tipo: 'haber' | 'retencion' | 'no_remunerativo'
  cantidad: number | null
  importe: number | null
  estado: 'pendiente' | 'aprobada' | 'procesada' | 'cancelada'
  motivo: string | null
  recurrente: boolean
  empleado_nombre?: string
  sector?: string
  created_at: string
}

interface TipoNovedad {
  id: number
  codigo: string
  descripcion: string
  tipo: 'haber' | 'retencion' | 'no_remunerativo'
  requiere_cantidad: boolean
  requiere_importe: boolean
  permite_recurrente: boolean
}

interface Resumen {
  total: number
  pendientes: number
  aprobadas: number
  procesadas: number
  total_haberes: number
  total_retenciones: number
}

// ============ HELPERS ============

const estadoConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pendiente: { label: 'Pendiente', color: 'text-amber-600 bg-amber-50', icon: Clock },
  aprobada: { label: 'Aprobada', color: 'text-blue-600 bg-blue-50', icon: CheckCircle2 },
  procesada: { label: 'Procesada', color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2 },
  cancelada: { label: 'Cancelada', color: 'text-gray-500 bg-gray-100', icon: Ban },
}

const tipoConfig: Record<string, { label: string; icon: typeof DollarSign; color: string }> = {
  haber: { label: 'Haber', icon: DollarSign, color: 'text-emerald-600' },
  retencion: { label: 'Retención', icon: TrendingDown, color: 'text-red-600' },
  no_remunerativo: { label: 'No Rem.', icon: Gift, color: 'text-blue-600' },
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  } catch {
    return dateStr
  }
}

const contextoNovedades = {
  descripcion: 'Gestión de novedades que afectan la liquidación: haberes adicionales, retenciones y conceptos no remunerativos.',
  reglas: [
    'Haberes: Suman al sueldo (gratificaciones, bonos, ajustes)',
    'Retenciones: Descuentos (embargos, préstamos)',
    'No remunerativos: No generan aportes (viáticos, viandas)',
    'Las novedades recurrentes se replican automáticamente cada mes',
  ],
  flujo: [
    '1. Se carga la novedad indicando empleado, concepto e importe',
    '2. Queda en estado "pendiente" hasta ser aprobada',
    '3. Al aprobar, se incluye en la próxima liquidación',
    '4. Después de liquidar, pasa a "procesada"',
  ],
  integraciones: [
    'Liquidación: Toma las novedades aprobadas',
    'Empleados: Asocia cada novedad a un legajo',
  ],
  notas: [
    'Los embargos tienen porcentaje máximo legal',
    'Se puede adjuntar documentación de respaldo',
  ],
}

// ============ COMPONENTE PRINCIPAL ============

export function NovedadesTab() {
  const [novedades, setNovedades] = useState<Novedad[]>([])
  const [tiposNovedad, setTiposNovedad] = useState<TipoNovedad[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showContexto, setShowContexto] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [showNueva, setShowNueva] = useState(false)

  // Cargar novedades
  const cargarNovedades = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (filtroEstado !== 'todos') params.append('estado', filtroEstado)
      if (filtroTipo !== 'todos') params.append('tipo', filtroTipo)

      const response = await fetch(`/api/sicamar/novedades?${params}`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Error al cargar')

      setNovedades(data.novedades || [])
      setResumen(data.resumen || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [filtroEstado, filtroTipo])

  // Cargar tipos de novedad
  const cargarTipos = useCallback(async () => {
    try {
      const response = await fetch('/api/sicamar/novedades?tipos=true')
      const data = await response.json()
      setTiposNovedad(data.tipos || [])
    } catch {
      // Silently fail
    }
  }, [])

  useEffect(() => {
    cargarNovedades()
    cargarTipos()
  }, [cargarNovedades, cargarTipos])

  // Aprobar novedad
  const aprobarNovedad = async (id: number) => {
    try {
      const response = await fetch('/api/sicamar/novedades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado: 'aprobada', aprobado_por: 'usuario' }),
      })
      if (!response.ok) throw new Error('Error al aprobar')
      await cargarNovedades()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  // Cancelar novedad
  const cancelarNovedad = async (id: number) => {
    if (!confirm('¿Cancelar esta novedad?')) return
    try {
      const response = await fetch('/api/sicamar/novedades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado: 'cancelada' }),
      })
      if (!response.ok) throw new Error('Error al cancelar')
      await cargarNovedades()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  // Eliminar novedad
  const eliminarNovedad = async (id: number) => {
    if (!confirm('¿Eliminar esta novedad? Esta acción no se puede deshacer.')) return
    try {
      const response = await fetch(`/api/sicamar/novedades?id=${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Error al eliminar')
      await cargarNovedades()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  // Filtrar por búsqueda
  const novedadesFiltradas = novedades.filter(n => {
    if (!busqueda) return true
    const search = busqueda.toLowerCase()
    return (
      n.empleado_nombre?.toLowerCase().includes(search) ||
      n.legajo.toString().includes(search) ||
      n.concepto_codigo.includes(search) ||
      n.concepto_descripcion?.toLowerCase().includes(search)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Novedades de Liquidación</h2>
          <p className="text-sm text-gray-500">Haberes, retenciones y conceptos adicionales</p>
        </div>
        <div className="flex items-center gap-2">
          <ContextoButton onClick={() => setShowContexto(true)} />
          <button
            onClick={() => setShowNueva(true)}
            className="px-3 py-1.5 text-xs text-white bg-[#C4322F] hover:bg-[#A52A27] rounded flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva novedad
          </button>
          <button
            onClick={cargarNovedades}
            disabled={loading}
            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4 py-3 border-y border-gray-100">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por empleado, legajo o concepto..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="flex-1 border-0 text-sm focus:ring-0 placeholder:text-gray-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {(['todos', 'pendiente', 'aprobada', 'procesada'] as const).map(est => (
            <button
              key={est}
              onClick={() => setFiltroEstado(est)}
              className={`px-2 py-1 text-xs rounded ${
                filtroEstado === est ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {est === 'todos' ? 'Todos' : estadoConfig[est]?.label || est}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
          {(['todos', 'haber', 'retencion', 'no_remunerativo'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={`px-2 py-1 text-xs rounded ${
                filtroTipo === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t === 'todos' ? 'Todos' : tipoConfig[t]?.label || t}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen */}
      {resumen && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500">Total novedades</p>
            <p className="text-2xl font-semibold text-gray-900">{resumen.total}</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4">
            <p className="text-xs text-amber-600">Pendientes</p>
            <p className="text-2xl font-semibold text-amber-700">{resumen.pendientes}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-xs text-blue-600">Aprobadas</p>
            <p className="text-2xl font-semibold text-blue-700">{resumen.aprobadas}</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4">
            <p className="text-xs text-emerald-600">Haberes</p>
            <p className="text-lg font-semibold text-emerald-700">{formatCurrency(resumen.total_haberes)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-xs text-red-600">Retenciones</p>
            <p className="text-lg font-semibold text-red-700">{formatCurrency(resumen.total_retenciones)}</p>
          </div>
        </div>
      )}

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

      {/* Tabla */}
      {!loading && novedadesFiltradas.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left font-medium text-gray-600 px-4 py-2.5">Empleado</th>
                <th className="text-left font-medium text-gray-600 px-4 py-2.5">Concepto</th>
                <th className="text-center font-medium text-gray-600 px-3 py-2.5 w-20">Tipo</th>
                <th className="text-right font-medium text-gray-600 px-4 py-2.5 w-28">Importe</th>
                <th className="text-center font-medium text-gray-600 px-3 py-2.5 w-24">Estado</th>
                <th className="text-center font-medium text-gray-600 px-3 py-2.5 w-24">Fecha</th>
                <th className="text-center font-medium text-gray-600 px-3 py-2.5 w-28">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {novedadesFiltradas.map(nov => {
                const TipoIcon = tipoConfig[nov.tipo]?.icon || DollarSign
                const EstadoIcon = estadoConfig[nov.estado]?.icon || Clock
                
                return (
                  <tr key={nov.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{nov.empleado_nombre || '-'}</p>
                      <p className="text-xs text-gray-400">Leg. {nov.legajo}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{nov.concepto_descripcion || nov.concepto_codigo}</p>
                      <p className="text-xs text-gray-400">Cód: {nov.concepto_codigo}</p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs ${tipoConfig[nov.tipo]?.color || 'text-gray-500'}`}>
                        <TipoIcon className="w-3.5 h-3.5" />
                        {tipoConfig[nov.tipo]?.label || nov.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {nov.cantidad ? (
                        <span className="text-gray-700">{nov.cantidad} hs</span>
                      ) : (
                        <span className={tipoConfig[nov.tipo]?.color || 'text-gray-700'}>
                          {formatCurrency(nov.importe)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${estadoConfig[nov.estado]?.color || 'bg-gray-100'}`}>
                        <EstadoIcon className="w-3 h-3" />
                        {estadoConfig[nov.estado]?.label || nov.estado}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-gray-500">
                      {formatDate(nov.created_at)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {nov.estado === 'pendiente' && (
                          <>
                            <button
                              onClick={() => aprobarNovedad(nov.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Aprobar"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => cancelarNovedad(nov.id)}
                              className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                              title="Cancelar"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => eliminarNovedad(nov.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {nov.estado !== 'pendiente' && (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && novedadesFiltradas.length === 0 && !error && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay novedades registradas</p>
          <button
            onClick={() => setShowNueva(true)}
            className="mt-3 text-sm text-[#C4322F] hover:underline"
          >
            Crear primera novedad
          </button>
        </div>
      )}

      {/* Modal nueva novedad (simplificado) */}
      {showNueva && (
        <NuevaNovedadModal
          tiposNovedad={tiposNovedad}
          onClose={() => setShowNueva(false)}
          onCreated={() => {
            setShowNueva(false)
            cargarNovedades()
          }}
        />
      )}

      {/* Modal contexto */}
      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Contexto: Novedades de Liquidación"
        contenido={contextoNovedades}
      />
    </div>
  )
}

// ============ MODAL NUEVA NOVEDAD ============

interface NuevaNovedadModalProps {
  tiposNovedad: TipoNovedad[]
  onClose: () => void
  onCreated: () => void
}

function NuevaNovedadModal({ tiposNovedad, onClose, onCreated }: NuevaNovedadModalProps) {
  const [legajo, setLegajo] = useState('')
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoNovedad | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [importe, setImporte] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleGuardar = async () => {
    if (!legajo || !tipoSeleccionado) {
      setError('Completa legajo y tipo de novedad')
      return
    }

    setGuardando(true)
    setError('')

    try {
      // Buscar empleado por legajo
      const empResponse = await fetch(`/api/sicamar/empleados?legajo=${legajo}`)
      const empData = await empResponse.json()
      
      if (!empData.empleados?.length) {
        setError('Empleado no encontrado')
        setGuardando(false)
        return
      }

      const empleado = empData.empleados[0]

      const response = await fetch('/api/sicamar/novedades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_id: empleado.id,
          legajo: parseInt(legajo),
          concepto_codigo: tipoSeleccionado.codigo,
          concepto_descripcion: tipoSeleccionado.descripcion,
          tipo: tipoSeleccionado.tipo,
          cantidad: cantidad ? parseFloat(cantidad) : null,
          importe: importe ? parseFloat(importe) : null,
          motivo,
          recurrente: false,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al guardar')
      }

      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Nueva Novedad</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Legajo</label>
            <input
              type="text"
              value={legajo}
              onChange={e => setLegajo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Ej: 1234"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de novedad</label>
            <select
              value={tipoSeleccionado?.id || ''}
              onChange={e => {
                const tipo = tiposNovedad.find(t => t.id === parseInt(e.target.value))
                setTipoSeleccionado(tipo || null)
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              <optgroup label="Haberes">
                {tiposNovedad.filter(t => t.tipo === 'haber').map(t => (
                  <option key={t.id} value={t.id}>{t.codigo} - {t.descripcion}</option>
                ))}
              </optgroup>
              <optgroup label="Retenciones">
                {tiposNovedad.filter(t => t.tipo === 'retencion').map(t => (
                  <option key={t.id} value={t.id}>{t.codigo} - {t.descripcion}</option>
                ))}
              </optgroup>
              <optgroup label="No Remunerativos">
                {tiposNovedad.filter(t => t.tipo === 'no_remunerativo').map(t => (
                  <option key={t.id} value={t.id}>{t.codigo} - {t.descripcion}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {tipoSeleccionado?.requiere_cantidad && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad (horas)</label>
              <input
                type="number"
                step="0.5"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          {tipoSeleccionado?.requiere_importe !== false && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Importe</label>
              <input
                type="number"
                step="0.01"
                value={importe}
                onChange={e => setImporte(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              rows={2}
            />
          </div>

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
            disabled={guardando}
            className="px-4 py-2 text-sm text-white bg-[#C4322F] hover:bg-[#A52A27] rounded-lg disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
