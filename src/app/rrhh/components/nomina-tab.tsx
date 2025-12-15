'use client'

import { useState, useEffect, Fragment } from 'react'
import {
  Users,
  Search,
  Download,
  Plus,
  Edit2,
  Check,
  X,
  UserCheck,
  UserX,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building2,
  GraduationCap,
  Heart,
  Briefcase,
  CreditCard,
  User,
  FileText,
  Banknote,
  BadgeCheck,
  RefreshCw,
  Cake,
  Award,
  AlertTriangle,
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'
import { EmpleadoAvatarSimple, FotoUpload } from './empleado-avatar'

const contextoNomina = {
  descripcion: 'Base de datos maestra de empleados. Contiene toda la información del personal: datos personales, laborales y estado actual.',
  reglas: [
    'Estados laborales: Efectivo (con legajo), Pre-efectivo (período prueba), Sin identificar (solo biométrico)',
    'Clase: Mensual (administrativos) o Jornal (operarios)',
    'Activo/Inactivo: Inactivo = desafectado (baja, renuncia, despido)',
    'Legajo se asigna al pasar de pre-efectivo a efectivo',
    'Todo cambio queda en historial'
  ],
  flujo: [
    '1. Ingreso nuevo: Se crea como Pre-efectivo sin legajo',
    '2. Período prueba: 3 meses según convenio',
    '3. Efectivización: Se asigna legajo y pasa a Efectivo',
    '4. Desvinculación: Pasa a Inactivo (no se borra)'
  ],
  integraciones: [
    'Bejerman: Sincronización mensual para liquidación',
    'InWeb: Alta/baja en sistema biométrico',
    'AFIP: Alta temprana obligatoria'
  ],
  notas: [
    'Clase Mensual: Sueldos fijos, horario flexible',
    'Clase Jornal: Operarios, turnos rotativos, horas extra',
    'Convenio: UOM (operarios), ASIMRA (supervisores)',
    'Desafectados: Se mantienen en DB para historial'
  ]
}

interface Empleado {
  id: number
  legajo: string
  dni: string
  cuil: string | null
  nombre: string | null
  apellido: string | null
  activo: boolean
  estado_laboral: string
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
  // Campos Bejerman
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
  // Foto
  foto_url: string | null
  foto_thumb_url: string | null
}

// Helper para determinar el convenio colectivo basado en la categoría
const getConvenioColectivo = (categoria: string | null, fuera_convenio: boolean | null): { nombre: string; color: string } => {
  if (fuera_convenio === true || categoria?.toUpperCase().includes('EXCLUIDO')) {
    return { nombre: 'Fuera de Convenio', color: 'bg-purple-50 text-purple-700' }
  }
  if (categoria?.toUpperCase().includes('SUP.') || categoria?.toUpperCase().includes('SUPERVISOR')) {
    return { nombre: 'ASIMRA', color: 'bg-blue-50 text-blue-700' }
  }
  // Por defecto UOM para operarios
  return { nombre: 'UOM', color: 'bg-amber-50 text-amber-700' }
}

// Helper para la frecuencia de pago
const getFrecuenciaPago = (clase: string | null): { texto: string; detalle: string } => {
  if (clase?.toLowerCase() === 'mensual') {
    return { texto: 'Mensual', detalle: '1 vez/mes' }
  }
  if (clase?.toLowerCase() === 'jornal') {
    return { texto: 'Quincenal', detalle: '2 veces/mes' }
  }
  return { texto: '-', detalle: '' }
}

// Helper para calcular antigüedad
const calcularAntiguedad = (fechaIngreso: string | null): string => {
  if (!fechaIngreso) return '-'
  const ingreso = new Date(fechaIngreso)
  const hoy = new Date()
  const diffMs = hoy.getTime() - ingreso.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const años = Math.floor(diffDias / 365)
  const meses = Math.floor((diffDias % 365) / 30)
  
  if (años === 0 && meses === 0) return 'Menos de 1 mes'
  if (años === 0) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`
  if (meses === 0) return `${años} ${años === 1 ? 'año' : 'años'}`
  return `${años} ${años === 1 ? 'año' : 'años'}, ${meses} ${meses === 1 ? 'mes' : 'meses'}`
}

// Helper para calcular edad
const calcularEdad = (fechaNacimiento: string | null): string => {
  if (!fechaNacimiento) return '-'
  const nacimiento = new Date(fechaNacimiento)
  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const m = hoy.getMonth() - nacimiento.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--
  }
  return `${edad} años`
}

// Helper para formatear fecha
const formatearFecha = (fecha: string | null): string => {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Helper para construir dirección completa
const construirDireccion = (emp: Empleado): string => {
  const partes = []
  if (emp.domicilio) partes.push(emp.domicilio)
  if (emp.piso) partes.push(`Piso ${emp.piso}`)
  if (emp.departamento) partes.push(`Dpto ${emp.departamento}`)
  if (partes.length === 0) return '-'
  return partes.join(', ')
}

const construirLocalidad = (emp: Empleado): string => {
  const partes = []
  if (emp.localidad) partes.push(emp.localidad)
  if (emp.provincia) partes.push(emp.provincia)
  if (emp.codigo_postal) partes.push(`CP ${emp.codigo_postal}`)
  if (partes.length === 0) return ''
  return partes.join(', ')
}

// Componente de badges para empleado
interface EmpleadoBadgesProps {
  empleadoId: number
  eventos: Map<number, EventoEmpleado[]>
  estados: Map<number, EstadoEmpleado>
}

function EmpleadoBadges({ empleadoId, eventos, estados }: EmpleadoBadgesProps) {
  const empEventos = eventos.get(empleadoId) || []
  const empEstado = estados.get(empleadoId)
  
  if (empEventos.length === 0 && !empEstado) return null
  
  return (
    <div className="flex items-center gap-1 ml-2">
      {/* Badge de estado (enfermo, accidentado, vacaciones, etc.) */}
      {empEstado && (
        <span 
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
          style={{ 
            backgroundColor: `${empEstado.tipos_estado_empleado?.color || '#6B7280'}20`,
            color: empEstado.tipos_estado_empleado?.color || '#6B7280'
          }}
          title={empEstado.tipos_estado_empleado?.nombre || empEstado.tipo_estado}
        >
          <AlertTriangle className="w-3 h-3" />
          {empEstado.tipo_estado}
        </span>
      )}
      
      {/* Badges de eventos (cumpleaños, aniversario) */}
      {empEventos.map((ev, idx) => {
        const isToday = ev.dias_faltantes === 0
        const isTomorrow = ev.dias_faltantes === 1
        const isBirthday = ev.tipo === 'cumpleaños'
        
        let bgColor = isBirthday ? '#EC489920' : '#3B82F620'
        let textColor = isBirthday ? '#EC4899' : '#3B82F6'
        
        if (isToday) {
          bgColor = isBirthday ? '#EC489940' : '#3B82F640'
        }
        
        const label = isToday 
          ? (isBirthday ? 'Cumple hoy' : 'Aniv. hoy')
          : isTomorrow
            ? (isBirthday ? 'Cumple mañana' : 'Aniv. mañana')
            : (isBirthday ? `Cumple en ${ev.dias_faltantes}d` : `Aniv. en ${ev.dias_faltantes}d`)
        
        return (
          <span 
            key={`${ev.tipo}-${idx}`}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${isToday ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: bgColor, color: textColor }}
            title={isBirthday ? `Cumple ${ev.años} años` : `${ev.años} años en la empresa`}
          >
            {isBirthday ? <Cake className="w-3 h-3" /> : <Award className="w-3 h-3" />}
            {label}
          </span>
        )
      })}
    </div>
  )
}

type EstadoFiltro = 'todos' | 'efectivo' | 'pre_efectivo' | 'sin_identificar'
type VistaMode = 'activos' | 'desafectados'

// Tipos para badges
interface EventoEmpleado {
  id: number
  tipo: 'cumpleaños' | 'aniversario'
  dias_faltantes: number
  años: number
}

interface EstadoEmpleado {
  empleado_id: number
  tipo_estado: string
  tipos_estado_empleado?: {
    nombre: string
    color: string
  }
}

export function NominaTab() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [vistaMode, setVistaMode] = useState<VistaMode>('activos')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<Empleado>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [showContexto, setShowContexto] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  // Estados y eventos para badges
  const [eventos, setEventos] = useState<Map<number, EventoEmpleado[]>>(new Map())
  const [estados, setEstados] = useState<Map<number, EstadoEmpleado>>(new Map())

  const toggleExpanded = (id: number) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const fetchEmpleados = async () => {
    setIsLoading(true)
    try {
      const [empRes, eventosRes, estadosRes] = await Promise.all([
        fetch('/api/sicamar/empleados'),
        fetch('/api/sicamar/empleados/eventos?dias=5'),
        fetch('/api/sicamar/empleados/estados?vigentes=true')
      ])
      
      const empData = await empRes.json()
      const eventosData = await eventosRes.json()
      const estadosData = await estadosRes.json()
      
      if (empData.empleados) {
        setEmpleados(empData.empleados)
      }
      
      // Agrupar eventos por empleado_id
      const eventosMap = new Map<number, EventoEmpleado[]>()
      for (const ev of eventosData.eventos || []) {
        if (!eventosMap.has(ev.id)) {
          eventosMap.set(ev.id, [])
        }
        eventosMap.get(ev.id)!.push(ev)
      }
      setEventos(eventosMap)
      
      // Mapear estados por empleado_id
      const estadosMap = new Map<number, EstadoEmpleado>()
      for (const est of estadosData || []) {
        estadosMap.set(est.empleado_id, est)
      }
      setEstados(estadosMap)
      
    } catch (error) {
      console.error('Error fetching empleados:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEmpleados()
  }, [])

  const filteredEmpleados = empleados.filter(emp => {
    const matchesSearch = searchQuery === '' ||
      (emp.apellido?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.nombre?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.legajo?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.dni?.includes(searchQuery))

    if (vistaMode === 'desafectados') {
      return matchesSearch && !emp.activo
    }
    
    if (!emp.activo) return false

    let matchesEstado = true
    switch (estadoFiltro) {
      case 'efectivo':
        matchesEstado = emp.estado_laboral === 'efectivo'
        break
      case 'pre_efectivo':
        matchesEstado = emp.estado_laboral === 'pre_efectivo'
        break
      case 'sin_identificar':
        matchesEstado = emp.estado_laboral === 'sin_identificar'
        break
    }

    return matchesSearch && matchesEstado
  })

  const startEditing = (emp: Empleado) => {
    setEditingId(emp.id)
    setEditForm({
      legajo: emp.legajo,
      dni: emp.dni,
      nombre: emp.nombre,
      apellido: emp.apellido,
      estado_laboral: emp.estado_laboral,
      activo: emp.activo,
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEditing = async () => {
    if (!editingId) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/sicamar/empleados/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (response.ok) {
        await fetchEmpleados()
        setEditingId(null)
        setEditForm({})
      }
    } catch (error) {
      console.error('Error saving empleado:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const empleadosActivos = empleados.filter(e => e.activo)
  const stats = {
    total: empleados.length,
    activos: empleadosActivos.length,
    efectivos: empleadosActivos.filter(e => e.estado_laboral === 'efectivo').length,
    preEfectivos: empleadosActivos.filter(e => e.estado_laboral === 'pre_efectivo').length,
    sinIdentificar: empleadosActivos.filter(e => e.estado_laboral === 'sin_identificar').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Nómina de Empleados</h2>
          <p className="text-sm text-gray-500">Gestión del personal</p>
        </div>
        <div className="flex items-center gap-2">
          <ContextoButton onClick={() => setShowContexto(true)} />
          <button className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
          <button className="px-3 py-1.5 text-xs text-white bg-gray-900 hover:bg-gray-800 rounded flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Nuevo empleado
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="text-2xl font-semibold text-gray-900">{stats.activos}</div>
          <div className="text-xs text-gray-500">total activos</div>
        </div>
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="text-2xl font-semibold text-gray-900">{stats.efectivos}</div>
          <div className="text-xs text-gray-500">efectivos</div>
        </div>
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="text-2xl font-semibold text-gray-900">{stats.preEfectivos}</div>
          <div className="text-xs text-gray-500">pre-efectivos</div>
        </div>
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="text-2xl font-semibold text-gray-900">{stats.sinIdentificar}</div>
          <div className="text-xs text-gray-500">sin identificar</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center justify-between py-3 border-y border-gray-100">
        <div className="flex items-center gap-4">
          {vistaMode === 'activos' && (
            <div className="flex gap-1">
              {[
                { value: 'todos', label: 'Todos' },
                { value: 'efectivo', label: 'Efectivos' },
                { value: 'pre_efectivo', label: 'Pre-efectivos' },
              ].map(filtro => (
                <button
                  key={filtro.value}
                  onClick={() => setEstadoFiltro(filtro.value as EstadoFiltro)}
                  className={`px-3 py-1.5 text-xs rounded transition-colors ${
                    estadoFiltro === filtro.value ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {filtro.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              setVistaMode(vistaMode === 'activos' ? 'desafectados' : 'activos')
              setEstadoFiltro('todos')
            }}
            className={`px-3 py-1.5 text-xs rounded flex items-center gap-1.5 ${
              vistaMode === 'desafectados' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            Desafectados ({stats.total - stats.activos})
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded w-48 focus:outline-none"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">
            {filteredEmpleados.length} {vistaMode === 'desafectados' ? 'desafectados' : 'empleados'}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left font-medium text-gray-600 px-4 py-2.5">Empleado</th>
                <th className="text-left font-medium text-gray-600 px-3 py-2.5 w-16">Legajo</th>
                <th className="text-left font-medium text-gray-600 px-3 py-2.5 w-24">DNI</th>
                <th className="text-left font-medium text-gray-600 px-3 py-2.5">Puesto / Cargo</th>
                <th className="text-left font-medium text-gray-600 px-3 py-2.5">Categoría</th>
                <th className="text-center font-medium text-gray-600 px-3 py-2.5 w-28">Convenio</th>
                <th className="text-center font-medium text-gray-600 px-3 py-2.5 w-24">Pago</th>
                <th className="text-center font-medium text-gray-600 px-3 py-2.5 w-20">Estado</th>
                <th className="text-center font-medium text-gray-600 px-3 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredEmpleados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron empleados
                  </td>
                </tr>
              ) : (
                filteredEmpleados.map((emp) => {
                  const convenio = getConvenioColectivo(emp.categoria, emp.fuera_convenio)
                  const frecuencia = getFrecuenciaPago(emp.clase)
                  const isExpanded = expandedId === emp.id
                  
                  return (
                    <Fragment key={emp.id}>
                      <tr 
                        className={`border-t border-gray-100 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50/50'
                        }`}
                        onClick={() => toggleExpanded(emp.id)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </span>
                            <EmpleadoAvatarSimple empleado={emp} size="sm" />
                            {editingId === emp.id ? (
                              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editForm.apellido || ''}
                                  onChange={(e) => setEditForm({ ...editForm, apellido: e.target.value })}
                                  placeholder="Apellido"
                                  className="px-1.5 py-0.5 text-xs border rounded w-24"
                                />
                                <input
                                  type="text"
                                  value={editForm.nombre || ''}
                                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                                  placeholder="Nombre"
                                  className="px-1.5 py-0.5 text-xs border rounded w-24"
                                />
                              </div>
                            ) : (
                              <div className="flex flex-col">
                                <div className="flex items-center flex-wrap gap-1">
                                  <span className="text-gray-900 font-medium">
                                    {emp.apellido || 'Sin apellido'}, {emp.nombre || 'Sin nombre'}
                                  </span>
                                  <EmpleadoBadges 
                                    empleadoId={emp.id} 
                                    eventos={eventos} 
                                    estados={estados} 
                                  />
                                </div>
                                {emp.sector && (
                                  <span className="text-[10px] text-gray-400">{emp.sector}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-500">
                          {emp.estado_laboral === 'efectivo' ? emp.legajo : '-'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{emp.dni}</td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-gray-700">{emp.cargo || '-'}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-gray-600 leading-tight block max-w-[160px] truncate" title={emp.categoria || ''}>
                            {emp.categoria || '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${convenio.color}`}>
                            {convenio.nombre}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-700">{frecuencia.texto}</span>
                            {frecuencia.detalle && (
                              <span className="text-[10px] text-gray-400">{frecuencia.detalle}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            emp.activo 
                              ? 'bg-green-50 text-green-700' 
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {emp.activo ? 'Activo' : 'Baja'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          {editingId === emp.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={saveEditing} disabled={isSaving} className="p-1 text-gray-600 hover:text-gray-900">
                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={cancelEditing} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => startEditing(emp)} className="p-1 text-gray-400 hover:text-gray-600">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                      
                      {/* Fila expandida con información detallada */}
                      {isExpanded && (
                        <tr key={`${emp.id}-expanded`} className="bg-gray-50/70">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="grid grid-cols-4 gap-6 text-xs">
                              {/* Datos Personales */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
                                  <User className="w-3.5 h-3.5 text-gray-500" />
                                  Datos Personales
                                </h4>
                                {/* Foto con upload */}
                                <div className="flex justify-center pb-2">
                                  <FotoUpload
                                    empleadoId={emp.id}
                                    foto_url={emp.foto_url}
                                    foto_thumb_url={emp.foto_thumb_url}
                                    nombre={emp.nombre}
                                    apellido={emp.apellido}
                                    legajo={emp.legajo}
                                    onUpdate={(foto_url, foto_thumb_url) => {
                                      setEmpleados(prev => prev.map(e => 
                                        e.id === emp.id ? { ...e, foto_url, foto_thumb_url } : e
                                      ))
                                    }}
                                    onDelete={() => {
                                      setEmpleados(prev => prev.map(e => 
                                        e.id === emp.id ? { ...e, foto_url: null, foto_thumb_url: null } : e
                                      ))
                                    }}
                                  />
                                </div>
                                <div className="space-y-2 text-gray-600">
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">DNI:</span>
                                    <span className="font-mono">{emp.dni || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">CUIL:</span>
                                    <span className="font-mono">{emp.cuil || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Nacimiento:</span>
                                    <span>{formatearFecha(emp.fecha_nacimiento)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Edad:</span>
                                    <span>{calcularEdad(emp.fecha_nacimiento)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Sexo:</span>
                                    <span className="capitalize">{emp.sexo || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Estado civil:</span>
                                    <span className="capitalize">{emp.estado_civil || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Nacionalidad:</span>
                                    <span className="capitalize">{emp.nacionalidad || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Estudios:</span>
                                    <span className="capitalize">{emp.estudios || '-'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Contacto y Domicilio */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-gray-500" />
                                  Contacto y Domicilio
                                </h4>
                                <div className="space-y-2 text-gray-600">
                                  <div className="flex justify-between items-start gap-2">
                                    <span className="text-gray-400 shrink-0 flex items-center gap-1">
                                      <Mail className="w-3 h-3" /> Email:
                                    </span>
                                    <span className="text-right text-[11px] break-all max-w-[140px]">
                                      {emp.email ? (
                                        <a href={`mailto:${emp.email}`} className="text-pink-600 hover:underline">
                                          {emp.email.toLowerCase()}
                                        </a>
                                      ) : '-'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-start gap-2">
                                    <span className="text-gray-400 shrink-0 flex items-center gap-1">
                                      <Phone className="w-3 h-3" /> Celular:
                                    </span>
                                    <span className="font-mono text-right">{emp.celular || '-'}</span>
                                  </div>
                                  <div className="flex justify-between items-start gap-2">
                                    <span className="text-gray-400 shrink-0">Teléfono:</span>
                                    <span className="font-mono text-right">{emp.telefono || '-'}</span>
                                  </div>
                                  <div className="flex flex-col gap-0.5 pt-1 border-t border-gray-100">
                                    <span className="text-gray-400">Domicilio:</span>
                                    <span className="text-gray-700">{construirDireccion(emp)}</span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-400">Localidad:</span>
                                    <span className="text-gray-700">{construirLocalidad(emp) || '-'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Datos Laborales */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
                                  <Briefcase className="w-3.5 h-3.5 text-gray-500" />
                                  Datos Laborales
                                </h4>
                                <div className="space-y-2 text-gray-600">
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Legajo:</span>
                                    <span className="font-mono font-medium">{emp.legajo || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Ingreso:</span>
                                    <span>{formatearFecha(emp.fecha_ingreso)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Antigüedad:</span>
                                    <span className="font-medium text-gray-800">{calcularAntiguedad(emp.fecha_ingreso)}</span>
                                  </div>
                                  {emp.fecha_egreso && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Egreso:</span>
                                      <span className="text-red-600">{formatearFecha(emp.fecha_egreso)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Estado:</span>
                                    <span className="capitalize">{emp.estado_laboral?.replace('_', '-') || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Sector:</span>
                                    <span>{emp.sector || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Cargo:</span>
                                    <span>{emp.cargo || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Centro costo:</span>
                                    <span>{emp.centro_costo || '-'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Convenio y Pago */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
                                  <CreditCard className="w-3.5 h-3.5 text-gray-500" />
                                  Convenio y Pago
                                  {emp.bejerman_sync_at && (
                                    <span className="ml-auto flex items-center gap-1 text-[10px] font-normal text-green-600" title={`Sincronizado: ${new Date(emp.bejerman_sync_at).toLocaleString('es-AR')}`}>
                                      <BadgeCheck className="w-3 h-3" />
                                      Bejerman
                                    </span>
                                  )}
                                </h4>
                                <div className="space-y-2 text-gray-600">
                                  {/* Salario Básico */}
                                  {emp.salario_basico && (
                                    <div className="flex justify-between items-center bg-green-50 -mx-1 px-1 py-1 rounded">
                                      <span className="text-gray-500 flex items-center gap-1">
                                        <Banknote className="w-3 h-3" /> Básico:
                                      </span>
                                      <span className="font-semibold text-green-700">
                                        ${emp.salario_basico.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Convenio:</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${convenio.color}`}>
                                      {convenio.nombre}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Sindicato:</span>
                                    <span className="font-mono text-[11px]">{emp.sindicato || '-'}</span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-400">Categoría:</span>
                                    <span className="text-gray-700 text-[11px]">
                                      {emp.categoria || '-'}
                                      {emp.codigo_categoria && <span className="text-gray-400 font-mono ml-1">({emp.codigo_categoria})</span>}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Clase:</span>
                                    <span className="capitalize">{emp.clase || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Frecuencia pago:</span>
                                    <span>{frecuencia.texto}</span>
                                  </div>
                                  {/* CBU */}
                                  {emp.cbu && (
                                    <div className="flex flex-col gap-0.5 pt-1 border-t border-gray-100">
                                      <span className="text-gray-400">CBU:</span>
                                      <span className="font-mono text-[10px] text-gray-600 break-all">{emp.cbu}</span>
                                    </div>
                                  )}
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-400">Obra social:</span>
                                    </div>
                                    <span className="text-gray-700 block mt-0.5">{emp.obra_social || '-'}</span>
                                    {emp.codigo_obra_social && (
                                      <span className="text-gray-400 text-[10px] font-mono">Cód: {emp.codigo_obra_social}</span>
                                    )}
                                  </div>
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
          </div>
        )}
      </div>

      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Contexto: Nómina de Empleados"
        contenido={contextoNomina}
      />
    </div>
  )
}
