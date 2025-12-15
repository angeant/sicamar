'use client'

import { useState } from 'react'
import { X, Info, ChevronDown, ChevronRight } from 'lucide-react'

interface ContextoModalProps {
  isOpen: boolean
  onClose: () => void
  titulo: string
  contenido: {
    descripcion: string
    reglas?: string[]
    flujo?: string[]
    integraciones?: string[]
    notas?: string[]
  }
}

export function ContextoModal({ isOpen, onClose, titulo, contenido }: ContextoModalProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(['descripcion'])

  if (!isOpen) return null

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => {
    const isExpanded = expandedSections.includes(id)
    return (
      <div className="border-b border-gray-100 last:border-b-0">
        <button
          onClick={() => toggleSection(id)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">{title}</span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </button>
        {isExpanded && (
          <div className="px-4 pb-4 text-sm text-gray-600">
            {children}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />
      
      {/* Panel lateral */}
      <div className="relative w-full max-w-md h-full bg-white shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-gray-500" />
            <h2 className="font-medium text-gray-900">{titulo}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Contenido */}
        <div className="flex-1 overflow-y-auto">
          <Section id="descripcion" title="Descripción">
            <p className="leading-relaxed">{contenido.descripcion}</p>
          </Section>
          
          {contenido.reglas && contenido.reglas.length > 0 && (
            <Section id="reglas" title="Reglas de Negocio">
              <ul className="space-y-2">
                {contenido.reglas.map((regla, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-gray-300 mt-1">•</span>
                    <span>{regla}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          
          {contenido.flujo && contenido.flujo.length > 0 && (
            <Section id="flujo" title="Flujo de Trabajo">
              <ol className="space-y-2">
                {contenido.flujo.map((paso, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-xs font-mono text-gray-400 mt-0.5 w-4">{i + 1}.</span>
                    <span>{paso}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}
          
          {contenido.integraciones && contenido.integraciones.length > 0 && (
            <Section id="integraciones" title="Integraciones">
              <ul className="space-y-2">
                {contenido.integraciones.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-gray-300 mt-1">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          
          {contenido.notas && contenido.notas.length > 0 && (
            <Section id="notas" title="Notas Importantes">
              <ul className="space-y-2">
                {contenido.notas.map((nota, i) => (
                  <li key={i} className="p-2 bg-gray-50 rounded text-xs">
                    {nota}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-400">
            Esta información sirve como fuente de verdad para la operación de esta sección.
          </p>
        </div>
      </div>
    </div>
  )
}

// Botón para abrir el modal
export function ContextoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1.5 transition-colors"
    >
      <Info className="w-3.5 h-3.5" />
      Contexto de la sección
    </button>
  )
}






