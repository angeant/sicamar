'use client'

import { useState } from 'react'
import Image from 'next/image'
import { UserButton } from '@clerk/nextjs'
import {
  Users,
  LayoutGrid,
  Clock,
  FileText,
  Palmtree,
  UtensilsCrossed,
  Receipt,
  AlertTriangle,
  HardHat,
  GraduationCap,
  Bell,
  Settings,
  Search,
  ChevronDown,
  CheckCircle2,
  Fingerprint,
  ClipboardList,
  FolderOpen,
  Calculator,
  RotateCcw,
  UserPlus,
  Shirt,
  CalendarClock,
  Zap,
  Factory,
} from 'lucide-react'

// Tab Components
import { OverviewTab } from './components/overview-tab'
import { PolivalenciasTab } from './components/polivalencias-tab'
import { AsistenciaTab } from './components/asistencia-tab'
import { MarcacionesTab } from './components/marcaciones-tab'
import { NominaTab } from './components/nomina-tab'
import { NovedadesTab } from './components/novedades-tab'
import { VacacionesTab } from './components/vacaciones-tab'
import { ViandasTab } from './components/viandas-tab'
import { SancionesTab } from './components/sanciones-tab'
import { EPPTab } from './components/epp-tab'
import { CapacitacionesTab } from './components/capacitaciones-tab'
import { DocumentacionTab } from './components/documentacion-tab'
import { LiquidacionesTab } from './components/liquidaciones-tab'
import { ReciboTab } from './components/recibo-tab'
// Nuevos tabs
import { TurnosRotacionesTab } from './components/turnos-rotaciones-tab'
import { AsignacionTurnosTab } from './components/asignacion-turnos-tab'
import { ValidacionJornadasTab } from './components/validacion-jornadas-tab'
import { PlantaLayoutTab } from './components/planta-layout-tab'
import { InduccionTab } from './components/induccion-tab'
import { CanjesTab } from './components/canjes-feriados-tab'
import { RopaTrabajoTab } from './components/ropa-trabajo-tab'
import { AutomatizacionTab } from './components/automatizacion-tab'

const tabs = [
  { id: 'overview', label: 'General', icon: LayoutGrid },
  // DATOS MAESTROS
  { id: 'nomina', label: 'Nómina', icon: ClipboardList },
  { id: 'planta', label: 'Planta', icon: Factory },
  { id: 'turnos', label: 'Rotaciones', icon: RotateCcw },
  // REGISTRO DIARIO
  { id: 'marcaciones', label: 'Marcaciones', icon: Fingerprint },
  { id: 'validacion', label: 'Validar Jornadas', icon: CheckCircle2 },
  { id: 'asistencia', label: 'Asistencia', icon: Clock },
  { id: 'novedades', label: 'Novedades', icon: FileText },
  // EVENTOS
  { id: 'vacaciones', label: 'Vacaciones', icon: Palmtree },
  { id: 'canjes', label: 'Canjes', icon: CalendarClock },
  // LIQUIDACIÓN
  { id: 'liquidaciones', label: 'Liquidaciones', icon: Calculator },
  { id: 'recibo', label: 'Recibos', icon: Receipt },
  // OTROS
  { id: 'polivalencias', label: 'Polivalencias', icon: Users },
  { id: 'induccion', label: 'Inducción', icon: UserPlus },
  { id: 'documentacion', label: 'Legajos', icon: FolderOpen },
  { id: 'viandas', label: 'Viandas', icon: UtensilsCrossed },
  { id: 'ropa', label: 'Ropa', icon: Shirt },
  { id: 'sanciones', label: 'Sanciones', icon: AlertTriangle },
  { id: 'epp', label: 'EPP', icon: HardHat },
  { id: 'capacitaciones', label: 'Capacitaciones', icon: GraduationCap },
  // SISTEMA
  { id: 'automatizacion', label: 'Automatización', icon: Zap },
]

export default function SicamarRRHHPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/sicamar.png"
              alt="Sicamar Metales"
              width={140}
              height={45}
              className="h-10 w-auto"
              priority
            />
            <div className="hidden md:block h-8 w-px bg-gray-200" />
            <div className="hidden md:flex items-center gap-2">
              <Users className="w-5 h-5 text-[#C4322F]" />
              <span className="text-sm font-semibold text-gray-700">Gestión de RRHH</span>
            </div>
          </div>

          {/* Search */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar empleado, legajo, área..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 h-10 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C4322F]/20 focus:border-[#C4322F] transition-all"
              />
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#C4322F] rounded-full" />
            </button>
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <div className="h-8 w-px bg-gray-200 mx-1" />
            <UserButton 
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "w-9 h-9"
                }
              }}
            />
          </div>
        </div>
      </header>


      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                    ${activeTab === tab.id
                      ? 'border-[#C4322F] text-[#C4322F]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'nomina' && <NominaTab />}
        {activeTab === 'planta' && <PlantaLayoutTab />}
        {activeTab === 'turnos' && <TurnosRotacionesTab />}
        {activeTab === 'marcaciones' && <MarcacionesTab />}
        {activeTab === 'validacion' && <ValidacionJornadasTab />}
        {activeTab === 'asistencia' && <AsistenciaTab />}
        {activeTab === 'novedades' && <NovedadesTab />}
        {activeTab === 'vacaciones' && <VacacionesTab />}
        {activeTab === 'canjes' && <CanjesTab />}
        {activeTab === 'liquidaciones' && <LiquidacionesTab />}
        {activeTab === 'recibo' && <ReciboTab />}
        {activeTab === 'polivalencias' && <PolivalenciasTab />}
        {activeTab === 'induccion' && <InduccionTab />}
        {activeTab === 'documentacion' && <DocumentacionTab />}
        {activeTab === 'viandas' && <ViandasTab />}
        {activeTab === 'ropa' && <RopaTrabajoTab />}
        {activeTab === 'sanciones' && <SancionesTab />}
        {activeTab === 'epp' && <EPPTab />}
        {activeTab === 'capacitaciones' && <CapacitacionesTab />}
        {activeTab === 'automatizacion' && <AutomatizacionTab />}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-[1600px] mx-auto px-4 h-12 flex items-center justify-between text-xs text-gray-400">
          <span>Sicamar Metales S.A. - Sistema de Gestión RRHH · powered by Kalia</span>
          <span>v1.0 · Diciembre 2025</span>
        </div>
      </footer>
    </div>
  )
}

