'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  RefreshCw,
  Download,
  Filter,
  Sun,
  Moon,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Calculator
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'

// ============ TIPOS ============

interface Jornada {
  id: number
  empleado_id: number
  legajo: string
  nombre: string
  apellido: string
  nombre_completo: string
  categoria: string | null
  sector: string | null
  fecha: string
  turno_codigo: string | null
  hora_entrada_real: string | null
  hora_salida_real: string | null
  minutos_trabajados: number
  horas_hd: number
  horas_hn: number
  horas_ex_50_d: number
  horas_ex_50_n: number
  horas_ex_100: number
  horas_trabajadas: number
  estado: string
  tiene_tardanza: boolean
  tiene_salida_anticipada: boolean
  es_feriado: boolean
}

interface Resumen {
  total_jornadas: number
  dias_trabajados: number
  dias_ausentes: number
  total_horas_hd: number
  total_horas_hn: number
  total_horas_ex: number
  total_horas: number
  tardanzas: number
}

// ============ HELPERS ============

function formatHora(hora: string | null): string {
  if (!hora) return '-'
  try {
    const date = new Date(hora)
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return hora
  }
}

function formatNumber(num: number, decimals: number = 1): string {
  return num.toFixed(decimals)
}

const estadoConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  completa: { label: 'Completa', color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2 },
  tardanza: { label: 'Tardanza', color: 'text-amber-600 bg-amber-50', icon: AlertTriangle },
  ausente: { label: 'Ausente', color: 'text-red-600 bg-red-50', icon: AlertCircle },
}

const contextoAsistencia = {
  descripcion: 'Control de jornadas calculadas a partir de marcaciones y turnos asignados. Muestra horas trabajadas clasificadas por tipo.',
  reglas: [
    'HD (Hora Diurna): 06:00 a 21:00',
    'HN (Hora Nocturna): 21:00 a 06:00, adicional 13%',
    'EX 50%: Horas extra de lunes a sábado hasta 13hs',
    'EX 100%: Domingos, feriados y sábado después de 13hs',
    'Tardanza: Ingreso > 15 minutos después del horario',
    'Ausente: Sin marcaciones registradas',
  ],
  flujo: [
    '1. El sistema obtiene las marcaciones del reloj biométrico',
    '2. Cruza con el turno asignado del empleado',
    '3. Calcula minutos trabajados y los clasifica por tipo',
    '4. Detecta tardanzas y ausencias',
    '5. Los datos se usan luego en la liquidación',
  ],
  integraciones: [
    'Turnos: Define horario esperado de cada empleado',
    'Marcaciones: Fuente de datos de entrada/salida',
    'Liquidación: Usa las horas para calcular haberes',
  ],
  notas: [
    'Se pueden recalcular las jornadas si cambian marcaciones',
    'Las ausencias justificadas se marcan desde Novedades',
  ],
}

// ============ COMPONENTE PRINCIPAL ============

