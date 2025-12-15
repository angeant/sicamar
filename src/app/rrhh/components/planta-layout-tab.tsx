'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users,
  RefreshCw,
  AlertCircle,
  Flame,
  User,
  Truck,
  CircleDot,
  Package,
  Scale,
  Wrench,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'
import { EmpleadoAvatar } from './empleado-avatar'

// ============ TIPOS ============

interface Empleado {
  id: number
  legajo: string
  nombre: string
  apellido: string
  categoria: string | null
  sector: string | null
  foto_url?: string | null
  foto_thumb_url?: string | null
}

interface Puesto {
  id: string
  rol: string
  sector: string
  icono: 'horno' | 'chofer' | 'colador' | 'operador' | 'balanza' | 'logistica' | 'auxiliar'
  orden: number
}

interface AsignacionTurno {
  puesto_id: string
  turno: 'MAÑANA' | 'TARDE' | 'NOCHE'
  empleado: Empleado | null
}

// ============ ESTRUCTURA DE DOTACIÓN PLANTA 1 ============

const sectores = [
  { id: 'hornos_rotativos', nombre: 'Hornos Rotativos', color: '#6B7280', bgColor: 'bg-gray-50' },
  { id: 'hornos_basculantes', nombre: 'Hornos Basculantes', color: '#DC2626', bgColor: 'bg-red-50' },
  { id: 'maquina_colada', nombre: 'Máquina de Colada (MC1)', color: '#2563EB', bgColor: 'bg-blue-50' },
  { id: 'logistica', nombre: 'Logística y Final de Línea', color: '#059669', bgColor: 'bg-green-50' },
  { id: 'auxiliares', nombre: 'Auxiliares', color: '#7C3AED', bgColor: 'bg-purple-50' },
]

const puestos: Puesto[] = [
  // Sector HORNOS ROTATIVOS (4 personas)
  { id: 'HR1', rol: 'Hornero Rotativo 1', sector: 'hornos_rotativos', icono: 'horno', orden: 1 },
  { id: 'HR2', rol: 'Hornero Rotativo 2', sector: 'hornos_rotativos', icono: 'horno', orden: 2 },
  { id: 'HR3', rol: 'Hornero Rotativo 3', sector: 'hornos_rotativos', icono: 'horno', orden: 3 },
  { id: 'CHR', rol: 'Chofer Rotativo', sector: 'hornos_rotativos', icono: 'chofer', orden: 4 },
  
  // Sector HORNOS BASCULANTES (3 personas)
  { id: 'HB1', rol: 'Hornero Basculante 1', sector: 'hornos_basculantes', icono: 'horno', orden: 1 },
  { id: 'HB2', rol: 'Hornero Basculante 2', sector: 'hornos_basculantes', icono: 'horno', orden: 2 },
  { id: 'CHB', rol: 'Chofer Basculantes', sector: 'hornos_basculantes', icono: 'chofer', orden: 3 },
  
  // Sector MÁQUINA DE COLADA MC1 (6 personas)
  { id: 'COL', rol: 'Colador', sector: 'maquina_colada', icono: 'colador', orden: 1 },
  { id: 'ACOL', rol: 'Asistente de Colador', sector: 'maquina_colada', icono: 'colador', orden: 2 },
  { id: 'ME1', rol: 'Media Esfera - Coladora', sector: 'maquina_colada', icono: 'operador', orden: 3 },
  { id: 'ME2', rol: 'Media Esfera - Punta', sector: 'maquina_colada', icono: 'operador', orden: 4 },
  { id: 'GR1', rol: 'Operador Granalla 1', sector: 'maquina_colada', icono: 'operador', orden: 5 },
  { id: 'GR2', rol: 'Operador Granalla 2', sector: 'maquina_colada', icono: 'operador', orden: 6 },
  
  // Sector LOGÍSTICA Y FINAL DE LÍNEA (4 personas)
  { id: 'BAL', rol: 'Balancero', sector: 'logistica', icono: 'balanza', orden: 1 },
  { id: 'MESA', rol: 'Operador de Mesa', sector: 'logistica', icono: 'operador', orden: 2 },
  { id: 'LOG1', rol: 'Operador Logística 1', sector: 'logistica', icono: 'logistica', orden: 3 },
  { id: 'LOG2', rol: 'Operador Logística 2', sector: 'logistica', icono: 'logistica', orden: 4 },
  
  // AUXILIARES (2 personas)
  { id: 'AUX1', rol: 'Operador General 1', sector: 'auxiliares', icono: 'auxiliar', orden: 1 },
  { id: 'AUX2', rol: 'Operador General 2', sector: 'auxiliares', icono: 'auxiliar', orden: 2 },
]

