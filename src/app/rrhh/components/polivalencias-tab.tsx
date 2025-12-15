'use client'

import { Users, Construction, Download, Plus } from 'lucide-react'

export function PolivalenciasTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Matriz de Polivalencias</h2>
          <p className="text-sm text-gray-500">Competencias y habilidades del personal</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1.5" disabled>
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
          <button className="px-3 py-1.5 text-xs text-white bg-gray-900 hover:bg-gray-800 rounded flex items-center gap-1.5" disabled>
            <Plus className="w-3.5 h-3.5" />
            Nueva evaluación
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-300 rounded-lg bg-gray-50">
        <Construction className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700 mb-2">Módulo en desarrollo</h3>
        <p className="text-sm text-gray-500 text-center max-w-md">
          La Matriz de Polivalencias está siendo implementada.
          Próximamente podrás ver competencias del personal (Empleado × Puesto → Nivel 1-4).
        </p>
      </div>
    </div>
  )
}
