'use client'

import { useState, useEffect, useCallback } from 'react'

// Tipos
interface Empleado {
  id: number
  legajo: string
  nombre: string
  apellido: string
  sector: string
  categoria: string
}

interface JornadaDiaria {
  id?: number
  empleado_id: number
  fecha: string
  turno_asignado: string | null
  hora_entrada_asignada: string | null
  hora_salida_asignada: string | null
  horas_asignadas: number
  hora_entrada_real: string | null
  hora_salida_real: string | null
  horas_trabajadas: number
  horas_diurnas: number
  horas_nocturnas: number
  horas_extra_50: number
  horas_extra_100: number
  horas_feriado: number
  origen: 'reloj' | 'manual' | 'mixto'
  estado_empleado: string | null
  tiene_inconsistencia: boolean
  tipo_inconsistencia: string | null
  inconsistencia_resuelta: boolean
  resuelto_por: string | null
  notas: string | null
}

interface EmpleadoConJornadas {
  empleado: Empleado
  jornadas: Record<string, JornadaDiaria>
  totales: {
    horas_trabajadas: number
    horas_diurnas: number
    horas_nocturnas: number
    horas_extra: number
    dias_trabajados: number
    inconsistencias: number
  }
}

interface EstadoLiquidacion {
  totalEmpleados: number
  empleadosProcesados: number
  empleadosConInconsistencias: number
  diasProcesados: number
  diasTotales: number
  listoParaLiquidar: boolean
}

// Helpers
const DIAS_SEMANA = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function getFechasQuincena(anio: number, mes: number, quincena: 1 | 2): string[] {
  const fechas: string[] = []
  const ultimoDia = new Date(anio, mes, 0).getDate()
  
  const desde = quincena === 1 ? 1 : 16
  const hasta = quincena === 1 ? 15 : ultimoDia
  
  if (quincena === 1) {
    const primerDia = new Date(anio, mes - 1, 1)
    const diaSemana = primerDia.getDay()
    if (diaSemana !== 0) {
      const mesAnterior = mes === 1 ? 12 : mes - 1
      const anioAnterior = mes === 1 ? anio - 1 : anio
      const ultimoDiaMesAnterior = new Date(anioAnterior, mesAnterior, 0).getDate()
      const ultimoDiaDate = new Date(anioAnterior, mesAnterior - 1, ultimoDiaMesAnterior)
      const diasHastaDomingo = ultimoDiaDate.getDay()
      if (diasHastaDomingo !== 0) {
        const domingoAnterior = ultimoDiaMesAnterior - diasHastaDomingo
        fechas.push(`${anioAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(domingoAnterior).padStart(2, '0')}`)
      } else {
        fechas.push(`${anioAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(ultimoDiaMesAnterior).padStart(2, '0')}`)
      }
    }
  }
  
  for (let d = desde; d <= hasta; d++) {
    const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    fechas.push(fecha)
  }
  
  return fechas
}

function formatHora(timestamp: string | null): string {
  if (!timestamp) return '-'
  try {
    const d = new Date(timestamp)
    return d.toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires'
    })
  } catch {
    return '-'
  }
}

