'use client'

import { useState } from 'react'
import {
  FileText,
  Search,
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  User,
  Download,
  Eye,
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'

const contextoDocumentacion = {
  descripcion: 'Gestión digital de legajos. Centraliza toda la documentación de cada empleado: ingreso, periódica, capacitaciones y recibos firmados.',
  reglas: [
    'Documentos de ingreso: DNI, CUIL, Alta AFIP, Contrato firmado, CBU',
    'Documentos periódicos: Apto médico (anual), Libreta sanitaria (anual)',
    'Documentos mensuales: Recibo de sueldo firmado',
    'Todo documento obligatorio debe estar cargado',
    'Alertas 30 días antes de vencimiento'
  ],
  flujo: [
    '1. Nuevo ingreso: Se genera checklist de documentos requeridos',
    '2. RRHH solicita documentación al empleado',
    '3. Empleado envía (WhatsApp/presencial)',
    '4. RRHH carga y valida',
    '5. Sistema alerta vencimientos próximos'
  ],
  integraciones: [
    'WhatsApp Bot: Empleado envía foto de documento',
    'Storage: Archivos en bucket seguro con backup',
    'Alertas: Email/WhatsApp cuando documento por vencer'
  ],
  notas: [
    'Problema actual: Legajos en papel, carpetas físicas',
    'Objetivo: 100% digital, acceso inmediato',
    'Crítico: Apto médico vencido = no puede trabajar',
    'Auditoría: Listado de documentos faltantes por empleado'
  ]
}

// Tipos de documentos
const TIPOS_DOCUMENTO = [
  { id: 1, codigo: 'DNI_FRENTE', nombre: 'DNI - Frente', categoria: 'ingreso', obligatorio: true },
  { id: 2, codigo: 'DNI_DORSO', nombre: 'DNI - Dorso', categoria: 'ingreso', obligatorio: true },
  { id: 3, codigo: 'CUIL', nombre: 'Constancia CUIL', categoria: 'ingreso', obligatorio: true },
  { id: 4, codigo: 'ALTA_AFIP', nombre: 'Alta temprana AFIP', categoria: 'ingreso', obligatorio: true },
  { id: 5, codigo: 'CONTRATO', nombre: 'Contrato de trabajo firmado', categoria: 'ingreso', obligatorio: true },
  { id: 6, codigo: 'CBU', nombre: 'Constancia CBU', categoria: 'ingreso', obligatorio: true },
  { id: 7, codigo: 'APTO_MEDICO', nombre: 'Apto médico', categoria: 'periodico', obligatorio: true, tieneVencimiento: true },
  { id: 8, codigo: 'LIBRETA_SANITARIA', nombre: 'Libreta sanitaria', categoria: 'periodico', obligatorio: true, tieneVencimiento: true },
  { id: 9, codigo: 'RECIBO_SUELDO', nombre: 'Recibo de sueldo firmado', categoria: 'mensual', obligatorio: true },
]

const CATEGORIAS = {
  ingreso: { nombre: 'Documentos de ingreso', color: 'blue' },
  periodico: { nombre: 'Documentos periódicos', color: 'purple' },
  mensual: { nombre: 'Documentos mensuales', color: 'green' },
}

// Mock data de empleados con sus documentos
const MOCK_EMPLEADOS = [
  {
    id: 1,
    legajo: '332',
    nombre: 'ALANIZ, MATIAS',
    fechaIngreso: '2022-03-15',
    documentos: {
      DNI_FRENTE: { estado: 'cargado', fecha: '2022-03-10' },
      DNI_DORSO: { estado: 'cargado', fecha: '2022-03-10' },
      CUIL: { estado: 'cargado', fecha: '2022-03-10' },
      ALTA_AFIP: { estado: 'cargado', fecha: '2022-03-15' },
      CONTRATO: { estado: 'cargado', fecha: '2022-03-15' },
      CBU: { estado: 'cargado', fecha: '2022-03-15' },
      APTO_MEDICO: { estado: 'vencido', fecha: '2023-03-15', vencimiento: '2024-03-15' },
      LIBRETA_SANITARIA: { estado: 'cargado', fecha: '2024-06-01', vencimiento: '2025-06-01' },
      RECIBO_SUELDO: { estado: 'pendiente' },
    }
  },
  {
    id: 2,
    legajo: '363',
    nombre: 'ALVAREZ, MAGALI',
    fechaIngreso: '2024-08-01',
    documentos: {
      DNI_FRENTE: { estado: 'cargado', fecha: '2024-08-01' },
      DNI_DORSO: { estado: 'cargado', fecha: '2024-08-01' },
      CUIL: { estado: 'cargado', fecha: '2024-08-01' },
      ALTA_AFIP: { estado: 'cargado', fecha: '2024-08-01' },
      CONTRATO: { estado: 'pendiente' },
      CBU: { estado: 'cargado', fecha: '2024-08-01' },
      APTO_MEDICO: { estado: 'cargado', fecha: '2024-08-01', vencimiento: '2025-08-01' },
      LIBRETA_SANITARIA: { estado: 'pendiente' },
      RECIBO_SUELDO: { estado: 'pendiente' },
    }
  },
  {
    id: 3,
    legajo: '328',
    nombre: 'ARMAYOR, BRIAN LAUREANO',
    fechaIngreso: '2022-01-10',
    documentos: {
      DNI_FRENTE: { estado: 'cargado', fecha: '2022-01-10' },
      DNI_DORSO: { estado: 'cargado', fecha: '2022-01-10' },
      CUIL: { estado: 'cargado', fecha: '2022-01-10' },
      ALTA_AFIP: { estado: 'cargado', fecha: '2022-01-10' },
      CONTRATO: { estado: 'cargado', fecha: '2022-01-10' },
      CBU: { estado: 'cargado', fecha: '2022-01-10' },
      APTO_MEDICO: { estado: 'por_vencer', fecha: '2024-01-10', vencimiento: '2025-01-10' },
      LIBRETA_SANITARIA: { estado: 'cargado', fecha: '2024-07-01', vencimiento: '2025-07-01' },
      RECIBO_SUELDO: { estado: 'cargado', fecha: '2024-11-30' },
    }
  },
]

type ViewMode = 'empleados' | 'documentos' | 'alertas'

export function DocumentacionTab() {
  const [viewMode, setViewMode] = useState<ViewMode>('empleados')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedEmpleado, setExpandedEmpleado] = useState<number | null>(null)
  const [filterCategoria, setFilterCategoria] = useState<string>('todas')
  const [showContexto, setShowContexto] = useState(false)

  // Calcular estadísticas
  const stats = {
    completos: MOCK_EMPLEADOS.filter(e => {
      const docsObligatorios = TIPOS_DOCUMENTO.filter(t => t.obligatorio)
      return docsObligatorios.every(t => e.documentos[t.codigo as keyof typeof e.documentos]?.estado === 'cargado')
    }).length,
    pendientes: MOCK_EMPLEADOS.filter(e => {
      const docsObligatorios = TIPOS_DOCUMENTO.filter(t => t.obligatorio)
      return docsObligatorios.some(t => e.documentos[t.codigo as keyof typeof e.documentos]?.estado === 'pendiente')
    }).length,
    vencidos: MOCK_EMPLEADOS.filter(e => {
      return Object.values(e.documentos).some(d => d.estado === 'vencido')
    }).length,
    porVencer: MOCK_EMPLEADOS.filter(e => {
      return Object.values(e.documentos).some(d => d.estado === 'por_vencer')
    }).length,
  }

  const filteredEmpleados = MOCK_EMPLEADOS.filter(e =>
    e.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.legajo.includes(searchQuery)
  )

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'cargado': return <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />
      case 'pendiente': return <Clock className="w-3.5 h-3.5 text-gray-300" />
      case 'vencido': return <XCircle className="w-3.5 h-3.5 text-[#C4322F]" />
      case 'por_vencer': return <AlertTriangle className="w-3.5 h-3.5 text-[#C4322F]" />
      default: return <Clock className="w-3.5 h-3.5 text-gray-300" />
    }
  }

  const calcularProgreso = (empleado: typeof MOCK_EMPLEADOS[0]) => {
    const docsObligatorios = TIPOS_DOCUMENTO.filter(t => t.obligatorio)
    const cargados = docsObligatorios.filter(t => 
      empleado.documentos[t.codigo as keyof typeof empleado.documentos]?.estado === 'cargado'
    ).length
    return Math.round((cargados / docsObligatorios.length) * 100)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Documentación de Empleados</h2>
          <p className="text-sm text-gray-500">Legajos y documentos requeridos</p>
        </div>
        <div className="flex items-center gap-2">
          <ContextoButton onClick={() => setShowContexto(true)} />
          <button className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
          <button className="px-3 py-1.5 text-xs text-white bg-gray-900 hover:bg-gray-800 rounded flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            Cargar documento
          </button>
        </div>
      </div>

      {/* Tabs y búsqueda */}
      <div className="flex items-center justify-between py-3 border-y border-gray-100">
        <div className="flex gap-1">
          {([
            { id: 'empleados' as const, label: 'Por empleado' },
            { id: 'documentos' as const, label: 'Por documento' },
            { id: 'alertas' as const, label: 'Alertas', count: stats.vencidos + stats.porVencer },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1.5 ${
                viewMode === tab.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {tab.count && tab.count > 0 && (
                <span className={`px-1 py-0.5 text-[10px] rounded ${
                  viewMode === tab.id ? 'bg-white/20' : 'bg-[#C4322F] text-white'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
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

      {/* Vista por empleado */}
      {viewMode === 'empleados' && (
        <div className="space-y-2">
          {filteredEmpleados.map(empleado => {
            const isExpanded = expandedEmpleado === empleado.id
            const progreso = calcularProgreso(empleado)
            const tieneVencidos = Object.values(empleado.documentos).some(d => d.estado === 'vencido')
            const tienePorVencer = Object.values(empleado.documentos).some(d => d.estado === 'por_vencer')
            
            return (
              <div key={empleado.id} className="border border-gray-200 rounded-lg">
                <div 
                  className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedEmpleado(isExpanded ? null : empleado.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      tieneVencidos ? 'bg-[#C4322F]' : tienePorVencer ? 'bg-[#C4322F]' : progreso === 100 ? 'bg-gray-400' : 'bg-gray-300'
                    }`} />
                    <div>
                      <span className="text-sm text-gray-900">{empleado.nombre}</span>
                      <span className="text-xs text-gray-400 ml-2">Leg. {empleado.legajo}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${progreso === 100 ? 'bg-gray-400' : 'bg-[#C4322F]'}`}
                          style={{ width: `${progreso}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8">{progreso}%</span>
                    </div>
                    {(tieneVencidos || tienePorVencer) && (
                      <span className="text-xs text-[#C4322F]">{tieneVencidos ? 'Vencido' : 'Por vencer'}</span>
                    )}
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3">
                    {Object.entries(CATEGORIAS).map(([catKey, categoria]) => {
                      const docsCategoria = TIPOS_DOCUMENTO.filter(t => t.categoria === catKey)
                      if (filterCategoria !== 'todas' && filterCategoria !== catKey) return null
                      
                      return (
                        <div key={catKey} className="mb-3 last:mb-0">
                          <p className="text-xs text-gray-400 mb-2">{categoria.nombre}</p>
                          <div className="grid grid-cols-3 gap-2">
                            {docsCategoria.map(tipo => {
                              const doc = empleado.documentos[tipo.codigo as keyof typeof empleado.documentos]
                              return (
                                <div key={tipo.codigo} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded">
                                  <div className="flex items-center gap-2">
                                    {getEstadoIcon(doc?.estado || 'pendiente')}
                                    <span className="text-xs text-gray-700">{tipo.nombre}</span>
                                  </div>
                                  <button className="text-gray-400 hover:text-gray-600">
                                    {doc?.estado === 'cargado' ? <Eye className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Vista por documento */}
      {viewMode === 'documentos' && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Documento</th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600 w-20">Completo</th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600 w-20">Pendiente</th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600 w-20">Por vencer</th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600 w-20">Vencido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {TIPOS_DOCUMENTO.map(tipo => {
                const docStats = {
                  cargado: MOCK_EMPLEADOS.filter(e => e.documentos[tipo.codigo as keyof typeof e.documentos]?.estado === 'cargado').length,
                  pendiente: MOCK_EMPLEADOS.filter(e => !e.documentos[tipo.codigo as keyof typeof e.documentos] || e.documentos[tipo.codigo as keyof typeof e.documentos]?.estado === 'pendiente').length,
                  por_vencer: MOCK_EMPLEADOS.filter(e => e.documentos[tipo.codigo as keyof typeof e.documentos]?.estado === 'por_vencer').length,
                  vencido: MOCK_EMPLEADOS.filter(e => e.documentos[tipo.codigo as keyof typeof e.documentos]?.estado === 'vencido').length,
                }
                
                return (
                  <tr key={tipo.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5">
                      <span className="text-gray-900">{tipo.nombre}</span>
                      {tipo.obligatorio && <span className="text-[#C4322F] ml-1">*</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{docStats.cargado}</td>
                    <td className="px-4 py-2.5 text-center text-gray-400">{docStats.pendiente || '-'}</td>
                    <td className="px-4 py-2.5 text-center text-[#C4322F]">{docStats.por_vencer || '-'}</td>
                    <td className="px-4 py-2.5 text-center text-[#C4322F]">{docStats.vencido || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vista de alertas */}
      {viewMode === 'alertas' && (
        <div className="space-y-4">
          {stats.vencidos > 0 && (
            <div className="border border-gray-200 rounded-lg">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-[#C4322F]" />
                <span className="text-sm font-medium text-gray-700">Documentos vencidos</span>
              </div>
              <div className="divide-y divide-gray-100">
                {MOCK_EMPLEADOS.flatMap(empleado => 
                  Object.entries(empleado.documentos)
                    .filter(([, doc]) => doc.estado === 'vencido')
                    .map(([codigo, doc]) => {
                      const tipo = TIPOS_DOCUMENTO.find(t => t.codigo === codigo)
                      return (
                        <div key={`${empleado.id}-${codigo}`} className="px-4 py-3 flex items-center justify-between">
                          <div>
                            <span className="text-sm text-gray-900">{empleado.nombre}</span>
                            <span className="text-xs text-gray-500 ml-2">{tipo?.nombre} - Venció: {doc.vencimiento}</span>
                          </div>
                          <button className="text-xs text-[#C4322F] hover:underline">Actualizar</button>
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          )}

          {stats.porVencer > 0 && (
            <div className="border border-gray-200 rounded-lg">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#C4322F]" />
                <span className="text-sm font-medium text-gray-700">Por vencer (próximos 30 días)</span>
              </div>
              <div className="divide-y divide-gray-100">
                {MOCK_EMPLEADOS.flatMap(empleado => 
                  Object.entries(empleado.documentos)
                    .filter(([, doc]) => doc.estado === 'por_vencer')
                    .map(([codigo, doc]) => {
                      const tipo = TIPOS_DOCUMENTO.find(t => t.codigo === codigo)
                      return (
                        <div key={`${empleado.id}-${codigo}`} className="px-4 py-3 flex items-center justify-between">
                          <div>
                            <span className="text-sm text-gray-900">{empleado.nombre}</span>
                            <span className="text-xs text-gray-500 ml-2">{tipo?.nombre} - Vence: {doc.vencimiento}</span>
                          </div>
                          <button className="text-xs text-gray-600 hover:underline">Renovar</button>
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          )}

          {stats.vencidos === 0 && stats.porVencer === 0 && (
            <div className="border border-gray-200 rounded-lg p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No hay alertas de documentación</p>
            </div>
          )}
        </div>
      )}

      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Contexto: Documentación de Empleados"
        contenido={contextoDocumentacion}
      />
    </div>
  )
}
