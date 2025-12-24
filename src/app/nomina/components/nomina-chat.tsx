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
  toolCalls?: ToolCall[]
}

interface EmpleadoSeleccionado {
  id: number
  legajo: string
  nombre: string
}

// Helper para obtener el conversation_id guardado del usuario
function getSavedConversationId(email: string): string | null {
  if (typeof window === 'undefined') return null
  const key = `sicamar_nomina_conversation_${email}`
  return localStorage.getItem(key)
}

// Guardar conversation_id del usuario
function saveConversationId(email: string, conversationId: string): void {
  if (typeof window === 'undefined') return
  const key = `sicamar_nomina_conversation_${email}`
  localStorage.setItem(key, conversationId)
}

// Limpiar conversation_id (para nueva conversación)
function clearConversationId(email: string): void {
  if (typeof window === 'undefined') return
  const key = `sicamar_nomina_conversation_${email}`
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
          <div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-wide mb-0.5">Input</p>
            <pre className="text-[9px] text-zinc-400 bg-zinc-900/50 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>
          
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

interface NominaChatProps {
  onEmpleadoUpdated?: () => void
  selectedEmpleados?: EmpleadoSeleccionado[]
  onClearEmpleadoSelection?: () => void
  onRemoveEmpleado?: (id: number) => void
}

export default function NominaChat({ 
  onEmpleadoUpdated,
  selectedEmpleados = [],
  onClearEmpleadoSelection,
  onRemoveEmpleado
}: NominaChatProps) {
  const { user } = useUser()
  const userEmail = user?.primaryEmailAddress?.emailAddress || ''
  
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [attachedImage, setAttachedImage] = useState<{ base64: string; type: string; preview: string } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  
  // Cargar conversación existente del usuario al montar
  useEffect(() => {
    if (!userEmail) return
    
    const savedConvId = getSavedConversationId(userEmail)
    if (savedConvId) {
      setConversationId(savedConvId)
      loadConversationHistory(savedConvId)
    } else {
      loadConversationHistory()
    }
  }, [userEmail])
  
  // Cargar historial de mensajes de una conversación
  const loadConversationHistory = async (convId?: string) => {
    setIsLoadingHistory(true)
    try {
      const url = convId 
        ? `/api/sicamar/chat-nomina/history?conversation_id=${convId}`
        : '/api/sicamar/chat-nomina/history'
      
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
    
    setMessages([])
    setConversationId(null)
    setErrorMessage(null)
    setInput('')
    
    clearConversationId(userEmail)
    inputRef.current?.focus()
  }, [userEmail])
  
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])
  
  const sendMessage = async () => {
    if ((!input.trim() && !attachedImage) || isLoading) return
    
    // Construir mensaje con contexto de empleados seleccionados
    let messageContent = input.trim()
    
    if (selectedEmpleados.length > 0) {
      const legajos = selectedEmpleados.map(e => e.legajo).join(', ')
      messageContent = `[Empleados seleccionados: legajos ${legajos}]\n\n${messageContent}`
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent || '(imagen adjunta)'
    }
    
    // Para mostrar al usuario, solo el input sin el contexto
    const displayMessage: Message = {
      ...userMessage,
      content: input.trim() || '(imagen adjunta)'
    }
    
    // Guardar referencia a la imagen antes de limpiar
    const imageToSend = attachedImage
    
    setMessages(prev => [...prev, displayMessage])
    setInput('')
    setAttachedImage(null)
    setIsLoading(true)
    setErrorMessage(null)
    
    // Limpiar selección después de enviar
    if (selectedEmpleados.length > 0) {
      onClearEmpleadoSelection?.()
    }
    
    try {
      const response = await fetch('/api/sicamar/chat-nomina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent || '(imagen adjunta)',
          conversation_id: conversationId,
          image: imageToSend ? {
            base64: imageToSend.base64,
            media_type: imageToSend.type
          } : undefined
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response || ''
        }
        setMessages(prev => [...prev, assistantMessage])
        
        if (data.conversation_id) {
          setConversationId(data.conversation_id)
          if (userEmail) {
            saveConversationId(userEmail, data.conversation_id)
          }
        }
        
        // Notificar que hubo cambios
        onEmpleadoUpdated?.()
      } else {
        setErrorMessage(data.error || 'Error procesando mensaje')
      }
    } catch (err) {
      console.error('Error sending message:', err)
      setErrorMessage('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }
  
  // Handle image file
  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64Full = e.target?.result as string
      const base64 = base64Full.split(',')[1]
      const mediaType = file.type
      
      setAttachedImage({
        base64,
        type: mediaType,
        preview: base64Full
      })
    }
    reader.readAsDataURL(file)
  }, [])
  
  // Drag & drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }, [])
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleImageFile(files[0])
    }
  }, [handleImageFile])
  
  const removeAttachedImage = useCallback(() => {
    setAttachedImage(null)
  }, [])
  
  return (
    <div 
      ref={dropZoneRef}
      className={`w-72 flex-shrink-0 bg-zinc-950 border-l border-zinc-800/50 flex flex-col h-screen relative ${
        isDragging ? 'ring-2 ring-inset ring-[#C4322F]/50' : ''
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-zinc-950/80 z-50 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#C4322F] mx-auto mb-2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <p className="text-[11px] text-zinc-400">Soltá la imagen</p>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium text-zinc-600 tracking-widest uppercase">
              Asistente
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Nómina
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
        {isLoadingHistory && (
          <div className="flex items-center justify-center py-8">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
          </div>
        )}
        
        {!isLoadingHistory && messages.length === 0 && (
          <div className="py-6">
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Bajas, cambios de condición.
            </p>
            <div className="mt-4 space-y-1.5">
              {[
                'Cambiar a efectivo',
                'Dar de baja',
                'Ver empleados a prueba'
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
                <p className="text-[13px] text-zinc-200 whitespace-pre-wrap">{message.content}</p>
              </div>
            ) : (
              <div className="space-y-2">
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
                  <p className="text-[13px] text-zinc-300 whitespace-pre-wrap leading-relaxed">{message.content}</p>
                )}
              </div>
            )}
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
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
          <div 
            className={`flex-1 min-h-[28px] bg-zinc-900 border border-zinc-800 rounded px-2 py-1 flex flex-wrap items-center gap-1 cursor-text ${
              isLoading ? 'opacity-50' : ''
            } focus-within:border-zinc-600`}
            onClick={() => inputRef.current?.focus()}
          >
            {/* Thumbnail de imagen adjunta */}
            {attachedImage && (
              <div className="relative flex-shrink-0 group">
                <img 
                  src={attachedImage.preview} 
                  alt="Adjunto" 
                  className="h-6 w-6 object-cover rounded"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); removeAttachedImage() }}
                  className="absolute -top-1 -right-1 w-3 h-3 bg-zinc-700 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <span className="text-[8px] text-white leading-none">×</span>
                </button>
              </div>
            )}
            
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
              placeholder={selectedEmpleados.length > 0 ? "acción..." : "Escribí algo..."}
              disabled={isLoading}
              className="flex-1 min-w-[50px] bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={isLoading || (!input.trim() && !attachedImage)}
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
