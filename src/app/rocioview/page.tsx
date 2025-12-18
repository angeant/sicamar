'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Filter, Terminal, ChevronDown, ChevronRight } from 'lucide-react'

interface ConceptoCalculado {
  concepto_codigo: string
  concepto_descripcion: string
  concepto_tipo: number
  cantidad: number | null
  valor_unitario: number | null
  importe: number
  formula_aplicada: string
}

interface EmpleadoLiquidado {
  legajo: string
  empleado_id: number
  nombre_completo: string
  conceptos: ConceptoCalculado[]
  totales: {
    haberes: number
    no_remunerativos: number
    retenciones: number
    contribuciones: number
    neto: number
  }
}

interface ResultadoLiquidacion {
  success: boolean
  periodo: {
    anio: number
    mes: number
    tipo: string
    descripcion: string
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
  empleados: EmpleadoLiquidado[]
}

interface LiquidacionRow {
  legajo: string
  apellido: string
  fecha_liquidacion: string
  descripcion_liquidacion: string
  concepto_codigo: string
  concepto_descripcion: string
  cantidad: number | null
  importe: number
}

const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function formatImporte(n: number | null): string {
  if (n === null || n === 0) return '0,00'
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatFecha(fecha: string): string {
  const d = new Date(fecha)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function RocioViewPage() {
  const [loading, setLoading] = useState(true)
  const [resultado, setResultado] = useState<ResultadoLiquidacion | null>(null)
  const [rows, setRows] = useState<LiquidacionRow[]>([])
  const [conceptoFilter, setConceptoFilter] = useState<string>('')
  const [conceptos, setConceptos] = useState<{codigo: string, descripcion: string}[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showMotor, setShowMotor] = useState(true)
  const [motorLog, setMotorLog] = useState<string[]>([])

  // Configuración fija: 2da Quincena Noviembre 2025
  const anio = 2025
  const mes = 11
  const tipo = 'SQN'

  const procesarLiquidacion = async () => {
    setLoading(true)
    setError(null)
    setMotorLog([])
    
    const addLog = (msg: string) => {
      setMotorLog(prev => [...prev, `[${new Date().toLocaleTimeString('es-AR')}] ${msg}`])
    }
    
    try {
      addLog('Iniciando Motor de Liquidaciones Kalia...')
      addLog(`Período: ${meses[mes]} ${anio} - 2da Quincena (Jornalizados)`)
      addLog('Consultando empleados...')
      
      const res = await fetch('/api/sicamar/liquidaciones/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anio, mes, tipo })
      })
      
      const data = await res.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Error procesando liquidación')
      }
      
      addLog(`✓ ${data.resumen.total_empleados} empleados procesados`)
      addLog(`✓ Total Haberes: $${formatImporte(data.resumen.total_haberes)}`)
      addLog(`✓ Total Retenciones: $${formatImporte(data.resumen.total_retenciones)}`)
      addLog(`✓ Total Neto: $${formatImporte(data.resumen.total_neto)}`)
      addLog('Motor completado.')
      
      setResultado(data)
      
      // Convertir a filas para la tabla
      const allRows: LiquidacionRow[] = []
      const conceptosSet = new Map<string, string>()
      
      for (const emp of data.empleados || []) {
        const [apellido] = emp.nombre_completo.split(',')
        
        for (const concepto of emp.conceptos || []) {
          conceptosSet.set(concepto.concepto_codigo, concepto.concepto_descripcion)
          allRows.push({
            legajo: emp.legajo,
            apellido: apellido?.trim() || emp.nombre_completo,
            fecha_liquidacion: data.periodo.fecha_hasta,
            descripcion_liquidacion: `2DA Q ${meses[mes]?.toUpperCase()} ${anio}`,
            concepto_codigo: concepto.concepto_codigo,
            concepto_descripcion: concepto.concepto_descripcion,
            cantidad: concepto.cantidad,
            importe: concepto.importe,
          })
        }
      }
      
      // Ordenar por legajo
      allRows.sort((a, b) => {
        const legA = parseInt(a.legajo) || 0
        const legB = parseInt(b.legajo) || 0
        if (legA !== legB) return legA - legB
        return a.concepto_codigo.localeCompare(b.concepto_codigo)
      })
      
      setRows(allRows)
      setConceptos(Array.from(conceptosSet.entries()).map(([codigo, descripcion]) => ({ codigo, descripcion })).sort((a, b) => a.codigo.localeCompare(b.codigo)))
      
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    procesarLiquidacion()
  }, [])

  // Filtrar por concepto
  const filteredRows = conceptoFilter 
    ? rows.filter(r => r.concepto_codigo === conceptoFilter)
    : rows

  // Legajos únicos
  const legajosUnicos = [...new Set(filteredRows.map(r => r.legajo))]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-medium text-neutral-900">Liquidaciones</h1>
            <span className="text-xs text-neutral-400">Vista Rocío</span>
            <span className="text-xs px-2 py-0.5 bg-[#C4322F]/10 text-[#C4322F] rounded">
              2da Quincena Noviembre 2025
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Filtro de concepto */}
            <select
              value={conceptoFilter}
              onChange={(e) => setConceptoFilter(e.target.value)}
              className="h-8 pl-2 pr-6 text-sm border border-neutral-200 rounded focus:outline-none focus:border-neutral-400 min-w-[200px]"
            >
              <option value="">Todos los conceptos</option>
              {conceptos.map(c => (
                <option key={c.codigo} value={c.codigo}>
                  {c.codigo} - {c.descripcion}
                </option>
              ))}
            </select>
            
