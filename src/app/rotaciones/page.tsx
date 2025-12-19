'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth, useUser, SignInButton } from '@clerk/nextjs'
import Link from 'next/link'
import RotationsChat from './components/rotations-chat'

// ============ TIPOS ============

interface Turno {
  nombre: string
  entrada: string
  salida: string
}

interface Rotacion {
  id: number
  nombre: string
  turnos: Turno[]
  frecuencia_semanas: number
  notas: string | null
  activo?: boolean
}

interface EmpleadoRotacion {
  empleado_id: number
  legajo: string
  nombre_completo: string
  sector: string | null
  foto_thumb_url: string | null
  rotacion_id: number | null
  rotacion_nombre: string | null
  turnos: Turno[] | null
  frecuencia_semanas: number | null
  cantidad_turnos: number
}

// ============ COMPONENTES AUXILIARES ============

function AvatarMini({ foto_thumb_url, nombre_completo }: { foto_thumb_url: string | null, nombre_completo: string }) {
  const iniciales = nombre_completo
    .split(',')
    .map(p => p.trim()[0])
    .reverse()
    .join('')
    .toUpperCase()
    .slice(0, 2)
  
  if (foto_thumb_url) {
    return (
      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
        <img src={foto_thumb_url} alt={nombre_completo} className="w-full h-full object-cover grayscale" />
      </div>
    )
  }
  
  return (
    <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs text-neutral-400 flex-shrink-0">
      {iniciales}
    </div>
  )
}

