'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  toolCalls?: Array<{
    name: string
    input: Record<string, unknown>
    result?: unknown
  }>
}

interface PlanningChatProps {
  fechasSemana?: string[]
  onJornadaUpdated?: () => void
}

export default function PlanningChat({ fechasSemana, onJornadaUpdated }: PlanningChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentThinking, setCurrentThinking] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])
  
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setCurrentThinking(null)
    setErrorMessage(null)
    
    try {
      const response = await fetch('/api/sicamar/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          context: { fechasSemana }
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
              
              if (parsed.type === 'thinking') {
                setCurrentThinking(parsed.content)
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
              } else if (parsed.type === 'tool_result') {
                const toolCalls = assistantMessage.toolCalls || []
                const lastCall = toolCalls[toolCalls.length - 1]
                if (lastCall) {
                  lastCall.result = parsed.result
                  assistantMessage = { ...assistantMessage, toolCalls: [...toolCalls] }
                  setMessages(prev => prev.map(m => 
                    m.id === assistantMessage.id ? assistantMessage : m
                  ))
                  
                  if (parsed.name === 'sicamar_jornadas_editar' && parsed.result?.success) {
                    onJornadaUpdated?.()
                  }
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
        <p className="text-[10px] font-medium text-zinc-600 tracking-widest uppercase">
          Asistente
        </p>
        <p className="text-xs text-zinc-400 mt-0.5">
          Planificación
        </p>
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
              <div className="space-y-1.5">
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <div className="space-y-1">
                    {message.toolCalls.map((tool, i) => (
                      <div key={i} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-[#C4322F]/60" />
                          <span className="text-[9px] text-zinc-500 font-mono">
                            {tool.name.replace('sicamar_', '').replace('_', '.')}
                          </span>
                          {tool.result !== undefined && (
                            <span className={`text-[9px] ${(tool.result as { success?: boolean })?.success ? 'text-green-500' : 'text-red-400'}`}>
                              {(tool.result as { success?: boolean })?.success ? '✓' : '✗'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {message.content && (
                  <p className="text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed">{message.content}</p>
                )}
              </div>
            )}
          </div>
        ))}
        
        {currentThinking && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-zinc-500 animate-pulse" />
              <span className="text-[9px] text-zinc-500">Pensando...</span>
            </div>
          </div>
        )}
        
        {isLoading && !currentThinking && (
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-zinc-500 animate-pulse" />
            <span className="text-[9px] text-zinc-500">...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-zinc-800/50">
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí algo..."
            disabled={isLoading}
            className="flex-1 h-7 bg-zinc-900 border border-zinc-800 rounded px-2.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="h-7 w-7 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 rounded flex items-center justify-center transition-colors"
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