// Componente CeldaDia simplificado
function CeldaDia({ 
  jornada, 
  onClick 
}: { 
  jornada: JornadaDiaria | null
  onClick: () => void 
}) {
  if (!jornada) {
    return (
      <td className="py-2 text-center w-12 bg-white cursor-pointer hover:bg-neutral-50" onClick={onClick}>
        <span className="text-neutral-300">-</span>
      </td>
    )
  }

  if (jornada.estado_empleado) {
    const estadoConfig: Record<string, { bg: string; text: string; label: string }> = {
      'enfermo': { bg: 'bg-neutral-800', text: 'text-white', label: 'Enf' },
      'enf': { bg: 'bg-neutral-800', text: 'text-white', label: 'Enf' },
      'vacaciones': { bg: 'bg-neutral-800', text: 'text-white', label: 'Vac' },
      'vac': { bg: 'bg-neutral-800', text: 'text-white', label: 'Vac' },
      'accidente': { bg: 'bg-neutral-800', text: 'text-white', label: 'Acc' },
      'acc': { bg: 'bg-neutral-800', text: 'text-white', label: 'Acc' },
      'licencia': { bg: 'bg-neutral-800', text: 'text-white', label: 'Lic' },
      'lic': { bg: 'bg-neutral-800', text: 'text-white', label: 'Lic' },
      'inasistencia': { bg: 'bg-red-600', text: 'text-white', label: 'Ina' },
      'ina': { bg: 'bg-red-600', text: 'text-white', label: 'Ina' },
      'ausente': { bg: 'bg-neutral-800', text: 'text-white', label: 'Aus' },
      'aus': { bg: 'bg-neutral-800', text: 'text-white', label: 'Aus' },
    }
    const config = estadoConfig[jornada.estado_empleado.toLowerCase()] || { bg: 'bg-neutral-800', text: 'text-white', label: '?' }
    return (
      <td className="py-2 text-center cursor-pointer hover:bg-neutral-50 w-12 bg-white" onClick={onClick}>
        <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium rounded ${config.bg} ${config.text}`}>
          {config.label}
        </span>
      </td>
    )
  }

  const turnoBadgePastel: Record<string, { bg: string; text: string }> = {
    'M': { bg: 'bg-green-100', text: 'text-green-700' },
    'T': { bg: 'bg-violet-100', text: 'text-violet-700' }, 
    'N': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  }
  const turnoBadgeSolido: Record<string, { bg: string; text: string }> = {
    'M': { bg: 'bg-green-600', text: 'text-white' },
    'T': { bg: 'bg-violet-600', text: 'text-white' }, 
    'N': { bg: 'bg-indigo-600', text: 'text-white' },
  }

  const tieneInconsistencia = jornada.tiene_inconsistencia && !jornada.inconsistencia_resuelta
  const estaProcesado = jornada.horas_trabajadas > 0 || jornada.hora_entrada_real
  const turnoLabel = jornada.turno_asignado || 'M'
  
  let badgeFinal = turnoBadgePastel[turnoLabel] || { bg: 'bg-neutral-100', text: 'text-neutral-700' }
  let contenido = turnoLabel

  if (tieneInconsistencia) {
    badgeFinal = { bg: 'bg-amber-100', text: 'text-amber-700' }
    contenido = turnoLabel + '!'
  } else if (estaProcesado) {
    badgeFinal = turnoBadgeSolido[turnoLabel] || { bg: 'bg-neutral-600', text: 'text-white' }
    contenido = '✓'
  }

  return (
    <td 
      className="py-2 text-center cursor-pointer hover:bg-neutral-50 w-12 bg-white"
      onClick={onClick}
      title={`${formatHora(jornada.hora_entrada_real)} - ${formatHora(jornada.hora_salida_real)} (${jornada.horas_trabajadas?.toFixed(1) || 0}h)`}
    >
      <span className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 text-xs font-medium rounded ${badgeFinal.bg} ${badgeFinal.text}`}>
        {contenido}
      </span>
    </td>
  )
}

