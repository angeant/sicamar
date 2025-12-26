'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'

interface EmpleadoSeleccionado {
  id: number
  legajo: string
  nombre: string
}

interface MarcacionesChatProps {
  fechas?: string[]
  onDataUpdated?: () => void
  selectedEmpleados?: EmpleadoSeleccionado[]
  onClearEmpleadoSelection?: () => void
  onRemoveEmpleado?: (id: number) => void
}

export default function MarcacionesChat({ 
  fechas = [],
  onDataUpdated, 
  selectedEmpleados = [],
  onClearEmpleadoSelection,
  onRemoveEmpleado
}: MarcacionesChatProps) {
  const { user } = useUser()
  const userEmail = user?.primaryEmailAddress?.emailAddress || ''
  
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // TODO: Implementar envío de mensaje
    }
  }
  
  return (
    <div className="w-72 flex-shrink-0 bg-zinc-950 border-l border-zinc-800/50 flex flex-col h-screen">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium text-zinc-600 tracking-widest uppercase">
              Asistente
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Marcaciones
            </p>
          </div>
        </div>
      </div>
      
      {/* Messages placeholder */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-4">
        <div className="py-6">
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Chat de marcaciones en desarrollo. Pronto podrás hacer consultas y correcciones de asistencia.
          </p>
          <div className="mt-4 space-y-1.5">
            {[
              '¿Quién faltó el lunes?',
              'Corregir entrada de legajo 213',
              'Ausencias de esta semana'
            ].map((suggestion, i) => (
              <button
                key={i}
                onClick={() => setInput(suggestion)}
                className="block w-full text-left text-[10px] text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900 px-2 py-1.5 rounded transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Input */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-zinc-800/50">
        <div className="flex items-start gap-1.5">
          <div 
            className={`flex-1 min-h-[28px] bg-zinc-900 border border-zinc-800 rounded px-2 py-1 flex flex-wrap items-center gap-1 cursor-text ${
              isLoading ? 'opacity-50' : ''
            } focus-within:border-zinc-600`}
            onClick={() => inputRef.current?.focus()}
          >
            {/* Badges de empleados seleccionados */}
            {selectedEmpleados.slice(0, 3).map((emp) => (
              <span 
                key={emp.id}
                className="inline-flex items-center gap-0.5 bg-[#C4322F]/25 text-[#C4322F] text-[9px] px-1 py-0.5 rounded flex-shrink-0"
              >
                <span className="font-mono">{emp.legajo}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); onRemoveEmpleado?.(emp.id) }}
                  className="hover:text-white transition-colors ml-0.5"
                >
                  ×
                </button>
              </span>
            ))}
            {selectedEmpleados.length > 3 && (
              <span className="text-[9px] text-zinc-500 flex-shrink-0">
                +{selectedEmpleados.length - 3}
              </span>
            )}
            
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedEmpleados.length > 0
                  ? "acción..." 
                  : "Escribí algo..."
              }
              disabled={isLoading}
              className="flex-1 min-w-[50px] bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
            />
          </div>
          <button
            disabled={isLoading || !input.trim()}
            className="h-7 w-7 flex-shrink-0 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 rounded flex items-center justify-center transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-400">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <p className="text-[8px] text-zinc-700 mt-2 text-center">
          Powered by <span className="font-semibold text-zinc-500">Kalia</span>
        </p>
      </div>
    </div>
  )
}


