'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'

interface ToolCall {
  name: string
  input: Record<string, unknown>
  result?: { success?: boolean; data?: unknown; error?: string }
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  toolCalls?: ToolCall[]
}

interface ChatSelection {
  empleados: { id: number; legajo: string; nombre: string }[]
  fechas: string[]
}

interface EmpleadoSeleccionado {
  id: number
  legajo: string
  nombre: string
}

interface PlanningChatProps {
  fechasSemana?: string[]
  onJornadaUpdated?: () => void
  selection?: ChatSelection | null
  onClearSelection?: () => void
  selectedEmpleados?: EmpleadoSeleccionado[]
  onClearEmpleadoSelection?: () => void
  onRemoveEmpleado?: (id: number) => void
}

// Helper para obtener el conversation_id guardado del usuario
function getSavedConversationId(email: string): string | null {
  if (typeof window === 'undefined') return null
  const key = `sicamar_chat_conversation_${email}`
  return localStorage.getItem(key)
}

// Guardar conversation_id del usuario
function saveConversationId(email: string, conversationId: string): void {
  if (typeof window === 'undefined') return
  const key = `sicamar_chat_conversation_${email}`
  localStorage.setItem(key, conversationId)
}

// Limpiar conversation_id (para nueva conversación)
function clearConversationId(email: string): void {
  if (typeof window === 'undefined') return
  const key = `sicamar_chat_conversation_${email}`
  localStorage.removeItem(key)
}

