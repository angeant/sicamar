'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth, useUser, SignInButton } from '@clerk/nextjs'
import Link from 'next/link'

// ============ TIPOS ============

interface EmpleadoPosicion {
  empleado_id: number
  legajo: string
  nombre_completo: string
  dni: string | null
  cargo_actual: string | null
  sector: string | null
  categoria: string | null
  activo: boolean
  foto_url: string | null
  foto_thumb_url: string | null
  // Posición actual
  posicion_id: number | null
  posicion_codigo: string | null
  posicion_nombre: string | null
  planta: string | null
  rotation_type: string | null
  is_locked: boolean
  fecha_desde: string | null
}

interface PosicionDisponible {
  id: number
  codigo: string
  nombre: string
  planta: string
  rotation_type: string | null
}

// ============ COMPONENTES ============

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
        <img 
          src={foto_thumb_url} 
          alt={nombre_completo}
          className="w-full h-full object-cover grayscale"
        />
      </div>
    )
  }
  
  return (
    <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs text-neutral-400 flex-shrink-0">
      {iniciales}
    </div>
  )
}

function RotationBadge({ type }: { type: string | null }) {
  if (!type) {
    return <span className="text-neutral-200">—</span>
  }
  
  const config: Record<string, { label: string; clase: string }> = {
    'FULL': { label: '3T', clase: 'bg-emerald-50 text-emerald-700' },
    'PENDULAR': { label: '2T', clase: 'bg-blue-50 text-blue-700' },
    'FIXED': { label: 'Fijo', clase: 'bg-neutral-100 text-neutral-500' },
  }
  
  const c = config[type] || { label: type, clase: 'bg-neutral-100 text-neutral-500' }
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${c.clase}`}>
      {c.label}
    </span>
  )
}

function PlantaBadge({ planta }: { planta: string | null }) {
  if (!planta) return <span className="text-neutral-200">—</span>
  
  const labels: Record<string, string> = {
    P1: 'P1',
    P2: 'P2',
    MTO: 'MTO',
    ADMIN: 'ADM',
    planta_1: 'P1',
    planta_2: 'P2',
    mantenimiento: 'MTO',
    administracion: 'ADM'
  }
  
  return (
    <span className="text-xs text-neutral-400">
      {labels[planta] || planta}
    </span>
  )
}

// ============ TIPOS DE ORDENAMIENTO ============

type SortKey = 'nombre' | 'legajo' | 'sector' | 'posicion' | 'planta' | 'rotacion'
type SortDir = 'asc' | 'desc'

// ============ PÁGINA PRINCIPAL ============

function PosicionesContent() {
  const [empleados, setEmpleados] = useState<EmpleadoPosicion[]>([])
  const [posicionesDisponibles, setPosicionesDisponibles] = useState<PosicionDisponible[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtroRotacion, setFiltroRotacion] = useState<string>('todas')
  const [filtroPlanta, setFiltroPlanta] = useState<string>('todas')
  const [editando, setEditando] = useState<number | null>(null)
  const [guardando, setGuardando] = useState<number | null>(null)
  const [pendingChanges, setPendingChanges] = useState<Record<number, { posicion_id: number | null }>>({})
  const [sortKey, setSortKey] = useState<SortKey>('nombre')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      const [empRes, posRes] = await Promise.all([
        fetch('/api/sicamar/posiciones'),
        fetch('/api/sicamar/posiciones/disponibles')
      ])
      
      const empData = await empRes.json()
      const posData = await posRes.json()
      
      setEmpleados(empData.data || [])
      setPosicionesDisponibles(posData.data || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const handleSave = async (empleadoId: number) => {
    const cambio = pendingChanges[empleadoId]
    if (!cambio) {
      setEditando(null)
      return
    }

    setGuardando(empleadoId)
    try {
      const res = await fetch('/api/sicamar/posiciones/asignar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_id: empleadoId,
          posicion_id: cambio.posicion_id,
          is_locked: false
        })
      })
      
      if (res.ok) {
        // Actualizar localmente
        const posicion = posicionesDisponibles.find(p => p.id === cambio.posicion_id)
        setEmpleados(prev => prev.map(emp => {
          if (emp.empleado_id === empleadoId) {
            return {
              ...emp,
              posicion_id: cambio.posicion_id,
              posicion_codigo: posicion?.codigo || null,
              posicion_nombre: posicion?.nombre || null,
              planta: posicion?.planta || null,
              rotation_type: posicion?.rotation_type || null,
              fecha_desde: new Date().toISOString().split('T')[0]
            }
          }
          return emp
        }))
        
        setPendingChanges(prev => {
          const next = { ...prev }
          delete next[empleadoId]
          return next
        })
        setEditando(null)
      }
    } catch (err) {
      console.error('Error guardando:', err)
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

  // Toggle sort
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // Filtros
  const empleadosFiltrados = empleados.filter(emp => {
    // Búsqueda
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const match = 
        emp.nombre_completo?.toLowerCase().includes(q) ||
        emp.legajo?.toLowerCase().includes(q) ||
        emp.posicion_nombre?.toLowerCase().includes(q) ||
        emp.sector?.toLowerCase().includes(q)
      if (!match) return false
    }
    
    // Filtro rotación
    if (filtroRotacion !== 'todas') {
      if (filtroRotacion === 'sin_posicion') {
        if (emp.posicion_id !== null) return false
      } else {
        if (emp.rotation_type !== filtroRotacion) return false
      }
    }
    
    // Filtro planta
    if (filtroPlanta !== 'todas') {
      if (emp.planta !== filtroPlanta) return false
    }
    
    return true
  }).sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    
    const getValue = (emp: EmpleadoPosicion, key: SortKey): string => {
      switch (key) {
        case 'nombre': return emp.nombre_completo || ''
        case 'legajo': return emp.legajo || ''
        case 'sector': return emp.sector || ''
        case 'posicion': return emp.posicion_nombre || ''
        case 'planta': return emp.planta || ''
        case 'rotacion': return emp.rotation_type || ''
        default: return ''
      }
    }
    
    const valA = getValue(a, sortKey).toLowerCase()
    const valB = getValue(b, sortKey).toLowerCase()
    
    if (valA < valB) return -1 * dir
    if (valA > valB) return 1 * dir
    return 0
  })

  // Stats
  const stats = {
    total: empleados.length,
    full: empleados.filter(e => e.rotation_type === 'FULL').length,
    pendular: empleados.filter(e => e.rotation_type === 'PENDULAR').length,
    fixed: empleados.filter(e => e.rotation_type === 'FIXED').length,
  }

  // Plantas únicas
  const plantas = [...new Set(empleados.map(e => e.planta).filter(Boolean))]

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      {/* Header estilo planificación */}
      <header className="flex-shrink-0 border-b border-neutral-100">
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-1">
              Sicamar
            </p>
            <h1 className="text-2xl font-light text-neutral-300 tracking-wide">
              Posiciones
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Filtro rotación */}
            <div className="flex items-center bg-neutral-100 rounded-lg p-0.5">
              {[
                { key: 'todas', label: 'Todas' },
                { key: 'FULL', label: '3 Turnos' },
                { key: 'PENDULAR', label: '2 Turnos' },
                { key: 'FIXED', label: 'Fijo' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFiltroRotacion(f.key)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                    filtroRotacion === f.key 
                      ? 'bg-white text-neutral-900 shadow-sm' 
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            
            {/* Filtro planta */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFiltroPlanta('todas')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  filtroPlanta === 'todas' ? 'bg-neutral-900 text-white' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                Todas
              </button>
              {plantas.map(p => (
                <button
                  key={p}
                  onClick={() => setFiltroPlanta(p!)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    filtroPlanta === p ? 'bg-neutral-900 text-white' : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            
            <Link
              href="/"
              className="text-xs text-neutral-400 hover:text-[#C4322F] transition-colors"
            >
              ← Inicio
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {/* Búsqueda */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Buscar empleado, legajo, posición..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-96 h-8 px-3 text-sm border border-neutral-200 rounded focus:border-neutral-400 focus:ring-0 focus:outline-none"
          />
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th 
                  onClick={() => handleSort('nombre')}
                  className="text-left text-xs font-normal text-neutral-400 pb-4 pr-6 w-64 cursor-pointer hover:text-neutral-600 transition-colors select-none"
                >
                  Empleado{sortKey === 'nombre' && <span className="ml-1 text-neutral-300">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th 
                  onClick={() => handleSort('legajo')}
                  className="text-left text-xs font-normal text-neutral-400 pb-4 px-3 w-20 cursor-pointer hover:text-neutral-600 transition-colors select-none"
                >
                  Legajo{sortKey === 'legajo' && <span className="ml-1 text-neutral-300">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th 
                  onClick={() => handleSort('sector')}
                  className="text-left text-xs font-normal text-neutral-400 pb-4 px-3 w-32 cursor-pointer hover:text-neutral-600 transition-colors select-none"
                >
                  Sector{sortKey === 'sector' && <span className="ml-1 text-neutral-300">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th 
                  onClick={() => handleSort('posicion')}
                  className="text-left text-xs font-normal text-neutral-400 pb-4 px-3 cursor-pointer hover:text-neutral-600 transition-colors select-none"
                >
                  Posición{sortKey === 'posicion' && <span className="ml-1 text-neutral-300">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th 
                  onClick={() => handleSort('planta')}
                  className="text-center text-xs font-normal text-neutral-400 pb-4 px-3 w-16 cursor-pointer hover:text-neutral-600 transition-colors select-none"
                >
                  Planta{sortKey === 'planta' && <span className="ml-1 text-neutral-300">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th 
                  onClick={() => handleSort('rotacion')}
                  className="text-center text-xs font-normal text-neutral-400 pb-4 px-3 w-20 cursor-pointer hover:text-neutral-600 transition-colors select-none"
                >
                  Rotación{sortKey === 'rotacion' && <span className="ml-1 text-neutral-300">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th className="text-center text-xs font-normal text-neutral-400 pb-4 px-3 w-24">
                  
                </th>
              </tr>
            </thead>
            <tbody className={loading ? 'opacity-40 pointer-events-none' : ''}>
              {loading && empleados.length === 0 ? (
                // Skeleton
                Array.from({ length: 20 }).map((_, i) => (
                  <tr key={i} className="border-t border-neutral-50">
                    <td className="py-2 pr-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-neutral-100 rounded-full animate-pulse" />
                        <div>
                          <div className="w-32 h-4 bg-neutral-100 rounded animate-pulse mb-1" />
                          <div className="w-20 h-3 bg-neutral-50 rounded animate-pulse" />
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3"><div className="w-10 h-4 bg-neutral-50 rounded animate-pulse" /></td>
                    <td className="py-2 px-3"><div className="w-16 h-4 bg-neutral-50 rounded animate-pulse" /></td>
                    <td className="py-2 px-3"><div className="w-40 h-4 bg-neutral-50 rounded animate-pulse" /></td>
                    <td className="py-2 px-3"><div className="w-8 h-4 bg-neutral-50 rounded animate-pulse mx-auto" /></td>
                    <td className="py-2 px-3"><div className="w-10 h-4 bg-neutral-50 rounded animate-pulse mx-auto" /></td>
                    <td className="py-2 px-3" />
                  </tr>
                ))
              ) : empleadosFiltrados.map(emp => {
                const isEditing = editando === emp.empleado_id
                const isSaving = guardando === emp.empleado_id
                const cambio = pendingChanges[emp.empleado_id]
                
                return (
                  <tr 
                    key={emp.empleado_id} 
                    className="border-t border-neutral-50 hover:bg-neutral-50/50 transition-colors"
                  >
                    <td className="py-2 pr-6">
                      <div className="flex items-center gap-3">
                        <AvatarMini 
                          foto_thumb_url={emp.foto_thumb_url} 
                          nombre_completo={emp.nombre_completo}
                        />
                        <div>
                          <p className="text-sm text-neutral-700">
                            {emp.nombre_completo.split(',')[0]}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            {emp.nombre_completo.split(',')[1]?.trim()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-xs text-neutral-300 font-mono">
                        {emp.legajo}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-xs text-neutral-500">
                        {emp.sector || '—'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <select
                          value={cambio?.posicion_id ?? emp.posicion_id ?? ''}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : null
                            setPendingChanges(prev => ({
                              ...prev,
                              [emp.empleado_id]: { posicion_id: val }
                            }))
                          }}
                          className="h-7 px-2 text-xs border border-neutral-300 rounded w-full max-w-xs focus:border-neutral-400 focus:ring-0 focus:outline-none"
                        >
                          <option value="">Sin posición</option>
                          {posicionesDisponibles.map(pos => (
                            <option key={pos.id} value={pos.id}>
                              {pos.nombre.replace(/\s*\(Genérico\)/gi, '')} ({pos.planta})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={emp.posicion_nombre ? 'text-sm text-neutral-700' : 'text-neutral-200'}>
                          {emp.posicion_nombre?.replace(/\s*\(Genérico\)/gi, '') || '—'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <PlantaBadge planta={emp.planta} />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <RotationBadge type={emp.rotation_type} />
                    </td>
                    <td className="py-2 px-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleSave(emp.empleado_id)}
                            disabled={isSaving}
                            className="h-6 px-2 text-[10px] bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:opacity-50"
                          >
                            {isSaving ? '...' : 'OK'}
                          </button>
                          <button
                            onClick={() => handleCancel(emp.empleado_id)}
                            disabled={isSaving}
                            className="h-6 px-2 text-[10px] text-neutral-400 hover:text-neutral-600"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditando(emp.empleado_id)}
                          className="text-[10px] text-neutral-400 hover:text-[#C4322F] transition-colors"
                        >
                          editar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!loading && empleadosFiltrados.length === 0 && (
          <div className="text-center py-12 text-neutral-300 text-sm">
            No se encontraron empleados
          </div>
        )}

        {/* Leyenda */}
        <div className="mt-8 pt-6 border-t border-neutral-100">
          <div className="flex items-center gap-6 text-[10px] text-neutral-300">
            <span><span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">3T</span> rotación 3 turnos (M→T→N)</span>
            <span><span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">2T</span> rotación 2 turnos (pendular)</span>
            <span><span className="bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded font-medium">Fijo</span> turno fijo</span>
            <span className="text-neutral-200">|</span>
            <span>P1 · Planta 1</span>
            <span>P2 · Planta 2</span>
            <span>MTO · Mantenimiento</span>
            <span>ADM · Administración</span>
          </div>
        </div>
        
        {/* Stats */}
        <div className="mt-4 text-xs text-neutral-300">
          {empleadosFiltrados.length} de {stats.total} empleados · {stats.full} 3T · {stats.pendular} 2T · {stats.fixed} fijo
        </div>
      </div>
    </div>
  )
}

// Auth wrapper
function LoginPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center px-4">
        <p className="text-sm font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-4">
          Sicamar
        </p>
        <h1 className="text-2xl font-light text-neutral-300 mb-4">
          Posiciones
        </h1>
        <p className="text-sm text-neutral-400 mb-8">
          Iniciá sesión para acceder
        </p>
        <SignInButton mode="modal">
          <button className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-[#C4322F] transition-colors cursor-pointer">
            <span>Acceder</span>
            <span>→</span>
          </button>
        </SignInButton>
      </div>
    </div>
  )
}

export default function PosicionesPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const [isSicamarMember, setIsSicamarMember] = useState<boolean | null>(null)

  // Verificar membresía
  useEffect(() => {
    async function checkMembership() {
      if (!user?.id) return
      try {
        const email = user.primaryEmailAddress?.emailAddress || ''
        const res = await fetch(`/api/auth/check-sicamar?userId=${user.id}&email=${encodeURIComponent(email)}`)
        const data = await res.json()
        setIsSicamarMember(data.isMember)
      } catch {
        setIsSicamarMember(false)
      }
    }
    if (isSignedIn && user) {
      checkMembership()
    }
  }, [isSignedIn, user])

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-neutral-300 text-sm">Cargando...</div>
      </div>
    )
  }

  if (!isSignedIn) {
    return <LoginPage />
  }

  if (isSicamarMember === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-neutral-300 text-sm">Verificando acceso...</div>
      </div>
    )
  }

  if (!isSicamarMember) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-sm font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-4">
            Sicamar
          </p>
          <h1 className="text-2xl font-light text-neutral-300 mb-4">
            Acceso Restringido
          </h1>
          <p className="text-sm text-neutral-400 mb-8">
            No tenés permisos para acceder a esta página.
          </p>
          <Link href="/" className="text-sm text-neutral-400 hover:text-[#C4322F]">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  return <PosicionesContent />
}
