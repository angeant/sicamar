'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Calculator,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Download,
  Play,
  Lock,
  Unlock,
  FileSpreadsheet,
  Users,
  TrendingUp,
  RefreshCw,
  Eye,
  Check,
  X,
  FileText,
  Search,
  Filter,
  History,
  ArrowLeftRight,
  Printer,
  Info,
  FunctionSquare,
  BookOpen,
  Hash,
  Plus,
  Pencil,
  Save,
  Trash2,
  Database,
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'
import { EmpleadoAvatar } from './empleado-avatar'
import { NuevaLiquidacion } from './nueva-liquidacion'

// Tipos
interface PeriodoLiquidacion {
  id: number
  bejerman_liq_nroint: number
  anio: number
  mes: number
  quincena: number | null
  fecha_liquidacion: string
  fecha_periodo: string
  fecha_desde?: string
  fecha_hasta?: string
  tipo: string
  tipo_label: string
  descripcion: string
  estado: string
  estado_label: string
  total_empleados: number
  usuario_bejerman: string
  fecha_modificacion_bejerman: string
}

interface EmpleadoLiquidacion {
  legajo: number
  empleado_id: number | null
  nombre: string
  apellido: string
  nombre_completo: string
  categoria: string | null
  sector: string | null
  cargo: string | null
  foto_url: string | null
  foto_thumb_url: string | null
  conceptos: ConceptoLiquidado[]
  totales: {
    haberes: number
    no_rem: number
    retenciones: number
    contribuciones: number
    neto: number
    horas_diurnas: number
    horas_nocturnas: number
    horas_extra: number
    presentismo: number
  }
}

