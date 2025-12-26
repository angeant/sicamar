'use client'

import { useState, useEffect, Fragment } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useAuth, useUser } from '@clerk/nextjs'
import NominaChat from './components/nomina-chat'

// ========== TYPES ==========
interface Empleado {
  id: number
  legajo: string
  dni: string
  cuil: string | null
  nombre: string | null
  apellido: string | null
  activo: boolean
  estado_laboral: string
  condicion_contratacion: string | null
  fecha_ingreso: string | null
  fecha_egreso: string | null
  fecha_nacimiento: string | null
  categoria: string | null
  sector: string | null
  cargo: string | null
  clase: string | null
  celular: string | null
  domicilio: string | null
  piso: string | null
  departamento: string | null
  localidad: string | null
  provincia: string | null
  codigo_postal: string | null
  estudios: string | null
  sexo: string | null
  nacionalidad: string | null
  estado_civil: string | null
  obra_social: string | null
  codigo_obra_social: string | null
  fuera_convenio: boolean | null
  centro_costo: string | null
  lugar_pago: string | null
  created_at: string
  updated_at: string | null
  email: string | null
  telefono: string | null
  salario_basico: number | null
  cbu: string | null
  sindicato: string | null
  codigo_categoria: string | null
  codigo_sector: string | null
  codigo_cargo: string | null
  bejerman_leg_numero: number | null
  bejerman_sync_at: string | null
  foto_url: string | null
  foto_thumb_url: string | null
}

interface EmpleadoSeleccionado {
  id: number
  legajo: string
  nombre: string
}

type SortField = 'apellido' | 'legajo' | 'sector' | 'condicion' | 'antiguedad'
type SortOrder = 'asc' | 'desc'

// ========== HELPERS ==========
const calcularAntiguedad = (fechaIngreso: string | null): string => {
  if (!fechaIngreso) return '-'
  const ingreso = new Date(fechaIngreso)
  const hoy = new Date()
  const diffMs = hoy.getTime() - ingreso.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const años = Math.floor(diffDias / 365)
  const meses = Math.floor((diffDias % 365) / 30)
  
  if (años === 0 && meses === 0) return '<1m'
  if (años === 0) return `${meses}m`
  if (meses === 0) return `${años}a`
  return `${años}a ${meses}m`
}

const calcularAntiguedadDias = (fechaIngreso: string | null): number => {
  if (!fechaIngreso) return 0
  const ingreso = new Date(fechaIngreso)
  const hoy = new Date()
  return Math.floor((hoy.getTime() - ingreso.getTime()) / (1000 * 60 * 60 * 24))
}