export function AsistenciaTab() {
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0])
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showContexto, setShowContexto] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [calculando, setCalculando] = useState(false)

  // Cargar jornadas
  const cargarJornadas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        limit: '500',
      })
      if (filtroEstado !== 'todos') {
        params.append('estado', filtroEstado)
      }

      const response = await fetch(`/api/sicamar/jornadas?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar jornadas')
      }

      setJornadas(data.jornadas || [])
      setResumen(data.resumen || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setJornadas([])
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta, filtroEstado])

  useEffect(() => {
    cargarJornadas()
  }, [cargarJornadas])

  // Calcular jornadas
  const calcularJornadas = async () => {
    setCalculando(true)
    try {
      const response = await fetch('/api/sicamar/jornadas/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Error al calcular')
      }

      // Recargar datos
      await cargarJornadas()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al calcular')
    } finally {
      setCalculando(false)
    }
  }

  // Navegación rápida de fechas
  const moverPeriodo = (dias: number) => {
    const desde = new Date(fechaDesde)
    const hasta = new Date(fechaHasta)
    desde.setDate(desde.getDate() + dias)
    hasta.setDate(hasta.getDate() + dias)
    setFechaDesde(desde.toISOString().split('T')[0])
    setFechaHasta(hasta.toISOString().split('T')[0])
  }

  // Agrupar jornadas por empleado para vista resumen
  const jornadasPorEmpleado = jornadas.reduce((acc, j) => {
    const key = j.empleado_id
    if (!acc[key]) {
      acc[key] = {
        empleado_id: j.empleado_id,
        legajo: j.legajo,
        nombre_completo: j.nombre_completo,
        sector: j.sector,
        jornadas: [],
        totales: {
          hd: 0, hn: 0, ex_50_d: 0, ex_50_n: 0, ex_100: 0, total: 0,
          tardanzas: 0, ausentes: 0,
        }
      }
    }
    acc[key].jornadas.push(j)
    acc[key].totales.hd += j.horas_hd || 0
    acc[key].totales.hn += j.horas_hn || 0
    acc[key].totales.ex_50_d += j.horas_ex_50_d || 0
    acc[key].totales.ex_50_n += j.horas_ex_50_n || 0
    acc[key].totales.ex_100 += j.horas_ex_100 || 0
    acc[key].totales.total += j.horas_trabajadas || 0
    if (j.tiene_tardanza) acc[key].totales.tardanzas++
    if (j.estado === 'ausente') acc[key].totales.ausentes++
    return acc
  }, {} as Record<number, { empleado_id: number; legajo: string; nombre_completo: string; sector: string | null; jornadas: Jornada[]; totales: { hd: number; hn: number; ex_50_d: number; ex_50_n: number; ex_100: number; total: number; tardanzas: number; ausentes: number } }>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Asistencia y Jornadas</h2>
          <p className="text-sm text-gray-500">Control de horas trabajadas por empleado</p>
        </div>
        <div className="flex items-center gap-2">
          <ContextoButton onClick={() => setShowContexto(true)} />
          <button 
            onClick={calcularJornadas}
            disabled={calculando}
            className="px-3 py-1.5 text-xs text-white bg-[#C4322F] hover:bg-[#A52A27] rounded flex items-center gap-1.5 disabled:opacity-50"
          >
            <Calculator className={`w-3.5 h-3.5 ${calculando ? 'animate-pulse' : ''}`} />
            {calculando ? 'Calculando...' : 'Calcular período'}
          </button>
          <button 
            onClick={cargarJornadas}
            disabled={loading}
            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4 py-3 border-y border-gray-100">
        <div className="flex items-center gap-2">
          <button onClick={() => moverPeriodo(-7)} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-sm"
            />
            <span className="text-gray-400">a</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-sm"
            />
          </div>
          <button onClick={() => moverPeriodo(7)} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          {(['todos', 'completa', 'tardanza', 'ausente'] as const).map(est => (
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
      </div>

      {/* Resumen general */}
      {resumen && (
        <div className="grid grid-cols-6 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500">Días trabajados</p>
            <p className="text-2xl font-semibold text-gray-900">{resumen.dias_trabajados}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500">Ausencias</p>
            <p className="text-2xl font-semibold text-red-600">{resumen.dias_ausentes}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-xs text-blue-600 flex items-center gap-1">
              <Sun className="w-3 h-3" /> Horas diurnas
            </p>
            <p className="text-2xl font-semibold text-blue-700">{formatNumber(resumen.total_horas_hd)}</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-4">
            <p className="text-xs text-indigo-600 flex items-center gap-1">
              <Moon className="w-3 h-3" /> Horas nocturnas
            </p>
            <p className="text-2xl font-semibold text-indigo-700">{formatNumber(resumen.total_horas_hn)}</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4">
            <p className="text-xs text-amber-600">Horas extra</p>
            <p className="text-2xl font-semibold text-amber-700">{formatNumber(resumen.total_horas_ex)}</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4">
            <p className="text-xs text-emerald-600">Total horas</p>
            <p className="text-2xl font-semibold text-emerald-700">{formatNumber(resumen.total_horas)}</p>
          </div>
        </div>
      )}

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
          <span className="ml-2 text-gray-500">Cargando jornadas...</span>
        </div>
      )}

      {/* Tabla por empleado */}
      {!loading && Object.keys(jornadasPorEmpleado).length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left font-medium text-gray-600 px-4 py-2.5">Empleado</th>
                <th className="text-right font-medium text-gray-600 px-3 py-2.5 w-20">HD</th>
                <th className="text-right font-medium text-gray-600 px-3 py-2.5 w-20">HN</th>
                <th className="text-right font-medium text-gray-600 px-3 py-2.5 w-20">EX 50D</th>
                <th className="text-right font-medium text-gray-600 px-3 py-2.5 w-20">EX 50N</th>
                <th className="text-right font-medium text-gray-600 px-3 py-2.5 w-20">EX 100</th>
                <th className="text-right font-medium text-gray-600 px-3 py-2.5 w-24">Total</th>
                <th className="text-center font-medium text-gray-600 px-3 py-2.5 w-24">Estado</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(jornadasPorEmpleado).map(emp => (
                <tr key={emp.empleado_id} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{emp.nombre_completo}</p>
                    <p className="text-xs text-gray-400">Leg. {emp.legajo} · {emp.sector || '-'}</p>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-gray-700">
                    {formatNumber(emp.totales.hd)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-gray-700">
                    {formatNumber(emp.totales.hn)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-amber-600">
                    {emp.totales.ex_50_d > 0 ? formatNumber(emp.totales.ex_50_d) : '-'}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-amber-600">
                    {emp.totales.ex_50_n > 0 ? formatNumber(emp.totales.ex_50_n) : '-'}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-orange-600">
                    {emp.totales.ex_100 > 0 ? formatNumber(emp.totales.ex_100) : '-'}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-medium text-gray-900">
                    {formatNumber(emp.totales.total)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {emp.totales.tardanzas > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                          {emp.totales.tardanzas} tard
                        </span>
                      )}
                      {emp.totales.ausentes > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600">
                          {emp.totales.ausentes} aus
                        </span>
                      )}
                      {emp.totales.tardanzas === 0 && emp.totales.ausentes === 0 && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && jornadas.length === 0 && !error && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay jornadas calculadas para este período</p>
          <p className="text-sm text-gray-400 mt-1">
            Presiona "Calcular período" para generar las jornadas
          </p>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex items-center gap-6 text-xs text-gray-500">
        <span><strong>HD:</strong> Hora diurna</span>
        <span><strong>HN:</strong> Hora nocturna (+13%)</span>
        <span><strong>EX 50D:</strong> Extra 50% diurna</span>
        <span><strong>EX 50N:</strong> Extra 50% nocturna</span>
        <span><strong>EX 100:</strong> Extra 100% (dom/feriado)</span>
      </div>

      {/* Modal contexto */}
      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Contexto: Asistencia y Jornadas"
        contenido={contextoAsistencia}
      />
    </div>
  )
}
