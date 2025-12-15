'use client'

import { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  Edit2,
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'

// ============ TIPOS ============

interface CatalogoRopa {
  id: string
  codigo: string
  nombre: string
  tipo: string
  temporada: string
  color: string
  areaDestino: string
}

interface TalleEmpleado {
  id: string
  empleadoId: string
  empleadoNombre: string
  empleadoApellido: string
  empleadoArea: string
  talleCamisa: string
  tallePantalon: string
  talleCalzado: string
}

interface EntregaRopa {
  id: string
  empleadoId: string
  empleadoNombre: string
  ropaId: string
  cantidad: number
  temporada: string
  fechaEntrega?: string
  estado: 'pendiente' | 'entregado'
}

// ============ DATOS MOCK ============

const catalogoRopa: CatalogoRopa[] = [
  { id: 'ROPA-001', codigo: 'CAM-AZ', nombre: 'Camisa Azul Oscuro', tipo: 'camisa', temporada: 'verano', color: 'Azul Oscuro', areaDestino: 'Mantenimiento' },
  { id: 'ROPA-002', codigo: 'CAM-GR', nombre: 'Camisa Gris', tipo: 'camisa', temporada: 'verano', color: 'Gris', areaDestino: 'Producción' },
  { id: 'ROPA-003', codigo: 'PAN', nombre: 'Pantalón Grafa', tipo: 'pantalon', temporada: 'todo_año', color: 'Azul', areaDestino: 'Todos' },
  { id: 'ROPA-004', codigo: 'CHOM', nombre: 'Chomba Blanca', tipo: 'chomba', temporada: 'verano', color: 'Blanco', areaDestino: 'Admin' },
]

const tallesEmpleados: TalleEmpleado[] = [
  { id: 'T001', empleadoId: 'E001', empleadoNombre: 'Carlos', empleadoApellido: 'Quintero', empleadoArea: 'Producción', talleCamisa: 'L', tallePantalon: '44', talleCalzado: '42' },
  { id: 'T002', empleadoId: 'E002', empleadoNombre: 'Miguel', empleadoApellido: 'De Dio', empleadoArea: 'Producción', talleCamisa: 'XL', tallePantalon: '46', talleCalzado: '43' },
  { id: 'T003', empleadoId: 'E003', empleadoNombre: 'Juan', empleadoApellido: 'Coronel', empleadoArea: 'Producción', talleCamisa: 'M', tallePantalon: '42', talleCalzado: '41' },
  { id: 'T004', empleadoId: 'E015', empleadoNombre: 'Sergio', empleadoApellido: 'Diale', empleadoArea: 'Mantenimiento', talleCamisa: 'L', tallePantalon: '44', talleCalzado: '43' },
  { id: 'T005', empleadoId: 'E016', empleadoNombre: 'Pablo', empleadoApellido: 'Franco', empleadoArea: 'Mantenimiento', talleCamisa: 'XXL', tallePantalon: '48', talleCalzado: '44' },
  { id: 'T006', empleadoId: 'E017', empleadoNombre: 'Walter', empleadoApellido: 'Kegalj', empleadoArea: 'Mantenimiento', talleCamisa: '', tallePantalon: '', talleCalzado: '' },
  { id: 'T007', empleadoId: 'E018', empleadoNombre: 'Marcelo', empleadoApellido: 'Beluardi', empleadoArea: 'Mantenimiento', talleCamisa: '', tallePantalon: '', talleCalzado: '' },
]

const entregasRopa: EntregaRopa[] = [
  { id: 'ENT-001', empleadoId: 'E001', empleadoNombre: 'Quintero, Carlos', ropaId: 'ROPA-002', cantidad: 2, temporada: 'verano_2025', fechaEntrega: '2025-11-01', estado: 'entregado' },
  { id: 'ENT-002', empleadoId: 'E001', empleadoNombre: 'Quintero, Carlos', ropaId: 'ROPA-003', cantidad: 2, temporada: 'verano_2025', fechaEntrega: '2025-11-01', estado: 'entregado' },
  { id: 'ENT-003', empleadoId: 'E002', empleadoNombre: 'De Dio, Miguel', ropaId: 'ROPA-002', cantidad: 2, temporada: 'verano_2025', fechaEntrega: '2025-11-01', estado: 'entregado' },
  { id: 'ENT-004', empleadoId: 'E003', empleadoNombre: 'Coronel, Juan', ropaId: 'ROPA-002', cantidad: 2, temporada: 'verano_2025', estado: 'pendiente' },
  { id: 'ENT-005', empleadoId: 'E015', empleadoNombre: 'Diale, Sergio', ropaId: 'ROPA-001', cantidad: 2, temporada: 'verano_2025', fechaEntrega: '2025-11-02', estado: 'entregado' },
]

// Contexto de la sección
const contextoRopa = {
  descripcion: 'Gestión de ropa de trabajo: registro de talles, entregas por temporada y consolidado para compras.',
  reglas: [
    'Entrega Verano: 2 Camisas + 2 Pantalones (misma ropa para todos, difieren colores por área)',
    'Entrega Invierno: Se entrega en Marzo (campera térmica)',
    'Mantenimiento: Azul Oscuro',
    'Producción: Gris',
    'Administrativos: Chombas/Camisas blancas'
  ],
  flujo: [
    'Rocío (o el Bot) recopila talles de empleados',
    'Se consolida la información en el sistema',
    'Se genera reporte para Compras con totales por talle',
    'Compras adquiere la ropa',
    'Pañolero es el encargado de la entrega física final',
    'Se registra cada entrega en el sistema'
  ],
  integraciones: [
    'Formulario Bot WhatsApp: "¿Cuál es tu talle de camisa?"',
    'Exportación Excel para Compras',
    'Historial de entregas por empleado'
  ],
  notas: [
    'El input actual es un Formulario de Google, migrar al Bot',
    'Datos requeridos: Apellido, Nombre, Talle Camisa, Talle Pantalón',
    'El Pañolero confirma entregas en el sistema'
  ]
}

// ============ COMPONENTE PRINCIPAL ============

export function RopaTrabajoTab() {
  const [searchQuery, setSearchQuery] = useState('')
  const [vistaMode, setVistaMode] = useState<'talles' | 'entregas' | 'consolidado'>('talles')
  const [showContexto, setShowContexto] = useState(false)

  const stats = useMemo(() => {
    const totalEmpleados = tallesEmpleados.length
    const conTalles = tallesEmpleados.filter(t => t.talleCamisa && t.tallePantalon).length
    const sinTalles = totalEmpleados - conTalles
    const entregasPendientes = entregasRopa.filter(e => e.estado === 'pendiente').length
    return { totalEmpleados, conTalles, sinTalles, entregasPendientes }
  }, [])

  // Consolidado para compras
  const consolidado = useMemo(() => {
    const items: { talle: string; cantidad: number; tipo: string }[] = []
    tallesEmpleados.filter(t => t.talleCamisa && t.tallePantalon).forEach(emp => {
      // Camisas
      const existeCamisa = items.find(i => i.talle === emp.talleCamisa && i.tipo === 'camisa')
      if (existeCamisa) existeCamisa.cantidad += 2
      else items.push({ talle: emp.talleCamisa, cantidad: 2, tipo: 'camisa' })
      // Pantalones
      const existePantalon = items.find(i => i.talle === emp.tallePantalon && i.tipo === 'pantalon')
      if (existePantalon) existePantalon.cantidad += 2
      else items.push({ talle: emp.tallePantalon, cantidad: 2, tipo: 'pantalon' })
    })
    return items
  }, [])

  const filteredTalles = tallesEmpleados.filter(t =>
    t.empleadoNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.empleadoApellido.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Ropa de Trabajo</h2>
          <p className="text-sm text-gray-500">Gestión de talles y entregas</p>
        </div>
        <div className="flex items-center gap-2">
          <ContextoButton onClick={() => setShowContexto(true)} />
          <button className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
          <button className="px-3 py-1.5 text-xs text-white bg-gray-900 hover:bg-gray-800 rounded flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Registrar Entrega
          </button>
        </div>
      </div>

      {/* Alerta de talles faltantes */}
      {stats.sinTalles > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm">
          <AlertTriangle className="w-4 h-4 text-gray-500" />
          <span className="text-gray-600">
            <span className="text-[#C4322F] font-medium">{stats.sinTalles}</span> empleado(s) sin talles cargados
          </span>
        </div>
      )}

      {/* Filtros y vistas */}
      <div className="flex items-center justify-between py-3 border-y border-gray-100">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar empleado..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded w-48 focus:outline-none focus:border-gray-300"
          />
        </div>

        <div className="flex gap-1">
          {(['talles', 'entregas', 'consolidado'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setVistaMode(mode)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                vistaMode === mode ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {mode === 'talles' ? 'Talles' : mode === 'entregas' ? 'Entregas' : 'Consolidado'}
            </button>
          ))}
        </div>
      </div>

      {/* Vista: Talles */}
      {vistaMode === 'talles' && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left font-medium text-gray-600 px-4 py-2.5">Empleado</th>
                <th className="text-left font-medium text-gray-600 px-4 py-2.5 w-24">Área</th>
                <th className="text-center font-medium text-gray-600 px-4 py-2.5 w-20">Camisa</th>
                <th className="text-center font-medium text-gray-600 px-4 py-2.5 w-20">Pantalón</th>
                <th className="text-center font-medium text-gray-600 px-4 py-2.5 w-20">Calzado</th>
                <th className="text-center font-medium text-gray-600 px-4 py-2.5 w-20">Estado</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTalles.map(talle => {
                const completo = talle.talleCamisa && talle.tallePantalon && talle.talleCalzado
                return (
                  <tr key={talle.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-gray-900">
                      {talle.empleadoApellido}, {talle.empleadoNombre}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{talle.empleadoArea}</td>
                    <td className="px-4 py-2.5 text-center">
                      {talle.talleCamisa ? (
                        <span className="text-gray-700 font-mono text-xs">{talle.talleCamisa}</span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {talle.tallePantalon ? (
                        <span className="text-gray-700 font-mono text-xs">{talle.tallePantalon}</span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {talle.talleCalzado ? (
                        <span className="text-gray-700 font-mono text-xs">{talle.talleCalzado}</span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {completo ? (
                        <CheckCircle2 className="w-4 h-4 text-gray-400 mx-auto" />
                      ) : (
                        <span className="text-xs text-[#C4322F]">incompleto</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vista: Entregas */}
      {vistaMode === 'entregas' && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
            Temporada: Verano 2025
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="text-left font-medium text-gray-600 px-4 py-2">Empleado</th>
                <th className="text-left font-medium text-gray-600 px-4 py-2">Artículo</th>
                <th className="text-center font-medium text-gray-600 px-4 py-2 w-20">Cant.</th>
                <th className="text-center font-medium text-gray-600 px-4 py-2 w-24">Fecha</th>
                <th className="text-center font-medium text-gray-600 px-4 py-2 w-24">Estado</th>
              </tr>
            </thead>
            <tbody>
              {entregasRopa.map(entrega => {
                const ropa = catalogoRopa.find(r => r.id === entrega.ropaId)
                return (
                  <tr key={entrega.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-2 text-gray-900">{entrega.empleadoNombre}</td>
                    <td className="px-4 py-2 text-gray-600">{ropa?.nombre}</td>
                    <td className="px-4 py-2 text-center text-gray-600">{entrega.cantidad}</td>
                    <td className="px-4 py-2 text-center text-gray-500 text-xs">
                      {entrega.fechaEntrega ? new Date(entrega.fechaEntrega).toLocaleDateString('es-AR') : '-'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {entrega.estado === 'entregado' ? (
                        <span className="text-xs text-gray-500">entregado</span>
                      ) : (
                        <span className="text-xs text-[#C4322F]">pendiente</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vista: Consolidado */}
      {vistaMode === 'consolidado' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Consolidado para Compras - Verano 2025</span>
            <button className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1">
              <Download className="w-3 h-3" />
              Excel
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Camisas */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
                Camisas
              </div>
              <div className="divide-y divide-gray-100">
                {consolidado.filter(c => c.tipo === 'camisa').sort((a, b) => a.talle.localeCompare(b.talle)).map((item, i) => (
                  <div key={i} className="px-4 py-2 flex items-center justify-between">
                    <span className="text-sm text-gray-600">Talle {item.talle}</span>
                    <span className="font-mono text-sm text-gray-900">{item.cantidad}</span>
                  </div>
                ))}
                <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Total</span>
                  <span className="font-mono font-medium text-gray-900">
                    {consolidado.filter(c => c.tipo === 'camisa').reduce((acc, c) => acc + c.cantidad, 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Pantalones */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
                Pantalones
              </div>
              <div className="divide-y divide-gray-100">
                {consolidado.filter(c => c.tipo === 'pantalon').sort((a, b) => Number(a.talle) - Number(b.talle)).map((item, i) => (
                  <div key={i} className="px-4 py-2 flex items-center justify-between">
                    <span className="text-sm text-gray-600">Talle {item.talle}</span>
                    <span className="font-mono text-sm text-gray-900">{item.cantidad}</span>
                  </div>
                ))}
                <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Total</span>
                  <span className="font-mono font-medium text-gray-900">
                    {consolidado.filter(c => c.tipo === 'pantalon').reduce((acc, c) => acc + c.cantidad, 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Catálogo rápido */}
      <div className="pt-4 border-t border-gray-100">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Catálogo por área</h3>
        <div className="flex gap-3 text-sm">
          {catalogoRopa.map(ropa => (
            <div key={ropa.id} className="px-3 py-2 border border-gray-200 rounded">
              <span className="text-gray-900">{ropa.nombre}</span>
              <span className="text-gray-400 ml-2">· {ropa.areaDestino}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de contexto */}
      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Contexto: Ropa de Trabajo"
        contenido={contextoRopa}
      />
    </div>
  )
}