interface ConceptoLiquidado {
  id: number
  concepto_codigo: string
  concepto_descripcion: string
  concepto_tipo: number
  cantidad: number | null
  valor_unitario: number | null
  importe: number | null
  formula: string | null
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const TIPOS_LIQUIDACION = [
  { value: '', label: 'Todos los tipos' },
  { value: 'MN', label: 'Mensual' },
  { value: 'PQN', label: '1ra Quincena' },
  { value: 'SQN', label: '2da Quincena' },
  { value: 'VAC', label: 'Vacaciones' },
  { value: 'SA1', label: 'SAC 1er Sem.' },
  { value: 'SA2', label: 'SAC 2do Sem.' },
  { value: 'FID', label: 'Liquidación Final' },
]

type ViewMode = 'historial' | 'detalle' | 'exportar' | 'comparar' | 'nueva' | 'conceptos' | 'simular'

// Tipo para el catálogo de conceptos
interface ConceptoCatalogo {
  id: number
  codigo: string
  descripcion: string
  tipo: number
  activo: boolean
  formula: string | null
  multiplicador: number | null
}

// Tipos para simulación
interface SimulacionResultado {
  success: boolean
  parametros: {
    anio: number
    mes: number
    tipo: string
    fecha_desde: string
    fecha_hasta: string
  }
  resumen: {
    total_empleados: number
    total_haberes: number
    total_no_remunerativos: number
    total_retenciones: number
    total_contribuciones: number
    total_neto: number
  }
  fuente?: 'kalia' | 'bejerman' | 'referencia'
  archivo_pdf?: string | null
  periodo?: {
    descripcion: string
    anio: number
    mes: number
    tipo: string
  }
  empleados: Array<{
    legajo: string
    empleado_id?: number
    nombre_completo: string
    pagina_pdf?: number
    conceptos: Array<{
      concepto_codigo: string
      concepto_descripcion: string
      concepto_tipo: number
      cantidad: number | null
      valor_unitario: number | null
      importe: number
      formula_aplicada: string
    }>
    totales: {
      haberes: number
      no_remunerativos: number
      retenciones: number
      contribuciones: number
      neto: number
    }
  }>
  comparacion?: {
    resumen: {
      coincidencias: number
      diferencias: number
      precision: number
    }
    por_empleado: Array<{
      legajo: string
      nombre: string
      neto_kalia: number
      neto_bejerman: number
      diferencia: number
      coincide: boolean
    }>
    diferencias_detalle: Array<{
      legajo: string
      concepto: string
      kalia: number
      bejerman: number
      diferencia: number
    }>
  }
}

// Wizard steps
interface NuevaPeriodoData {
  anio: number
  mes: number
  tipo: string
  fechaDesde: string
  fechaHasta: string
}

export function LiquidacionesTab() {
  const [viewMode, setViewMode] = useState<ViewMode>('historial')
  const [showNuevaModal, setShowNuevaModal] = useState(false)
  const [periodos, setPeriodos] = useState<PeriodoLiquidacion[]>([])
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<PeriodoLiquidacion | null>(null)
  const [empleadosLiquidacion, setEmpleadosLiquidacion] = useState<EmpleadoLiquidacion[]>([])
  const [resumenLiquidacion, setResumenLiquidacion] = useState<{
    total_horas_diurnas: number
    total_horas_nocturnas: number
    total_horas_extra: number
    total_haberes: number
    total_no_rem: number
    total_retenciones: number
    total_contribuciones: number
    total_neto: number
  } | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear())
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedEmpleado, setExpandedEmpleado] = useState<number | null>(null)
  const [conceptoSeleccionado, setConceptoSeleccionado] = useState<ConceptoLiquidado | null>(null)
  
  // Catálogo de conceptos
  const [catalogoConceptos, setCatalogoConceptos] = useState<ConceptoCatalogo[]>([])
  const [loadingConceptos, setLoadingConceptos] = useState(false)
  const [filtroTipoConcepto, setFiltroTipoConcepto] = useState<number | ''>('')
  const [searchConcepto, setSearchConcepto] = useState('')
  const [conceptoEditar, setConceptoEditar] = useState<ConceptoCatalogo | null>(null)
  const [showConceptoModal, setShowConceptoModal] = useState(false)
  
  // Simulación
  const [simulacionAnio, setSimulacionAnio] = useState(new Date().getFullYear())
  const [simulacionMes, setSimulacionMes] = useState(new Date().getMonth() + 1)
  const [simulacionTipo, setSimulacionTipo] = useState('SQN')
  const [simulacionPeriodoBejerman, setSimulacionPeriodoBejerman] = useState<string | number | null>(null)
  const [simulacionCompararBejerman, setSimulacionCompararBejerman] = useState(true)
  const [simulacionResultado, setSimulacionResultado] = useState<SimulacionResultado | null>(null)
  const [loadingSimulacion, setLoadingSimulacion] = useState(false)
  const [periodosBejerman, setPeriodosBejerman] = useState<Array<{id: string | number; descripcion: string; descripcion_corta?: string; anio: number; mes: number; tipo: string; es_referencia?: boolean}>>([])
  const [expandedSimEmpleado, setExpandedSimEmpleado] = useState<string | null>(null)
  
  const [showContexto, setShowContexto] = useState(false)

  const contextoContenido = {
    descripcion: 'Módulo de consulta de liquidaciones históricas importadas desde Bejerman. Permite ver el detalle de cada período, comparar liquidaciones y exportar archivos para importación.',
    reglas: [
      'Los datos se sincronizan desde Bejerman Sueldos (SJSCM)',
      'Las liquidaciones cerradas no pueden modificarse',
      'El presentismo se muestra como cantidad de días (ej: 20 = 100%)',
      'Las horas extra incluyen 50% diurnas, 50% nocturnas y 100%',
    ],
    flujo: [
      'Seleccionar período del historial',
      'Ver detalle por empleado',
      'Comparar con liquidación anterior si es necesario',
      'Exportar archivo TXT para Bejerman',
    ],
    integraciones: [
      'Bejerman Sueldos: Fuente de datos de liquidaciones históricas',
      'Exportación TXT: Formato de ancho fijo para importar novedades',
    ],
    notas: [
      'Los datos mostrados son de solo lectura (históricos)',
      'Para generar nuevas liquidaciones usar Bejerman',
    ],
  }

  // Cargar períodos
  const cargarPeriodos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtroTipo) params.append('tipo', filtroTipo)
      if (filtroAnio) params.append('anio', filtroAnio.toString())
      
      const response = await fetch(`/api/sicamar/liquidaciones?${params}`)
      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error || 'Error al cargar liquidaciones')
      
      setPeriodos(data.liquidaciones || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setPeriodos([])
    } finally {
      setLoading(false)
    }
  }, [filtroTipo, filtroAnio])

  // Cargar detalle de un período
  const cargarDetallePeriodo = async (periodoId: number) => {
    setLoadingDetalle(true)
    try {
      const response = await fetch(`/api/sicamar/liquidaciones/${periodoId}`)
      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error || 'Error al cargar detalle')
      
      setEmpleadosLiquidacion(data.empleados || [])
      setResumenLiquidacion(data.resumen || null)
      setViewMode('detalle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar detalle')
    } finally {
      setLoadingDetalle(false)
    }
  }

  // Cargar catálogo de conceptos
  const cargarCatalogoConceptos = useCallback(async () => {
    setLoadingConceptos(true)
    try {
      const response = await fetch('/api/sicamar/conceptos')
      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error || 'Error al cargar conceptos')
      
      setCatalogoConceptos(data.conceptos || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar conceptos')
    } finally {
      setLoadingConceptos(false)
    }
  }, [])

  useEffect(() => {
    cargarPeriodos()
  }, [cargarPeriodos])

  // Cargar conceptos cuando se cambia a la pestaña
  useEffect(() => {
    if (viewMode === 'conceptos' && catalogoConceptos.length === 0) {
      cargarCatalogoConceptos()
    }
  }, [viewMode, catalogoConceptos.length, cargarCatalogoConceptos])

  // Cargar períodos de Bejerman para simulación
  useEffect(() => {
    if (viewMode === 'simular' && periodosBejerman.length === 0) {
      cargarPeriodosBejerman()
    }
  }, [viewMode, periodosBejerman.length])

  // Cargar períodos de Bejerman disponibles
  const cargarPeriodosBejerman = async () => {
    try {
      const response = await fetch('/api/sicamar/liquidaciones/simular')
      const data = await response.json()
      if (data.periodos_bejerman) {
        setPeriodosBejerman(data.periodos_bejerman)
      }
    } catch (err) {
      console.error('Error cargando períodos:', err)
    }
  }

  // Ejecutar simulación
  const ejecutarSimulacion = async () => {
    setLoadingSimulacion(true)
    setSimulacionResultado(null)
    try {
      const response = await fetch('/api/sicamar/liquidaciones/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anio: simulacionAnio,
          mes: simulacionMes,
          tipo: simulacionTipo,
          comparar_con_bejerman: simulacionCompararBejerman && simulacionPeriodoBejerman,
          periodo_bejerman_id: simulacionPeriodoBejerman,
        }),
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error en simulación')
      
      setSimulacionResultado(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al simular')
    } finally {
      setLoadingSimulacion(false)
    }
  }

  // Generar archivo TXT para Bejerman
  const generarTXT = () => {
    if (!periodoSeleccionado || empleadosLiquidacion.length === 0) return
    
    // Formato 3: NOVEDADES (30 caracteres, ancho fijo)
    // Pos 1-9: LEGAJO, Pos 10-18: CONCEPTO, Pos 19-27: CANTIDAD
    let contenido = ''
    
    for (const emp of empleadosLiquidacion) {
      for (const concepto of emp.conceptos) {
        if (concepto.cantidad && concepto.cantidad > 0) {
          const legajo = emp.legajo.toString().padStart(9, ' ')
          const codigo = concepto.concepto_codigo.padStart(9, ' ')
          const cantidad = (concepto.cantidad * 100).toFixed(0).padStart(9, '0') // 2 decimales implícitos
          contenido += `${legajo}${codigo}${cantidad}\n`
        }
      }
    }
    
    // Descargar archivo
    const blob = new Blob([contenido], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `novedades_${periodoSeleccionado.tipo}_${periodoSeleccionado.anio}_${periodoSeleccionado.mes}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredEmpleados = empleadosLiquidacion.filter(emp => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return emp.legajo.toString().includes(query) ||
           emp.nombre_completo.toLowerCase().includes(query) ||
           emp.categoria?.toLowerCase().includes(query) ||
           emp.sector?.toLowerCase().includes(query)
  })

  const getTipoBadgeColor = (tipo: string) => {
    const colors: Record<string, string> = {
      'MN': 'bg-blue-100 text-blue-700',
      'PQN': 'bg-emerald-100 text-emerald-700',
      'SQN': 'bg-teal-100 text-teal-700',
      'VAC': 'bg-amber-100 text-amber-700',
      'SA1': 'bg-purple-100 text-purple-700',
      'SA2': 'bg-purple-100 text-purple-700',
      'FID': 'bg-red-100 text-red-700',
    }
    return colors[tipo] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="space-y-6">
      {/* Contexto Modal */}
      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Liquidaciones Históricas"
        contenido={contextoContenido}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Liquidaciones</h2>
            <p className="text-sm text-gray-500">Historial de liquidaciones desde Bejerman</p>
          </div>
          <ContextoButton onClick={() => setShowContexto(true)} />
        </div>
        
        {/* Filtros */}
        <div className="flex items-center gap-3">
          <select
            value={filtroAnio}
            onChange={(e) => setFiltroAnio(parseInt(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C4322F]/20"
          >
            {[2025, 2024, 2023].map(anio => (
              <option key={anio} value={anio}>{anio}</option>
            ))}
          </select>
          
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C4322F]/20"
          >
            {TIPOS_LIQUIDACION.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          
          <button
            onClick={cargarPeriodos}
            disabled={loading}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          
          <button
            onClick={() => setShowNuevaModal(true)}
            className="px-3 py-2 text-sm font-medium text-white bg-[#C4322F] rounded-lg hover:bg-[#A52A27] flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            Nueva Liquidación
          </button>
        </div>
      </div>

      {/* Tabs de vista */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { id: 'historial' as const, label: 'Historial', icon: History },
          { id: 'detalle' as const, label: 'Detalle', icon: Users, disabled: !periodoSeleccionado },
          { id: 'exportar' as const, label: 'Exportar TXT', icon: Download, disabled: !periodoSeleccionado },
          { id: 'nueva' as const, label: 'Nueva Liquidación', icon: Plus },
          { id: 'simular' as const, label: 'Comparar', icon: ArrowLeftRight },
          { id: 'conceptos' as const, label: 'Catálogo Conceptos', icon: BookOpen },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            disabled={tab.disabled}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              viewMode === tab.id
                ? 'border-[#C4322F] text-[#C4322F]'
                : tab.disabled
                ? 'border-transparent text-gray-300 cursor-not-allowed'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Vista Historial */}
      {viewMode === 'historial' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
              <span className="ml-2 text-gray-500">Cargando liquidaciones...</span>
            </div>
          ) : periodos.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No hay liquidaciones para mostrar</p>
              <p className="text-sm text-gray-400 mt-1">
                Ejecutá el script de migración para importar datos de Bejerman
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Período</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Descripción</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Empleados</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Estado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {periodos.map(periodo => (
                    <tr 
                      key={periodo.id} 
                      className={`hover:bg-gray-50 cursor-pointer ${
                        periodoSeleccionado?.id === periodo.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setPeriodoSeleccionado(periodo)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {MESES[periodo.mes - 1]} {periodo.anio}
                          </span>
                          {periodo.quincena && (
                            <span className="text-xs text-gray-500">
                              ({periodo.quincena}° Q)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTipoBadgeColor(periodo.tipo)}`}>
                          {periodo.tipo_label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {periodo.descripcion}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono text-sm text-gray-900">
                          {periodo.total_empleados}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          ['cerrada', 'cerrado'].includes(periodo.estado)
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {['cerrada', 'cerrado'].includes(periodo.estado) && <Lock className="w-3 h-3 inline mr-1" />}
                          {periodo.estado_label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setPeriodoSeleccionado(periodo)
                            cargarDetallePeriodo(periodo.id)
                          }}
                          disabled={loadingDetalle}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          {loadingDetalle && periodoSeleccionado?.id === periodo.id ? (
                            <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                          ) : (
                            <Eye className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Vista Detalle */}
      {viewMode === 'detalle' && periodoSeleccionado && (
        <div className="space-y-4">
          {/* Info del período */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${getTipoBadgeColor(periodoSeleccionado.tipo)}`}>
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {periodoSeleccionado.descripcion}
                </h3>
                <p className="text-sm text-gray-500">
                  {MESES[periodoSeleccionado.mes - 1]} {periodoSeleccionado.anio} · {periodoSeleccionado.tipo_label}
                </p>
              </div>
            </div>
            {resumenLiquidacion && (
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="font-mono font-bold text-green-600">$ {resumenLiquidacion.total_haberes.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-gray-500">Total Haberes</p>
                </div>
                <div className="text-center">
                  <p className="font-mono font-bold text-red-600">$ {resumenLiquidacion.total_retenciones.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-gray-500">Retenciones</p>
                </div>
                <div className="text-center">
                  <p className="font-mono font-bold text-emerald-600">$ {resumenLiquidacion.total_neto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-gray-500">Total Neto</p>
                </div>
                {resumenLiquidacion.total_contribuciones > 0 && (
                  <div className="text-center">
                    <p className="font-mono font-bold text-orange-600">$ {resumenLiquidacion.total_contribuciones.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-gray-500">Contrib. Patronales</p>
                  </div>
                )}
                <div className="h-8 w-px bg-gray-300" />
                <div className="text-center">
                  <p className="font-mono font-bold text-gray-900">{resumenLiquidacion.total_horas_diurnas.toFixed(0)}</p>
                  <p className="text-xs text-gray-500">Hs Diurnas</p>
                </div>
                <div className="text-center">
                  <p className="font-mono font-bold text-indigo-600">{resumenLiquidacion.total_horas_nocturnas.toFixed(0)}</p>
                  <p className="text-xs text-gray-500">Hs Nocturnas</p>
                </div>
                <div className="text-center">
                  <p className="font-mono font-bold text-blue-600">{resumenLiquidacion.total_horas_extra.toFixed(0)}</p>
                  <p className="text-xs text-gray-500">Hs Extra</p>
                </div>
              </div>
            )}
          </div>

          {/* Búsqueda */}
          <div className="flex items-center justify-between">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, legajo, categoría..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-80 focus:outline-none focus:ring-2 focus:ring-[#C4322F]/20"
              />
            </div>
            <span className="text-sm text-gray-500">
              {filteredEmpleados.length} empleados
            </span>
          </div>

          {/* Lista de empleados */}
          {loadingDetalle ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {filteredEmpleados.map(emp => (
                <div key={emp.legajo}>
                  <div
                    className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedEmpleado(expandedEmpleado === emp.legajo ? null : emp.legajo)}
                  >
                    <div className="flex items-center gap-3">
                      <EmpleadoAvatar 
                        foto_url={emp.foto_url}
                        foto_thumb_url={emp.foto_thumb_url}
                        nombre={emp.nombre}
                        apellido={emp.apellido}
                        legajo={String(emp.legajo)}
                        size="md"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{emp.nombre_completo || `Legajo ${emp.legajo}`}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {emp.categoria && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{emp.categoria}</span>}
                          {emp.sector && <span>· {emp.sector}</span>}
                          <span>· {emp.conceptos.length} conceptos</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      {/* Montos */}
                      <div className="text-right border-r border-gray-200 pr-4">
                        <p className="font-mono font-semibold text-green-600">$ {emp.totales.haberes.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                        <p className="text-xs text-gray-500">Haberes</p>
                      </div>
                      <div className="text-right border-r border-gray-200 pr-4">
                        <p className="font-mono font-semibold text-emerald-700">$ {emp.totales.neto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                        <p className="text-xs text-gray-500">Neto</p>
                      </div>
                      {/* Horas */}
                      <div className="text-right">
                        <p className="font-mono text-gray-900">{emp.totales.horas_diurnas.toFixed(0)}</p>
                        <p className="text-xs text-gray-500">Diurnas</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-indigo-600">{emp.totales.horas_nocturnas.toFixed(0)}</p>
                        <p className="text-xs text-gray-500">Noct.</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-blue-600">{emp.totales.horas_extra.toFixed(0)}</p>
                        <p className="text-xs text-gray-500">Extra</p>
                      </div>
                      <div className="text-right">
                        {emp.totales.presentismo > 0 ? (
                          <Check className="w-5 h-5 text-green-500" />
                        ) : (
                          <X className="w-5 h-5 text-red-500" />
                        )}
                        <p className="text-xs text-gray-500">Pres.</p>
                      </div>
                      {expandedEmpleado === emp.legajo ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                  
                  {/* Detalle expandido */}
                  {expandedEmpleado === emp.legajo && (
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500 uppercase">
                            <th className="text-left py-2 w-16">Código</th>
                            <th className="text-left py-2">Concepto</th>
                            <th className="text-center py-2 w-20">Tipo</th>
                            <th className="text-left py-2 w-64">Detalle / Fórmula</th>
                            <th className="text-right py-2 w-32">Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emp.conceptos.map(c => {
                            // Generar detalle con valores reales
                            const getDetalleValores = () => {
                              if (!c.cantidad && !c.valor_unitario) return null
                              
                              // Si tiene cantidad y valor unitario, mostrar cálculo
                              if (c.cantidad && c.valor_unitario) {
                                const unidad = c.concepto_descripcion.toLowerCase().includes('hora') ? 'hs' : 
                                               c.concepto_descripcion.toLowerCase().includes('dia') ? 'días' : 'u'
                                return (
                                  <span className="font-mono text-xs">
                                    <span className="text-gray-700 font-semibold">{c.cantidad.toFixed(2)}</span>
                                    <span className="text-gray-400"> {unidad} × </span>
                                    <span className="text-gray-600">$ {c.valor_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                  </span>
                                )
                              }
                              
                              // Si solo tiene cantidad
                              if (c.cantidad && !c.valor_unitario) {
                                if (c.cantidad <= 100 && (c.concepto_tipo === 2 || c.concepto_tipo === 4)) {
                                  return (
                                    <span className="font-mono text-xs text-gray-600">
                                      <span className="font-semibold">{c.cantidad.toFixed(2)}%</span> s/ base
                                    </span>
                                  )
                                }
                                return (
                                  <span className="font-mono text-xs text-gray-600">
                                    <span className="font-semibold">{c.cantidad.toFixed(2)}</span> {c.concepto_descripcion.toLowerCase().includes('hora') ? 'horas' : 'unidades'}
                                  </span>
                                )
                              }
                              
                              // Si solo tiene valor unitario (monto fijo)
                              if (!c.cantidad && c.valor_unitario) {
                                return (
                                  <span className="font-mono text-xs text-gray-600">
                                    Fijo: $ {c.valor_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </span>
                                )
                              }
                              
                              return null
                            }
                            
                            return (
                              <tr key={c.id} className="border-t border-gray-200 hover:bg-gray-100">
                                <td className="py-2 font-mono text-gray-500 text-xs">{c.concepto_codigo}</td>
                                <td className="py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-900 font-medium">{c.concepto_descripcion}</span>
                                    {c.formula && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setConceptoSeleccionado(c)
                                        }}
                                        className="p-1 hover:bg-blue-100 rounded transition-colors group"
                                        title="Ver fórmula de cálculo"
                                      >
                                        <FunctionSquare className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-600" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 text-center">
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                    c.concepto_tipo === 0 ? 'bg-green-100 text-green-700' :
                                    c.concepto_tipo === 1 ? 'bg-blue-100 text-blue-700' :
                                    c.concepto_tipo === 2 ? 'bg-red-100 text-red-700' :
                                    c.concepto_tipo === 4 ? 'bg-orange-100 text-orange-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {c.concepto_tipo === 0 ? 'Haber' : 
                                     c.concepto_tipo === 1 ? 'No Rem' : 
                                     c.concepto_tipo === 2 ? 'Ret.' : 
                                     c.concepto_tipo === 4 ? 'Contrib.' : 'Info'}
                                  </span>
                                </td>
                                <td className="py-2 text-left">
                                  {getDetalleValores() || <span className="text-gray-400 text-xs">—</span>}
                                </td>
                                <td className={`py-2 text-right font-mono font-semibold ${
                                  c.concepto_tipo === 2 ? 'text-red-600' : 
                                  c.concepto_tipo === 4 ? 'text-orange-600' : 
                                  'text-gray-900'
                                }`}>
                                  {c.importe ? (c.concepto_tipo === 2 ? '-' : '') + `$ ${Math.abs(c.importe).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="border-t-2 border-gray-300 bg-gray-100">
                          <tr>
                            <td colSpan={4} className="py-2 text-right font-semibold text-gray-700">Total Haberes:</td>
                            <td className="py-2 text-right font-mono font-bold text-green-700">
                              $ {emp.totales.haberes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="py-2 text-right font-semibold text-gray-700">Total Retenciones:</td>
                            <td className="py-2 text-right font-mono font-bold text-red-600">
                              -$ {emp.totales.retenciones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr className="bg-emerald-50">
                            <td colSpan={4} className="py-3 text-right font-bold text-emerald-800 text-base">NETO A COBRAR:</td>
                            <td className="py-3 text-right font-mono font-bold text-emerald-700 text-lg">
                              $ {emp.totales.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          {emp.totales.contribuciones > 0 && (
                            <tr className="bg-orange-50 border-t border-orange-200">
                              <td colSpan={4} className="py-2 text-right font-semibold text-orange-800 text-sm">
                                Contribuciones Patronales:
                              </td>
                              <td className="py-2 text-right font-mono font-bold text-orange-700">
                                $ {emp.totales.contribuciones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          )}
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Vista Exportar */}
      {viewMode === 'exportar' && periodoSeleccionado && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Exportar a Bejerman</h3>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Período seleccionado:</strong> {periodoSeleccionado.descripcion}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                {empleadosLiquidacion.length} empleados con {empleadosLiquidacion.reduce((sum, e) => sum + e.conceptos.length, 0)} conceptos
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {/* TXT Novedades */}
              <div className="p-4 border border-gray-200 rounded-lg hover:border-[#C4322F] transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">Archivo TXT (Formato 3)</p>
                    <p className="text-xs text-gray-500">Novedades con cantidades - Ancho fijo 30 chars</p>
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-300 mb-3 overflow-x-auto">
                  <div className="text-gray-500 mb-1"># Legajo(9) | Concepto(9) | Cantidad(9)</div>
                  <div>      95      001000003900</div>
                  <div>      95      002000000800</div>
                </div>
                <button
                  onClick={generarTXT}
                  disabled={empleadosLiquidacion.length === 0}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Descargar TXT
                </button>
              </div>
              
              {/* CSV */}
              <div className="p-4 border border-gray-200 rounded-lg hover:border-[#C4322F] transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">Archivo CSV</p>
                    <p className="text-xs text-gray-500">Para análisis en Excel</p>
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-300 mb-3">
                  <div className="text-gray-500 mb-1"># legajo;concepto;descripcion;cantidad;importe</div>
                  <div>95;0010;HORAS DIURNAS;39;0</div>
                  <div>95;0020;HORAS NOCTURNAS;8;0</div>
                </div>
                <button
                  onClick={() => {
                    if (!periodoSeleccionado) return
                    let csv = 'legajo;concepto;descripcion;tipo;cantidad;importe\n'
                    for (const emp of empleadosLiquidacion) {
                      for (const c of emp.conceptos) {
                        csv += `${emp.legajo};${c.concepto_codigo};${c.concepto_descripcion};${c.concepto_tipo};${c.cantidad || 0};${c.importe || 0}\n`
                      }
                    }
                    const blob = new Blob([csv], { type: 'text/csv' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `liquidacion_${periodoSeleccionado.tipo}_${periodoSeleccionado.anio}_${periodoSeleccionado.mes}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  disabled={empleadosLiquidacion.length === 0}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Descargar CSV
                </button>
              </div>
            </div>
          </div>
          
          {/* Info del formato */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">Formato TXT de Bejerman</p>
                <p className="text-sm text-amber-700 mt-1">
                  El archivo TXT usa formato de <strong>ancho fijo</strong> (no CSV). 
                  Cada línea tiene exactamente 30 caracteres:
                </p>
                <ul className="text-sm text-amber-700 mt-2 list-disc list-inside space-y-1">
                  <li>Posición 1-9: Legajo (alineado a derecha con espacios)</li>
                  <li>Posición 10-18: Código de concepto (alineado a derecha)</li>
                  <li>Posición 19-27: Cantidad con 2 decimales implícitos (39.00 → 00003900)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vista Nueva Liquidación */}
      {viewMode === 'nueva' && (
        <NuevaLiquidacion />
      )}

      {/* Vista Comparar con Bejerman */}
      {viewMode === 'simular' && (
        <div className="space-y-4">
          {/* Filtros inline */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={simulacionAnio}
                onChange={(e) => setSimulacionAnio(parseInt(e.target.value))}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                {[2025, 2024, 2023].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              
              <select
                value={simulacionMes}
                onChange={(e) => setSimulacionMes(parseInt(e.target.value))}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                {MESES.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              
              <select
                value={simulacionTipo}
                onChange={(e) => setSimulacionTipo(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                {TIPOS_LIQUIDACION.filter(t => t.value).map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              
              <select
                value={simulacionPeriodoBejerman || ''}
                onChange={(e) => {
                  const val = e.target.value
                  if (!val) {
                    setSimulacionPeriodoBejerman(null)
                  } else if (val.startsWith('ref_')) {
                    setSimulacionPeriodoBejerman(val) // String para referencias
                  } else {
                    setSimulacionPeriodoBejerman(parseInt(val)) // Number para períodos normales
                  }
                }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                <option value="">Sin comparar</option>
                {periodosBejerman.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.descripcion_corta || p.descripcion}
                  </option>
                ))}
              </select>
              
              <button
                onClick={ejecutarSimulacion}
                disabled={loadingSimulacion}
                className="px-4 py-2 text-sm font-medium text-white bg-[#C4322F] rounded-lg hover:bg-[#A52A27] disabled:opacity-50 flex items-center gap-2"
              >
                {loadingSimulacion ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Calculando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Simular
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Resultados de simulación */}
          {simulacionResultado && (
            <>
              {/* Indicador de fuente */}
              {simulacionResultado.fuente === 'bejerman' && simulacionResultado.periodo && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3">
                  <Database className="w-5 h-5 text-blue-600" />
                  <div>
                    <span className="font-medium text-blue-900">Datos de Bejerman: </span>
                    <span className="text-blue-700">{simulacionResultado.periodo.descripcion}</span>
                  </div>
                </div>
              )}
              
              {simulacionResultado.fuente === 'kalia' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
                  <Calculator className="w-5 h-5 text-amber-600" />
                  <div>
                    <span className="font-medium text-amber-900">Simulación Kalia </span>
                    <span className="text-amber-700">(datos de ejemplo, no vinculado a período real)</span>
                  </div>
                </div>
              )}
              
              {simulacionResultado.fuente === 'referencia' && simulacionResultado.periodo && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-green-600" />
                  <div>
                    <span className="font-medium text-green-900">Datos de Recibo PDF: </span>
                    <span className="text-green-700">{simulacionResultado.periodo.descripcion}</span>
                    <span className="text-green-600 text-sm ml-2">(el nº de página se muestra junto a cada empleado)</span>
                  </div>
                </div>
              )}
              
              {/* Resumen en tabla simple */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empl.</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Haberes</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Retenciones</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Contrib. Patron.</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase bg-amber-50">Costo Empleador</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Neto</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase bg-blue-50">% Neto/Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Calcular contribuciones patronales estimadas (~23.5% sobre haberes)
                      const TASA_CONTRIB_PATRONAL = 0.235 // 10.77% Jub + 1.5% PAMI + 4.44% Asig.Fam + 0.89% FNE + 6% OS
                      const contribPatronal = simulacionResultado.resumen.total_contribuciones > 0 
                        ? simulacionResultado.resumen.total_contribuciones 
                        : simulacionResultado.resumen.total_haberes * TASA_CONTRIB_PATRONAL
                      const costoEmpleador = simulacionResultado.resumen.total_haberes + contribPatronal
                      const pctNeto = costoEmpleador > 0 ? (simulacionResultado.resumen.total_neto / costoEmpleador * 100) : 0
                      
                      return (
                        <tr>
                          <td className="px-3 py-4 font-semibold text-gray-900">{simulacionResultado.resumen.total_empleados}</td>
                          <td className="px-3 py-4 text-right font-mono text-gray-900">
                            $ {simulacionResultado.resumen.total_haberes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-4 text-right font-mono text-red-600">
                            -$ {simulacionResultado.resumen.total_retenciones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-4 text-right font-mono text-orange-600">
                            $ {contribPatronal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-4 text-right font-mono font-bold text-amber-700 bg-amber-50">
                            $ {costoEmpleador.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-4 text-right font-mono font-bold text-green-700">
                            $ {simulacionResultado.resumen.total_neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-4 text-right font-mono font-bold text-blue-700 bg-blue-50">
                            {pctNeto.toFixed(1)}%
                          </td>
                        </tr>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
              
              {/* Detalle por empleado */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="font-medium text-gray-900">Detalle por Empleado</span>
                  <span className="text-sm text-gray-500">{simulacionResultado.empleados.length} procesados</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {simulacionResultado.empleados.map((emp) => (
                    <div key={emp.legajo}>
                      <div
                        className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedSimEmpleado(expandedSimEmpleado === emp.legajo ? null : emp.legajo)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-gray-500 w-8">{emp.legajo}</span>
                          <span className="font-medium text-gray-900">{emp.nombre_completo}</span>
                          <span className="text-xs text-gray-400">{emp.conceptos.length} conceptos</span>
                          {emp.pagina_pdf && simulacionResultado?.archivo_pdf && (
                            <a
                              href={`/api/sicamar/recibos-pdf/${encodeURIComponent(simulacionResultado.archivo_pdf)}#page=${emp.pagina_pdf}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full hover:bg-blue-200 transition-colors flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              📄 Ver Pág. {emp.pagina_pdf}
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          {(() => {
                            const TASA_CONTRIB = 0.235
                            const contrib = emp.totales.contribuciones > 0 ? emp.totales.contribuciones : emp.totales.haberes * TASA_CONTRIB
                            const costoEmp = emp.totales.haberes + contrib
                            const pct = costoEmp > 0 ? (emp.totales.neto / costoEmp * 100) : 0
                            return (
                              <>
                                <span className="font-mono text-gray-700 w-28 text-right" title="Haberes">
                                  $ {emp.totales.haberes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                                <span className="font-mono text-red-500 w-24 text-right" title="Retenciones">
                                  -$ {emp.totales.retenciones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                                <span className="font-mono text-orange-500 w-24 text-right" title="Contrib. Patronal (est.)">
                                  $ {contrib.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                                <span className="font-mono font-semibold text-amber-700 w-28 text-right bg-amber-50 px-1 rounded" title="Costo Total Empleador">
                                  $ {costoEmp.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                                <span className="font-mono font-semibold text-green-700 w-28 text-right" title="Neto a Cobrar">
                                  $ {emp.totales.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                                <span className="font-mono text-blue-600 w-14 text-right bg-blue-50 px-1 rounded" title="% Neto vs Costo Empleador">
                                  {pct.toFixed(1)}%
                                </span>
                              </>
                            )
                          })()}
                          {expandedSimEmpleado === emp.legajo ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                      
                      {expandedSimEmpleado === emp.legajo && (
                        <div className="px-4 pb-3 bg-gray-50">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-gray-500 uppercase border-b border-gray-200">
                                <th className="py-2 text-left w-16">Código</th>
                                <th className="py-2 text-left">Concepto</th>
                                <th className="py-2 text-center w-20">Tipo</th>
                                <th className="py-2 text-left w-48">Detalle / Fórmula</th>
                                <th className="py-2 text-right w-32">Importe</th>
                              </tr>
                            </thead>
                            <tbody>
                              {emp.conceptos.map((c, i) => {
                                // Generar fórmula legible
                                const getFormulaDisplay = () => {
                                  // Si tiene cantidad y valor unitario explícitos
                                  if (c.cantidad && c.valor_unitario && c.cantidad < 500) {
                                    const unidad = c.concepto_descripcion.toLowerCase().includes('hora') ? 'hs' : 
                                                   c.concepto_descripcion.toLowerCase().includes('dia') ? 'días' : 
                                                   c.concepto_descripcion.toLowerCase().includes('feriado') ? 'hs' : 'u'
                                    return (
                                      <span className="font-mono text-xs">
                                        <span className="text-gray-700 font-semibold">{c.cantidad.toFixed(2)}</span>
                                        <span className="text-gray-400"> {unidad} × </span>
                                        <span className="text-gray-600">$ {c.valor_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                      </span>
                                    )
                                  }
                                  
                                  // Si tiene cantidad razonable (< 500), calcular valor unitario
                                  if (c.cantidad && c.cantidad < 500 && c.importe > 0) {
                                    const valorUnitCalc = c.importe / c.cantidad
                                    const unidad = c.concepto_descripcion.toLowerCase().includes('hora') ? 'hs' : 
                                                   c.concepto_descripcion.toLowerCase().includes('dia') ? 'días' : 
                                                   c.concepto_descripcion.toLowerCase().includes('feriado') ? 'hs' :
                                                   c.concepto_descripcion.toLowerCase().includes('presentismo') ? '%' : 'u'
                                    return (
                                      <span className="font-mono text-xs">
                                        <span className="text-gray-700 font-semibold">{c.cantidad.toFixed(2)}</span>
                                        <span className="text-gray-400"> {unidad} × </span>
                                        <span className="text-gray-600">$ {valorUnitCalc.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                      </span>
                                    )
                                  }
                                  
                                  // Si la cantidad parece un número de ley o código (> 500), no mostrar como cantidad
                                  if (c.cantidad && c.cantidad >= 500) {
                                    return <span className="text-xs text-gray-400 italic">Importe fijo</span>
                                  }
                                  
                                  return c.formula_aplicada ? <span className="text-xs text-gray-500">{c.formula_aplicada}</span> : null
                                }
                                
                                return (
                                  <tr key={i} className="border-b border-gray-100 last:border-0">
                                    <td className="py-2 font-mono text-gray-500 text-xs">{c.concepto_codigo}</td>
                                    <td className="py-2 text-gray-900">{c.concepto_descripcion}</td>
                                    <td className="py-2 text-center">
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        c.concepto_tipo === 0 ? 'bg-green-100 text-green-700' : 
                                        c.concepto_tipo === 2 ? 'bg-red-100 text-red-700' : 
                                        c.concepto_tipo === 4 ? 'bg-orange-100 text-orange-700' : 
                                        'bg-gray-100 text-gray-600'
                                      }`}>
                                        {c.concepto_tipo === 0 ? 'Haber' : 
                                         c.concepto_tipo === 2 ? 'Ret.' : 
                                         c.concepto_tipo === 4 ? 'Contrib.' : 'Otro'}
                                      </span>
                                    </td>
                                    <td className="py-2">
                                      {getFormulaDisplay()}
                                    </td>
                                    <td className={`py-2 text-right font-mono font-semibold ${
                                      c.concepto_tipo === 2 ? 'text-red-600' :
                                      c.concepto_tipo === 4 ? 'text-orange-600' :
                                      'text-green-600'
                                    }`}>
                                      {c.concepto_tipo === 2 ? '-' : ''}$ {Math.abs(c.importe).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                )
                              })}
                              
                              {/* Fila de totales */}
                              <tr className="border-t-2 border-gray-300 bg-gray-100">
                                <td colSpan={3} className="py-3"></td>
                                <td className="py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                                  Total Haberes:
                                </td>
                                <td className="py-3 text-right font-mono font-bold text-green-700">
                                  $ {emp.totales.haberes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                              <tr className="bg-gray-100">
                                <td colSpan={3} className="py-1"></td>
                                <td className="py-1 text-right text-xs font-semibold text-gray-600 uppercase">
                                  Total Retenciones:
                                </td>
                                <td className="py-1 text-right font-mono font-bold text-red-600">
                                  -$ {emp.totales.retenciones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                              {(() => {
                                const TASA_CONTRIB = 0.235
                                const contrib = emp.totales.contribuciones > 0 ? emp.totales.contribuciones : emp.totales.haberes * TASA_CONTRIB
                                const costoEmp = emp.totales.haberes + contrib
                                const pct = costoEmp > 0 ? (emp.totales.neto / costoEmp * 100) : 0
                                return (
                                  <>
                                    <tr className="bg-gray-100">
                                      <td colSpan={3} className="py-1"></td>
                                      <td className="py-1 text-right text-xs font-semibold text-gray-600 uppercase">
                                        Contrib. Patronal (est.):
                                      </td>
                                      <td className="py-1 text-right font-mono font-bold text-orange-600">
                                        $ {contrib.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                    <tr className="bg-amber-50">
                                      <td colSpan={3} className="py-2"></td>
                                      <td className="py-2 text-right text-xs font-semibold text-amber-700 uppercase">
                                        Costo Empleador:
                                      </td>
                                      <td className="py-2 text-right font-mono font-bold text-amber-700">
                                        $ {costoEmp.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                    <tr className="bg-green-50">
                                      <td colSpan={3} className="py-2"></td>
                                      <td className="py-2 text-right text-xs font-semibold text-green-700 uppercase">
                                        Neto a Cobrar:
                                      </td>
                                      <td className="py-2 text-right font-mono font-bold text-green-700 text-lg">
                                        $ {emp.totales.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                    <tr className="bg-blue-50">
                                      <td colSpan={3} className="py-2"></td>
                                      <td className="py-2 text-right text-xs font-semibold text-blue-700 uppercase">
                                        % Neto / Costo:
                                      </td>
                                      <td className="py-2 text-right font-mono font-bold text-blue-700">
                                        {pct.toFixed(1)}%
                                      </td>
                                    </tr>
                                  </>
                                )
                              })()}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          
          {/* Info inicial si no hay resultados */}
          {!simulacionResultado && !loadingSimulacion && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
              <p className="text-sm">
                Selecciona un período de Bejerman para comparar y presiona <span className="font-medium text-gray-900">Simular</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Vista Catálogo de Conceptos */}
      {viewMode === 'conceptos' && (
        <div className="space-y-4">
          {/* Header y filtros */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Catálogo de Conceptos</h3>
                  <p className="text-sm text-gray-500">
                    {catalogoConceptos.length} conceptos con fórmulas de Bejerman
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Búsqueda */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar concepto..."
                    value={searchConcepto}
                    onChange={(e) => setSearchConcepto(e.target.value)}
                    className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                
                {/* Filtro por tipo */}
                <select
                  value={filtroTipoConcepto}
                  onChange={(e) => setFiltroTipoConcepto(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Todos los tipos</option>
                  <option value="0">Haberes Remunerativos</option>
                  <option value="1">No Remunerativos</option>
                  <option value="2">Retenciones</option>
                  <option value="4">Contribuciones Patronales</option>
                  <option value="6">Informativos</option>
                </select>

                <button
                  onClick={cargarCatalogoConceptos}
                  disabled={loadingConceptos}
                  className="p-2 hover:bg-white rounded-lg border border-gray-200 transition-colors"
                  title="Refrescar"
                >
                  <RefreshCw className={`w-4 h-4 text-gray-500 ${loadingConceptos ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={() => {
                    setConceptoEditar(null)
                    setShowConceptoModal(true)
                  }}
                  className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Concepto
                </button>
              </div>
            </div>
          </div>

          {/* Resumen por tipo */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { tipo: 0, label: 'Haberes', color: 'green', icon: TrendingUp },
              { tipo: 1, label: 'No Rem.', color: 'blue', icon: FileText },
              { tipo: 2, label: 'Retenciones', color: 'red', icon: Calculator },
              { tipo: 4, label: 'Contrib.', color: 'orange', icon: Users },
              { tipo: 6, label: 'Info', color: 'gray', icon: Info },
            ].map(({ tipo, label, color, icon: Icon }) => {
              const count = catalogoConceptos.filter(c => c.tipo === tipo).length
              const withFormula = catalogoConceptos.filter(c => c.tipo === tipo && c.formula).length
              return (
                <button
                  key={tipo}
                  onClick={() => setFiltroTipoConcepto(filtroTipoConcepto === tipo ? '' : tipo)}
                  className={`p-3 rounded-lg border transition-all ${
                    filtroTipoConcepto === tipo 
                      ? `bg-${color}-100 border-${color}-300 ring-2 ring-${color}-500/20` 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${filtroTipoConcepto === tipo ? `text-${color}-600` : 'text-gray-400'}`} />
                    <span className={`text-sm font-medium ${filtroTipoConcepto === tipo ? `text-${color}-700` : 'text-gray-700'}`}>
                      {label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-gray-900">{count}</span>
                    <span className="text-xs text-gray-500">({withFormula} con fórmula)</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Lista de conceptos */}
          {loadingConceptos ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
              <span className="ml-2 text-gray-500">Cargando conceptos...</span>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-20">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Descripción</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 w-28">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Fórmula de Cálculo</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 w-20">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 w-16">Editar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {catalogoConceptos
                    .filter(c => {
                      // Filtro por tipo
                      if (filtroTipoConcepto !== '' && c.tipo !== filtroTipoConcepto) return false
                      // Filtro por búsqueda
                      if (searchConcepto) {
                        const query = searchConcepto.toLowerCase()
                        return c.codigo.includes(query) || 
                               c.descripcion.toLowerCase().includes(query) ||
                               (c.formula && c.formula.toLowerCase().includes(query))
                      }
                      return true
                    })
                    .map(concepto => (
                      <tr key={concepto.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-semibold text-gray-700">{concepto.codigo}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-900 font-medium">{concepto.descripcion}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            concepto.tipo === 0 ? 'bg-green-100 text-green-700' :
                            concepto.tipo === 1 ? 'bg-blue-100 text-blue-700' :
                            concepto.tipo === 2 ? 'bg-red-100 text-red-700' :
                            concepto.tipo === 4 ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {concepto.tipo === 0 ? 'Haber' : 
                             concepto.tipo === 1 ? 'No Rem' : 
                             concepto.tipo === 2 ? 'Retención' : 
                             concepto.tipo === 4 ? 'Contrib.' : 'Info'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {concepto.formula ? (
                            <div className="flex items-center gap-2">
                              <FunctionSquare className="w-4 h-4 text-blue-400 flex-shrink-0" />
                              <span className="text-sm text-gray-600 italic">{concepto.formula}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">Sin fórmula definida</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {concepto.activo ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                              <Check className="w-3 h-3" />
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                              <X className="w-3 h-3" />
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => {
                              setConceptoEditar(concepto)
                              setShowConceptoModal(true)
                            }}
                            className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors group"
                            title="Editar concepto"
                          >
                            <Pencil className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              
              {catalogoConceptos.filter(c => {
                if (filtroTipoConcepto !== '' && c.tipo !== filtroTipoConcepto) return false
                if (searchConcepto) {
                  const query = searchConcepto.toLowerCase()
                  return c.codigo.includes(query) || 
                         c.descripcion.toLowerCase().includes(query) ||
                         (c.formula && c.formula.toLowerCase().includes(query))
                }
                return true
              }).length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No se encontraron conceptos</p>
                  <p className="text-sm text-gray-400 mt-1">Probá ajustando los filtros de búsqueda</p>
                </div>
              )}
            </div>
          )}

          {/* Leyenda */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900">Acerca de las Fórmulas</p>
                <p className="text-sm text-blue-700 mt-1">
                  Las fórmulas fueron extraídas directamente de <strong>Bejerman Sueldos</strong> y muestran 
                  cómo se calcula cada concepto. Algunos conceptos usan variables como "Sueldo o Jornal" 
                  (valor hora × 200 hs mensuales) o "Base Imponible" (suma de haberes remunerativos).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear/Editar Concepto */}
      {showConceptoModal && (
        <ConceptoModal
          concepto={conceptoEditar}
          onClose={() => {
            setShowConceptoModal(false)
            setConceptoEditar(null)
          }}
          onSaved={() => {
            setShowConceptoModal(false)
            setConceptoEditar(null)
            cargarCatalogoConceptos()
          }}
        />
      )}

      {/* Modal Nueva Liquidación */}
      {showNuevaModal && (
        <NuevaLiquidacionModal
          onClose={() => setShowNuevaModal(false)}
          onCreated={() => {
            setShowNuevaModal(false)
            cargarPeriodos()
          }}
        />
      )}

      {/* Modal Fórmula del Concepto */}
      {conceptoSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConceptoSeleccionado(null)}>
          <div 
            className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-6 py-4 ${
              conceptoSeleccionado.concepto_tipo === 0 ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
              conceptoSeleccionado.concepto_tipo === 1 ? 'bg-gradient-to-r from-blue-500 to-indigo-600' :
              conceptoSeleccionado.concepto_tipo === 2 ? 'bg-gradient-to-r from-red-500 to-rose-600' :
              conceptoSeleccionado.concepto_tipo === 4 ? 'bg-gradient-to-r from-orange-500 to-amber-600' :
              'bg-gradient-to-r from-gray-500 to-gray-600'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <FunctionSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/70 text-xs font-mono">{conceptoSeleccionado.concepto_codigo}</p>
                    <h3 className="font-semibold text-white">{conceptoSeleccionado.concepto_descripcion}</h3>
                  </div>
                </div>
                <button 
                  onClick={() => setConceptoSeleccionado(null)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Tipo de concepto */}
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  conceptoSeleccionado.concepto_tipo === 0 ? 'bg-green-100 text-green-700' :
                  conceptoSeleccionado.concepto_tipo === 1 ? 'bg-blue-100 text-blue-700' :
                  conceptoSeleccionado.concepto_tipo === 2 ? 'bg-red-100 text-red-700' :
                  conceptoSeleccionado.concepto_tipo === 4 ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {conceptoSeleccionado.concepto_tipo === 0 ? 'Haber Remunerativo' : 
                   conceptoSeleccionado.concepto_tipo === 1 ? 'No Remunerativo' : 
                   conceptoSeleccionado.concepto_tipo === 2 ? 'Retención / Deducción' : 
                   conceptoSeleccionado.concepto_tipo === 4 ? 'Contribución Patronal' : 'Informativo'}
                </span>
              </div>

              {/* Fórmula */}
              {conceptoSeleccionado.formula && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Fórmula de Cálculo (Bejerman)
                  </p>
                  <p className="text-slate-800 font-medium">
                    {conceptoSeleccionado.formula}
                  </p>
                </div>
              )}

              {/* Valores actuales */}
              <div className="grid grid-cols-3 gap-3">
                {conceptoSeleccionado.cantidad !== null && (
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Cantidad</p>
                    <p className="font-mono font-bold text-gray-900">
                      {conceptoSeleccionado.cantidad.toFixed(2)}
                    </p>
                  </div>
                )}
                {conceptoSeleccionado.valor_unitario !== null && (
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Valor Unitario</p>
                    <p className="font-mono font-bold text-gray-900">
                      $ {conceptoSeleccionado.valor_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                {conceptoSeleccionado.importe !== null && (
                  <div className={`rounded-lg p-3 text-center ${
                    conceptoSeleccionado.concepto_tipo === 2 ? 'bg-red-50' :
                    conceptoSeleccionado.concepto_tipo === 4 ? 'bg-orange-50' :
                    'bg-green-50'
                  }`}>
                    <p className="text-xs text-gray-500 mb-1">Importe</p>
                    <p className={`font-mono font-bold ${
                      conceptoSeleccionado.concepto_tipo === 2 ? 'text-red-700' :
                      conceptoSeleccionado.concepto_tipo === 4 ? 'text-orange-700' :
                      'text-green-700'
                    }`}>
                      {conceptoSeleccionado.concepto_tipo === 2 ? '-' : ''}$ {Math.abs(conceptoSeleccionado.importe).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>

              {/* Cálculo visual */}
              {conceptoSeleccionado.cantidad && conceptoSeleccionado.valor_unitario && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <p className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-2">
                    Cálculo Aplicado
                  </p>
                  <div className="flex items-center justify-center gap-2 text-lg font-mono">
                    <span className="font-bold text-gray-900">{conceptoSeleccionado.cantidad.toFixed(2)}</span>
                    <span className="text-gray-400">×</span>
                    <span className="text-gray-700">$ {conceptoSeleccionado.valor_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    <span className="text-gray-400">=</span>
                    <span className={`font-bold ${
                      conceptoSeleccionado.concepto_tipo === 2 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      $ {(conceptoSeleccionado.importe || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setConceptoSeleccionado(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ MODAL NUEVA LIQUIDACIÓN ============

interface NuevaLiquidacionModalProps {
  onClose: () => void
  onCreated: () => void
}

function NuevaLiquidacionModal({ onClose, onCreated }: NuevaLiquidacionModalProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [calculando, setCalculando] = useState(false)
  const [error, setError] = useState('')
  
  // Paso 1: Datos del período
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [tipo, setTipo] = useState('SQN')
  
  // Paso 2: Período creado
  const [periodoCreado, setPeriodoCreado] = useState<PeriodoLiquidacion | null>(null)
  
  // Paso 3: Resultados del cálculo
  const [resultados, setResultados] = useState<{
    empleados_procesados: number
    total_haberes: number
    total_retenciones: number
    total_neto: number
  } | null>(null)
  
  // Crear período
  const crearPeriodo = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/sicamar/liquidaciones/nueva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anio, mes, tipo }),
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al crear período')
      
      setPeriodoCreado(data.periodo)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }
  
  // Calcular liquidación
  const calcularLiquidacion = async (guardar: boolean = false) => {
    if (!periodoCreado) return
    
    setCalculando(true)
    setError('')
    try {
      const response = await fetch('/api/sicamar/liquidaciones/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodo_id: periodoCreado.id,
          guardar,
        }),
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al calcular')
      
      setResultados(data.resumen)
      if (guardar) {
        setStep(4)
      } else {
        setStep(3)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setCalculando(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Nueva Liquidación</h3>
              <p className="text-sm text-gray-500">Paso {step} de 4</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Progress bar */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${
                  s <= step ? 'bg-[#C4322F]' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-red-700">
              <XCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          
          {/* Paso 1: Definir período */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-4">Definir Período</h4>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                    <select
                      value={anio}
                      onChange={e => setAnio(parseInt(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      {[2025, 2024, 2023].map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
                    <select
                      value={mes}
                      onChange={e => setMes(parseInt(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      {MESES.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      value={tipo}
                      onChange={e => setTipo(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      {TIPOS_LIQUIDACION.filter(t => t.value).map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-700">
                  <strong>¿Qué incluye este proceso?</strong>
                </p>
                <ul className="text-sm text-blue-600 mt-2 space-y-1">
                  <li>• Cálculo de horas desde jornadas registradas</li>
                  <li>• Aplicación de novedades aprobadas</li>
                  <li>• Cálculo automático de antigüedad y presentismo</li>
                  <li>• Retenciones de ley y sindicales</li>
                </ul>
              </div>
            </div>
          )}
          
          {/* Paso 2: Confirmación de creación */}
          {step === 2 && periodoCreado && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h4 className="font-semibold text-gray-900 text-lg">Período Creado</h4>
                <p className="text-gray-500 mt-1">
                  {MESES[periodoCreado.mes - 1]} {periodoCreado.anio} - {periodoCreado.tipo}
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  El período está listo para calcular. El siguiente paso analizará:
                </p>
                <ul className="text-sm text-gray-600 mt-2 space-y-1">
                  <li>✓ Jornadas del período ({periodoCreado.fecha_desde} al {periodoCreado.fecha_hasta})</li>
                  <li>✓ Novedades pendientes y aprobadas</li>
                  <li>✓ Parámetros de liquidación vigentes</li>
                  <li>✓ Valores por categoría</li>
                </ul>
              </div>
            </div>
          )}
          
          {/* Paso 3: Resultados del cálculo */}
          {step === 3 && resultados && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <Calculator className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <h4 className="font-semibold text-gray-900 text-lg">Pre-Liquidación Calculada</h4>
                <p className="text-gray-500 mt-1">
                  Revisa los resultados antes de confirmar
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Empleados procesados</p>
                  <p className="text-2xl font-bold text-gray-900">{resultados.empleados_procesados}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-4">
                  <p className="text-sm text-emerald-600">Total Haberes</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    $ {resultados.total_haberes.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm text-red-600">Total Retenciones</p>
                  <p className="text-2xl font-bold text-red-700">
                    $ {resultados.total_retenciones.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-600">Total Neto</p>
                  <p className="text-2xl font-bold text-blue-700">
                    $ {resultados.total_neto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>⚠️ Importante:</strong> Los resultados aún no están guardados. 
                  Al confirmar se generarán los registros en la base de datos.
                </p>
              </div>
            </div>
          )}
          
          {/* Paso 4: Completado */}
          {step === 4 && (
            <div className="space-y-6 text-center py-8">
              <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto" />
              <div>
                <h4 className="font-semibold text-gray-900 text-xl">¡Liquidación Guardada!</h4>
                <p className="text-gray-500 mt-2">
                  Los conceptos han sido registrados correctamente.
                </p>
              </div>
              
              {resultados && (
                <div className="bg-emerald-50 rounded-lg p-4 inline-block">
                  <p className="text-emerald-700">
                    <strong>{resultados.empleados_procesados}</strong> empleados · 
                    Neto total: <strong>$ {resultados.total_neto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</strong>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-between">
          {step > 1 && step < 4 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Volver
            </button>
          ) : (
            <div />
          )}
          
          <div className="flex gap-2">
            {step === 1 && (
              <button
                onClick={crearPeriodo}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-[#C4322F] hover:bg-[#A52A27] rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {loading ? 'Creando...' : 'Crear Período'}
              </button>
            )}
            
            {step === 2 && (
              <button
                onClick={() => calcularLiquidacion(false)}
                disabled={calculando}
                className="px-4 py-2 text-sm font-medium text-white bg-[#C4322F] hover:bg-[#A52A27] rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {calculando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                {calculando ? 'Calculando...' : 'Calcular'}
              </button>
            )}
            
            {step === 3 && (
              <>
                <button
                  onClick={() => calcularLiquidacion(false)}
                  disabled={calculando}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Recalcular
                </button>
                <button
                  onClick={() => calcularLiquidacion(true)}
                  disabled={calculando}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {calculando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {calculando ? 'Guardando...' : 'Confirmar y Guardar'}
                </button>
              </>
            )}
            
            {step === 4 && (
              <button
                onClick={onCreated}
                className="px-4 py-2 text-sm font-medium text-white bg-[#C4322F] hover:bg-[#A52A27] rounded-lg"
              >
                Finalizar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ MODAL CREAR/EDITAR CONCEPTO ============

interface ConceptoModalProps {
  concepto: ConceptoCatalogo | null
  onClose: () => void
  onSaved: () => void
}

// Variables disponibles para las fórmulas
const VARIABLES_FORMULA = [
  { id: 'sueldo_jornal', label: 'Sueldo o Jornal', desc: 'Valor hora × 200 hs', ejemplo: 'Sueldo o Jornal' },
  { id: 'cantidad', label: 'Cantidad', desc: 'Cantidad ingresada en el concepto', ejemplo: 'CONCEPTO (Cantidad)' },
  { id: 'valor_generico', label: 'Valor Genérico', desc: 'Multiplicador configurado', ejemplo: 'CONCEPTO (Valor Genérico)' },
  { id: 'importe', label: 'Importe', desc: 'Importe directo ingresado', ejemplo: 'CONCEPTO (Importe)' },
  { id: 'total', label: 'Total Concepto', desc: 'Total de otro concepto', ejemplo: 'OTRO_CONCEPTO (Total)' },
  { id: 'base_imp', label: 'Base Imponible', desc: 'Suma de haberes remunerativos', ejemplo: 'Base Imponible (Total)' },
  { id: 'total_haberes', label: 'Total Haberes Rem.', desc: 'Suma de todos los haberes', ejemplo: 'Total Haberes Remunerativos' },
]

function ConceptoModal({ concepto, onClose, onSaved }: ConceptoModalProps) {
  const isEditing = !!concepto
  
  const [codigo, setCodigo] = useState(concepto?.codigo || '')
  const [descripcion, setDescripcion] = useState(concepto?.descripcion || '')
  const [tipo, setTipo] = useState(concepto?.tipo ?? 0)
  const [formula, setFormula] = useState(concepto?.formula || '')
  const [multiplicador, setMultiplicador] = useState(concepto?.multiplicador?.toString() || '1')
  const [activo, setActivo] = useState(concepto?.activo ?? true)
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  const handleSave = async () => {
    // Validaciones
    if (!codigo.trim()) {
      setError('El código es requerido')
      return
    }
    if (!descripcion.trim()) {
      setError('La descripción es requerida')
      return
    }
    
    setSaving(true)
    setError('')
    
    try {
      const response = await fetch('/api/sicamar/conceptos', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: concepto?.id,
          codigo: codigo.trim(),
          descripcion: descripcion.trim().toUpperCase(),
          tipo,
          formula: formula.trim() || null,
          multiplicador: parseFloat(multiplicador) || 1,
          activo,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al guardar')
      }
      
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }
  
  const insertVariable = (variable: string) => {
    setFormula(prev => prev + (prev ? ' ' : '') + variable)
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                {isEditing ? <Pencil className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
              </div>
              <div>
                <h3 className="font-semibold text-white">
                  {isEditing ? 'Editar Concepto' : 'Nuevo Concepto'}
                </h3>
                {isEditing && (
                  <p className="text-white/70 text-sm">Código: {concepto.codigo}</p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          
          {/* Código y Descripción */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                disabled={isEditing}
                maxLength={4}
                placeholder="0000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-lg disabled:bg-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="NOMBRE DEL CONCEPTO"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>
          
          {/* Tipo y Multiplicador */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Concepto
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value={0}>Haber Remunerativo</option>
                <option value={1}>No Remunerativo</option>
                <option value={2}>Retención / Deducción</option>
                <option value={4}>Contribución Patronal</option>
                <option value={6}>Informativo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Multiplicador
              </label>
              <input
                type="number"
                step="0.01"
                value={multiplicador}
                onChange={(e) => setMultiplicador(e.target.value)}
                placeholder="1.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Ej: 1.5 para 50% extra, 2.0 para 100%</p>
            </div>
          </div>
          
          {/* Fórmula */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fórmula de Cálculo
            </label>
            <textarea
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="Ej: Sueldo o Jornal × Cantidad horas × 1.50"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Describe cómo se calcula el concepto. Puede ser texto descriptivo o una fórmula.
            </p>
          </div>
          
          {/* Variables disponibles */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-3">
              Variables disponibles (click para insertar)
            </p>
            <div className="flex flex-wrap gap-2">
              {VARIABLES_FORMULA.map(v => (
                <button
                  key={v.id}
                  onClick={() => insertVariable(v.ejemplo)}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                  title={v.desc}
                >
                  {v.label}
                </button>
              ))}
              <button
                onClick={() => insertVariable(' × ')}
                className="px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg hover:bg-gray-100"
              >
                ×
              </button>
              <button
                onClick={() => insertVariable(' + ')}
                className="px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg hover:bg-gray-100"
              >
                +
              </button>
              <button
                onClick={() => insertVariable(' - ')}
                className="px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg hover:bg-gray-100"
              >
                -
              </button>
              <button
                onClick={() => insertVariable(' / ')}
                className="px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg hover:bg-gray-100"
              >
                /
              </button>
              <button
                onClick={() => insertVariable(' % ')}
                className="px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg hover:bg-gray-100"
              >
                %
              </button>
            </div>
          </div>
          
          {/* Estado activo */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="activo"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="activo" className="text-sm text-gray-700">
              Concepto activo (visible en liquidaciones)
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditing ? 'Guardar Cambios' : 'Crear Concepto'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