const iconosPuesto: Record<string, typeof Flame> = {
  horno: Flame,
  chofer: Truck,
  colador: CircleDot,
  operador: Wrench,
  balanza: Scale,
  logistica: Package,
  auxiliar: User,
}

const contexto = {
  descripcion: 'Dotación de Planta 1: Chequeo de personal asignado por turno. 19 puestos operativos distribuidos en 5 sectores.',
  reglas: [
    'Cada puesto debe tener una persona asignada por turno',
    'Los horneros rotativos operan un horno cada uno',
    'Los choferes alimentan las líneas de hornos',
    'El sector de colada es crítico y requiere el equipo completo',
  ],
  flujo: [
    '1. Al inicio de turno, Kalia verifica la dotación',
    '2. Los puestos vacíos se marcan en rojo',
    '3. Se puede reasignar personal desde el panel de detalle',
  ],
  integraciones: [
    'Turnos: Respeta la rotación M-T-N',
    'Polivalencias: Solo asigna personal capacitado',
    'Marcaciones: Valida presencia en puesto asignado',
  ],
  notas: [
    'Total Planta 1: 19 personas por turno',
    'Sectores: Rotativos (4), Basculantes (3), Colada (6), Logística (4), Auxiliares (2)',
  ],
}

// ============ COMPONENTE PRINCIPAL ============

