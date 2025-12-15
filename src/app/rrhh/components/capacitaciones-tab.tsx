'use client'

import { GraduationCap, Plus, Construction } from 'lucide-react'

export function CapacitacionesTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Capacitaciones</h2>
          <p className="text-sm text-gray-500">Formación y competencias</p>
        </div>
        <button className="px-3 py-1.5 text-xs text-white bg-gray-900 hover:bg-gray-800 rounded flex items-center gap-1.5" disabled>
          <Plus className="w-3.5 h-3.5" />
          Nueva capacitación
        </button>
      </div>

      <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-300 rounded-lg bg-gray-50">
        <Construction className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700 mb-2">Módulo en desarrollo</h3>
        <p className="text-sm text-gray-500 text-center max-w-md">
          El módulo de Capacitaciones está siendo implementado.
          Próximamente podrás gestionar formaciones y competencias del personal.
        </p>
      </div>
    </div>
  )
}
