'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  
  return (
    <span className="text-[10px] text-neutral-400 font-medium">
      {cantidad === 1 ? 'Fijo' : `${cantidad}T`}
    </span>
  )
}

// ============ DROPDOWN SUTIL PARA ROTACIONES ============

function RotacionDropdown({ 
  value, 
  rotaciones, 
  onChange, 
  disabled 
}: { 
  value: number | null
  rotaciones: Rotacion[]
  onChange: (rotacionId: number | null) => void
  disabled?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const selectedRotacion = rotaciones.find(r => r.id === value)
  const displayText = selectedRotacion?.nombre || 'Sin rotación'
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-1.5 text-xs transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-neutral-900 cursor-pointer'}
          ${selectedRotacion ? 'text-neutral-600' : 'text-neutral-300'}
        `}
      >
        <span className="truncate max-w-[140px]">{displayText}</span>
        <svg 
          width="10" 
          height="10" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          className={`flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-neutral-100 rounded shadow-lg z-20 min-w-[180px] py-1 max-h-[200px] overflow-y-auto">
          <button
            onClick={() => { onChange(null); setIsOpen(false) }}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-50 transition-colors ${!value ? 'text-neutral-900' : 'text-neutral-400'}`}
          >
            Sin rotación
          </button>
          {rotaciones.map(rot => (
            <button
              key={rot.id}
              onClick={() => { onChange(rot.id); setIsOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-50 transition-colors ${value === rot.id ? 'text-neutral-900' : 'text-neutral-600'}`}
            >
              {rot.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
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

// Tipo para empleados seleccionados (exportado para el chat)
export interface EmpleadoSeleccionado {
  empleado_id: number
  legajo: string
  nombre_completo: string
}

function EmpleadosLista({
  empleados,
  rotaciones,
  loading,
  searchQuery,
  setSearchQuery,
  filtroRotacion,
  setFiltroRotacion,
  onAsignar,
  selectedEmpleados,
  onSelectionChange
}: {
  empleados: EmpleadoRotacion[]
  rotaciones: Rotacion[]
  loading: boolean
  searchQuery: string
  setSearchQuery: (q: string) => void
  filtroRotacion: string
  setFiltroRotacion: (t: string) => void
  onAsignar: (empleadoId: number, rotacionId: number | null) => Promise<void>
  selectedEmpleados: EmpleadoSeleccionado[]
  onSelectionChange: (selected: EmpleadoSeleccionado[]) => void
}) {
  const [guardando, setGuardando] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('nombre')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filtroOpen, setFiltroOpen] = useState(false)
  const filtroRef = useRef<HTMLDivElement>(null)
  
  // Para drag selection
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filtroRef.current && !filtroRef.current.contains(event.target as Node)) {
        setFiltroOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Manejar fin de drag fuera de la tabla
  useEffect(() => {
    function handleMouseUp() {
      setIsDragging(false)
      setDragStartIndex(null)
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  // Función para manejar click en una fila
  const handleRowClick = (emp: EmpleadoRotacion, index: number, event: React.MouseEvent) => {
    const isSelected = selectedEmpleados.some(s => s.empleado_id === emp.empleado_id)
    
    if (event.metaKey || event.ctrlKey) {
      // Cmd/Ctrl+Click: toggle individual
      if (isSelected) {
        onSelectionChange(selectedEmpleados.filter(s => s.empleado_id !== emp.empleado_id))
      } else {
        onSelectionChange([...selectedEmpleados, { empleado_id: emp.empleado_id, legajo: emp.legajo, nombre_completo: emp.nombre_completo }])
      }
    } else if (event.shiftKey && selectedEmpleados.length > 0) {
      // Shift+Click: seleccionar rango
      const lastSelectedId = selectedEmpleados[selectedEmpleados.length - 1].empleado_id
      const lastIndex = empleadosFiltrados.findIndex(e => e.empleado_id === lastSelectedId)
      const startIdx = Math.min(lastIndex, index)
      const endIdx = Math.max(lastIndex, index)
      
      const rangeSelection = empleadosFiltrados.slice(startIdx, endIdx + 1).map(e => ({
        empleado_id: e.empleado_id,
        legajo: e.legajo,
        nombre_completo: e.nombre_completo
      }))
      
      // Merge con selección existente (sin duplicados)
      const existingIds = new Set(selectedEmpleados.map(s => s.empleado_id))
      const newSelection = [...selectedEmpleados]
      for (const e of rangeSelection) {
        if (!existingIds.has(e.empleado_id)) {
          newSelection.push(e)
        }
      }
      onSelectionChange(newSelection)
    } else {
      // Click simple: seleccionar solo este
      if (isSelected && selectedEmpleados.length === 1) {
        onSelectionChange([])
      } else {
        onSelectionChange([{ empleado_id: emp.empleado_id, legajo: emp.legajo, nombre_completo: emp.nombre_completo }])
      }
    }
  }

  // Manejar inicio de drag
  const handleRowMouseDown = (index: number, event: React.MouseEvent) => {
    // Solo iniciar drag con click izquierdo sin modificadores
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      setIsDragging(true)
      setDragStartIndex(index)
    }
  }

  // Manejar mouse enter durante drag
  const handleRowMouseEnter = (index: number) => {
    if (isDragging && dragStartIndex !== null) {
      const startIdx = Math.min(dragStartIndex, index)
      const endIdx = Math.max(dragStartIndex, index)
      
      const rangeSelection = empleadosFiltrados.slice(startIdx, endIdx + 1).map(e => ({
        empleado_id: e.empleado_id,
        legajo: e.legajo,
        nombre_completo: e.nombre_completo
      }))
      onSelectionChange(rangeSelection)
    }
  }

  // Obtener la rotación seleccionada para mostrar en el filtro
  const rotacionFiltroActual = filtroRotacion === 'todas' 
    ? 'Todas las rotaciones' 
    : filtroRotacion === 'sin' 
      ? 'Sin rotación' 
      : rotaciones.find(r => r.id === Number(filtroRotacion))?.nombre || 'Todas las rotaciones'

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
    
    if (filtroRotacion !== 'todas') {
      if (filtroRotacion === 'sin') {
        if (emp.rotacion_id !== null) return false
      } else {
        const rotId = Number(filtroRotacion)
        if (emp.rotacion_id !== rotId) return false
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
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-widest">
            Empleados
          </h2>
          <span className="text-[9px] text-neutral-300" title="Click para seleccionar, ⌘+click para agregar, arrastrar para múltiples">
            ⌘ click · drag
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-40 h-7 px-2 text-xs border border-neutral-200 rounded focus:border-neutral-400 focus:ring-0 focus:outline-none"
          />
          
          {/* Filtro por rotación - dropdown sutil */}
          <div ref={filtroRef} className="relative">
            <button
              onClick={() => setFiltroOpen(!filtroOpen)}
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              <span>{rotacionFiltroActual}</span>
              <svg 
                width="10" 
                height="10" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className={`transition-transform ${filtroOpen ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            
            {filtroOpen && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-neutral-100 rounded shadow-lg z-20 min-w-[180px] py-1 max-h-[240px] overflow-y-auto">
                <button
                  onClick={() => { setFiltroRotacion('todas'); setFiltroOpen(false) }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-50 transition-colors ${filtroRotacion === 'todas' ? 'text-neutral-900 font-medium' : 'text-neutral-500'}`}
                >
                  Todas las rotaciones
                </button>
                <button
                  onClick={() => { setFiltroRotacion('sin'); setFiltroOpen(false) }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-50 transition-colors ${filtroRotacion === 'sin' ? 'text-neutral-900 font-medium' : 'text-neutral-500'}`}
                >
                  Sin rotación
                </button>
                <div className="border-t border-neutral-100 my-1" />
                {rotaciones.map(rot => (
                  <button
                    key={rot.id}
                    onClick={() => { setFiltroRotacion(String(rot.id)); setFiltroOpen(false) }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-50 transition-colors ${filtroRotacion === String(rot.id) ? 'text-neutral-900 font-medium' : 'text-neutral-600'}`}
                  >
                    {rot.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table ref={tableRef} className="w-full select-none">
          <thead>
            <tr>
              <th onClick={() => handleSort('nombre')} className="text-left text-xs font-normal text-neutral-400 pb-3 pr-3 cursor-pointer hover:text-neutral-600 select-none">
                Empleado{sortKey === 'nombre' && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
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
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-neutral-100 rounded-full animate-pulse" />
                      <div className="flex flex-col gap-1">
                        <div className="w-24 h-3 bg-neutral-100 rounded animate-pulse" />
                        <div className="w-12 h-2 bg-neutral-50 rounded animate-pulse" />
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-2"><div className="w-14 h-3 bg-neutral-50 rounded animate-pulse" /></td>
                  <td className="py-2 px-2"><div className="w-28 h-3 bg-neutral-50 rounded animate-pulse" /></td>
                  <td />
                </tr>
              ))
            ) : empleadosFiltrados.map((emp, index) => {
              const isSaving = guardando === emp.empleado_id
              const isSelected = selectedEmpleados.some(s => s.empleado_id === emp.empleado_id)
              
              return (
                <tr 
                  key={emp.empleado_id} 
                  className="border-t border-neutral-50 transition-colors cursor-pointer"
                  onClick={(e) => handleRowClick(emp, index, e)}
                  onMouseDown={(e) => handleRowMouseDown(index, e)}
                  onMouseEnter={() => handleRowMouseEnter(index)}
                >
                  <td className={`py-2 pl-3 pr-3 rounded-l transition-colors ${
                    isSelected 
                      ? 'bg-[#C4322F]/5' 
                      : 'hover:bg-neutral-50/50'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <AvatarMini foto_thumb_url={emp.foto_thumb_url} nombre_completo={emp.nombre_completo} />
                        {isSelected && (
                          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#C4322F] rounded-full flex items-center justify-center">
                            <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm text-neutral-700 truncate max-w-[180px]">{emp.nombre_completo}</span>
                        <span className="text-[10px] text-neutral-300 font-mono">{emp.legajo}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <span className="text-xs text-neutral-400 truncate">{emp.sector || '—'}</span>
                  </td>
                  <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <RotacionDropdown
                        value={emp.rotacion_id}
                        rotaciones={rotaciones}
                        onChange={async (newVal) => {
                          if (newVal !== emp.rotacion_id) {
                            setGuardando(emp.empleado_id)
                            await onAsignar(emp.empleado_id, newVal)
                            setGuardando(null)
                          }
                        }}
                        disabled={isSaving}
                      />
                      {isSaving && <span className="text-[9px] text-neutral-400 ml-1">guardando...</span>}
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

      <div className="mt-4 flex items-center justify-between text-xs text-neutral-300">
        <span>{empleadosFiltrados.length} de {stats.total} · {stats.conRotacion} con rotación · {stats.sinRotacion} sin asignar</span>
        {selectedEmpleados.length > 0 && (
          <span className="text-[#C4322F]">
            {selectedEmpleados.length} seleccionado{selectedEmpleados.length > 1 ? 's' : ''} 
            <button 
              onClick={() => onSelectionChange([])} 
              className="ml-2 text-neutral-400 hover:text-neutral-600"
            >
              (limpiar)
            </button>
          </span>
        )}
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
  const [filtroRotacion, setFiltroRotacion] = useState<string>('todas')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRotacion, setEditingRotacion] = useState<Rotacion | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedEmpleados, setSelectedEmpleados] = useState<EmpleadoSeleccionado[]>([])

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
            filtroRotacion={filtroRotacion}
            setFiltroRotacion={setFiltroRotacion}
            onAsignar={handleAsignarRotacion}
            selectedEmpleados={selectedEmpleados}
            onSelectionChange={setSelectedEmpleados}
          />
        </div>
      </div>
      
      <RotationsChat 
        onRotationUpdated={handleRotationUpdated} 
        selectedEmpleados={selectedEmpleados}
        onClearSelection={() => setSelectedEmpleados([])}
        onRemoveEmpleado={(id) => setSelectedEmpleados(prev => prev.filter(e => e.empleado_id !== id))}
      />

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
