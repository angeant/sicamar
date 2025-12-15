'use client'

import { useState, useMemo } from 'react'
import {
  Plus,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'

// ============ TIPOS ============

interface PlanInduccion {
  id: string
  nombre: string
  tipoEmpleado: 'jerarquico' | 'operario' | 'administrativo'
  duracionEstimadaDias: number
}

interface EtapaInduccion {
  id: string
  planId: string
  orden: number
  area: string
  duracion: string
  responsableNombre: string
  tareasCompletar: string[]
}

interface InduccionEmpleado {
  id: string
  empleadoNombre: string
  empleadoApellido: string
  empleadoCargo: string
  planId: string
  fechaInicio: string
  estado: 'en_progreso' | 'completada' | 'pausada'
}

interface ProgresoInduccion {
  id: string
  induccionEmpleadoId: string
  etapaId: string
  fechaProgramada: string
  fechaCompletada?: string
  confirmadoPor?: string
  estado: 'pendiente' | 'en_curso' | 'completada' | 'pendiente_confirmacion'
}

// ============ DATOS MOCK ============

const planesInduccion: PlanInduccion[] = [
  { id: 'PLAN-JER', nombre: 'Jerárquicos', tipoEmpleado: 'jerarquico', duracionEstimadaDias: 15 },
  { id: 'PLAN-OP', nombre: 'Operarios', tipoEmpleado: 'operario', duracionEstimadaDias: 5 },
  { id: 'PLAN-ADM', nombre: 'Administrativos', tipoEmpleado: 'administrativo', duracionEstimadaDias: 7 },
]

const etapasInduccion: EtapaInduccion[] = [
  { id: 'ET-001', planId: 'PLAN-JER', orden: 1, area: 'Recursos Humanos', duracion: '1 día', responsableNombre: 'Lang, María', tareasCompletar: ['Completar legajo', 'Entrega de EPP', 'Firma de políticas'] },
  { id: 'ET-002', planId: 'PLAN-JER', orden: 2, area: 'Seguridad e Higiene', duracion: '2 días', responsableNombre: 'Álvarez, Norberto', tareasCompletar: ['Inducción HyS', 'Recorrido planta', 'Evaluación inicial'] },
  { id: 'ET-003', planId: 'PLAN-JER', orden: 3, area: 'Laboratorio', duracion: '1 semana', responsableNombre: 'Ciaffaroni, Pablo', tareasCompletar: ['Conocer procesos de calidad', 'Análisis de muestras'] },
  { id: 'ET-004', planId: 'PLAN-JER', orden: 4, area: 'Administración', duracion: '2 días', responsableNombre: 'Iturralde, Ana', tareasCompletar: ['Sistemas internos', 'Procesos administrativos'] },
  { id: 'ET-005', planId: 'PLAN-JER', orden: 5, area: 'Compras', duracion: '1 día', responsableNombre: 'Gómez, Ricardo', tareasCompletar: ['Proceso de compras', 'Proveedores clave'] },
  { id: 'ET-006', planId: 'PLAN-JER', orden: 6, area: 'Mantenimiento', duracion: '2 días', responsableNombre: 'Diale, Sergio', tareasCompletar: ['Tour de equipos'] },
  { id: 'ET-007', planId: 'PLAN-JER', orden: 7, area: 'Planta 1', duracion: '3 días', responsableNombre: 'Quintero, Carlos', tareasCompletar: ['Proceso de fundición', 'Seguridad específica'] },
  { id: 'ET-008', planId: 'PLAN-JER', orden: 8, area: 'Planta 2', duracion: '2 días', responsableNombre: 'Ramirez, Gustavo', tareasCompletar: ['Proceso de acondicionamiento'] },
  { id: 'ET-009', planId: 'PLAN-JER', orden: 9, area: 'Gerencia', duracion: '1 día', responsableNombre: 'Directorio', tareasCompletar: ['Reunión con Gerencia', 'Objetivos del puesto'] },
  { id: 'ET-101', planId: 'PLAN-OP', orden: 1, area: 'Recursos Humanos', duracion: '4 horas', responsableNombre: 'Lang, María', tareasCompletar: ['Completar legajo', 'Entrega de EPP'] },
  { id: 'ET-102', planId: 'PLAN-OP', orden: 2, area: 'Seguridad e Higiene', duracion: '1 día', responsableNombre: 'Álvarez, Norberto', tareasCompletar: ['Inducción HyS obligatoria', 'Examen'] },
  { id: 'ET-103', planId: 'PLAN-OP', orden: 3, area: 'Área de Trabajo', duracion: '3 días', responsableNombre: 'Supervisor de turno', tareasCompletar: ['Capacitación en puesto', 'Práctica supervisada'] },
]

const induccionesActivas: InduccionEmpleado[] = [
  { id: 'IND-001', empleadoNombre: 'Martín', empleadoApellido: 'Fernández', empleadoCargo: 'Supervisor de Producción', planId: 'PLAN-JER', fechaInicio: '2025-11-25', estado: 'en_progreso' },
  { id: 'IND-002', empleadoNombre: 'Lucas', empleadoApellido: 'González', empleadoCargo: 'Operario Fundición', planId: 'PLAN-OP', fechaInicio: '2025-12-02', estado: 'en_progreso' },
  { id: 'IND-003', empleadoNombre: 'Carla', empleadoApellido: 'Méndez', empleadoCargo: 'Analista Contable', planId: 'PLAN-ADM', fechaInicio: '2025-11-20', estado: 'completada' },
]

const progresoInducciones: ProgresoInduccion[] = [
  { id: 'P001', induccionEmpleadoId: 'IND-001', etapaId: 'ET-001', fechaProgramada: '2025-11-25', fechaCompletada: '2025-11-25', confirmadoPor: 'Lang', estado: 'completada' },
  { id: 'P002', induccionEmpleadoId: 'IND-001', etapaId: 'ET-002', fechaProgramada: '2025-11-26', fechaCompletada: '2025-11-27', confirmadoPor: 'Álvarez', estado: 'completada' },
  { id: 'P003', induccionEmpleadoId: 'IND-001', etapaId: 'ET-003', fechaProgramada: '2025-11-28', fechaCompletada: '2025-12-04', confirmadoPor: 'Ciaffaroni', estado: 'completada' },
  { id: 'P004', induccionEmpleadoId: 'IND-001', etapaId: 'ET-004', fechaProgramada: '2025-12-05', estado: 'en_curso' },
  { id: 'P005', induccionEmpleadoId: 'IND-001', etapaId: 'ET-005', fechaProgramada: '2025-12-09', estado: 'pendiente' },
  { id: 'P006', induccionEmpleadoId: 'IND-001', etapaId: 'ET-006', fechaProgramada: '2025-12-10', estado: 'pendiente' },
  { id: 'P007', induccionEmpleadoId: 'IND-001', etapaId: 'ET-007', fechaProgramada: '2025-12-12', estado: 'pendiente' },
  { id: 'P008', induccionEmpleadoId: 'IND-001', etapaId: 'ET-008', fechaProgramada: '2025-12-16', estado: 'pendiente' },
  { id: 'P009', induccionEmpleadoId: 'IND-001', etapaId: 'ET-009', fechaProgramada: '2025-12-18', estado: 'pendiente' },
  { id: 'P101', induccionEmpleadoId: 'IND-002', etapaId: 'ET-101', fechaProgramada: '2025-12-02', estado: 'pendiente_confirmacion' },
  { id: 'P102', induccionEmpleadoId: 'IND-002', etapaId: 'ET-102', fechaProgramada: '2025-12-03', estado: 'pendiente' },
  { id: 'P103', induccionEmpleadoId: 'IND-002', etapaId: 'ET-103', fechaProgramada: '2025-12-04', estado: 'pendiente' },
]

// Contexto de la sección
const contextoInduccion = {
  descripcion: 'Gestión del proceso de incorporación de nuevos empleados con planes diferenciados según el tipo de puesto.',
  reglas: [
    'Plan Jerárquicos: 15 días, recorrido completo por todas las áreas',
    'Plan Operarios: 5 días, inducción de seguridad + área de trabajo',
    'Plan Administrativos: 7 días, sistemas + recorrido general',
    'Cada etapa tiene un responsable/tutor asignado',
    'El responsable debe confirmar cuando el empleado completó la etapa'
  ],
  flujo: [
    'RRHH crea la inducción y asigna el plan correspondiente',
    'El sistema agenda las rotaciones por área',
    'Al iniciar cada etapa, se notifica al responsable',
    'El responsable confirma: "¿Juan completó la inducción en tu área?"',
    'Se registra fecha y observaciones',
    'Al completar todas las etapas, se marca como finalizada'
  ],
  integraciones: [
    'WhatsApp Bot: Notifica a responsables de etapas pendientes',
    'Calendario: Sincroniza fechas programadas',
    'Polivalencias: Puede actualizar nivel tras inducción en puesto'
  ],
  notas: [
    'Recorrido obligatorio jerárquicos: Lab, Admin, Compras, RRHH, Mto, Seguridad, Gerencia, P2',
    'Responsables clave: Ciaffaroni (Lab), Iturralde (Admin), Lang (RRHH)',
    'La inducción HyS es obligatoria para TODOS los nuevos ingresos'
  ]
}

// ============ COMPONENTE PRINCIPAL ============

export function InduccionTab() {
  const [expandedInduccion, setExpandedInduccion] = useState<string | null>('IND-001')
  const [showContexto, setShowContexto] = useState(false)

  const getProgresoDeInduccion = (induccionId: string) => {
    return progresoInducciones.filter(p => p.induccionEmpleadoId === induccionId)
  }

  const getEtapaById = (etapaId: string) => {
    return etapasInduccion.find(e => e.id === etapaId)
  }

  const getPlanById = (planId: string) => {
    return planesInduccion.find(p => p.id === planId)
  }

  const calcularProgreso = (induccionId: string) => {
    const progreso = getProgresoDeInduccion(induccionId)
    const completadas = progreso.filter(p => p.estado === 'completada').length
    return { completadas, total: progreso.length, porcentaje: Math.round((completadas / progreso.length) * 100) }
  }

  const pendientesConfirmacion = progresoInducciones.filter(p => p.estado === 'pendiente_confirmacion').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Inducción y Onboarding</h2>
          <p className="text-sm text-gray-500">Proceso de incorporación de nuevos empleados</p>
        </div>
        <div className="flex items-center gap-2">
          <ContextoButton onClick={() => setShowContexto(true)} />
          <button className="px-3 py-1.5 text-xs text-white bg-gray-900 hover:bg-gray-800 rounded flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Nueva Inducción
          </button>
        </div>
      </div>

      {/* Alerta de confirmaciones pendientes */}
      {pendientesConfirmacion > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-gray-600">
            <span className="text-[#C4322F] font-medium">{pendientesConfirmacion}</span> etapa(s) pendiente(s) de confirmación
          </span>
        </div>
      )}

      {/* Lista de inducciones */}
      <div className="space-y-3">
        {induccionesActivas.map(induccion => {
          const plan = getPlanById(induccion.planId)
          const progreso = calcularProgreso(induccion.id)
          const isExpanded = expandedInduccion === induccion.id
          const etapasProgreso = getProgresoDeInduccion(induccion.id)

          return (
            <div key={induccion.id} className="border border-gray-200 rounded-lg">
              {/* Header */}
              <button
                onClick={() => setExpandedInduccion(isExpanded ? null : induccion.id)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <span className="font-medium text-gray-900">
                      {induccion.empleadoApellido}, {induccion.empleadoNombre}
                    </span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="text-sm text-gray-500">{induccion.empleadoCargo}</span>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    induccion.estado === 'completada' ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-500'
                  }`}>
                    {plan?.nombre}
                  </span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gray-900 rounded-full"
                          style={{ width: `${progreso.porcentaje}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{progreso.completadas}/{progreso.total}</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {/* Detalle de etapas */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="mt-3 space-y-1">
                    {etapasProgreso.map(prog => {
                      const etapa = getEtapaById(prog.etapaId)
                      if (!etapa) return null
                      
                      return (
                        <div key={prog.id} className="flex items-center gap-3 py-2">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            prog.estado === 'completada' ? 'bg-gray-900' :
                            prog.estado === 'en_curso' ? 'bg-gray-300' :
                            prog.estado === 'pendiente_confirmacion' ? 'bg-[#C4322F]' :
                            'bg-gray-100'
                          }`}>
                            {prog.estado === 'completada' ? (
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            ) : (
                              <Circle className={`w-2 h-2 ${
                                prog.estado === 'pendiente_confirmacion' ? 'text-white' : 'text-gray-400'
                              }`} />
                            )}
                          </div>
                          
                          <div className="flex-1 flex items-center justify-between">
                            <div>
                              <span className="text-sm text-gray-900">{etapa.area}</span>
                              <span className="text-xs text-gray-400 ml-2">({etapa.duracion})</span>
                              <span className="text-xs text-gray-400 ml-2">· {etapa.responsableNombre}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {prog.estado === 'pendiente_confirmacion' && (
                                <button className="px-2 py-1 text-xs text-[#C4322F] hover:bg-red-50 rounded">
                                  Confirmar
                                </button>
                              )}
                              {prog.estado === 'en_curso' && (
                                <span className="text-xs text-gray-400">en curso</span>
                              )}
                              {prog.estado === 'completada' && (
                                <span className="text-xs text-gray-400">
                                  {new Date(prog.fechaCompletada!).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Planes disponibles */}
      <div className="pt-4 border-t border-gray-100">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Planes disponibles</h3>
        <div className="flex gap-3 text-sm">
          {planesInduccion.map(plan => (
            <div key={plan.id} className="px-3 py-2 border border-gray-200 rounded">
              <span className="text-gray-900">{plan.nombre}</span>
              <span className="text-gray-400 ml-2">{plan.duracionEstimadaDias}d</span>
              <span className="text-gray-400 ml-1">
                · {etapasInduccion.filter(e => e.planId === plan.id).length} etapas
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de contexto */}
      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Contexto: Inducción y Onboarding"
        contenido={contextoInduccion}
      />
    </div>
  )
}
