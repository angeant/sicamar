'use client'

import { useState, useMemo } from 'react'
import {
  Plus,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Send,
  FileText,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'

// ============ TIPOS ============

interface Feriado {
  id: string
  fecha: string
  nombre: string
}

interface PropuestaCanje {
  id: string
  feriadoId: string
  descripcion: string
  fechaTrabajo: string
  diasCompensatorios: string[]
  estado: 'borrador' | 'activa' | 'aprobada' | 'rechazada' | 'vencida'
  porcentajeRequerido: number
  fechaLimiteVotacion: string
  creadaPor: string
}

interface VotoCanje {
  id: string
  propuestaId: string
  empleadoId: string
  empleadoNombre: string
  voto: boolean
  medio: 'whatsapp' | 'planilla' | 'sistema'
}

// ============ DATOS MOCK ============

const feriados: Feriado[] = [
  { id: 'FER-001', fecha: '2025-12-08', nombre: 'Inmaculada Concepción' },
  { id: 'FER-002', fecha: '2025-12-25', nombre: 'Navidad' },
  { id: 'FER-003', fecha: '2026-01-01', nombre: 'Año Nuevo' },
]

const propuestasCanjes: PropuestaCanje[] = [
  {
    id: 'CANJE-001',
    feriadoId: 'FER-001',
    descripcion: 'Trabajar el Lunes 8/12 a cambio del Viernes 26 y Sábado 27 (post-Navidad)',
    fechaTrabajo: '2025-12-08',
    diasCompensatorios: ['2025-12-26', '2025-12-27'],
    estado: 'activa',
    porcentajeRequerido: 95,
    fechaLimiteVotacion: '2025-12-05T18:00:00',
    creadaPor: 'Rocío Barrera',
  },
  {
    id: 'CANJE-002',
    feriadoId: 'FER-002',
    descripcion: 'Trabajar Carnaval Lunes a cambio de viernes largo en Semana Santa',
    fechaTrabajo: '2026-02-16',
    diasCompensatorios: ['2026-04-03'],
    estado: 'borrador',
    porcentajeRequerido: 95,
    fechaLimiteVotacion: '2026-02-10T18:00:00',
    creadaPor: 'Rocío Barrera',
  },
]

const votosCanjes: VotoCanje[] = [
  { id: 'V001', propuestaId: 'CANJE-001', empleadoId: 'E001', empleadoNombre: 'Quintero, Carlos', voto: true, medio: 'whatsapp' },
  { id: 'V002', propuestaId: 'CANJE-001', empleadoId: 'E002', empleadoNombre: 'De Dio, Miguel', voto: true, medio: 'whatsapp' },
  { id: 'V003', propuestaId: 'CANJE-001', empleadoId: 'E003', empleadoNombre: 'Coronel, Juan', voto: true, medio: 'planilla' },
  { id: 'V004', propuestaId: 'CANJE-001', empleadoId: 'E004', empleadoNombre: 'Prado, Pedro', voto: true, medio: 'whatsapp' },
  { id: 'V005', propuestaId: 'CANJE-001', empleadoId: 'E005', empleadoNombre: 'Barrasa, Luis', voto: true, medio: 'whatsapp' },
  { id: 'V006', propuestaId: 'CANJE-001', empleadoId: 'E006', empleadoNombre: 'Ochoa, Roberto', voto: true, medio: 'whatsapp' },
  { id: 'V007', propuestaId: 'CANJE-001', empleadoId: 'E007', empleadoNombre: 'Martínez, Jorge', voto: false, medio: 'planilla' },
  { id: 'V008', propuestaId: 'CANJE-001', empleadoId: 'E008', empleadoNombre: 'Veliz, Fernando', voto: true, medio: 'whatsapp' },
  { id: 'V009', propuestaId: 'CANJE-001', empleadoId: 'E009', empleadoNombre: 'Puñet, Marcos', voto: true, medio: 'sistema' },
  { id: 'V010', propuestaId: 'CANJE-001', empleadoId: 'E010', empleadoNombre: 'Evangelisti, Diego', voto: true, medio: 'whatsapp' },
  { id: 'V011', propuestaId: 'CANJE-001', empleadoId: 'E011', empleadoNombre: 'Diale, Sergio', voto: true, medio: 'whatsapp' },
  { id: 'V012', propuestaId: 'CANJE-001', empleadoId: 'E012', empleadoNombre: 'Franco, Pablo', voto: true, medio: 'planilla' },
  { id: 'V013', propuestaId: 'CANJE-001', empleadoId: 'E013', empleadoNombre: 'Ramirez, Gustavo', voto: true, medio: 'whatsapp' },
  { id: 'V014', propuestaId: 'CANJE-001', empleadoId: 'E014', empleadoNombre: 'Chelencof, Daniel', voto: true, medio: 'whatsapp' },
]

const totalEmpleadosVotantes = 28

// Contexto de la sección
const contextoCanjes = {
  descripcion: 'Sistema de propuestas y votaciones para canjear días feriados por días compensatorios. Permite digitalizar el proceso actual de planillas físicas.',
  reglas: [
    'Se necesita el 95% de adhesión (firmas/votos) para confirmar el cambio',
    'La propuesta debe incluir el día a trabajar y los días compensatorios',
    'Los votos se pueden registrar por WhatsApp, planilla física o sistema',
    'Debe haber al menos 80% de participación para validar el resultado'
  ],
  flujo: [
    'RRHH crea propuesta: "¿Aceptás trabajar el 8 a cambio del 26 y 27?"',
    'Se envía propuesta por WhatsApp a todos los empleados',
    'Se baja planilla impresa a Planta 1 y 2 como complemento',
    'Empleados responden SI/NO por el medio disponible',
    'Sistema consolida votos de todos los canales',
    'Si alcanza 95% de adhesión, se confirma el cambio'
  ],
  integraciones: [
    'WhatsApp Bot: Envía propuesta y recibe respuestas SI/NO',
    'Genera planillas PDF para firma física',
    'Notifica resultado final a todos los involucrados'
  ],
  notas: [
    'Escenario típico: Feriado laborable (ej. Lunes 8)',
    'Beneficio: Día libre compensatorio + día "regalado"',
    'El bot gestiona la "encuesta vinculante" digitalmente'
  ]
}

// ============ HELPERS ============

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function getTimeRemaining(dateStr: string): string {
  const now = new Date()
  const limit = new Date(dateStr)
  const diff = limit.getTime() - now.getTime()
  if (diff < 0) return 'Vencida'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d restantes`
  return `${hours}h restantes`
}

// ============ COMPONENTE PRINCIPAL ============

export function CanjesTab() {
  const [expandedPropuesta, setExpandedPropuesta] = useState<string | null>('CANJE-001')
  const [showContexto, setShowContexto] = useState(false)

  const getFeriadoById = (id: string) => feriados.find(f => f.id === id)

  const getVotosDePropuesta = (propuestaId: string) => {
    return votosCanjes.filter(v => v.propuestaId === propuestaId)
  }

  const calcularResultados = (propuestaId: string) => {
    const votos = getVotosDePropuesta(propuestaId)
    const totalVotos = votos.length
    const aFavor = votos.filter(v => v.voto).length
    const enContra = votos.filter(v => !v.voto).length
    const faltantes = totalEmpleadosVotantes - totalVotos
    const porcentajeParticipacion = Math.round((totalVotos / totalEmpleadosVotantes) * 100)
    const porcentajeAFavor = totalVotos > 0 ? Math.round((aFavor / totalVotos) * 100) : 0
    return { totalVotos, aFavor, enContra, faltantes, porcentajeParticipacion, porcentajeAFavor }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Canjes de Feriados</h2>
          <p className="text-sm text-gray-500">Propuestas y votaciones vinculantes</p>
        </div>
        <div className="flex items-center gap-2">
          <ContextoButton onClick={() => setShowContexto(true)} />
          <button className="px-3 py-1.5 text-xs text-white bg-gray-900 hover:bg-gray-800 rounded flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Nueva Propuesta
          </button>
        </div>
      </div>

      {/* Lista de propuestas */}
      <div className="space-y-3">
        {propuestasCanjes.map(propuesta => {
          const feriado = getFeriadoById(propuesta.feriadoId)
          const resultados = calcularResultados(propuesta.id)
          const isExpanded = expandedPropuesta === propuesta.id
          const votos = getVotosDePropuesta(propuesta.id)

          return (
            <div key={propuesta.id} className="border border-gray-200 rounded-lg">
              {/* Header de propuesta */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{feriado?.nombre}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        propuesta.estado === 'activa' ? 'bg-gray-100 text-gray-700' :
                        propuesta.estado === 'aprobada' ? 'bg-gray-100 text-gray-700' :
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {propuesta.estado}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{propuesta.descripcion}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Trabajar: <span className="text-gray-700">{formatDate(propuesta.fechaTrabajo)}</span></span>
                      <span>→</span>
                      <span>Libres: <span className="text-gray-700">{propuesta.diasCompensatorios.map(d => formatDate(d)).join(', ')}</span></span>
                      {propuesta.estado === 'activa' && (
                        <>
                          <span className="border-l border-gray-200 pl-4 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getTimeRemaining(propuesta.fechaLimiteVotacion)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {propuesta.estado === 'activa' && (
                    <div className="text-right min-w-[120px]">
                      <div className="flex items-center gap-2 justify-end mb-1">
                        <span className="text-sm font-medium text-gray-900">{resultados.porcentajeAFavor}%</span>
                        <span className="text-xs text-gray-400">a favor</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gray-900 rounded-full"
                          style={{ width: `${resultados.porcentajeAFavor}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {resultados.totalVotos}/{totalEmpleadosVotantes} votos
                      </div>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  {propuesta.estado === 'activa' && (
                    <>
                      <button
                        onClick={() => setExpandedPropuesta(isExpanded ? null : propuesta.id)}
                        className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1"
                      >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        Ver votos
                      </button>
                      <button className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1">
                        <Send className="w-3 h-3" />
                        Recordatorio
                      </button>
                      <button className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Planilla
                      </button>
                    </>
                  )}
                  {propuesta.estado === 'borrador' && (
                    <button className="px-2.5 py-1 text-xs text-white bg-gray-900 hover:bg-gray-800 rounded flex items-center gap-1">
                      <Send className="w-3 h-3" />
                      Iniciar votación
                    </button>
                  )}
                </div>
              </div>

              {/* Detalle de votos */}
              {isExpanded && propuesta.estado === 'activa' && (
                <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50/50">
                  <div className="py-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-gray-500">
                        {votos.length} votos recibidos
                      </span>
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span>WhatsApp: {votos.filter(v => v.medio === 'whatsapp').length}</span>
                        <span>Planilla: {votos.filter(v => v.medio === 'planilla').length}</span>
                        <span>Sistema: {votos.filter(v => v.medio === 'sistema').length}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                      {votos.map(voto => (
                        <div
                          key={voto.id}
                          className="flex items-center justify-between px-2 py-1.5 bg-white rounded border border-gray-100"
                        >
                          <span className="text-xs text-gray-700">{voto.empleadoNombre.split(',')[0]}</span>
                          {voto.voto ? (
                            <ThumbsUp className="w-3 h-3 text-gray-400" />
                          ) : (
                            <ThumbsDown className="w-3 h-3 text-[#C4322F]" />
                          )}
                        </div>
                      ))}
                    </div>

                    {resultados.faltantes > 0 && (
                      <p className="text-xs text-gray-500 mt-3">
                        {resultados.faltantes} empleados sin votar
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Próximos feriados */}
      <div className="pt-4 border-t border-gray-100">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Próximos feriados</h3>
        <div className="flex gap-3">
          {feriados.filter(f => new Date(f.fecha) > new Date()).map(feriado => {
            const tienePropuesta = propuestasCanjes.some(p => p.feriadoId === feriado.id)
            return (
              <div key={feriado.id} className="px-3 py-2 border border-gray-200 rounded text-sm">
                <span className="text-gray-900">{feriado.nombre}</span>
                <span className="text-gray-400 ml-2">{formatDate(feriado.fecha)}</span>
                {tienePropuesta && <span className="ml-2 text-xs text-gray-400">(con propuesta)</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal de contexto */}
      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Contexto: Canjes de Feriados"
        contenido={contextoCanjes}
      />
    </div>
  )
}