export default function LiquidacionesPage() {
  const [anio, setAnio] = useState(2025)
  const [mes, setMes] = useState(12)
  const [quincena, setQuincena] = useState<1 | 2>(1)
  const [empleados, setEmpleados] = useState<EmpleadoConJornadas[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<{ turno: 'M' | 'T' | 'N'; fecha: string } | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [liquidando, setLiquidando] = useState(false)
  
  const fechas = getFechasQuincena(anio, mes, quincena)

  // Calcular estado de liquidación
  const estadoLiquidacion: EstadoLiquidacion = (() => {
    let empleadosProcesados = 0
    let empleadosConInconsistencias = 0
    let diasConDatos = new Set<string>()
    
    for (const emp of empleados) {
      let tieneDatos = false
      let tieneInconsistencia = false
      
      for (const [fecha, jornada] of Object.entries(emp.jornadas)) {
        if (jornada.horas_trabajadas > 0 || jornada.estado_empleado || jornada.hora_entrada_real) {
          tieneDatos = true
          diasConDatos.add(fecha)
        }
        if (jornada.tiene_inconsistencia && !jornada.inconsistencia_resuelta) {
          tieneInconsistencia = true
        }
      }
      
      if (tieneDatos) empleadosProcesados++
      if (tieneInconsistencia) empleadosConInconsistencias++
    }
    
    const diasTotales = fechas.filter(f => new Date(f + 'T12:00:00').getDay() !== 0).length // Excluir domingos puros
    
    return {
      totalEmpleados: empleados.length,
      empleadosProcesados,
      empleadosConInconsistencias,
      diasProcesados: diasConDatos.size,
      diasTotales,
      listoParaLiquidar: empleadosConInconsistencias === 0 && empleadosProcesados > 0
    }
  })()

  // Cargar datos
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const ultimoDia = new Date(anio, mes, 0).getDate()
      const desde = quincena === 1 ? 1 : 16
      const hasta = quincena === 1 ? 15 : ultimoDia
      
      let fechaDesde = `${anio}-${String(mes).padStart(2, '0')}-${String(desde).padStart(2, '0')}`
      
      if (quincena === 1) {
        const primerDia = new Date(anio, mes - 1, 1)
        if (primerDia.getDay() === 1) {
          const mesAnterior = mes === 1 ? 12 : mes - 1
          const anioAnterior = mes === 1 ? anio - 1 : anio
          const ultimoDiaMesAnterior = new Date(anioAnterior, mesAnterior, 0).getDate()
          fechaDesde = `${anioAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(ultimoDiaMesAnterior).padStart(2, '0')}`
        }
      }
      
      const fechaHasta = `${anio}-${String(mes).padStart(2, '0')}-${String(hasta).padStart(2, '0')}`
      
      const empRes = await fetch('/api/sicamar/empleados?clase=Jornal&activo=true')
      const empData = await empRes.json()
      const empleadosList = empData.data || empData.empleados || []
      
      if (empleadosList.length === 0) {
        setEmpleados([])
        setLoading(false)
        return
      }
      
      const jorRes = await fetch(`/api/sicamar/jornadas?desde=${fechaDesde}&hasta=${fechaHasta}`)
      const jorData = await jorRes.json()
      
      const fechasArray = getFechasQuincena(anio, mes, quincena)
      
      const jornadasMap = new Map<number, Map<string, JornadaDiaria>>()
      for (const j of jorData.data || []) {
        if (!jornadasMap.has(j.empleado_id)) {
          jornadasMap.set(j.empleado_id, new Map())
        }
        jornadasMap.get(j.empleado_id)!.set(j.fecha, j)
      }
      
      const empleadosConJornadas: EmpleadoConJornadas[] = empleadosList.map((emp: Empleado) => {
        const jornadasEmp = jornadasMap.get(emp.id) || new Map()
        const jornadas: Record<string, JornadaDiaria> = {}
        
        const totales = {
          horas_trabajadas: 0,
          horas_diurnas: 0,
          horas_nocturnas: 0,
          horas_extra: 0,
          dias_trabajados: 0,
          inconsistencias: 0
        }
        
        for (const fecha of fechasArray) {
          const jornada = jornadasEmp.get(fecha)
          if (jornada) {
            jornadas[fecha] = jornada
            totales.horas_trabajadas += jornada.horas_trabajadas || 0
            totales.horas_diurnas += jornada.horas_diurnas || 0
            totales.horas_nocturnas += jornada.horas_nocturnas || 0
            totales.horas_extra += (jornada.horas_extra_50 || 0) + (jornada.horas_extra_100 || 0)
            if (jornada.horas_trabajadas > 0 || jornada.estado_empleado) totales.dias_trabajados++
            if (jornada.tiene_inconsistencia && !jornada.inconsistencia_resuelta) totales.inconsistencias++
          }
        }
        
        return { empleado: emp, jornadas, totales }
      })
      
      setEmpleados(empleadosConJornadas)
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }, [anio, mes, quincena])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Procesar turno
  const handleProcesarTurnoDia = async (fecha: string, turno: 'M' | 'T' | 'N') => {
    setProcesando({ turno, fecha })
    setFeedback(null)
    
    try {
      const res = await fetch('/api/sicamar/jornadas/procesar-turno-dia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, turno })
      })
      const data = await res.json()
      
      if (data.success) {
        setFeedback({ type: 'success', message: data.message })
        
        // Actualizar solo el día procesado
        const jorRes = await fetch(`/api/sicamar/jornadas?desde=${fecha}&hasta=${fecha}`)
        const jorData = await jorRes.json()
        
        setEmpleados(prev => {
          const updatedJornadas = jorData.data || []
          const jornadasPorEmpleado = new Map<number, JornadaDiaria>()
          for (const j of updatedJornadas) {
            jornadasPorEmpleado.set(j.empleado_id, j)
          }
          
          return prev.map(emp => {
            const jornadaActualizada = jornadasPorEmpleado.get(emp.empleado.id)
            if (jornadaActualizada) {
              const nuevasJornadas = { ...emp.jornadas, [fecha]: jornadaActualizada }
              const totales = { ...emp.totales }
              
              // Recalcular
              totales.horas_trabajadas = 0
              totales.inconsistencias = 0
              for (const j of Object.values(nuevasJornadas)) {
                totales.horas_trabajadas += j.horas_trabajadas || 0
                if (j.tiene_inconsistencia && !j.inconsistencia_resuelta) totales.inconsistencias++
              }
              
              return { ...emp, jornadas: nuevasJornadas, totales }
            }
            return emp
          })
        })
        
        setTimeout(() => setFeedback(null), 4000)
      } else {
        setFeedback({ type: 'error', message: data.error || 'Error' })
      }
    } catch (error) {
      console.error('Error:', error)
      setFeedback({ type: 'error', message: 'Error de conexión' })
    } finally {
      setProcesando(null)
    }
  }

  // Ejecutar liquidación
  const handleLiquidar = async () => {
    if (!estadoLiquidacion.listoParaLiquidar) return
    
    setLiquidando(true)
    setFeedback(null)
    
    try {
      // Preparar datos para el motor
      const ultimoDia = new Date(anio, mes, 0).getDate()
      const desde = quincena === 1 ? 1 : 16
      const hasta = quincena === 1 ? 15 : ultimoDia
      
      const res = await fetch('/api/sicamar/liquidaciones/ejecutar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anio,
          mes,
          quincena,
          desde: `${anio}-${String(mes).padStart(2, '0')}-${String(desde).padStart(2, '0')}`,
          hasta: `${anio}-${String(mes).padStart(2, '0')}-${String(hasta).padStart(2, '0')}`,
          empleados: empleados.map(e => ({
            empleado_id: e.empleado.id,
            ...e.totales
          }))
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setFeedback({ 
          type: 'success', 
          message: `✓ Liquidación generada: ${data.liquidacion_id || 'OK'}` 
        })
      } else {
        setFeedback({ type: 'error', message: data.error || 'Error al liquidar' })
      }
    } catch (error) {
      console.error('Error liquidando:', error)
      setFeedback({ type: 'error', message: 'Error de conexión' })
    } finally {
      setLiquidando(false)
    }
  }

  const prevQuincena = () => {
    if (quincena === 1) {
      setQuincena(2)
      if (mes === 1) { setMes(12); setAnio(anio - 1) } 
      else { setMes(mes - 1) }
    } else {
      setQuincena(1)
    }
  }

  const nextQuincena = () => {
    if (quincena === 2) {
      setQuincena(1)
      if (mes === 12) { setMes(1); setAnio(anio + 1) }
      else { setMes(mes + 1) }
    } else {
      setQuincena(2)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-neutral-500">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Banner de procesamiento */}
      {procesando && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-3">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          <span className="text-sm text-blue-700">
            Procesando turno <strong>{procesando.turno === 'M' ? 'Mañana' : procesando.turno === 'T' ? 'Tarde' : 'Noche'}</strong>...
          </span>
        </div>
      )}
      
      {/* Banner de feedback */}
      {feedback && !procesando && (
        <div className={`px-4 py-2 border-b flex items-center justify-between ${
          feedback.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <span className={`text-sm ${feedback.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
            {feedback.message}
          </span>
          <button onClick={() => setFeedback(null)} className="text-sm px-2 hover:opacity-70">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-medium">Liquidación de Jornales</h1>
          
          <div className="flex items-center gap-2">
            <button 
              className="h-8 w-8 flex items-center justify-center border border-neutral-200 rounded hover:bg-neutral-50"
              onClick={prevQuincena}
            >
              ←
            </button>
            <div className="text-sm font-medium min-w-[180px] text-center">
              {quincena === 1 ? '1era' : '2da'} Quincena {MESES[mes - 1]} {anio}
            </div>
            <button 
              className="h-8 w-8 flex items-center justify-center border border-neutral-200 rounded hover:bg-neutral-50"
              onClick={nextQuincena}
            >
              →
            </button>
          </div>
        </div>
        
        <div className="text-sm text-neutral-500">
          {empleados.length} empleados
        </div>
      </div>

      {/* Tabla de jornadas */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide min-w-[200px] sticky left-0 bg-neutral-50 z-20">
                Empleado
              </th>
              {fechas.map(fecha => {
                const d = new Date(fecha + 'T12:00:00')
                const diaSemana = d.getDay()
                const esDomingo = diaSemana === 0
                
                return (
                  <th key={fecha} className={`px-1 py-2 text-center min-w-[48px] ${esDomingo ? 'bg-neutral-100' : ''}`}>
                    <div className="text-[10px] text-neutral-400">{DIAS_SEMANA[diaSemana]}</div>
                    <div className="text-xs font-medium">{d.getDate()}</div>
                    <div className="flex gap-0.5 justify-center mt-1">
                      {esDomingo ? (
                        <button
                          className={`w-4 h-4 text-[8px] rounded flex items-center justify-center ${
                            procesando?.fecha === fecha && procesando?.turno === 'N'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                          } disabled:opacity-50`}
                          onClick={() => handleProcesarTurnoDia(fecha, 'N')}
                          disabled={procesando !== null}
                        >
                          {procesando?.fecha === fecha && procesando?.turno === 'N' ? '⏳' : 'N'}
                        </button>
                      ) : (
                        <>
                          <button
                            className={`w-4 h-4 text-[8px] rounded flex items-center justify-center ${
                              procesando?.fecha === fecha && procesando?.turno === 'M'
                                ? 'bg-green-600 text-white'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            } disabled:opacity-50`}
                            onClick={() => handleProcesarTurnoDia(fecha, 'M')}
                            disabled={procesando !== null}
                          >
                            {procesando?.fecha === fecha && procesando?.turno === 'M' ? '⏳' : 'M'}
                          </button>
                          <button
                            className={`w-4 h-4 text-[8px] rounded flex items-center justify-center ${
                              procesando?.fecha === fecha && procesando?.turno === 'T'
                                ? 'bg-violet-600 text-white'
                                : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                            } disabled:opacity-50`}
                            onClick={() => handleProcesarTurnoDia(fecha, 'T')}
                            disabled={procesando !== null}
                          >
                            {procesando?.fecha === fecha && procesando?.turno === 'T' ? '⏳' : 'T'}
                          </button>
                          <button
                            className={`w-4 h-4 text-[8px] rounded flex items-center justify-center ${
                              procesando?.fecha === fecha && procesando?.turno === 'N'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                            } disabled:opacity-50`}
                            onClick={() => handleProcesarTurnoDia(fecha, 'N')}
                            disabled={procesando !== null}
                          >
                            {procesando?.fecha === fecha && procesando?.turno === 'N' ? '⏳' : 'N'}
                          </button>
                        </>
                      )}
                    </div>
                  </th>
                )
              })}
              <th className="px-3 py-2 text-right text-xs font-medium text-neutral-500 uppercase tracking-wide min-w-[70px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {empleados.map(({ empleado, jornadas, totales }) => (
              <tr key={empleado.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-3 py-2 sticky left-0 bg-white z-10">
                  <div className="font-medium text-sm">{empleado.apellido}, {empleado.nombre}</div>
                  <div className="text-xs text-neutral-400">#{empleado.legajo}</div>
                </td>
                {fechas.map(fecha => (
                  <CeldaDia
                    key={fecha}
                    jornada={jornadas[fecha] || null}
                    onClick={() => {}}
                  />
                ))}
                <td className="px-3 py-2 text-right font-medium">
                  <div className="text-sm">{Math.round(totales.horas_trabajadas)}h</div>
                  {totales.inconsistencias > 0 && (
                    <div className="text-[10px] text-amber-600">{totales.inconsistencias} !</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Panel de liquidación */}
      <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Estado */}
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-neutral-500">Empleados:</span>{' '}
                <span className="font-medium">{estadoLiquidacion.empleadosProcesados}/{estadoLiquidacion.totalEmpleados}</span>
              </div>
              <div>
                <span className="text-neutral-500">Inconsistencias:</span>{' '}
                <span className={`font-medium ${estadoLiquidacion.empleadosConInconsistencias > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {estadoLiquidacion.empleadosConInconsistencias}
                </span>
              </div>
            </div>
            
            {/* Indicador de estado */}
            {estadoLiquidacion.listoParaLiquidar ? (
              <div className="flex items-center gap-2 text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm font-medium">Listo para liquidar</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600">
                <span className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-sm">Revisar inconsistencias primero</span>
              </div>
            )}
          </div>

          {/* Botón liquidar */}
          <button
            className={`h-10 px-6 text-sm font-medium rounded transition-colors ${
              estadoLiquidacion.listoParaLiquidar && !liquidando
                ? 'bg-[#C4322F] hover:bg-[#A02A2A] text-white'
                : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
            }`}
            disabled={!estadoLiquidacion.listoParaLiquidar || liquidando}
            onClick={handleLiquidar}
          >
            {liquidando ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Liquidando...
              </span>
            ) : (
              'LIQUIDAR QUINCENA'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}