// Componente para mostrar una tool call expandible
function ToolCallItem({ tool, isLast }: { tool: ToolCall; isLast: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isSuccess = tool.result?.success !== false
  const isLoading = tool.result === undefined
  
  return (
    <div className={`${!isLast ? 'border-b border-zinc-800/50' : ''}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-zinc-800/30 transition-colors text-left"
      >
        <svg 
          width="8" 
          height="8" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          className={`text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-[9px] text-zinc-400 font-mono flex-1">
          {tool.name.replace('sicamar_', '').replace(/_/g, '.')}
        </span>
        {isLoading ? (
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
        ) : (
          <span className={`text-[9px] ${isSuccess ? 'text-green-500' : 'text-red-400'}`}>
            {isSuccess ? '✓' : '✗'}
          </span>
        )}
      </button>
      
      {isExpanded && (
        <div className="px-2 pb-2 space-y-2">
          {/* Input */}
          <div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-wide mb-0.5">Input</p>
            <pre className="text-[9px] text-zinc-400 bg-zinc-900/50 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>
          
          {/* Output */}
          {tool.result && (
            <div>
              <p className="text-[8px] text-zinc-600 uppercase tracking-wide mb-0.5">Output</p>
              <pre className={`text-[9px] ${isSuccess ? 'text-zinc-400' : 'text-red-400'} bg-zinc-900/50 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all`}>
                {JSON.stringify(tool.result.data || tool.result.error || tool.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Componente para mostrar thinking expandible (estilo Cursor)
function ThinkingBlock({ thinking, isStreaming }: { thinking: string; isStreaming: boolean }) {
  const [isExpanded, setIsExpanded] = useState(true)
  
  return (
    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-zinc-800/30 transition-colors text-left"
      >
        <svg 
          width="8" 
          height="8" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          className={`text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-[9px] text-zinc-500 flex-1">
          Pensando...
        </span>
        {isStreaming && (
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-2 pb-2">
          <p className="text-[9px] text-zinc-500 italic whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto scrollbar-hidden">
            {thinking}
          </p>
        </div>
      )}
    </div>
  )
}

export default function PlanningChat({ 
  fechasSemana, 
  onJornadaUpdated, 
  selection, 
  onClearSelection,
  selectedEmpleados = [],
  onClearEmpleadoSelection,
  onRemoveEmpleado
}: PlanningChatProps) {
  const { user } = useUser()
  const userEmail = user?.primaryEmailAddress?.emailAddress || ''
  
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentThinking, setCurrentThinking] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Cargar conversación existente del usuario al montar
  useEffect(() => {
    if (!userEmail) return
    
    // Intentar cargar del localStorage primero, sino buscar en el servidor
    const savedConvId = getSavedConversationId(userEmail)
    if (savedConvId) {
      setConversationId(savedConvId)
      loadConversationHistory(savedConvId)
    } else {
      // Buscar última conversación del usuario en el servidor
      loadConversationHistory()
    }
  }, [userEmail])
  
  // Cargar historial de mensajes de una conversación
  const loadConversationHistory = async (convId?: string) => {
    setIsLoadingHistory(true)
    try {
      const url = convId 
        ? `/api/sicamar/chat/history?conversation_id=${convId}`
        : '/api/sicamar/chat/history'
      
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.messages?.length > 0) {
          const loadedMessages: Message[] = data.messages.map((m: { id: string; role: string; content: string; tool_calls?: ToolCall[] }) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            toolCalls: m.tool_calls || []
          }))
          setMessages(loadedMessages)
          
          // Actualizar conversation_id si se devolvió uno
          if (data.conversation_id) {
            setConversationId(data.conversation_id)
            if (userEmail) {
              saveConversationId(userEmail, data.conversation_id)
            }
          }
        }
      }
    } catch (err) {
      console.error('Error loading conversation history:', err)
    } finally {
      setIsLoadingHistory(false)
    }
  }
  
  // Función para iniciar nueva conversación
  const startNewConversation = useCallback(() => {
    if (!userEmail) return
    
    // Reset state
    setMessages([])
    setConversationId(null)
    setErrorMessage(null)
    setInput('')
    
    // Limpiar conversation_id guardado
    clearConversationId(userEmail)
    
    // Focus input
    inputRef.current?.focus()
  }, [userEmail])
  
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  
  useEffect(() => {
    scrollToBottom()
  }, [messages, currentThinking, scrollToBottom])
  
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return
    
    // Construir el mensaje con contexto de empleados seleccionados
    let messageContent = input.trim()
    
    if (selectedEmpleados.length > 0) {
      // Agregar contexto de empleados seleccionados de forma compacta
      const legajos = selectedEmpleados.map(e => e.legajo).join(', ')
      messageContent = `[Empleados seleccionados: legajos ${legajos}]\n\n${messageContent}`
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent
    }
    
    // Para mostrar al usuario, solo mostramos el input sin el contexto
    const displayMessage: Message = {
      ...userMessage,
      content: input.trim()
    }
    
    setMessages(prev => [...prev, displayMessage])
    setInput('')
    setIsLoading(true)
    setCurrentThinking(null)
    setErrorMessage(null)
    
    // Limpiar selección de empleados después de enviar
    if (selectedEmpleados.length > 0) {
      onClearEmpleadoSelection?.()
    }
    
    try {
      const response = await fetch('/api/sicamar/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          context: { 
            fechasSemana,
            seleccion: selection ? {
              legajos: selection.empleados.map(e => e.legajo),
              nombres: selection.empleados.map(e => e.nombre),
              fechas: selection.fechas
            } : null
          },
          conversation_id: conversationId,
          user_email: userEmail,
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = errorData.error || 'Error conectando con el servidor'
        setErrorMessage(errorMsg)
        throw new Error(errorMsg)
      }
      
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')
      
      const decoder = new TextDecoder()
      let assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        thinking: '',
        toolCalls: []
      }
      
      setMessages(prev => [...prev, assistantMessage])
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            
            try {
              const parsed = JSON.parse(data)
              
              if (parsed.type === 'thinking_start') {
                // Iniciar bloque de thinking
                setCurrentThinking('')
              } else if (parsed.type === 'thinking') {
                // Acumular thinking en el mensaje
                assistantMessage = {
                  ...assistantMessage,
                  thinking: (assistantMessage.thinking || '') + (parsed.content || '')
                }
                setMessages(prev => prev.map(m => 
                  m.id === assistantMessage.id ? assistantMessage : m
                ))
                setCurrentThinking(assistantMessage.thinking || '')
              } else if (parsed.type === 'text') {
                assistantMessage = {
                  ...assistantMessage,
                  content: assistantMessage.content + parsed.content
                }
                setMessages(prev => prev.map(m => 
                  m.id === assistantMessage.id ? assistantMessage : m
                ))
                setCurrentThinking(null)
              } else if (parsed.type === 'tool_call') {
                assistantMessage = {
                  ...assistantMessage,
                  toolCalls: [...(assistantMessage.toolCalls || []), {
                    name: parsed.name,
                    input: parsed.input
                  }]
                }
                setMessages(prev => prev.map(m => 
                  m.id === assistantMessage.id ? assistantMessage : m
                ))
                setCurrentThinking(null)
              } else if (parsed.type === 'tool_result') {
                const toolCalls = [...(assistantMessage.toolCalls || [])]
                // Buscar la tool call correspondiente
                const toolIndex = toolCalls.findIndex(t => t.name === parsed.name && !t.result)
                if (toolIndex >= 0) {
                  toolCalls[toolIndex] = { ...toolCalls[toolIndex], result: parsed.result }
                  assistantMessage = { ...assistantMessage, toolCalls }
                  setMessages(prev => prev.map(m => 
                    m.id === assistantMessage.id ? assistantMessage : m
                  ))
                  
                  // Refrescar tabla cuando una herramienta modifica planificación
                  const herramientasQueModifican = [
                    'sicamar_planning_editar',
                    'sicamar_planning_bulk', 
                    'sicamar_planning_limpiar'
                  ]
                  if (herramientasQueModifican.includes(parsed.name) && parsed.result?.success) {
                    onJornadaUpdated?.()
                  }
                }
              } else if (parsed.type === 'conversation_id') {
                // Guardar el ID de conversación para mantener persistencia
                setConversationId(parsed.id)
                if (userEmail) {
                  saveConversationId(userEmail, parsed.id)
                }
              } else if (parsed.type === 'error') {
                setErrorMessage(parsed.message)
              }
            } catch {
              // Ignorar líneas que no son JSON válido
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Chat error:', error)
      if (!errorMessage) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Hubo un error al procesar tu mensaje. Verificá que la API key esté configurada.'
        }])
      }
    } finally {
      setIsLoading(false)
      setCurrentThinking(null)
      // Limpiar selección después de enviar mensaje
      onClearSelection?.()
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
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
              Planificación
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={startNewConversation}
              disabled={isLoading}
              title="Nueva conversación"
              className="p-1.5 rounded hover:bg-zinc-800 transition-colors disabled:opacity-30"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-500 hover:text-zinc-300">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-4 scrollbar-hidden">
        {messages.length === 0 && (
          <div className="py-6">
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Podés preguntarme sobre la planificación o pedirme cambios.
            </p>
            <div className="mt-4 space-y-1.5">
              {[
                '¿Qué tiene legajo 213?',
                'Turno tarde el martes para Juan',
                'Jornadas del lunes al viernes'
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
        )}
        
        {errorMessage && (
          <div className="bg-red-950/30 border border-red-900/30 rounded px-2 py-1.5">
            <p className="text-[10px] text-red-400">{errorMessage}</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`${message.role === 'user' ? 'ml-4' : ''}`}>
            {message.role === 'user' ? (
              <div className="bg-zinc-800 rounded px-2.5 py-1.5">
                <p className="text-[11px] text-zinc-200 whitespace-pre-wrap">{message.content}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Thinking (si existe y está completo) */}
                {message.thinking && !currentThinking && (
                  <ThinkingBlock thinking={message.thinking} isStreaming={false} />
                )}
                
                {/* Tool calls */}
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <div className="bg-zinc-900/50 border border-zinc-800/50 rounded overflow-hidden">
                    {message.toolCalls.map((tool, i) => (
                      <ToolCallItem 
                        key={i} 
                        tool={tool} 
                        isLast={i === message.toolCalls!.length - 1} 
                      />
                    ))}
                  </div>
                )}
                
                {/* Message content */}
                {message.content && (
                  <p className="text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed">{message.content}</p>
                )}
              </div>
            )}
          </div>
        ))}
        
        {/* Thinking en streaming */}
        {currentThinking && (
          <ThinkingBlock thinking={currentThinking} isStreaming={true} />
        )}
        
        {/* Loading indicator */}
        {isLoading && !currentThinking && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
            <span className="text-[9px] text-zinc-500">...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-zinc-800/50">
        <div className="flex items-start gap-1.5">
          {/* Input con badges dentro */}
          <div 
            className={`flex-1 min-h-[28px] bg-zinc-900 border border-zinc-800 rounded px-2 py-1 flex flex-wrap items-center gap-1 cursor-text ${
              isLoading ? 'opacity-50' : ''
            } focus-within:border-zinc-600`}
            onClick={() => inputRef.current?.focus()}
          >
            {/* Badges de empleados seleccionados (desde columna izquierda) */}
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
            
            {/* Chip de selección de celdas (empleados + fechas) */}
            {selection && selection.empleados.length > 0 && (
              <span className="inline-flex items-center gap-1 bg-zinc-800 text-[9px] text-zinc-300 px-1.5 py-0.5 rounded flex-shrink-0">
                <span className="truncate max-w-[100px]">
                  {selection.empleados.length === 1 
                    ? selection.empleados[0].legajo
                    : `${selection.empleados.length}emp`
                  }
                  ·
                  {selection.fechas.length === 1
                    ? new Date(selection.fechas[0] + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                    : `${selection.fechas.length}d`
                  }
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onClearSelection?.() }}
                  className="hover:text-white transition-colors"
                >
                  ×
                </button>
              </span>
            )}
            
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedEmpleados.length > 0 || selection
                  ? "acción..." 
                  : "Escribí algo..."
              }
              disabled={isLoading}
              className="flex-1 min-w-[50px] bg-transparent text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
            />
          </div>
          <button
            onClick={sendMessage}
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