function CantidadTurnosBadge({ cantidad }: { cantidad: number }) {
  if (!cantidad) return <span className="text-neutral-200 text-xs">—</span>
  
  const config: Record<number, { label: string; clase: string }> = {
    1: { label: 'Fijo', clase: 'bg-neutral-100 text-neutral-500' },
    2: { label: '2T', clase: 'bg-blue-50 text-blue-700' },
    3: { label: '3T', clase: 'bg-emerald-50 text-emerald-700' },
  }
  
  const c = config[cantidad] || { label: `${cantidad}T`, clase: 'bg-purple-50 text-purple-700' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${c.clase}`}>
      {c.label}
    </span>
  )
}

function TurnosPreview({ turnos }: { turnos: Turno[] | null }) {
  if (!turnos || turnos.length === 0) return <span className="text-neutral-200">—</span>
  
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {turnos.map((t, i) => (
        <span key={i} className="text-[10px] text-neutral-400">
          {t.nombre} {t.entrada?.slice(0,5)}-{t.salida?.slice(0,5)}
          {i < turnos.length - 1 && <span className="text-neutral-200 mx-0.5">→</span>}
        </span>
      ))}
    </div>
  )
}

// ============ MODAL CREAR/EDITAR ROTACIÓN ============

interface RotacionFormData {
  nombre: string
  turnos: Turno[]
  frecuencia_semanas: number
  notas: string
}

function RotacionModal({ 
  isOpen, 
  onClose, 
  onSave, 
  rotacion,
  saving
}: { 
  isOpen: boolean
  onClose: () => void
  onSave: (data: RotacionFormData) => void
  rotacion: Rotacion | null
  saving: boolean
}) {
  const [form, setForm] = useState<RotacionFormData>({
    nombre: '',
    turnos: [{ nombre: 'Mañana', entrada: '06:00', salida: '14:00' }],
    frecuencia_semanas: 1,
    notas: ''
  })

  useEffect(() => {
    if (rotacion) {
      setForm({
        nombre: rotacion.nombre,
        turnos: rotacion.turnos || [{ nombre: 'Mañana', entrada: '06:00', salida: '14:00' }],
        frecuencia_semanas: rotacion.frecuencia_semanas || 1,
        notas: rotacion.notas || ''
      })
    } else {
      setForm({
        nombre: '',
        turnos: [{ nombre: 'Mañana', entrada: '06:00', salida: '14:00' }],
        frecuencia_semanas: 1,
        notas: ''
      })
    }
  }, [rotacion, isOpen])

  const addTurno = () => {
    const defaults = ['Mañana', 'Tarde', 'Noche', 'Turno 4', 'Turno 5']
    const defaultHorarios = [
      { entrada: '06:00', salida: '14:00' },
      { entrada: '14:00', salida: '22:00' },
      { entrada: '22:00', salida: '06:00' },
      { entrada: '06:00', salida: '18:00' },
      { entrada: '18:00', salida: '06:00' },
    ]
    const idx = form.turnos.length
    setForm(f => ({
      ...f,
      turnos: [...f.turnos, { 
        nombre: defaults[idx] || `Turno ${idx + 1}`,
        ...defaultHorarios[idx] || { entrada: '06:00', salida: '14:00' }
      }]
    }))
  }

  const removeTurno = (idx: number) => {
    if (form.turnos.length <= 1) return
    setForm(f => ({
      ...f,
      turnos: f.turnos.filter((_, i) => i !== idx)
    }))
  }

  const updateTurno = (idx: number, field: keyof Turno, value: string) => {
    setForm(f => ({
      ...f,
      turnos: f.turnos.map((t, i) => i === idx ? { ...t, [field]: value } : t)
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-neutral-100">
          <h3 className="text-sm font-medium text-neutral-700">
            {rotacion ? 'Editar Rotación' : 'Nueva Rotación'}
          </h3>
        </div>
        
        <div className="px-5 py-4 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-[10px] text-neutral-400 uppercase tracking-wide mb-1">Nombre</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: 3 Turnos Estándar"
              className="w-full h-8 px-2 text-sm border border-neutral-200 rounded focus:border-neutral-400 focus:ring-0 focus:outline-none"
            />
          </div>

          {/* Turnos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] text-neutral-400 uppercase tracking-wide">Turnos de la rotación</label>
              <button
                type="button"
                onClick={addTurno}
                className="text-[10px] text-[#C4322F] hover:text-[#a02825]"
              >
                + Agregar turno
              </button>
            </div>
            
            <div className="space-y-2">
              {form.turnos.map((turno, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-neutral-50 rounded p-2">
                  <span className="text-[10px] text-neutral-300 w-4">{idx + 1}</span>
                  <input
                    type="text"
                    value={turno.nombre}
                    onChange={e => updateTurno(idx, 'nombre', e.target.value)}
                    placeholder="Nombre"
                    className="flex-1 h-6 px-2 text-xs border border-neutral-200 rounded focus:border-neutral-400 focus:ring-0 focus:outline-none"
                  />
                  <input
                    type="time"
                    value={turno.entrada}
                    onChange={e => updateTurno(idx, 'entrada', e.target.value)}
                    className="w-20 h-6 px-1 text-xs border border-neutral-200 rounded focus:border-neutral-400 focus:ring-0 focus:outline-none"
                  />
                  <span className="text-neutral-300 text-xs">→</span>
                  <input
                    type="time"
                    value={turno.salida}
                    onChange={e => updateTurno(idx, 'salida', e.target.value)}
                    className="w-20 h-6 px-1 text-xs border border-neutral-200 rounded focus:border-neutral-400 focus:ring-0 focus:outline-none"
                  />
                  {form.turnos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTurno(idx)}
                      className="text-neutral-300 hover:text-red-500 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[9px] text-neutral-300 mt-1">
              Los turnos rotan en orden: 1 → 2 → 3 → 1...
            </p>
          </div>

          {/* Frecuencia */}
          <div>
            <label className="block text-[10px] text-neutral-400 uppercase tracking-wide mb-1">Frecuencia de rotación</label>
            <select
              value={form.frecuencia_semanas}
              onChange={e => setForm(f => ({ ...f, frecuencia_semanas: Number(e.target.value) }))}
              className="w-full h-8 px-2 text-sm border border-neutral-200 rounded focus:border-neutral-400 focus:ring-0 focus:outline-none"
            >
              <option value={1}>Cada semana</option>
              <option value={2}>Cada 2 semanas</option>
              <option value={3}>Cada 3 semanas</option>
              <option value={4}>Cada 4 semanas</option>
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[10px] text-neutral-400 uppercase tracking-wide mb-1">Notas / Excepciones</label>
            <textarea
              value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              placeholder="Ej: No trabaja domingos. Sábados hasta las 13:00..."
              rows={2}
              className="w-full px-2 py-1.5 text-sm border border-neutral-200 rounded focus:border-neutral-400 focus:ring-0 focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-neutral-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-1.5 text-xs text-neutral-500 hover:text-neutral-700"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.nombre || form.turnos.length === 0}
            className="px-4 py-1.5 text-xs bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ SECCIÓN CATÁLOGO DE ROTACIONES ============

function RotacionesCatalogo({ 
  rotaciones, 
  loading, 
  onEdit, 
  onDelete,
  onCreate 
}: { 
  rotaciones: Rotacion[]
  loading: boolean
  onEdit: (r: Rotacion) => void
  onDelete: (r: Rotacion) => void
  onCreate: () => void
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-widest">
          Rotaciones
        </h2>
        <button
          onClick={onCreate}
          className="text-xs text-[#C4322F] hover:text-[#a02825] transition-colors"
        >
          + Nueva
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-neutral-50 rounded p-4 animate-pulse">
              <div className="h-4 bg-neutral-100 rounded w-2/3 mb-3" />
              <div className="h-3 bg-neutral-100 rounded w-1/2" />
            </div>
          ))
        ) : rotaciones.length === 0 ? (
          <div className="col-span-full text-center py-8 text-neutral-300 text-sm">
            No hay rotaciones. Creá una nueva.
          </div>
        ) : (
          rotaciones.map(rot => (
            <div 
              key={rot.id} 
              className="bg-neutral-50 rounded p-4 hover:bg-neutral-100/80 transition-colors group relative"
            >
              {/* Acciones */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button onClick={() => onEdit(rot)} className="p-1.5 text-neutral-400 hover:text-neutral-600" title="Editar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button onClick={() => onDelete(rot)} className="p-1.5 text-neutral-400 hover:text-red-500" title="Eliminar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>

              {/* Contenido */}
              <div className="flex items-center gap-2 mb-2">
                <CantidadTurnosBadge cantidad={rot.turnos?.length || 0} />
                <span className="text-sm font-medium text-neutral-700 truncate">{rot.nombre}</span>
              </div>
              
              <TurnosPreview turnos={rot.turnos} />
              
              {rot.frecuencia_semanas > 1 && (
                <p className="text-[10px] text-neutral-300 mt-2">
                  Rota cada {rot.frecuencia_semanas} semanas
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ============ SECCIÓN EMPLEADOS ============

type SortKey = 'nombre' | 'legajo' | 'sector' | 'rotacion'
type SortDir = 'asc' | 'desc'

function EmpleadosLista({
  empleados,
  rotaciones,
  loading,
  searchQuery,
  setSearchQuery,
  filtroTurnos,
  setFiltroTurnos,
  onAsignar
}: {
  empleados: EmpleadoRotacion[]
  rotaciones: Rotacion[]
  loading: boolean
  searchQuery: string
  setSearchQuery: (q: string) => void
  filtroTurnos: string
  setFiltroTurnos: (t: string) => void
  onAsignar: (empleadoId: number, rotacionId: number | null) => Promise<void>
}) {
  const [editando, setEditando] = useState<number | null>(null)
  const [guardando, setGuardando] = useState<number | null>(null)
  const [pendingChanges, setPendingChanges] = useState<Record<number, number | null>>({})
  const [sortKey, setSortKey] = useState<SortKey>('nombre')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handleSave = async (empleadoId: number) => {
    const newRotacionId = pendingChanges[empleadoId]
    if (newRotacionId === undefined) {
      setEditando(null)
      return
    }

    setGuardando(empleadoId)
    try {
      await onAsignar(empleadoId, newRotacionId)
      setPendingChanges(prev => {
        const next = { ...prev }
        delete next[empleadoId]
        return next
      })
      setEditando(null)
    } finally {
      setGuardando(null)
    }
  }

  const handleCancel = (empleadoId: number) => {
    setPendingChanges(prev => {
      const next = { ...prev }
      delete next[empleadoId]
      return next
    })
    setEditando(null)
  }

  // Filtros
  const empleadosFiltrados = empleados.filter(emp => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const match = 
        emp.nombre_completo?.toLowerCase().includes(q) ||
        emp.legajo?.toLowerCase().includes(q) ||
        emp.rotacion_nombre?.toLowerCase().includes(q) ||
        emp.sector?.toLowerCase().includes(q)
      if (!match) return false
    }
    
    if (filtroTurnos !== 'todas') {
      if (filtroTurnos === 'sin') {
        if (emp.rotacion_id !== null) return false
      } else {
        const num = Number(filtroTurnos)
        if (emp.cantidad_turnos !== num) return false
      }
    }
    
    return true
  }).sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    const getValue = (emp: EmpleadoRotacion, key: SortKey): string => {
      switch (key) {
        case 'nombre': return emp.nombre_completo || ''
        case 'legajo': return emp.legajo || ''
        case 'sector': return emp.sector || ''
        case 'rotacion': return emp.rotacion_nombre || ''
        default: return ''
      }
    }
    const valA = getValue(a, sortKey).toLowerCase()
    const valB = getValue(b, sortKey).toLowerCase()
    if (valA < valB) return -1 * dir
    if (valA > valB) return 1 * dir
    return 0
  })

  const stats = {
    total: empleados.length,
    conRotacion: empleados.filter(e => e.rotacion_id !== null).length,
    sinRotacion: empleados.filter(e => e.rotacion_id === null).length,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-widest">
          Empleados
        </h2>
        
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-40 h-7 px-2 text-xs border border-neutral-200 rounded focus:border-neutral-400 focus:ring-0 focus:outline-none"
          />
          
          <div className="flex items-center bg-neutral-100 rounded p-0.5">
            {[
              { key: 'todas', label: 'Todas' },
              { key: '1', label: 'Fijo' },
              { key: '2', label: '2T' },
              { key: '3', label: '3T' },
              { key: 'sin', label: 'Sin' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFiltroTurnos(f.key)}
                className={`px-2.5 py-1 text-[10px] rounded transition-all ${
                  filtroTurnos === f.key 
                    ? 'bg-white text-neutral-900 shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th onClick={() => handleSort('nombre')} className="text-left text-xs font-normal text-neutral-400 pb-3 pr-3 cursor-pointer hover:text-neutral-600 select-none">
                Empleado{sortKey === 'nombre' && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </th>
              <th onClick={() => handleSort('legajo')} className="text-left text-xs font-normal text-neutral-400 pb-3 px-2 w-16 cursor-pointer hover:text-neutral-600 select-none">
                Leg.{sortKey === 'legajo' && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </th>
              <th onClick={() => handleSort('sector')} className="text-left text-xs font-normal text-neutral-400 pb-3 px-2 w-24 cursor-pointer hover:text-neutral-600 select-none">
                Sector{sortKey === 'sector' && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </th>
              <th onClick={() => handleSort('rotacion')} className="text-left text-xs font-normal text-neutral-400 pb-3 px-2 cursor-pointer hover:text-neutral-600 select-none">
                Rotación{sortKey === 'rotacion' && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody className={loading ? 'opacity-40 pointer-events-none' : ''}>
            {loading && empleados.length === 0 ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-t border-neutral-50">
                  <td className="py-2 pr-3"><div className="flex items-center gap-2"><div className="w-8 h-8 bg-neutral-100 rounded-full animate-pulse" /><div className="w-24 h-3 bg-neutral-100 rounded animate-pulse" /></div></td>
                  <td className="py-2 px-2"><div className="w-8 h-3 bg-neutral-50 rounded animate-pulse" /></td>
                  <td className="py-2 px-2"><div className="w-14 h-3 bg-neutral-50 rounded animate-pulse" /></td>
                  <td className="py-2 px-2"><div className="w-28 h-3 bg-neutral-50 rounded animate-pulse" /></td>
                  <td />
                </tr>
              ))
            ) : empleadosFiltrados.map(emp => {
              const isEditing = editando === emp.empleado_id
              const isSaving = guardando === emp.empleado_id
              const pendingValue = pendingChanges[emp.empleado_id]
              
              return (
                <tr key={emp.empleado_id} className="border-t border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <AvatarMini foto_thumb_url={emp.foto_thumb_url} nombre_completo={emp.nombre_completo} />
                      <span className="text-sm text-neutral-700 truncate max-w-[180px]">{emp.nombre_completo}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <span className="text-xs text-neutral-300 font-mono">{emp.legajo}</span>
                  </td>
                  <td className="py-2 px-2">
                    <span className="text-xs text-neutral-400 truncate">{emp.sector || '—'}</span>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <CantidadTurnosBadge cantidad={emp.cantidad_turnos} />
                      <select
                        value={emp.rotacion_id ?? ''}
                        onChange={async (e) => {
                          const newVal = e.target.value ? Number(e.target.value) : null
                          if (newVal !== emp.rotacion_id) {
                            setGuardando(emp.empleado_id)
                            await onAsignar(emp.empleado_id, newVal)
                            setGuardando(null)
                          }
                        }}
                        disabled={isSaving}
                        className={`h-6 px-1.5 text-xs border border-neutral-200 rounded max-w-[180px] focus:border-neutral-400 focus:ring-0 focus:outline-none bg-white ${isSaving ? 'opacity-50' : ''}`}
                      >
                        <option value="">Sin rotación</option>
                        {rotaciones.map(rot => (
                          <option key={rot.id} value={rot.id}>{rot.nombre}</option>
                        ))}
                      </select>
                      {isSaving && <span className="text-[9px] text-neutral-400">...</span>}
                    </div>
                  </td>
                  <td className="py-2 px-2" />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!loading && empleadosFiltrados.length === 0 && (
        <div className="text-center py-8 text-neutral-300 text-xs">No se encontraron empleados</div>
      )}

      <div className="mt-4 text-xs text-neutral-300">
        {empleadosFiltrados.length} de {stats.total} · {stats.conRotacion} con rotación · {stats.sinRotacion} sin asignar
      </div>
    </div>
  )
}

// ============ PÁGINA PRINCIPAL ============

function RotacionesContent() {
  const [rotaciones, setRotaciones] = useState<Rotacion[]>([])
  const [empleados, setEmpleados] = useState<EmpleadoRotacion[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtroTurnos, setFiltroTurnos] = useState<string>('todas')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRotacion, setEditingRotacion] = useState<Rotacion | null>(null)
  const [saving, setSaving] = useState(false)

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      const [rotRes, empRes] = await Promise.all([
        fetch('/api/sicamar/rotaciones/disponibles'),
        fetch('/api/sicamar/rotaciones')
      ])
      const rotData = await rotRes.json()
      const empData = await empRes.json()
      setRotaciones(rotData.data || [])
      setEmpleados(empData.data || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }, [])
  
  const handleRotationUpdated = useCallback(() => { cargarDatos() }, [cargarDatos])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  const handleCrearRotacion = () => { setEditingRotacion(null); setModalOpen(true) }
  const handleEditarRotacion = (rot: Rotacion) => { setEditingRotacion(rot); setModalOpen(true) }
  
  const handleEliminarRotacion = async (rot: Rotacion) => {
    if (!confirm(`¿Eliminar "${rot.nombre}"?`)) return
    try {
      await fetch('/api/sicamar/rotaciones/disponibles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rot.id })
      })
      cargarDatos()
    } catch (err) { console.error('Error:', err) }
  }

  const handleGuardarRotacion = async (data: RotacionFormData) => {
    setSaving(true)
    try {
      const method = editingRotacion ? 'PUT' : 'POST'
      const body = editingRotacion ? { id: editingRotacion.id, ...data } : data
      const res = await fetch('/api/sicamar/rotaciones/disponibles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (res.ok) { setModalOpen(false); cargarDatos() }
    } catch (err) { console.error('Error:', err) }
    finally { setSaving(false) }
  }

  const handleAsignarRotacion = async (empleadoId: number, rotacionId: number | null) => {
    const res = await fetch('/api/sicamar/rotaciones/asignar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empleado_id: empleadoId, rotacion_id: rotacionId })
    })
    if (res.ok) {
      const rotacion = rotaciones.find(r => r.id === rotacionId)
      setEmpleados(prev => prev.map(emp => {
        if (emp.empleado_id === empleadoId) {
          return {
            ...emp,
            rotacion_id: rotacionId,
            rotacion_nombre: rotacion?.nombre || null,
            turnos: rotacion?.turnos || null,
            frecuencia_semanas: rotacion?.frecuencia_semanas || null,
            cantidad_turnos: rotacion?.turnos?.length || 0,
          }
        }
        return emp
      }))
    }
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
        <header className="flex-shrink-0 border-b border-neutral-100">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-1">Sicamar</p>
              <h1 className="text-2xl font-light text-neutral-300 tracking-wide">Rotaciones</h1>
            </div>
            <Link href="/" className="text-xs text-neutral-400 hover:text-[#C4322F] transition-colors">← Inicio</Link>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-6 py-5">
          <RotacionesCatalogo 
            rotaciones={rotaciones}
            loading={loading}
            onEdit={handleEditarRotacion}
            onDelete={handleEliminarRotacion}
            onCreate={handleCrearRotacion}
          />

          <div className="border-t border-neutral-100 my-4" />

          <EmpleadosLista
            empleados={empleados}
            rotaciones={rotaciones}
            loading={loading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filtroTurnos={filtroTurnos}
            setFiltroTurnos={setFiltroTurnos}
            onAsignar={handleAsignarRotacion}
          />
        </div>
      </div>
      
      <RotationsChat onRotationUpdated={handleRotationUpdated} />

      <RotacionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleGuardarRotacion}
        rotacion={editingRotacion}
        saving={saving}
      />
    </div>
  )
}

function LoginPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center px-4">
        <p className="text-sm font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-4">
          Sicamar
        </p>
        <h1 className="text-2xl font-light text-neutral-300 mb-4">
          Rotaciones
        </h1>
        <p className="text-sm text-neutral-400 mb-8">Iniciá sesión para acceder</p>
        <SignInButton mode="modal">
          <button className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-[#C4322F] transition-colors cursor-pointer">
            <span>Acceder</span><span>→</span>
          </button>
        </SignInButton>
      </div>
    </div>
  )
}

export default function RotacionesPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const [isSicamarMember, setIsSicamarMember] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkMembership() {
      if (!user?.id) return
      try {
        const email = user.primaryEmailAddress?.emailAddress || ''
        const res = await fetch(`/api/auth/check-sicamar?userId=${user.id}&email=${encodeURIComponent(email)}`)
        const data = await res.json()
        setIsSicamarMember(data.isMember)
      } catch { setIsSicamarMember(false) }
    }
    if (isSignedIn && user) checkMembership()
  }, [isSignedIn, user])

  if (!isLoaded) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="text-neutral-300 text-sm">Cargando...</div></div>
  if (!isSignedIn) return <LoginPage />
  if (isSicamarMember === null) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="text-neutral-300 text-sm">Verificando acceso...</div></div>
  if (!isSicamarMember) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center px-4">
        <p className="text-sm font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-4">
          Sicamar
        </p>
        <h1 className="text-2xl font-light text-neutral-300 mb-4">
          Acceso Restringido
        </h1>
        <p className="text-sm text-neutral-400 mb-8">No tenés permisos para acceder.</p>
        <Link href="/" className="text-sm text-neutral-400 hover:text-[#C4322F]">← Volver al inicio</Link>
      </div>
    </div>
  )
  return <RotacionesContent />
}
