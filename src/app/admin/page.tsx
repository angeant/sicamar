'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface ToolCall {
  name: string
  input: Record<string, unknown>
  result?: { success?: boolean; data?: unknown; error?: string }
}

interface Conversation {
  id: string
  session_id: string
  created_at: string
  updated_at: string
  last_message_at: string
  message_count: number
  last_user_message?: string
  messages?: Message[]
  user_email?: string
  agent_name?: string
}

const ALLOWED_EMAIL = 'angelo@kalia.app'

// Tool call display component
function ToolCallItem({ tool }: { tool: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isSuccess = tool.result?.success !== false
  
  return (
    <div className="border-b border-zinc-800/50 last:border-b-0">
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
        <span className={`text-[9px] ${isSuccess ? 'text-green-500' : 'text-red-400'}`}>
          {isSuccess ? '✓' : '✗'}
        </span>
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

// Message bubble component
function MessageBubble({ message }: { message: Message & { toolCalls?: ToolCall[] } }) {
  const isUser = message.role === 'user'
  
  return (
    <div className={`${isUser ? 'ml-8' : 'mr-8'}`}>
      {isUser ? (
        <div className="bg-zinc-800 rounded px-3 py-2">
          <p className="text-[11px] text-zinc-200 whitespace-pre-wrap">{message.content}</p>
          <p className="text-[9px] text-zinc-500 mt-1">
            {new Date(message.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded overflow-hidden">
              {message.toolCalls.map((tool, i) => (
                <ToolCallItem key={i} tool={tool} />
              ))}
            </div>
          )}
          {message.content && (
            <div>
              <p className="text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed">{message.content}</p>
              <p className="text-[9px] text-zinc-500 mt-1">
                {new Date(message.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Expanded conversation view
function ConversationDetail({ conversation, onClose }: { conversation: Conversation; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function loadMessages() {
      try {
        const res = await fetch(`/api/sicamar/admin/conversations/${conversation.id}`)
        const data = await res.json()
        if (data.success) {
          setMessages(data.messages || [])
        }
      } catch (error) {
        console.error('Error loading messages:', error)
      } finally {
        setLoading(false)
      }
    }
    loadMessages()
  }, [conversation.id])
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-200 font-medium">
              {conversation.user_email || 'Conversación'}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Agente de Planificación - Web
            </p>
            <p className="text-[9px] text-zinc-600 font-mono mt-0.5">{conversation.session_id || conversation.id}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-[11px] text-zinc-500 text-center py-8">Sin mensajes</p>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
        </div>
        
        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-zinc-800">
          <div className="flex items-center justify-between text-[10px] text-zinc-500">
            <span>
              {messages.length} mensaje{messages.length !== 1 ? 's' : ''}
            </span>
            <span>
              {new Date(conversation.created_at).toLocaleDateString('es-AR', { 
                day: '2-digit', month: '2-digit', year: '2-digit',
                hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const router = useRouter()
  
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'most_messages'>('newest')
  
  const userEmail = user?.primaryEmailAddress?.emailAddress
  const isAuthorized = userEmail === ALLOWED_EMAIL
  
  const loadConversations = useCallback(async () => {
    if (!isAuthorized) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/sicamar/admin/conversations')
      const data = await res.json()
      if (data.success) {
        setConversations(data.conversations || [])
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }, [isAuthorized])
  
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in')
      return
    }
    
    if (isLoaded && isSignedIn && isAuthorized) {
      loadConversations()
    }
  }, [isLoaded, isSignedIn, isAuthorized, router, loadConversations])
  
  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
      </div>
    )
  }
  
  // Not signed in
  if (!isSignedIn) {
    return null
  }
  
  // Not authorized
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-400">Acceso denegado</p>
          <p className="text-[10px] text-zinc-500 mt-1">No tenés permisos para acceder a esta página.</p>
        </div>
      </div>
    )
  }
  
  // Filter and sort conversations
  const filteredConversations = conversations
    .filter(conv => {
      if (!searchTerm) return true
      const search = searchTerm.toLowerCase()
      return (
        conv.session_id?.toLowerCase().includes(search) ||
        conv.id?.toLowerCase().includes(search) ||
        conv.last_user_message?.toLowerCase().includes(search)
      )
    })
    .sort((a, b) => {
      switch (sortOrder) {
        case 'newest':
          return new Date(b.last_message_at || b.created_at).getTime() - new Date(a.last_message_at || a.created_at).getTime()
        case 'oldest':
          return new Date(a.last_message_at || a.created_at).getTime() - new Date(b.last_message_at || b.created_at).getTime()
        case 'most_messages':
          return (b.message_count || 0) - (a.message_count || 0)
        default:
          return 0
      }
    })
  
  const formatRelativeTime = (timestamp: string) => {
    const now = new Date()
    const date = new Date(timestamp)
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffMs / (1000 * 60))

    if (diffDays > 0) return `hace ${diffDays}d`
    if (diffHours > 0) return `hace ${diffHours}h`
    if (diffMinutes > 0) return `hace ${diffMinutes}m`
    return 'ahora'
  }
  
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium text-zinc-600 tracking-widest uppercase">
                Admin
              </p>
              <p className="text-sm text-zinc-200 mt-0.5">
                Agente de Planificación - Web
              </p>
            </div>
            <button
              onClick={loadConversations}
              disabled={loading}
              className="h-7 px-3 text-[10px] text-zinc-400 border border-zinc-800 rounded hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Actualizar'}
            </button>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-3 mt-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por session o mensaje..."
              className="flex-1 h-7 bg-zinc-900 border border-zinc-800 rounded px-2.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
            />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              className="h-7 bg-zinc-900 border border-zinc-800 rounded px-2 text-[11px] text-zinc-200 focus:outline-none focus:border-zinc-600"
            >
              <option value="newest">Más recientes</option>
              <option value="oldest">Más antiguas</option>
              <option value="most_messages">Más mensajes</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        {loading && conversations.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <div className="flex flex-col items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
              <span className="text-[10px] text-zinc-500">Cargando conversaciones...</span>
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <p className="text-[11px] text-zinc-500">
                {searchTerm ? 'No se encontraron conversaciones' : 'Sin conversaciones'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className="w-full text-left bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 hover:bg-zinc-900 hover:border-zinc-700 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {conv.user_email && (
                        <span className="text-[11px] text-zinc-300 truncate">
                          {conv.user_email}
                        </span>
                      )}
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {conv.message_count || 0} msg
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {conv.session_id || conv.id.slice(0, 16)}
                    </p>
                    {conv.last_user_message && (
                      <p className="text-[11px] text-zinc-400 mt-1.5 line-clamp-2">
                        {conv.last_user_message}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[10px] text-zinc-500">
                      {formatRelativeTime(conv.last_message_at || conv.created_at)}
                    </p>
                    <svg 
                      width="12" 
                      height="12" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      className="text-zinc-600 group-hover:text-zinc-400 ml-auto mt-1 transition-colors"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        
        {/* Stats */}
        <div className="mt-6 pt-4 border-t border-zinc-800">
          <p className="text-[10px] text-zinc-600 text-center">
            {filteredConversations.length} conversación{filteredConversations.length !== 1 ? 'es' : ''}
            {searchTerm && ` (filtradas de ${conversations.length})`}
          </p>
        </div>
      </div>
      
      {/* Conversation detail modal */}
      {selectedConversation && (
        <ConversationDetail 
          conversation={selectedConversation} 
          onClose={() => setSelectedConversation(null)} 
        />
      )}
    </div>
  )
}

