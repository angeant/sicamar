'use client'

import { UtensilsCrossed, Construction } from 'lucide-react'

export function ViandasTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Control de Viandas</h2>
          <p className="text-sm text-gray-500">Pedido diario de comida</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-300 rounded-lg bg-gray-50">
        <Construction className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700 mb-2">Módulo en desarrollo</h3>
        <p className="text-sm text-gray-500 text-center max-w-md">
          El módulo de Viandas está siendo implementado.
          Próximamente podrás gestionar el pedido diario de comida para el personal.
        </p>
      </div>
    </div>
  )
}
