'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Calendar,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  Check,
  X,
  Sun,
  Moon,
  Play,
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'

// ============ TIPOS ============

interface JornadaValidacion {
  id: number | null
  empleado_id: number
  legajo: string
  nombre_completo: string
  categoria: string | null
  sector: string | null
  fecha: string
  turno_codigo: string | null
  hora_entrada_asignada: string | null
  hora_salida_asignada: string | null
  hora_entrada_real: string | null
  hora_salida_real: string | null
  minutos_trabajados: number
  minutos_hd: number
  minutos_hn: number
  estado: 'completa' | 'tardanza' | 'ausente' | 'sin_salida' | 'sin_calcular'
  tiene_tardanza: boolean
  tiene_bloque: boolean
}

interface ResumenValidacion {
  total_empleados: number
  con_jornada: number
  sin_calcular: number
  completas: number
  tardanzas: number
  ausentes: number
  sin_bloque: number
}

// ============ HELPERS ============

function formatHora(hora: string | null): string {
  if (!hora) return '-'
  try {
    const date = new Date(hora)
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return hora.slice(0, 5)
  }
}

function formatMinutosAHoras(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${h}:${m.toString().padStart(2, '0')}`
}

const estadoConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  completa: { label: 'OK', color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2 },
  tardanza: { label: 'Tardanza', color: 'text-amber-600 bg-amber-50', icon: AlertTriangle },
  ausente: { label: 'Ausente', color: 'text-red-600 bg-red-50', icon: XCircle },
  sin_salida: { label: 'Sin salida', color: 'text-orange-600 bg-orange-50', icon: AlertCircle },
  sin_calcular: { label: 'Pendiente', color: 'text-gray-500 bg-gray-100', icon: Clock },
}

const contexto = {
  descripcion: 'Validación de jornadas calculadas a partir de marcaciones y turnos asignados. Aquí se revisan las horas antes de liquidar.',
  reglas: [
    'Cada empleado debe tener un bloque asignado para calcular',
    'El cálculo cruza marcaciones con el turno del día',
    'Las tardanzas se detectan automáticamente (>15 min)',
    'Sin marcaciones = ausente (a menos que tenga licencia)',
  ],
  flujo: [
    '1. Seleccionar período a validar',
    '2. Calcular jornadas para ese período',
    '3. Revisar anomalías (tardanzas, ausencias)',
    '4. Una vez validado, proceder a liquidar',
  ],
  integraciones: [
    'Asignación de Turnos: Define qué turno tiene cada empleado',
    'Marcaciones: Datos del reloj biométrico',
    'Liquidación: Usa las horas validadas',
  ],
  notas: [
    'Calcular genera/actualiza las jornadas del período',
    'Las ausencias se pueden justificar desde Novedades',
  ],
}

// ============ COMPONENTE PRINCIPAL ============

export function ValidacionJornadasTab() {
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [fechasInicializadas, setFechasInicializadas] = useState(false)
  
  const [jornadas, setJornadas] = useState<JornadaValidacion[]>([])
  const [resumen, setResumen] = useState<ResumenValidacion | null>(null)
  const [loading, setLoading] = useState(false)
  const [calculando, setCalculando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showContexto, setShowContexto] = useState(false)
  
  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null)

  // Inicializar fechas solo en cliente para evitar hydration mismatch
  useEffect(() => {
    if (!fechasInicializadas) {
      const d = new Date()
      const desde = new Date(d)
      desde.setDate(1)
      const hasta = new Date(d)
      hasta.setDate(15)
      setFechaDesde(desde.toISOString().split('T')[0])
      setFechaHasta(hasta.toISOString().split('T')[0])
      setFechasInicializadas(true)
    }
  }, [fechasInicializadas])

  // Cargar jornadas
  const cargarJornadas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        limit: '1000',
      })

      const response = await fetch(`/api/sicamar/jornadas?${params}`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Error al cargar')

      // También cargar empleados sin jornada
      const empResponse = await fetch('/api/sicamar/empleados?activos=true')
      const empData = await empResponse.json()
      
      const jornadasMap = new Map<string, JornadaValidacion>()
      for (const j of data.jornadas || []) {
        const key = `${j.empleado_id}_${j.fecha}`
        jornadasMap.set(key, {
          ...j,
          tiene_bloque: true,
        })
      }

      // Agregar empleados sin jornada calculada
      const empleados = empData.empleados || []
      const fechas = generarFechas(fechaDesde, fechaHasta)
      
      for (const emp of empleados) {
        for (const fecha of fechas) {
          const key = `${emp.id}_${fecha}`
          if (!jornadasMap.has(key)) {
            jornadasMap.set(key, {
              id: null,
              empleado_id: emp.id,
              legajo: emp.legajo,
              nombre_completo: `${emp.apellido}, ${emp.nombre}`,
              categoria: emp.categoria,
              sector: emp.sector,
              fecha,
              turno_codigo: null,
              hora_entrada_asignada: null,
              hora_salida_asignada: null,
              hora_entrada_real: null,
              hora_salida_real: null,
              minutos_trabajados: 0,
              minutos_hd: 0,
              minutos_hn: 0,
              estado: 'sin_calcular',
              tiene_tardanza: false,
              tiene_bloque: false, // Asumir que no tiene hasta verificar
            })
          }
        }
      }

      const jornadasArray = Array.from(jornadasMap.values())
      setJornadas(jornadasArray)
      
      // Calcular resumen
      const resumenCalc: ResumenValidacion = {
        total_empleados: empleados.length,
        con_jornada: new Set(jornadasArray.filter(j => j.id).map(j => j.empleado_id)).size,
        sin_calcular: jornadasArray.filter(j => j.estado === 'sin_calcular').length,
        completas: jornadasArray.filter(j => j.estado === 'completa').length,
        tardanzas: jornadasArray.filter(j => j.estado === 'tardanza').length,
        ausentes: jornadasArray.filter(j => j.estado === 'ausente').length,
        sin_bloque: empleados.length - new Set(jornadasArray.filter(j => j.tiene_bloque).map(j => j.empleado_id)).size,
      }
      setResumen(resumenCalc)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta])

  // Calcular jornadas
  const calcularJornadas = async () => {
    setCalculando(true)
    setError(null)
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
      if (!response.ok) throw new Error(data.error || 'Error al calcular')

      // Recargar datos
      await cargarJornadas()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al calcular')
    } finally {
      setCalculando(false)
    }
  }

  useEffect(() => {
    cargarJornadas()
  }, [cargarJornadas])

  // Filtrar jornadas
  const jornadasFiltradas = useMemo(() => {
    return jornadas.filter(j => {
      if (busqueda) {
        const search = busqueda.toLowerCase()
        if (!j.legajo.includes(search) && !j.nombre_completo.toLowerCase().includes(search)) {
          return false
        }
      }
      if (filtroEstado !== 'todos' && j.estado !== filtroEstado) return false
      if (fechaSeleccionada && j.fecha !== fechaSeleccionada) return false
      return true
    }).sort((a, b) => {
      // Ordenar por fecha desc, luego por nombre
      if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha)
      return a.nombre_completo.localeCompare(b.nombre_completo)
    })
  }, [jornadas, busqueda, filtroEstado, fechaSeleccionada])

  // Fechas únicas para el filtro
  const fechasDisponibles = useMemo(() => {
    return [...new Set(jornadas.map(j => j.fecha))].sort().reverse()
  }, [jornadas])

  // Preset de períodos
  const setPeriodo = (tipo: 'q1' | 'q2' | 'mes') => {
    const hoy = new Date()
    const anio = hoy.getFullYear()
    const mes = hoy.getMonth() + 1
    
    if (tipo === 'q1') {
      setFechaDesde(`${anio}-${String(mes).padStart(2, '0')}-01`)
      setFechaHasta(`${anio}-${String(mes).padStart(2, '0')}-15`)
    } else if (tipo === 'q2') {
      const ultimoDia = new Date(anio, mes, 0).getDate()
      setFechaDesde(`${anio}-${String(mes).padStart(2, '0')}-16`)
      setFechaHasta(`${anio}-${String(mes).padStart(2, '0')}-${ultimoDia}`)
    } else {
      const ultimoDia = new Date(anio, mes, 0).getDate()
      setFechaDesde(`${anio}-${String(mes).padStart(2, '0')}-01`)
      setFechaHasta(`${anio}-${String(mes).padStart(2, '0')}-${ultimoDia}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Validación de Jornadas</h2>
          <p className="text-sm text-gray-500">Cruzar marcaciones con turnos y calcular horas</p>
        </div>
        <div className="flex items-center gap-2">
          <ContextoButton onClick={() => setShowContexto(true)} />
          <button
            onClick={calcularJornadas}
            disabled={calculando}
            className="px-3 py-1.5 text-xs text-white bg-[#C4322F] hover:bg-[#A52A27] rounded flex items-center gap-1.5 disabled:opacity-50"
          >
            <Calculator className={`w-3.5 h-3.5 ${calculando ? 'animate-pulse' : ''}`} />
            {calculando ? 'Calculando...' : 'Calcular Jornadas'}
          </button>
          <button
            onClick={cargarJornadas}
            disabled={loading}
            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Selector de período */}
      <div className="flex items-center gap-4 py-3 border-y border-gray-100">
        <div className="flex items-center gap-2">
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
        
        <div className="flex gap-1">
          <button
            onClick={() => setPeriodo('q1')}
            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
          >
            1° Quincena
          </button>
          <button
            onClick={() => setPeriodo('q2')}
            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
          >
            2° Quincena
          </button>
          <button
            onClick={() => setPeriodo('mes')}
            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
          >
            Mes completo
          </button>
        </div>
      </div>

      {/* Resumen */}
      {resumen && (
        <div className="grid grid-cols-6 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Empleados</p>
            <p className="text-xl font-semibold text-gray-900">{resumen.total_empleados}</p>
          </div>
          <div className={`rounded-lg p-3 ${resumen.sin_calcular > 0 ? 'bg-gray-100' : 'bg-emerald-50'}`}>
            <p className="text-xs text-gray-500">Pendientes</p>
            <p className={`text-xl font-semibold ${resumen.sin_calcular > 0 ? 'text-gray-600' : 'text-emerald-600'}`}>
              {resumen.sin_calcular}
            </p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3">
            <p className="text-xs text-emerald-600">Completas</p>
            <p className="text-xl font-semibold text-emerald-700">{resumen.completas}</p>
          </div>
          <div className={`rounded-lg p-3 ${resumen.tardanzas > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
            <p className="text-xs text-amber-600">Tardanzas</p>
            <p className={`text-xl font-semibold ${resumen.tardanzas > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
              {resumen.tardanzas}
            </p>
          </div>
          <div className={`rounded-lg p-3 ${resumen.ausentes > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <p className="text-xs text-red-600">Ausentes</p>
            <p className={`text-xl font-semibold ${resumen.ausentes > 0 ? 'text-red-700' : 'text-gray-400'}`}>
              {resumen.ausentes}
            </p>
          </div>
          <div className={`rounded-lg p-3 ${resumen.sin_bloque > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
            <p className="text-xs text-orange-600">Sin bloque</p>
            <p className={`text-xl font-semibold ${resumen.sin_bloque > 0 ? 'text-orange-700' : 'text-gray-400'}`}>
              {resumen.sin_bloque}
            </p>
          </div>
        </div>
      )}

      {/* Alerta si hay sin bloque */}
      {resumen && resumen.sin_bloque > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
          <div>
            <p className="font-medium text-orange-800">
              {resumen.sin_bloque} empleados sin bloque asignado
            </p>
            <p className="text-sm text-orange-700">
              Asigna turnos primero en la pestaña "Asignación de Turnos"
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Buscar por legajo o nombre..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-3 pr-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </div>
        
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-gray-400 mr-1" />
          {(['todos', 'sin_calcular', 'completa', 'tardanza', 'ausente'] as const).map(e => (
            <button
              key={e}
              onClick={() => setFiltroEstado(e)}
              className={`px-2 py-1 text-xs rounded ${
                filtroEstado === e ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {e === 'todos' ? 'Todos' : estadoConfig[e]?.label || e}
            </button>
          ))}
        </div>

        {fechaSeleccionada && (
          <button
            onClick={() => setFechaSeleccionada(null)}
            className="px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded flex items-center gap-1"
          >
            {fechaSeleccionada}
            <X className="w-3 h-3" />
          </button>
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

      {/* Tabla */}
      {!loading && jornadasFiltradas.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left font-medium text-gray-600 px-4 py-2.5">Fecha</th>
                <th className="text-left font-medium text-gray-600 px-4 py-2.5">Empleado</th>
                <th className="text-center font-medium text-gray-600 px-3 py-2.5 w-20">Turno</th>
                <th className="text-center font-medium text-gray-600 px-3 py-2.5 w-24">Entrada</th>
                <th className="text-center font-medium text-gray-600 px-3 py-2.5 w-24">Salida</th>
                <th className="text-right font-medium text-gray-600 px-3 py-2.5 w-20">HD</th>
                <th className="text-right font-medium text-gray-600 px-3 py-2.5 w-20">HN</th>
                <th className="text-center font-medium text-gray-600 px-3 py-2.5 w-24">Estado</th>
              </tr>
            </thead>
            <tbody>
              {jornadasFiltradas.slice(0, 100).map((j, idx) => {
                const EstadoIcon = estadoConfig[j.estado]?.icon || Clock
                
                return (
                  <tr key={`${j.empleado_id}_${j.fecha}_${idx}`} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setFechaSeleccionada(j.fecha === fechaSeleccionada ? null : j.fecha)}
                        className="text-gray-900 hover:text-[#C4322F]"
                      >
                        {new Date(j.fecha + 'T12:00').toLocaleDateString('es-AR', { 
                          weekday: 'short', day: '2-digit', month: 'short' 
                        })}
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{j.nombre_completo}</p>
                      <p className="text-xs text-gray-400">Leg. {j.legajo}</p>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {j.turno_codigo ? (
                        <span className="text-xs text-gray-600">{j.turno_codigo}</span>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="text-xs">
                        {j.hora_entrada_asignada && (
                          <span className="text-gray-400">{formatHora(j.hora_entrada_asignada)}</span>
                        )}
                        {j.hora_entrada_real && (
                          <span className={`block font-mono ${j.tiene_tardanza ? 'text-amber-600' : 'text-gray-900'}`}>
                            {formatHora(j.hora_entrada_real)}
                          </span>
                        )}
                        {!j.hora_entrada_real && j.estado !== 'sin_calcular' && (
                          <span className="text-red-400">Sin marca</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="text-xs">
                        {j.hora_salida_asignada && (
                          <span className="text-gray-400">{formatHora(j.hora_salida_asignada)}</span>
                        )}
                        {j.hora_salida_real && (
                          <span className="block font-mono text-gray-900">
                            {formatHora(j.hora_salida_real)}
                          </span>
                        )}
                        {!j.hora_salida_real && j.hora_entrada_real && (
                          <span className="text-orange-400">Pendiente</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                      {j.minutos_hd > 0 ? formatMinutosAHoras(j.minutos_hd) : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-indigo-600">
                      {j.minutos_hn > 0 ? formatMinutosAHoras(j.minutos_hn) : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${estadoConfig[j.estado]?.color || 'bg-gray-100'}`}>
                        <EstadoIcon className="w-3 h-3" />
                        {estadoConfig[j.estado]?.label || j.estado}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {jornadasFiltradas.length > 100 && (
            <div className="px-4 py-2 bg-gray-50 text-sm text-gray-500 text-center">
              Mostrando 100 de {jornadasFiltradas.length} registros
            </div>
          )}
        </div>
      )}

      {/* Empty */}
      {!loading && jornadasFiltradas.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay jornadas para mostrar</p>
          <button
            onClick={calcularJornadas}
            disabled={calculando}
            className="mt-3 px-4 py-2 text-sm text-[#C4322F] hover:bg-red-50 rounded-lg"
          >
            Calcular jornadas del período
          </button>
        </div>
      )}

      {/* Contexto */}
      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Contexto: Validación de Jornadas"
        contenido={contexto}
      />
    </div>
  )
}

// Generar array de fechas entre dos fechas
function generarFechas(desde: string, hasta: string): string[] {
  const fechas: string[] = []
  const d = new Date(desde)
  const h = new Date(hasta)
  
  while (d <= h) {
    // Solo días laborables (lun-sab)
    const dow = d.getDay()
    if (dow !== 0) { // Excluir domingos
      fechas.push(d.toISOString().split('T')[0])
    }
    d.setDate(d.getDate() + 1)
  }
  
  return fechas
}