            <button
              onClick={procesarLiquidacion}
              disabled={loading}
              className="h-8 px-3 text-sm bg-[#C4322F] text-white rounded hover:bg-[#A02A2A] flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Reprocesar
            </button>
          </div>
        </div>
      </header>

      {/* Motor Log (colapsable) */}
      <div className="border-b border-neutral-100 bg-neutral-900 text-green-400">
        <button 
          onClick={() => setShowMotor(!showMotor)}
          className="w-full px-4 py-2 flex items-center gap-2 text-xs font-mono hover:bg-neutral-800"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Motor de Liquidaciones Kalia</span>
          {loading ? (
            <span className="ml-2 px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px]">PROCESANDO</span>
          ) : error ? (
            <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px]">ERROR</span>
          ) : (
            <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">COMPLETADO</span>
          )}
          {showMotor ? <ChevronDown className="w-3.5 h-3.5 ml-auto" /> : <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
        </button>
        {showMotor && (
          <div className="px-4 pb-3 max-h-32 overflow-y-auto font-mono text-[11px] space-y-0.5">
            {motorLog.map((log, idx) => (
              <div key={idx} className={log.includes('✓') ? 'text-green-400' : 'text-neutral-400'}>
                {log}
              </div>
            ))}
            {loading && <div className="text-amber-400 animate-pulse">Procesando...</div>}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-[1800px] mx-auto px-4 py-3 bg-red-50 border-b border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Resumen */}
      {resultado && (
        <div className="border-b border-neutral-100 bg-neutral-50">
          <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center gap-8 text-xs">
            <div>
              <span className="text-neutral-500">Empleados:</span>
              <span className="ml-2 font-medium text-neutral-900">{resultado.resumen.total_empleados}</span>
            </div>
            <div>
              <span className="text-neutral-500">Haberes:</span>
              <span className="ml-2 font-medium text-green-600">${formatImporte(resultado.resumen.total_haberes)}</span>
            </div>
            <div>
              <span className="text-neutral-500">Retenciones:</span>
              <span className="ml-2 font-medium text-red-600">${formatImporte(resultado.resumen.total_retenciones)}</span>
            </div>
            <div>
              <span className="text-neutral-500">Neto:</span>
              <span className="ml-2 font-medium text-neutral-900">${formatImporte(resultado.resumen.total_neto)}</span>
            </div>
            {conceptoFilter && (
              <>
                <div className="w-px h-4 bg-neutral-300" />
                <div className="text-amber-600">
                  <Filter className="w-3 h-3 inline mr-1" />
                  {conceptoFilter}: ${formatImporte(filteredRows.reduce((acc, r) => acc + (r.importe || 0), 0))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Subheader con filtro activo */}
      {conceptoFilter && (
        <div className="border-b border-neutral-100 bg-amber-50/50">
          <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs text-amber-700">
              Filtrando: <strong>{conceptoFilter}</strong> - {conceptos.find(c => c.codigo === conceptoFilter)?.descripcion}
            </span>
            <button 
              onClick={() => setConceptoFilter('')}
              className="ml-2 text-xs text-amber-600 hover:text-amber-800 underline"
            >
              Quitar filtro
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="border-b border-neutral-100">
        <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center gap-6 text-xs text-neutral-500">
          <span>{filteredRows.length} registros</span>
          <span>{legajosUnicos.length} empleados</span>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-[1800px] mx-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 sticky top-12">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide border-b border-neutral-200 w-20">
                  Legajo
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide border-b border-neutral-200 w-40">
                  Apellido
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide border-b border-neutral-200 w-28">
                  Fecha Liq.
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide border-b border-neutral-200">
                  Descripción Liquidación
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide border-b border-neutral-200 w-20">
                  Código
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide border-b border-neutral-200">
                  Concepto
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-neutral-500 uppercase tracking-wide border-b border-neutral-200 w-24">
                  Cantidad
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-neutral-500 uppercase tracking-wide border-b border-neutral-200 w-32">
                  Importe
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Procesando liquidación...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-neutral-400">
                    No hay datos para mostrar
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const prevRow = idx > 0 ? filteredRows[idx - 1] : null
                  const isNewLegajo = !prevRow || prevRow.legajo !== row.legajo
                  
                  return (
                    <tr 
                      key={`${row.legajo}-${row.concepto_codigo}-${idx}`}
                      className={`
                        hover:bg-neutral-50 border-b border-neutral-100
                        ${isNewLegajo ? 'border-t-2 border-t-neutral-200' : ''}
                      `}
                    >
                      <td className="px-3 py-1.5 text-neutral-600 font-mono">
                        {row.legajo}
                      </td>
                      <td className="px-3 py-1.5 text-neutral-900 font-medium">
                        {row.apellido}
                      </td>
                      <td className="px-3 py-1.5 text-neutral-500">
                        {formatFecha(row.fecha_liquidacion)}
                      </td>
                      <td className="px-3 py-1.5 text-neutral-700">
                        {row.descripcion_liquidacion}
                      </td>
                      <td className="px-3 py-1.5 text-neutral-500 font-mono text-xs">
                        {row.concepto_codigo}
                      </td>
                      <td className="px-3 py-1.5 text-neutral-600">
                        {row.concepto_descripcion}
                      </td>
                      <td className="px-3 py-1.5 text-right text-neutral-600 tabular-nums">
                        {row.cantidad !== null && row.cantidad > 0 ? formatImporte(row.cantidad) : ''}
                      </td>
                      <td className="px-3 py-1.5 text-right text-neutral-900 font-medium tabular-nums">
                        {formatImporte(row.importe)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