const formatearFecha = (fecha: string | null): string => {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const getCondicionLabel = (condicion: string | null): string => {
  const efectiva = condicion || 'efectivo'
  switch (efectiva) {
    case 'efectivo': return 'Efectivo'
    case 'eventual': return 'Eventual'
    case 'a_prueba': return 'A prueba'
    default: return efectiva
  }
}

// Avatar mini para empleados
function AvatarMini({ foto_thumb_url, nombre, apellido }: { foto_thumb_url?: string | null, nombre: string | null, apellido: string | null }) {
  const iniciales = `${nombre?.[0] || ''}${apellido?.[0] || ''}`.toUpperCase()
  
  if (foto_thumb_url) {
    return (
      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
        <img src={foto_thumb_url} alt={`${apellido}, ${nombre}`} className="w-full h-full object-cover grayscale" />
      </div>
    )
  }
  
  return (
    <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs text-neutral-400 flex-shrink-0">
      {iniciales}
    </div>
  )
}

// ========== MAIN PAGE ==========
export default function NominaPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [condicionFiltro, setCondicionFiltro] = useState<string>('todos')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  
  // Ordenamiento
  const [sortField, setSortField] = useState<SortField>('apellido')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  
  // Selección de empleados para el chat
  const [selectedEmpleados, setSelectedEmpleados] = useState<EmpleadoSeleccionado[]>([])

  const fetchEmpleados = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/sicamar/empleados')
      const data = await res.json()
      if (data.empleados) {
        setEmpleados(data.empleados)
      }
    } catch (error) {
      console.error('Error fetching empleados:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isSignedIn) {
      fetchEmpleados()
    }
  }, [isSignedIn])

  // Filtrar empleados
  const filteredEmpleados = empleados.filter(emp => {
    const matchesSearch = searchQuery === '' ||
      (emp.apellido?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.nombre?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.legajo?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.dni?.includes(searchQuery))

    const matchesActivo = mostrarInactivos ? !emp.activo : emp.activo

    const empCondicion = emp.condicion_contratacion || 'efectivo'
    const matchesCondicion = condicionFiltro === 'todos' || empCondicion === condicionFiltro

    return matchesSearch && matchesActivo && matchesCondicion
  })
  
  // Ordenar empleados
  const sortedEmpleados = [...filteredEmpleados].sort((a, b) => {
    let comparison = 0
    
    switch (sortField) {
      case 'apellido':
        comparison = (a.apellido || '').localeCompare(b.apellido || '')
        break
      case 'legajo':
        comparison = parseInt(a.legajo || '0') - parseInt(b.legajo || '0')
        break
      case 'sector':
        comparison = (a.sector || '').localeCompare(b.sector || '')
        break
      case 'condicion':
        comparison = (a.condicion_contratacion || 'efectivo').localeCompare(b.condicion_contratacion || 'efectivo')
        break
      case 'antiguedad':
        comparison = calcularAntiguedadDias(b.fecha_ingreso) - calcularAntiguedadDias(a.fecha_ingreso)
        break
    }
    
    return sortOrder === 'asc' ? comparison : -comparison
  })
  
  // Toggle ordenamiento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }
  
  // Manejar click en fila con modificadores
  const handleRowClick = (emp: Empleado, index: number, event: React.MouseEvent) => {
    const empData: EmpleadoSeleccionado = {
      id: emp.id,
      legajo: emp.legajo || '',
      nombre: `${emp.apellido || ''}, ${emp.nombre || ''}`
    }
    
    const isSelected = selectedEmpleados.some(s => s.id === emp.id)
    
    if (event.metaKey || event.ctrlKey) {
      // Cmd/Ctrl+Click: toggle individual
      event.preventDefault()
      if (isSelected) {
        setSelectedEmpleados(prev => prev.filter(s => s.id !== emp.id))
      } else {
        setSelectedEmpleados(prev => [...prev, empData])
      }
    } else if (event.shiftKey && selectedEmpleados.length > 0) {
      // Shift+Click: seleccionar rango
      event.preventDefault()
      const lastSelectedId = selectedEmpleados[selectedEmpleados.length - 1].id
      const lastIndex = sortedEmpleados.findIndex(e => e.id === lastSelectedId)
      const currentIndex = index
      
      const startIdx = Math.min(lastIndex, currentIndex)
      const endIdx = Math.max(lastIndex, currentIndex)
      
      const rangeEmpleados = sortedEmpleados.slice(startIdx, endIdx + 1).map(e => ({
        id: e.id,
        legajo: e.legajo || '',
        nombre: `${e.apellido || ''}, ${e.nombre || ''}`
      }))
      
      // Agregar al set existente sin duplicar
      setSelectedEmpleados(prev => {
        const existingIds = new Set(prev.map(s => s.id))
        const newEmpleados = rangeEmpleados.filter(e => !existingIds.has(e.id))
        return [...prev, ...newEmpleados]
      })
    } else {
      // Click normal: expandir/colapsar detalle
      setExpandedId(expandedId === emp.id ? null : emp.id)
    }
  }
  
  // Limpiar selección
  const handleClearSelection = () => {
    setSelectedEmpleados([])
  }
  
  // Remover un empleado de la selección
  const handleRemoveEmpleado = (id: number) => {
    setSelectedEmpleados(prev => prev.filter(s => s.id !== id))
  }

  const empleadosActivos = empleados.filter(e => e.activo)
  const stats = {
    total: empleadosActivos.length,
    efectivos: empleadosActivos.filter(e => (e.condicion_contratacion || 'efectivo') === 'efectivo').length,
    eventuales: empleadosActivos.filter(e => e.condicion_contratacion === 'eventual').length,
    aPrueba: empleadosActivos.filter(e => e.condicion_contratacion === 'a_prueba').length,
    inactivos: empleados.filter(e => !e.activo).length,
  }
  
  // Render sort indicator
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
  }

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    )
  }

  // No autenticado
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-neutral-400 text-sm">Acceso restringido</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Main Content - Lista de empleados */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 border-b border-neutral-100">
          <div className="px-8 py-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-1">
                Sicamar
              </p>
              <h1 className="text-2xl font-light text-neutral-300 tracking-wide">
                Nómina
              </h1>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Stats */}
              <div className="text-right">
                <p className="text-sm font-medium text-neutral-900">
                  {stats.total} activos
                </p>
                <p className="text-xs text-neutral-400">
                  {stats.efectivos} efectivos
                  {stats.eventuales > 0 && (
                    <span className="text-red-500 font-medium"> · {stats.eventuales} eventuales</span>
                  )}
                  {stats.aPrueba > 0 && (
                    <span className="text-amber-500 font-medium"> · {stats.aPrueba} a prueba</span>
                  )}
                </p>
              </div>
              
              {/* Buscar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-3 pr-3 text-sm border border-neutral-200 rounded-lg w-48 focus:outline-none focus:border-neutral-400"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="flex-shrink-0 px-8 py-3 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {[
              { value: 'todos', label: 'Todos' },
              { value: 'efectivo', label: 'Efectivos' },
              { value: 'eventual', label: 'Eventuales' },
              { value: 'a_prueba', label: 'A prueba' },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setCondicionFiltro(f.value)}
                className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                  condicionFiltro === f.value
                    ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {f.label}
              </button>
            ))}
            
            {/* Indicador de selección */}
            {selectedEmpleados.length > 0 && (
              <span className="ml-4 text-xs text-neutral-400">
                ⌘ click · {selectedEmpleados.length} seleccionados
              </span>
            )}
          </div>

          <button
            onClick={() => setMostrarInactivos(!mostrarInactivos)}
            className={`px-3 py-1.5 text-xs rounded-md transition-all ${
              mostrarInactivos
                ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {mostrarInactivos ? 'Ver activos' : `Bajas (${stats.inactivos})`}
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white border-b border-neutral-100 sticky top-0 z-10">
                <tr>
                  <th 
                    className="text-left text-[10px] font-normal text-neutral-400 uppercase tracking-wider pl-8 pr-3 py-3 cursor-pointer hover:text-neutral-600 bg-white"
                    onClick={() => handleSort('apellido')}
                  >
                    Empleado<SortIndicator field="apellido" />
                  </th>
                  <th 
                    className="text-left text-[10px] font-normal text-neutral-400 uppercase tracking-wider px-3 py-3 w-16 cursor-pointer hover:text-neutral-600 bg-white"
                    onClick={() => handleSort('legajo')}
                  >
                    Legajo<SortIndicator field="legajo" />
                  </th>
                  <th 
                    className="text-left text-[10px] font-normal text-neutral-400 uppercase tracking-wider px-3 py-3 cursor-pointer hover:text-neutral-600 bg-white"
                    onClick={() => handleSort('sector')}
                  >
                    Sector / Cargo<SortIndicator field="sector" />
                  </th>
                  <th 
                    className="text-left text-[10px] font-normal text-neutral-400 uppercase tracking-wider px-3 py-3 w-24 cursor-pointer hover:text-neutral-600 bg-white"
                    onClick={() => handleSort('condicion')}
                  >
                    Condición<SortIndicator field="condicion" />
                  </th>
                  <th 
                    className="text-left text-[10px] font-normal text-neutral-400 uppercase tracking-wider px-3 py-3 w-20 cursor-pointer hover:text-neutral-600 bg-white"
                    onClick={() => handleSort('antiguedad')}
                  >
                    Antig.<SortIndicator field="antiguedad" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedEmpleados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-neutral-300 text-sm">
                      No se encontraron empleados
                    </td>
                  </tr>
                ) : (
                  sortedEmpleados.map((emp, index) => {
                    const isExpanded = expandedId === emp.id
                    const isSelected = selectedEmpleados.some(s => s.id === emp.id)
                    
                    return (
                      <Fragment key={emp.id}>
                        <tr 
                          className={`border-b border-neutral-50 cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-[#C4322F]/5' 
                              : isExpanded 
                                ? 'bg-neutral-50/50' 
                                : 'hover:bg-neutral-50/30'
                          }`}
                          onClick={(e) => handleRowClick(emp, index, e)}
                        >
                          <td className="px-8 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-neutral-400">
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              </span>
                              <AvatarMini 
                                foto_thumb_url={emp.foto_thumb_url} 
                                nombre={emp.nombre} 
                                apellido={emp.apellido} 
                              />
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-medium text-sm ${emp.activo ? 'text-neutral-900' : 'text-neutral-400'}`}>
                                    {emp.apellido || 'Sin apellido'}, {emp.nombre || 'Sin nombre'}
                                  </span>
                                  {emp.condicion_contratacion === 'eventual' && (
                                    <span className="w-2 h-2 rounded-full bg-red-500" title="Eventual" />
                                  )}
                                  {emp.condicion_contratacion === 'a_prueba' && (
                                    <span className="w-2 h-2 rounded-full bg-amber-500" title="A prueba" />
                                  )}
                                </div>
                                <span className="text-[11px] text-neutral-400">{emp.dni}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-neutral-500">
                            {emp.legajo || '-'}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="text-xs text-neutral-700">{emp.sector || '-'}</span>
                              <span className="text-[11px] text-neutral-400">{emp.cargo || ''}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs text-neutral-600">
                              {getCondicionLabel(emp.condicion_contratacion)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-neutral-600">
                            {calcularAntiguedad(emp.fecha_ingreso)}
                          </td>
                        </tr>

                        {/* Expanded Row */}
                        {isExpanded && (
                          <tr className="bg-neutral-50/30">
                            <td colSpan={5} className="px-8 py-4">
                              <div className="grid grid-cols-4 gap-6 text-xs">
                                {/* Datos Personales */}
                                <div className="space-y-1.5">
                                  <h4 className="font-medium text-neutral-900 border-b border-neutral-200 pb-1.5 mb-2">
                                    Datos Personales
                                  </h4>
                                  <div className="flex justify-between"><span className="text-neutral-400">DNI:</span><span className="font-mono">{emp.dni || '-'}</span></div>
                                  <div className="flex justify-between"><span className="text-neutral-400">CUIL:</span><span className="font-mono">{emp.cuil || '-'}</span></div>
                                  <div className="flex justify-between"><span className="text-neutral-400">Nacimiento:</span><span>{formatearFecha(emp.fecha_nacimiento)}</span></div>
                                  <div className="flex justify-between"><span className="text-neutral-400">Sexo:</span><span className="capitalize">{emp.sexo || '-'}</span></div>
                                  <div className="flex justify-between"><span className="text-neutral-400">Estado civil:</span><span className="capitalize">{emp.estado_civil || '-'}</span></div>
                                </div>

                                {/* Contacto */}
                                <div className="space-y-1.5">
                                  <h4 className="font-medium text-neutral-900 border-b border-neutral-200 pb-1.5 mb-2">
                                    Contacto
                                  </h4>
                                  <div className="flex justify-between"><span className="text-neutral-400">Email:</span><span className="text-[11px]">{emp.email || '-'}</span></div>
                                  <div className="flex justify-between"><span className="text-neutral-400">Celular:</span><span className="font-mono">{emp.celular || '-'}</span></div>
                                  <div className="flex flex-col gap-0.5 pt-1">
                                    <span className="text-neutral-400">Domicilio:</span>
                                    <span className="text-neutral-700">{emp.domicilio || '-'}</span>
                                    {emp.localidad && <span className="text-neutral-500 text-[11px]">{emp.localidad}, {emp.provincia}</span>}
                                  </div>
                                </div>

                                {/* Datos Laborales */}
                                <div className="space-y-1.5">
                                  <h4 className="font-medium text-neutral-900 border-b border-neutral-200 pb-1.5 mb-2">
                                    Datos Laborales
                                  </h4>
                                  <div className="flex justify-between"><span className="text-neutral-400">Legajo:</span><span className="font-mono font-medium">{emp.legajo || '-'}</span></div>
                                  <div className="flex justify-between"><span className="text-neutral-400">Ingreso:</span><span>{formatearFecha(emp.fecha_ingreso)}</span></div>
                                  <div className="flex justify-between"><span className="text-neutral-400">Antigüedad:</span><span className="font-medium">{calcularAntiguedad(emp.fecha_ingreso)}</span></div>
                                  <div className="flex justify-between"><span className="text-neutral-400">Condición:</span><span>{getCondicionLabel(emp.condicion_contratacion)}</span></div>
                                  <div className="flex justify-between"><span className="text-neutral-400">Sector:</span><span>{emp.sector || '-'}</span></div>
                                  <div className="flex justify-between"><span className="text-neutral-400">Cargo:</span><span>{emp.cargo || '-'}</span></div>
                                </div>

                                {/* Convenio y Pago */}
                                <div className="space-y-1.5">
                                  <h4 className="font-medium text-neutral-900 border-b border-neutral-200 pb-1.5 mb-2">
                                    Convenio y Pago
                                  </h4>
                                  {emp.salario_basico && (
                                    <div className="flex justify-between bg-neutral-100 -mx-1 px-1 py-1 rounded">
                                      <span className="text-neutral-500">Básico:</span>
                                      <span className="font-medium">${emp.salario_basico.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between"><span className="text-neutral-400">Clase:</span><span className="capitalize">{emp.clase || '-'}</span></div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-neutral-400">Categoría:</span>
                                    <span className="text-neutral-700 text-[11px]">{emp.categoria || '-'}</span>
                                  </div>
                                  {emp.cbu && (
                                    <div className="flex flex-col gap-0.5 pt-1">
                                      <span className="text-neutral-400">CBU:</span>
                                      <span className="font-mono text-[10px] text-neutral-600 break-all">{emp.cbu}</span>
                                    </div>
                                  )}
                                  <div className="flex flex-col gap-0.5 pt-1">
                                    <span className="text-neutral-400">Obra social:</span>
                                    <span className="text-neutral-700 text-[11px]">{emp.obra_social || '-'}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Chat Panel */}
      <NominaChat 
        onEmpleadoUpdated={fetchEmpleados}
        selectedEmpleados={selectedEmpleados}
        onClearEmpleadoSelection={handleClearSelection}
        onRemoveEmpleado={handleRemoveEmpleado}
      />
    </div>
  )
}
