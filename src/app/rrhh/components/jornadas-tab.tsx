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
  
  // Asignado
  turno_asignado: string | null
  hora_entrada_asignada: string | null
  hora_salida_asignada: string | null
  horas_asignadas: number
  
  // Real
  hora_entrada_real: string | null
  hora_salida_real: string | null
  horas_trabajadas: number
  
  // Desglose
  horas_diurnas: number
  horas_nocturnas: number
  horas_extra_50: number
  horas_extra_100: number
  horas_feriado: number
  
  // Estado
  origen: 'reloj' | 'manual' | 'mixto'
  estado_empleado: string | null
  
  // Validación
  tiene_inconsistencia: boolean
  tipo_inconsistencia: string | null
  inconsistencia_resuelta: boolean
  resuelto_por: string | null
  
  notas: string | null
}

interface EmpleadoConJornadas {
  empleado: Empleado
  jornadas: Record<string, JornadaDiaria> // fecha -> jornada
  totales: {
    horas_trabajadas: number
    horas_diurnas: number
    horas_nocturnas: number
    horas_extra: number
    dias_trabajados: number
    inconsistencias: number
  }
}

// Helpers
const DIAS_SEMANA = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']

function getFechasQuincena(anio: number, mes: number, quincena: 1 | 2): string[] {
  const fechas: string[] = []
  const ultimoDia = new Date(anio, mes, 0).getDate()
  
  const desde = quincena === 1 ? 1 : 16
  const hasta = quincena === 1 ? 15 : ultimoDia
  
  // Para primera quincena, agregar el domingo anterior (turno noche que inicia el lunes)
  if (quincena === 1) {
    const primerDia = new Date(anio, mes - 1, 1) // mes es 1-indexed
    const diaSemana = primerDia.getDay()
    
    // Si el día 1 no es domingo, agregar el domingo anterior
    if (diaSemana !== 0) {
      const mesAnterior = mes === 1 ? 12 : mes - 1
      const anioAnterior = mes === 1 ? anio - 1 : anio
      const ultimoDiaMesAnterior = new Date(anioAnterior, mesAnterior, 0).getDate()
      
      // Buscar el último domingo del mes anterior
      const ultimoDiaDate = new Date(anioAnterior, mesAnterior - 1, ultimoDiaMesAnterior)
      const diasHastaDomingo = ultimoDiaDate.getDay() // 0 = domingo
      if (diasHastaDomingo !== 0) {
        const domingoAnterior = ultimoDiaMesAnterior - diasHastaDomingo
        fechas.push(`${anioAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(domingoAnterior).padStart(2, '0')}`)
      } else {
        // El último día ya es domingo
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

function getDiaSemana(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  return DIAS_SEMANA[d.getDay()]
}

function formatHora(timestamp: string | null): string {
  if (!timestamp) return '-'
  try {
    const d = new Date(timestamp)
    return d.toLocaleTimeString('es-AR', { 
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
  } catch {
    return '-'
  }
}

// Componente de celda de día - Badges limpios
function CeldaDia({ 
  fecha, 
  jornada, 
  esFuturo,
  esDomingo,
  onClick 
}: { 
  fecha: string
  jornada: JornadaDiaria | null
  esFuturo: boolean
  esDomingo: boolean
  onClick: () => void
}) {
  // Sin datos
  if (!jornada) {
    if (esDomingo) {
      return <td className="py-2 text-center w-12 bg-white" />
    }
    
    if (esFuturo) {
      return (
        <td 
          className="py-2 text-center cursor-pointer hover:bg-neutral-50 w-12 bg-white"
          onClick={onClick}
        />
      )
    }
    
    // Pasado sin fichaje - badge rojo
    return (
      <td 
        className="py-2 text-center cursor-pointer hover:bg-neutral-50 w-12 bg-white"
        onClick={onClick}
      >
        <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-100 text-red-700">
          —
        </span>
      </td>
    )
  }
  
  // Con estado (enfermo, vacaciones, etc)
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
      <td 
        className="py-2 text-center cursor-pointer hover:bg-neutral-50 w-12 bg-white"
        onClick={onClick}
      >
        <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium rounded ${config.bg} ${config.text}`}>
          {config.label}
        </span>
      </td>
    )
  }
  
  // Con datos de trabajo - Badge coloreado según turno
  // Pastel para planificado, sólido para procesado OK
  const turnoBadgePastel: Record<string, { bg: string; text: string }> = {
    'M': { bg: 'bg-green-100', text: 'text-green-700' },
    'T': { bg: 'bg-violet-100', text: 'text-violet-700' }, 
    'N': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    'F': { bg: 'bg-amber-100', text: 'text-amber-700' },
  }
  const turnoBadgeSolido: Record<string, { bg: string; text: string }> = {
    'M': { bg: 'bg-green-600', text: 'text-white' },
    'T': { bg: 'bg-violet-600', text: 'text-white' }, 
    'N': { bg: 'bg-indigo-600', text: 'text-white' },
    'F': { bg: 'bg-amber-600', text: 'text-white' },
  }
  
  const badge = jornada.horas_feriado > 0 
    ? { bg: 'bg-amber-100', text: 'text-amber-700' }
    : turnoBadgePastel[jornada.turno_asignado || 'M'] || { bg: 'bg-neutral-100', text: 'text-neutral-700' }
  
  // Detectar alertas
  const tieneInconsistencia = jornada.tiene_inconsistencia && !jornada.inconsistencia_resuelta
  const tieneExtraRegistrada = (jornada.horas_extra_50 || 0) + (jornada.horas_extra_100 || 0) > 0
  // Sospecha de extra: más de 8h 45min (8.75h) sin extras registradas
  const sospechaExtra = jornada.horas_trabajadas > 8.75 && !tieneExtraRegistrada
  
  // Determinar qué mostrar en el badge
  const turnoLabel = jornada.turno_asignado || 'M'
  const estaProcesado = jornada.horas_trabajadas > 0 || jornada.hora_entrada_real
  
  // Determinar badge final y contenido
  let badgeFinal = badge
  let contenido = turnoLabel
  
  if (tieneInconsistencia) {
    // Falta marcación → amarillo con turno + !
    badgeFinal = { bg: 'bg-amber-100', text: 'text-amber-700' }
    contenido = turnoLabel + '!'
  } else if (sospechaExtra) {
    // Sospecha de extra → negro con turno + ?
    badgeFinal = { bg: 'bg-neutral-800', text: 'text-white' }
    contenido = turnoLabel + '?'
  } else if (estaProcesado) {
    // Procesado OK → color sólido del turno con ✓
    const turno = jornada.turno_asignado || 'M'
    badgeFinal = turnoBadgeSolido[turno] || { bg: 'bg-neutral-600', text: 'text-white' }
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
      {tieneExtraRegistrada && (
        <div className="text-[9px] font-medium text-orange-600 mt-0.5">+Ex</div>
      )}
    </td>
  )
}

// Formatear fecha/hora completa
function formatFechaHora(timestamp: string | null): string {
  if (!timestamp) return '-'
  try {
    const d = new Date(timestamp)
    return d.toLocaleString('es-AR', { 
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
  } catch {
    return '-'
  }
}

// Modal de edición
interface MarcacionCruda {
  id_biometrico: string
  tipo: 'E' | 'S'
  fecha_hora: string
}

function ModalEdicionJornada({
  empleado,
  fecha,
  jornada,
  onClose,
  onSave,
  onSaveBatch
}: {
  empleado: Empleado
  fecha: string
  jornada: JornadaDiaria | null
  onClose: () => void
  onSave: (data: Partial<JornadaDiaria>) => void
  onSaveBatch: (fechaDesde: string, fechaHasta: string, data: Partial<JornadaDiaria>) => void
}) {
  const diaSemana = getDiaSemana(fecha)
  const dia = parseInt(fecha.split('-')[2])
  const esDomingo = new Date(fecha + 'T12:00:00').getDay() === 0
  const horasDefault = esDomingo ? 6 : 8 // Domingos son 6 horas
  
  const [marcacionesCrudas, setMarcacionesCrudas] = useState<MarcacionCruda[]>([])
  const [cargandoMarcaciones, setCargandoMarcaciones] = useState(false)
  const [mostrarMarcaciones, setMostrarMarcaciones] = useState(false)
  
  // Cargar marcaciones crudas del empleado
  useEffect(() => {
    const cargarMarcaciones = async () => {
      setCargandoMarcaciones(true)
      try {
        // Buscar marcaciones del día y días adyacentes
        const fechaObj = new Date(fecha + 'T12:00:00')
        const diaAnterior = new Date(fechaObj)
        diaAnterior.setDate(diaAnterior.getDate() - 1)
        const fechaAnterior = diaAnterior.toISOString().split('T')[0]
        
        const diaSiguiente = new Date(fechaObj)
        diaSiguiente.setDate(diaSiguiente.getDate() + 1)
        const fechaSiguiente = diaSiguiente.toISOString().split('T')[0]
        
        // Fetch marcaciones de 3 días
        const res = await fetch(`/api/sicamar/marcaciones/empleado?empleado_id=${empleado.id}&desde=${fechaAnterior}&hasta=${fechaSiguiente}`)
        const data = await res.json()
        
        if (data.success) {
          setMarcacionesCrudas(data.marcaciones || [])
        }
      } catch (error) {
        console.error('Error cargando marcaciones:', error)
      } finally {
        setCargandoMarcaciones(false)
      }
    }
    
    cargarMarcaciones()
  }, [empleado.id, fecha])
  
  const [formData, setFormData] = useState({
    turno_asignado: jornada?.turno_asignado || 'M',
    hora_entrada_real: jornada?.hora_entrada_real ? formatHora(jornada.hora_entrada_real) : '',
    hora_salida_real: jornada?.hora_salida_real ? formatHora(jornada.hora_salida_real) : '',
    horas_trabajadas: jornada?.horas_trabajadas || horasDefault,
    horas_extra_50: jornada?.horas_extra_50 || 0,
    horas_extra_100: jornada?.horas_extra_100 || 0,
    estado_empleado: jornada?.estado_empleado || '',
    notas: jornada?.notas || '',
    resolver_inconsistencia: false,
    // Para estados en lote
    fecha_desde: fecha,
    fecha_hasta: fecha,
  })
  
  const handleSave = () => {
    if (formData.estado_empleado && formData.fecha_desde !== formData.fecha_hasta) {
      // Guardar en lote
      onSaveBatch(formData.fecha_desde, formData.fecha_hasta, {
        estado_empleado: formData.estado_empleado,
        notas: formData.notas || null,
        origen: 'manual',
        horas_trabajadas: 0,
      })
    } else {
      // Guardar individual
      onSave({
        turno_asignado: formData.turno_asignado,
        hora_entrada_real: formData.hora_entrada_real ? `${fecha}T${formData.hora_entrada_real}:00-03:00` : null,
        hora_salida_real: formData.hora_salida_real ? `${fecha}T${formData.hora_salida_real}:00-03:00` : null,
        horas_trabajadas: formData.horas_trabajadas,
        horas_extra_50: formData.horas_extra_50,
        horas_extra_100: formData.horas_extra_100,
        estado_empleado: formData.estado_empleado || null,
        notas: formData.notas || null,
        origen: 'manual',
        inconsistencia_resuelta: formData.resolver_inconsistencia,
      })
    }
    onClose()
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-neutral-200">
          <h3 className="text-sm font-medium">
            {empleado.apellido}, {empleado.nombre} - {diaSemana} {dia}
          </h3>
          <p className="text-xs text-neutral-500">Legajo {empleado.legajo} · {empleado.sector || '-'}</p>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Marcaciones actuales del reloj */}
          {jornada && (jornada.hora_entrada_real || jornada.hora_salida_real) && (
            <div className="bg-neutral-50 rounded p-3 text-sm">
              <div className="text-xs font-medium text-neutral-500 uppercase mb-2">Marcaciones del Reloj</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-neutral-500">Entrada:</span>
                  <span className="ml-2 font-mono">{formatFechaHora(jornada.hora_entrada_real)}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Salida:</span>
                  <span className="ml-2 font-mono">{formatFechaHora(jornada.hora_salida_real)}</span>
                </div>
              </div>
              {jornada.tiene_inconsistencia && (
                <div className="mt-2 text-xs text-amber-600">
                  ⚠️ {jornada.tipo_inconsistencia === 'falta_salida' ? 'Falta marcación de salida' : 
                      jornada.tipo_inconsistencia === 'falta_entrada' ? 'Falta marcación de entrada' :
                      jornada.tipo_inconsistencia === 'sin_fichaje' ? 'Sin fichajes' :
                      jornada.tipo_inconsistencia}
                </div>
              )}
            </div>
          )}
          
          {/* Dropdown marcaciones crudas para debug */}
          <div className="border border-neutral-200 rounded">
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-xs font-medium text-neutral-600 flex items-center justify-between hover:bg-neutral-50"
              onClick={() => setMostrarMarcaciones(!mostrarMarcaciones)}
            >
              <span>🔍 Ver todas las marcaciones del empleado</span>
              <span className={`transition-transform ${mostrarMarcaciones ? 'rotate-180' : ''}`}>▼</span>
            </button>
            
            {mostrarMarcaciones && (
              <div className="border-t border-neutral-200 p-3 bg-neutral-50 max-h-48 overflow-y-auto">
                {cargandoMarcaciones ? (
                  <div className="text-xs text-neutral-500 text-center py-2">Cargando...</div>
                ) : marcacionesCrudas.length === 0 ? (
                  <div className="text-xs text-neutral-500 text-center py-2">No se encontraron marcaciones</div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-[10px] text-neutral-400 mb-2">
                      Mostrando marcaciones del día anterior, actual y siguiente
                    </div>
                    {marcacionesCrudas.map((m, i) => {
                      // Extraer fecha en timezone Argentina (no UTC)
                      const fechaArg = new Date(m.fecha_hora).toLocaleDateString('sv-SE', { 
                        timeZone: 'America/Argentina/Buenos_Aires' 
                      }) // Formato YYYY-MM-DD
                      const esHoy = fechaArg === fecha
                      const hora = new Date(m.fecha_hora).toLocaleString('es-AR', { 
                        weekday: 'short',
                        day: 'numeric',
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false, // Usar formato 24h
                        timeZone: 'America/Argentina/Buenos_Aires'
                      })
                      return (
                        <div 
                          key={i} 
                          className={`text-xs font-mono flex items-center gap-2 py-1 px-2 rounded ${
                            esHoy ? 'bg-white border border-neutral-200' : 'bg-transparent'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded text-[10px] flex items-center justify-center font-bold ${
                            m.tipo === 'E' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {m.tipo}
                          </span>
                          <span className={esHoy ? 'font-medium' : 'text-neutral-500'}>{hora}</span>
                          {esHoy && <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded">HOY</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Ausencia del empleado */}
          <div>
            <label className="text-xs font-medium text-neutral-600 block mb-1">Ausencia</label>
            <select 
              className="w-full h-8 text-sm border border-neutral-200 rounded px-2"
              value={formData.estado_empleado}
              onChange={e => setFormData(f => ({ ...f, estado_empleado: e.target.value }))}
            >
              <option value="">Sin ausencia</option>
              <option value="enfermo">Enfermo</option>
              <option value="vacaciones">Vacaciones</option>
              <option value="accidente">Accidente (ART)</option>
              <option value="licencia">Licencia</option>
              <option value="inasistencia">Inasistencia</option>
              <option value="ausente">Ausente justificado</option>
            </select>
          </div>
          
          {/* Si es estado, mostrar rango de fechas */}
          {formData.estado_empleado && (
            <div className="bg-blue-50 rounded p-3">
              <div className="text-xs font-medium text-blue-700 mb-2">Aplicar a múltiples días</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-600 block mb-1">Desde</label>
                  <input 
                    type="date" 
                    className="w-full h-8 text-sm border border-neutral-200 rounded px-2"
                    value={formData.fecha_desde}
                    onChange={e => setFormData(f => ({ ...f, fecha_desde: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-600 block mb-1">Hasta</label>
                  <input 
                    type="date" 
                    className="w-full h-8 text-sm border border-neutral-200 rounded px-2"
                    value={formData.fecha_hasta}
                    onChange={e => setFormData(f => ({ ...f, fecha_hasta: e.target.value }))}
                  />
                </div>
              </div>
              {formData.fecha_desde !== formData.fecha_hasta && (
                <div className="text-xs text-blue-600 mt-2">
                  Se aplicará a todos los días del {formData.fecha_desde} al {formData.fecha_hasta}
                </div>
              )}
            </div>
          )}
          
          {!formData.estado_empleado && (
            <>
              {/* Turno */}
              <div>
                <label className="text-xs font-medium text-neutral-600 block mb-1">Turno</label>
                <div className="flex gap-2">
                  {[
                    { value: 'M', label: 'Mañana', color: 'bg-green-100' },
                    { value: 'T', label: 'Tarde', color: 'bg-purple-100' },
                    { value: 'N', label: 'Noche', color: 'bg-indigo-100' },
                    { value: 'F', label: 'Franco', color: 'bg-neutral-100' },
                  ].map(t => (
                    <button
                      key={t.value}
                      className={`flex-1 h-8 text-xs rounded border ${formData.turno_asignado === t.value ? 'border-neutral-900 font-medium' : 'border-neutral-200'} ${t.color}`}
                      onClick={() => setFormData(f => ({ ...f, turno_asignado: t.value }))}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Horarios */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-600 block mb-1">Entrada</label>
                  <input 
                    type="time" 
                    className="w-full h-8 text-sm border border-neutral-200 rounded px-2"
                    value={formData.hora_entrada_real}
                    onChange={e => setFormData(f => ({ ...f, hora_entrada_real: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600 block mb-1">Salida</label>
                  <input 
                    type="time" 
                    className="w-full h-8 text-sm border border-neutral-200 rounded px-2"
                    value={formData.hora_salida_real}
                    onChange={e => setFormData(f => ({ ...f, hora_salida_real: e.target.value }))}
                  />
                </div>
              </div>
              
              {/* Horas */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-600 block mb-1">Horas trabajadas</label>
                  <input 
                    type="number" 
                    step="0.5"
                    className="w-full h-8 text-sm border border-neutral-200 rounded px-2"
                    value={formData.horas_trabajadas}
                    onChange={e => setFormData(f => ({ ...f, horas_trabajadas: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600 block mb-1">Extra 50%</label>
                  <input 
                    type="number" 
                    step="0.5"
                    className="w-full h-8 text-sm border border-neutral-200 rounded px-2"
                    value={formData.horas_extra_50}
                    onChange={e => setFormData(f => ({ ...f, horas_extra_50: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600 block mb-1">Extra 100%</label>
                  <input 
                    type="number" 
                    step="0.5"
                    className="w-full h-8 text-sm border border-neutral-200 rounded px-2"
                    value={formData.horas_extra_100}
                    onChange={e => setFormData(f => ({ ...f, horas_extra_100: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </>
          )}
          
          {/* Notas */}
          <div>
            <label className="text-xs font-medium text-neutral-600 block mb-1">Notas</label>
            <textarea 
              className="w-full text-sm border border-neutral-200 rounded px-2 py-1 h-16"
              placeholder="Observaciones..."
              value={formData.notas}
              onChange={e => setFormData(f => ({ ...f, notas: e.target.value }))}
            />
          </div>
          
          {/* Resolver inconsistencia */}
          {jornada?.tiene_inconsistencia && !jornada.inconsistencia_resuelta && (
            <label className="flex items-center gap-2 text-sm">
              <input 
                type="checkbox"
                checked={formData.resolver_inconsistencia}
                onChange={e => setFormData(f => ({ ...f, resolver_inconsistencia: e.target.checked }))}
              />
              <span className="text-amber-700">Marcar inconsistencia como resuelta</span>
            </label>
          )}
        </div>
        
        <div className="px-4 py-3 border-t border-neutral-200 flex justify-end gap-2">
          <button 
            className="h-8 px-3 text-sm border border-neutral-200 rounded hover:bg-neutral-50"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button 
            className="h-8 px-3 text-sm bg-neutral-900 text-white rounded hover:bg-neutral-800"
            onClick={handleSave}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// Componente principal
export function JornadasTab() {
  const [anio, setAnio] = useState(2025)
  const [mes, setMes] = useState(12)
  const [quincena, setQuincena] = useState<1 | 2>(1)
  const [empleados, setEmpleados] = useState<EmpleadoConJornadas[]>([])
  const [loading, setLoading] = useState(true)
  const [regenerando, setRegenerando] = useState(false)
  const [procesando, setProcesando] = useState<{ turno: 'M' | 'T' | 'N'; fecha: string } | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [modalOpen, setModalOpen] = useState<{ empleado: Empleado; fecha: string } | null>(null)
  const [resumenOpen, setResumenOpen] = useState<EmpleadoConJornadas | null>(null)
  const [filtroSector, setFiltroSector] = useState<string>('')
  const [ordenarPorDia, setOrdenarPorDia] = useState<string | null>(null)
  const [hoy, setHoy] = useState<string>('')
  
  // Inicializar fecha solo en cliente para evitar hydration mismatch
  useEffect(() => {
    if (!hoy) {
      setHoy(new Date().toISOString().split('T')[0])
    }
  }, [hoy])
  
  const fechas = getFechasQuincena(anio, mes, quincena)
  
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  
  // Cargar datos
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Calcular fechas del período
      const ultimoDia = new Date(anio, mes, 0).getDate()
      const desde = quincena === 1 ? 1 : 16
      const hasta = quincena === 1 ? 15 : ultimoDia
      
      // Para primera quincena, incluir el domingo anterior si existe
      let fechaDesde = `${anio}-${String(mes).padStart(2, '0')}-${String(desde).padStart(2, '0')}`
      
      // Si es primera quincena y el día 1 es lunes, incluir el domingo anterior
      if (quincena === 1) {
        const primerDia = new Date(anio, mes - 1, 1)
        if (primerDia.getDay() === 1) { // Lunes
          // Incluir el domingo anterior (último día del mes anterior)
          const mesAnterior = mes === 1 ? 12 : mes - 1
          const anioAnterior = mes === 1 ? anio - 1 : anio
          const ultimoDiaMesAnterior = new Date(anioAnterior, mesAnterior, 0).getDate()
          fechaDesde = `${anioAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(ultimoDiaMesAnterior).padStart(2, '0')}`
        }
      }
      
      const fechaHasta = `${anio}-${String(mes).padStart(2, '0')}-${String(hasta).padStart(2, '0')}`
      
      // Obtener empleados jornalizados
      const empRes = await fetch('/api/sicamar/empleados?clase=Jornal&activo=true')
      const empData = await empRes.json()
      
      console.log('Empleados response:', empData)
      
      const empleadosList = empData.data || empData.empleados || []
      if (empleadosList.length === 0) {
        console.log('No empleados found')
        setEmpleados([])
        setLoading(false)
        return
      }
      
      // Obtener jornadas del período
      const jorRes = await fetch(`/api/sicamar/jornadas?desde=${fechaDesde}&hasta=${fechaHasta}`)
      const jorData = await jorRes.json()
      
      console.log('Jornadas response:', jorData)
      
      // Usar las mismas fechas que se muestran en la tabla (incluye domingo anterior si corresponde)
      const fechasArray = getFechasQuincena(anio, mes, quincena)
      
      // Obtener estados de empleados del período
      const estRes = await fetch(`/api/sicamar/empleados/estados?vigentes=true&desde=${fechaDesde}&hasta=${fechaHasta}`)
      const estData = await estRes.json()
      
      // Mapear jornadas por empleado
      const jornadasMap = new Map<number, Map<string, JornadaDiaria>>()
      for (const j of jorData.data || []) {
        if (!jornadasMap.has(j.empleado_id)) {
          jornadasMap.set(j.empleado_id, new Map())
        }
        jornadasMap.get(j.empleado_id)!.set(j.fecha, j)
      }
      
      // Mapear estados por empleado
      const estadosMap = new Map<number, { tipo: string; desde: string; hasta: string }[]>()
      for (const e of estData || []) {
        if (!estadosMap.has(e.empleado_id)) {
          estadosMap.set(e.empleado_id, [])
        }
        estadosMap.get(e.empleado_id)!.push({
          tipo: e.tipo_estado,
          desde: e.fecha_inicio,
          hasta: e.fecha_fin
        })
      }
      
      // Combinar todo
      const result: EmpleadoConJornadas[] = empleadosList.map((emp: Empleado) => {
        const jornadasEmp = jornadasMap.get(emp.id) || new Map()
        const estadosEmp = estadosMap.get(emp.id) || []
        
        const jornadas: Record<string, JornadaDiaria> = {}
        let totales = {
          horas_trabajadas: 0,
          horas_diurnas: 0,
          horas_nocturnas: 0,
          horas_extra: 0,
          dias_trabajados: 0,
          inconsistencias: 0,
        }
        
        for (const fecha of fechasArray) {
          let jornada = jornadasEmp.get(fecha) || null
          const fechaObj = new Date(fecha + 'T12:00:00')
          const esDomingo = fechaObj.getDay() === 0
          
          // Si no hay jornada pero hay estado, crear una virtual
          if (!jornada) {
            const estado = estadosEmp.find(e => fecha >= e.desde && fecha <= e.hasta)
            if (estado) {
              jornada = {
                empleado_id: emp.id,
                fecha,
                turno_asignado: null,
                hora_entrada_asignada: null,
                hora_salida_asignada: null,
                horas_asignadas: 0,
                hora_entrada_real: null,
                hora_salida_real: null,
                horas_trabajadas: 0,
                horas_diurnas: 0,
                horas_nocturnas: 0,
                horas_extra_50: 0,
                horas_extra_100: 0,
                horas_feriado: 0,
                origen: 'manual',
                estado_empleado: estado.tipo.toLowerCase(),
                tiene_inconsistencia: false,
                tipo_inconsistencia: null,
                inconsistencia_resuelta: false,
                resuelto_por: null,
                notas: null,
              }
            }
          }
          
          if (jornada) {
            jornadas[fecha] = jornada
            // Sumar horas de todos los días (incluyendo domingo)
            totales.horas_trabajadas += jornada.horas_trabajadas || 0
            totales.horas_diurnas += jornada.horas_diurnas || 0
            totales.horas_nocturnas += jornada.horas_nocturnas || 0
            totales.horas_extra += (jornada.horas_extra_50 || 0) + (jornada.horas_extra_100 || 0)
            if (jornada.horas_trabajadas > 0) totales.dias_trabajados++
            if (jornada.tiene_inconsistencia && !jornada.inconsistencia_resuelta) totales.inconsistencias++
          }
        }
        
        return { empleado: emp, jornadas, totales }
      })
      
      setEmpleados(result)
    } catch (error) {
      console.error('Error fetching jornadas:', error)
    } finally {
      setLoading(false)
    }
  }, [anio, mes, quincena])
  
  useEffect(() => {
    fetchData()
  }, [fetchData])
  
  // Actualizar estado local de una jornada (sin recargar)
  const updateLocalJornada = (empleadoId: number, fecha: string, newData: Partial<JornadaDiaria>) => {
    setEmpleados(prev => prev.map(emp => {
      if (emp.empleado.id !== empleadoId) return emp
      
      const jornadaExistente = emp.jornadas[fecha]
      const nuevaJornada: JornadaDiaria = {
        empleado_id: empleadoId,
        fecha,
        turno_asignado: newData.turno_asignado || jornadaExistente?.turno_asignado || null,
        hora_entrada_asignada: jornadaExistente?.hora_entrada_asignada || null,
        hora_salida_asignada: jornadaExistente?.hora_salida_asignada || null,
        horas_asignadas: jornadaExistente?.horas_asignadas || 0,
        hora_entrada_real: newData.hora_entrada_real !== undefined ? newData.hora_entrada_real : jornadaExistente?.hora_entrada_real || null,
        hora_salida_real: newData.hora_salida_real !== undefined ? newData.hora_salida_real : jornadaExistente?.hora_salida_real || null,
        horas_trabajadas: newData.horas_trabajadas ?? jornadaExistente?.horas_trabajadas ?? 0,
        horas_diurnas: newData.horas_diurnas ?? jornadaExistente?.horas_diurnas ?? 0,
        horas_nocturnas: newData.horas_nocturnas ?? jornadaExistente?.horas_nocturnas ?? 0,
        horas_extra_50: newData.horas_extra_50 ?? jornadaExistente?.horas_extra_50 ?? 0,
        horas_extra_100: newData.horas_extra_100 ?? jornadaExistente?.horas_extra_100 ?? 0,
        horas_feriado: newData.horas_feriado ?? jornadaExistente?.horas_feriado ?? 0,
        origen: newData.origen || 'manual',
        estado_empleado: newData.estado_empleado !== undefined ? newData.estado_empleado : jornadaExistente?.estado_empleado || null,
        tiene_inconsistencia: newData.inconsistencia_resuelta ? false : jornadaExistente?.tiene_inconsistencia ?? false,
        tipo_inconsistencia: newData.inconsistencia_resuelta ? null : jornadaExistente?.tipo_inconsistencia || null,
        inconsistencia_resuelta: newData.inconsistencia_resuelta ?? jornadaExistente?.inconsistencia_resuelta ?? false,
        resuelto_por: jornadaExistente?.resuelto_por || null,
        notas: newData.notas !== undefined ? newData.notas : jornadaExistente?.notas || null,
      }
      
      const nuevasJornadas = { ...emp.jornadas, [fecha]: nuevaJornada }
      
      // Recalcular totales
      let totales = {
        horas_trabajadas: 0,
        horas_diurnas: 0,
        horas_nocturnas: 0,
        horas_extra: 0,
        dias_trabajados: 0,
        inconsistencias: 0,
      }
      for (const j of Object.values(nuevasJornadas)) {
        totales.horas_trabajadas += j.horas_trabajadas || 0
        totales.horas_diurnas += j.horas_diurnas || 0
        totales.horas_nocturnas += j.horas_nocturnas || 0
        totales.horas_extra += (j.horas_extra_50 || 0) + (j.horas_extra_100 || 0)
        if (j.horas_trabajadas > 0 || j.estado_empleado) totales.dias_trabajados++
        if (j.tiene_inconsistencia && !j.inconsistencia_resuelta) totales.inconsistencias++
      }
      
      return { ...emp, jornadas: nuevasJornadas, totales }
    }))
  }
  
  // Guardar jornada individual
  const handleSaveJornada = async (empleadoId: number, fecha: string, data: Partial<JornadaDiaria>) => {
    // Actualizar UI inmediatamente
    updateLocalJornada(empleadoId, fecha, data)
    
    // Guardar en background
    try {
      await fetch('/api/sicamar/jornadas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_id: empleadoId,
          fecha,
          ...data
        })
      })
    } catch (error) {
      console.error('Error saving jornada:', error)
      // Si falla, recargar para sincronizar
      fetchData()
    }
  }
  
  // Guardar jornadas en lote (para vacaciones, enfermedad, etc.)
  const handleSaveJornadaBatch = async (empleadoId: number, fechaDesde: string, fechaHasta: string, data: Partial<JornadaDiaria>) => {
    // Generar todas las fechas del rango
    const desde = new Date(fechaDesde + 'T12:00:00')
    const hasta = new Date(fechaHasta + 'T12:00:00')
    const fechasAActualizar: string[] = []
    const current = new Date(desde)
    
    while (current <= hasta) {
      const fechaStr = current.toISOString().split('T')[0]
      // Saltar domingos
      if (current.getDay() !== 0) {
        fechasAActualizar.push(fechaStr)
      }
      current.setDate(current.getDate() + 1)
    }
    
    // Actualizar UI inmediatamente para todas las fechas
    for (const fecha of fechasAActualizar) {
      updateLocalJornada(empleadoId, fecha, data)
    }
    
    // Guardar en background
    try {
      const promises = fechasAActualizar.map(fecha =>
        fetch('/api/sicamar/jornadas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empleado_id: empleadoId,
            fecha,
            ...data
          })
        })
      )
      await Promise.all(promises)
    } catch (error) {
      console.error('Error saving jornadas batch:', error)
      fetchData() // Si falla, recargar para sincronizar
    }
  }
  
  // Sectores únicos para filtro
  const sectores = [...new Set(empleados.map(e => e.empleado.sector).filter(Boolean))]
  
  // Día a usar para ordenar (el seleccionado o el primer día laborable)
  const diaParaOrdenar = ordenarPorDia || fechas.find(f => new Date(f + 'T12:00:00').getDay() !== 0) || fechas[0]
  
  // Obtener turno de un día específico para ordenar
  // Orden: M(1) → T(2) → N(3) → Estados(90) → Sin datos(99)
  const getTurnoDia = (emp: EmpleadoConJornadas, fecha: string): { orden: number; tieneData: boolean } => {
    const jornada = emp.jornadas[fecha]
    
    if (!jornada) {
      return { orden: 99, tieneData: false }
    }
    
    // Si tiene estado (vacaciones, enfermo, accidente), va después de los turnos
    if (jornada.estado_empleado) {
      return { orden: 90, tieneData: true }
    }
    
    // Si tiene turno asignado, ordenar por turno (M→T→N)
    // Los ! van con su grupo de turno
    if (jornada.turno_asignado) {
      const ordenTurno: Record<string, number> = { 'M': 1, 'T': 2, 'N': 3, 'F': 4 }
      return { orden: ordenTurno[jornada.turno_asignado] || 5, tieneData: true }
    }
    
    return { orden: 99, tieneData: false }
  }
  
  // Filtrar y ordenar empleados por turno del día seleccionado
  const empleadosFiltrados = (filtroSector 
    ? empleados.filter(e => e.empleado.sector === filtroSector)
    : empleados
  ).sort((a, b) => {
    const infoA = getTurnoDia(a, diaParaOrdenar)
    const infoB = getTurnoDia(b, diaParaOrdenar)
    
    // Primero los que tienen datos
    if (infoA.tieneData !== infoB.tieneData) {
      return infoA.tieneData ? -1 : 1
    }
    
    // Luego por turno
    if (infoA.orden !== infoB.orden) return infoA.orden - infoB.orden
    
    // Si mismo turno, ordenar por apellido
    return a.empleado.apellido.localeCompare(b.empleado.apellido)
  })
  
  // Navegar quincenas
  const prevQuincena = () => {
    setOrdenarPorDia(null) // Reset orden
    if (quincena === 1) {
      const newMes = mes === 1 ? 12 : mes - 1
      const newAnio = mes === 1 ? anio - 1 : anio
      setMes(newMes)
      setAnio(newAnio)
      setQuincena(2)
    } else {
      setQuincena(1)
    }
  }
  
  const nextQuincena = () => {
    setOrdenarPorDia(null) // Reset orden
    if (quincena === 2) {
      const newMes = mes === 12 ? 1 : mes + 1
      const newAnio = mes === 12 ? anio + 1 : anio
      setMes(newMes)
      setAnio(newAnio)
      setQuincena(1)
    } else {
      setQuincena(2)
    }
  }
  
  // Regenerar jornadas desde marcaciones
  const handleRegenerar = async () => {
    if (!confirm('¿Regenerar todas las jornadas de esta quincena desde las marcaciones? Esto sobrescribirá cualquier edición manual.')) {
      return
    }
    
    setRegenerando(true)
    try {
      const res = await fetch('/api/sicamar/jornadas/regenerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anio, mes, quincena })
      })
      const data = await res.json()
      
      if (data.success) {
        alert(`Regeneradas ${data.count} jornadas correctamente`)
        fetchData()
      } else {
        alert('Error: ' + (data.error || 'Error desconocido'))
      }
    } catch (error) {
      console.error('Error regenerando:', error)
      alert('Error al regenerar jornadas')
    } finally {
      setRegenerando(false)
    }
  }
  
  // Procesar un turno de un día específico
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
        // Mostrar feedback
        setFeedback({ 
          type: 'success', 
          message: data.message 
        })
        
        // Obtener solo las jornadas actualizadas del día
        const jorRes = await fetch(`/api/sicamar/jornadas?desde=${fecha}&hasta=${fecha}`)
        const jorData = await jorRes.json()
        
        // Actualizar el estado local sin recargar todo
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
              
              // Recalcular totales
              const totales = {
                horas_trabajadas: 0,
                horas_diurnas: 0,
                horas_nocturnas: 0,
                horas_extra: 0,
                dias_trabajados: 0,
                inconsistencias: 0
              }
              
              for (const j of Object.values(nuevasJornadas)) {
                totales.horas_trabajadas += j.horas_trabajadas || 0
                totales.horas_diurnas += j.horas_diurnas || 0
                totales.horas_nocturnas += j.horas_nocturnas || 0
                totales.horas_extra += (j.horas_extra_50 || 0) + (j.horas_extra_100 || 0)
                if (j.horas_trabajadas > 0 || j.estado_empleado) totales.dias_trabajados++
                if (j.tiene_inconsistencia && !j.inconsistencia_resuelta) totales.inconsistencias++
              }
              
              return { ...emp, jornadas: nuevasJornadas, totales }
            }
            return emp
          })
        })
        
        // Auto-ocultar feedback después de 4 segundos
        setTimeout(() => setFeedback(null), 4000)
      } else {
        setFeedback({ type: 'error', message: data.error || 'Error al procesar' })
      }
    } catch (error) {
      console.error('Error procesando turno:', error)
      setFeedback({ type: 'error', message: 'Error de conexión' })
    } finally {
      setProcesando(null)
    }
  }
  
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Banner de procesamiento */}
      {procesando && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-3">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          <span className="text-sm text-blue-700">
            Procesando turno <strong>{procesando.turno === 'M' ? 'Mañana' : procesando.turno === 'T' ? 'Tarde' : 'Noche'}</strong> del {new Date(procesando.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}...
          </span>
        </div>
      )}
      
      {/* Banner de feedback */}
      {feedback && !procesando && (
        <div className={`px-4 py-2 border-b flex items-center justify-between ${
          feedback.type === 'success' 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <span className={`text-sm ${feedback.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
            {feedback.type === 'success' ? '✓' : '✕'} {feedback.message}
          </span>
          <button 
            onClick={() => setFeedback(null)}
            className={`text-sm px-2 py-0.5 rounded ${
              feedback.type === 'success' 
                ? 'text-green-600 hover:bg-green-100' 
                : 'text-red-600 hover:bg-red-100'
            }`}
          >
            ✕
          </button>
        </div>
      )}
      
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium">Control de Jornadas</h2>
          
          {/* Navegación de quincena */}
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
        
        <div className="flex items-center gap-4">
          {/* Filtro por sector */}
          <select 
            className="h-8 text-sm border border-neutral-200 rounded px-2 bg-white"
            value={filtroSector}
            onChange={e => setFiltroSector(e.target.value)}
          >
            <option value="">Todos los sectores</option>
            {sectores.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          
          {/* Regenerar desde marcaciones */}
          <button
            className="h-8 px-3 text-sm border border-neutral-200 rounded hover:bg-neutral-50 disabled:opacity-50"
            onClick={handleRegenerar}
            disabled={regenerando}
          >
            {regenerando ? 'Regenerando...' : '↻ Regenerar'}
          </button>
          
          
          {/* Leyenda con badges */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">M</span>
            <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">T</span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">N</span>
            <span className="text-neutral-300">|</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">!</span>
            <span className="text-[10px] text-neutral-400">falta</span>
            <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-white font-medium">+?</span>
            <span className="text-[10px] text-neutral-400">extra?</span>
          </div>
        </div>
      </div>
      
      {/* Tabla */}
      <div className="flex-1 overflow-auto relative">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-neutral-500">
            Cargando...
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="bg-white sticky top-0 z-20 shadow-sm">
              <tr className="border-b border-neutral-200">
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide sticky left-0 bg-white z-30 min-w-[200px]">
                  Empleado
                </th>
                {fechas.map(fecha => {
                  const dia = parseInt(fecha.split('-')[2])
                  const diaSemana = getDiaSemana(fecha)
                  const esDomingo = new Date(fecha + 'T12:00:00').getDay() === 0
                  const isSelected = ordenarPorDia === fecha
                  return (
                    <th 
                      key={fecha} 
                      className={`py-1 text-center text-xs font-medium tracking-wide w-14 transition-colors
                        ${esDomingo ? 'text-neutral-400 bg-neutral-50' : isSelected ? 'text-neutral-900 bg-neutral-100' : 'text-neutral-500'}`}
                    >
                      <div 
                        className="cursor-pointer hover:bg-neutral-100 py-1"
                        onClick={() => setOrdenarPorDia(isSelected ? null : fecha)}
                        title={isSelected ? 'Click para quitar orden' : 'Click para ordenar por este día'}
                      >
                        {diaSemana} {dia}
                        {isSelected && <span className="text-[8px] text-neutral-400 ml-0.5">▼</span>}
                      </div>
                      <div className="flex justify-center gap-0.5 mt-1">
                        {esDomingo ? (
                          /* Domingo solo tiene turno Noche */
                          <button
                            className={`w-4 h-4 text-[8px] rounded disabled:opacity-50 flex items-center justify-center ${
                              procesando?.fecha === fecha && procesando?.turno === 'N'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                            }`}
                            onClick={(e) => { e.stopPropagation(); handleProcesarTurnoDia(fecha, 'N') }}
                            disabled={procesando !== null}
                            title={`Procesar Noche ${fecha}`}
                          >
                            {procesando?.fecha === fecha && procesando?.turno === 'N' ? '⏳' : 'N'}
                          </button>
                        ) : (
                          /* Días laborables tienen M, T, N */
                          <>
                            <button
                              className={`w-4 h-4 text-[8px] rounded disabled:opacity-50 flex items-center justify-center ${
                                procesando?.fecha === fecha && procesando?.turno === 'M'
                                  ? 'bg-green-600 text-white'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                              onClick={(e) => { e.stopPropagation(); handleProcesarTurnoDia(fecha, 'M') }}
                              disabled={procesando !== null}
                              title={`Procesar Mañana ${fecha}`}
                            >
                              {procesando?.fecha === fecha && procesando?.turno === 'M' ? '⏳' : 'M'}
                            </button>
                            <button
                              className={`w-4 h-4 text-[8px] rounded disabled:opacity-50 flex items-center justify-center ${
                                procesando?.fecha === fecha && procesando?.turno === 'T'
                                  ? 'bg-violet-600 text-white'
                                  : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                              }`}
                              onClick={(e) => { e.stopPropagation(); handleProcesarTurnoDia(fecha, 'T') }}
                              disabled={procesando !== null}
                              title={`Procesar Tarde ${fecha}`}
                            >
                              {procesando?.fecha === fecha && procesando?.turno === 'T' ? '⏳' : 'T'}
                            </button>
                            <button
                              className={`w-4 h-4 text-[8px] rounded disabled:opacity-50 flex items-center justify-center ${
                                procesando?.fecha === fecha && procesando?.turno === 'N'
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                              }`}
                              onClick={(e) => { e.stopPropagation(); handleProcesarTurnoDia(fecha, 'N') }}
                              disabled={procesando !== null}
                              title={`Procesar Noche ${fecha}`}
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
              {empleadosFiltrados.map(({ empleado, jornadas, totales }) => (
                <tr key={empleado.id} className="border-b border-neutral-100">
                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                    <div className="font-medium text-sm text-neutral-900">{empleado.apellido}, {empleado.nombre}</div>
                    <div className="text-xs text-neutral-400">#{empleado.legajo} · {empleado.sector || '-'}</div>
                  </td>
                  {fechas.map(fecha => {
                    const esFuturo = fecha > hoy
                    const esDomingo = new Date(fecha + 'T12:00:00').getDay() === 0
                    return (
                      <CeldaDia
                        key={fecha}
                        fecha={fecha}
                        jornada={jornadas[fecha] || null}
                        esFuturo={esFuturo}
                        esDomingo={esDomingo}
                        onClick={() => setModalOpen({ empleado, fecha })}
                      />
                    )
                  })}
                  <td 
                    className={`px-3 py-2 text-right ${totales.inconsistencias === 0 ? 'cursor-pointer hover:bg-neutral-50' : ''}`}
                    onClick={() => totales.inconsistencias === 0 && setResumenOpen({ empleado, jornadas, totales })}
                  >
                    <div className="font-medium text-neutral-800">{Math.round(totales.horas_trabajadas)}h</div>
                    <div className="text-xs text-neutral-400">
                      {totales.dias_trabajados}d
                      {totales.horas_extra > 0 && <span className="ml-1">+{totales.horas_extra > 0 ? totales.horas_extra.toFixed(1) : Math.round(totales.horas_extra)}</span>}
                      {totales.inconsistencias > 0 && <span className="text-red-500 ml-1">⚠{totales.inconsistencias}</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Modal Edición */}
      {modalOpen && (
        <ModalEdicionJornada
          empleado={modalOpen.empleado}
          fecha={modalOpen.fecha}
          jornada={empleados.find(e => e.empleado.id === modalOpen.empleado.id)?.jornadas[modalOpen.fecha] || null}
          onClose={() => setModalOpen(null)}
          onSave={(data) => handleSaveJornada(modalOpen.empleado.id, modalOpen.fecha, data)}
          onSaveBatch={(desde, hasta, data) => handleSaveJornadaBatch(modalOpen.empleado.id, desde, hasta, data)}
        />
      )}
      
      {/* Modal Resumen de Conceptos */}
      {resumenOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setResumenOpen(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-neutral-200">
              <h3 className="text-sm font-medium text-neutral-900">
                {resumenOpen.empleado.apellido}, {resumenOpen.empleado.nombre}
              </h3>
              <p className="text-xs text-neutral-500">
                Legajo {resumenOpen.empleado.legajo} · {quincena === 1 ? '1era' : '2da'} Quincena {MESES[mes - 1]} {anio}
              </p>
            </div>
            
            <div className="p-4">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-neutral-100">
                  <tr>
                    <td className="py-2 text-neutral-600">Días trabajados</td>
                    <td className="py-2 text-right font-medium">{resumenOpen.totales.dias_trabajados}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-neutral-600">Horas normales</td>
                    <td className="py-2 text-right font-medium">{Math.round(resumenOpen.totales.horas_trabajadas)}h</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-neutral-600">Horas diurnas</td>
                    <td className="py-2 text-right font-medium">{Math.round(resumenOpen.totales.horas_diurnas)}h</td>
                  </tr>
                  {resumenOpen.totales.horas_nocturnas > 0 && (
                    <tr>
                      <td className="py-2 text-neutral-600">Horas nocturnas</td>
                      <td className="py-2 text-right font-medium">{Math.round(resumenOpen.totales.horas_nocturnas)}h</td>
                    </tr>
                  )}
                  {resumenOpen.totales.horas_extra > 0 && (
                    <tr>
                      <td className="py-2 text-neutral-600">Horas extra</td>
                      <td className="py-2 text-right font-medium text-amber-600">+{resumenOpen.totales.horas_extra.toFixed(1)}h</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-neutral-200">
                    <td className="py-2 font-medium text-neutral-800">Presentismo</td>
                    <td className="py-2 text-right font-medium text-green-600">
                      {resumenOpen.totales.dias_trabajados >= (quincena === 1 ? 11 : 10) ? '100%' : 
                       resumenOpen.totales.dias_trabajados >= (quincena === 1 ? 9 : 8) ? '50%' : '0%'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="px-4 py-3 border-t border-neutral-200 flex justify-end">
              <button 
                className="h-8 px-3 text-sm bg-neutral-900 hover:bg-neutral-800 text-white rounded"
                onClick={() => setResumenOpen(null)}
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