export function PlantaLayoutTab() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [asignaciones, setAsignaciones] = useState<AsignacionTurno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showContexto, setShowContexto] = useState(false)
  const [turnoActivo, setTurnoActivo] = useState<'MAÑANA' | 'TARDE' | 'NOCHE'>('MAÑANA')

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [empRes] = await Promise.all([
        fetch('/api/sicamar/empleados?activos=true'),
      ])

      const empData = await empRes.json()
      setEmpleados(empData.empleados || [])

      // Simular asignaciones (en producción vendría de la API)
      // Por ahora todas vacías
      const asignacionesSimuladas: AsignacionTurno[] = puestos.flatMap(puesto => {
        const turnos: ('MAÑANA' | 'TARDE' | 'NOCHE')[] = ['MAÑANA', 'TARDE', 'NOCHE']
        return turnos.map(turno => ({
          puesto_id: puesto.id,
          turno,
          empleado: null, // Sin asignar
        }))
      })
      setAsignaciones(asignacionesSimuladas)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // Obtener asignación de un puesto
  const getAsignacion = (puestoId: string) => {
    return asignaciones.find(a => a.puesto_id === puestoId && a.turno === turnoActivo)
  }

  // Estadísticas por sector
  const statsPorSector = useMemo(() => {
    const stats: Record<string, { total: number; asignados: number }> = {}
    
    for (const sector of sectores) {
      const puestosSector = puestos.filter(p => p.sector === sector.id)
      const asignados = puestosSector.filter(p => {
        const asig = getAsignacion(p.id)
        return asig?.empleado !== null
      }).length
      
      stats[sector.id] = {
        total: puestosSector.length,
        asignados,
      }
    }
    
    return stats
  }, [asignaciones, turnoActivo])

  // Stats totales
  const statsTotal = useMemo(() => {
    const total = puestos.length
    const asignados = puestos.filter(p => getAsignacion(p.id)?.empleado !== null).length
    return { total, asignados }
  }, [asignaciones, turnoActivo])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Dotación Planta 1</h2>
          <p className="text-sm text-gray-500">Chequeo de personal por turno • 19 puestos</p>
        </div>
        <div className="flex items-center gap-2">
          <ContextoButton onClick={() => setShowContexto(true)} />
          <button
            onClick={cargarDatos}
            disabled={loading}
            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Selector de turno y resumen */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Turno:</span>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['MAÑANA', 'TARDE', 'NOCHE'] as const).map(turno => (
                <button
                  key={turno}
                  onClick={() => setTurnoActivo(turno)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    turnoActivo === turno
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {turno === 'MAÑANA' && <span className="text-amber-500">☀️</span>}
                    {turno === 'TARDE' && <span className="text-orange-500">🌅</span>}
                    {turno === 'NOCHE' && <span className="text-indigo-500">🌙</span>}
                    {turno}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Resumen total */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {statsTotal.asignados === statsTotal.total ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span className={`text-sm font-semibold ${
                statsTotal.asignados === statsTotal.total ? 'text-green-600' : 'text-red-600'
              }`}>
                {statsTotal.asignados} / {statsTotal.total} puestos cubiertos
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      )}

      {/* Sectores con puestos */}
      {!loading && (
        <div className="space-y-4">
          {sectores.map(sector => {
            const puestosSector = puestos.filter(p => p.sector === sector.id)
            const stats = statsPorSector[sector.id]
            const completo = stats.asignados === stats.total
            
            return (
              <div 
                key={sector.id}
                className={`rounded-xl border overflow-hidden ${sector.bgColor}`}
                style={{ borderColor: `${sector.color}40` }}
              >
                {/* Header del sector */}
                <div 
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ backgroundColor: `${sector.color}15` }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: sector.color }}
                    />
                    <h3 className="font-semibold text-gray-900">{sector.nombre}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {completo ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${completo ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.asignados} / {stats.total}
                    </span>
                  </div>
                </div>

                {/* Puestos del sector */}
                <div className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {puestosSector.map(puesto => {
                      const asignacion = getAsignacion(puesto.id)
                      const empleado = asignacion?.empleado
                      const Icono = iconosPuesto[puesto.icono] || User
                      
                      return (
                        <div
                          key={puesto.id}
                          className={`bg-white rounded-lg border-2 p-2 transition-all cursor-pointer hover:shadow-md w-[140px] ${
                            empleado 
                              ? 'border-green-300' 
                              : 'border-red-300 border-dashed'
                          }`}
                        >
                          {/* Header: Icono + código + rol */}
                          <div className="flex items-center gap-1.5 mb-2">
                            <div 
                              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${sector.color}20` }}
                            >
                              <Icono 
                                className="w-3 h-3"
                                style={{ color: sector.color }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span 
                                className="text-[10px] font-bold block"
                                style={{ color: sector.color }}
                              >
                                {puesto.id}
                              </span>
                              <p className="text-[9px] text-gray-500 truncate leading-tight">
                                {puesto.rol}
                              </p>
                            </div>
                          </div>

                          {/* Slot de empleado */}
                          <div className={`rounded-md p-1.5 flex items-center gap-1.5 ${
                            empleado ? 'bg-green-50' : 'bg-gray-100'
                          }`}>
                            {empleado ? (
                              <>
                                <EmpleadoAvatar 
                                  foto_url={empleado.foto_url}
                                  foto_thumb_url={empleado.foto_thumb_url}
                                  nombre={empleado.nombre}
                                  apellido={empleado.apellido}
                                  legajo={empleado.legajo}
                                  size="xs"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-medium text-gray-900 truncate">
                                    {empleado.apellido}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                  <User className="w-3 h-3 text-gray-400" />
                                </div>
                                <span className="text-[10px] text-gray-400 italic">
                                  Vacante
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Resumen final */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Resumen de Dotación - Turno {turnoActivo}</h4>
          <div className="grid grid-cols-5 gap-4">
            {sectores.map(sector => {
              const stats = statsPorSector[sector.id]
              const completo = stats.asignados === stats.total
              
              return (
                <div 
                  key={sector.id}
                  className="text-center p-3 rounded-lg"
                  style={{ backgroundColor: `${sector.color}10` }}
                >
                  <div 
                    className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center"
                    style={{ backgroundColor: `${sector.color}20` }}
                  >
                    <span 
                      className="text-sm font-bold"
                      style={{ color: sector.color }}
                    >
                      {stats.asignados}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">
                    {sector.nombre.split(' ')[0]}
                  </p>
                  <p className={`text-[10px] font-semibold ${completo ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.asignados}/{stats.total}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Contexto Modal */}
      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Contexto: Dotación de Planta"
        contenido={contexto}
      />
    </div>
  )
}
