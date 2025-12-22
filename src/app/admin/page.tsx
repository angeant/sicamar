'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

interface MessageMetadata {
  request_payload?: {
    model: string
    messages_count: number
    messages_preview: Array<{ role: string; content_length: number }>
    tools_count: number
    system_prompt_length: number
    timestamp?: string
  }
  response_info?: {
    stop_reason: string | null
    tool_calls_count: number
    text_length: number
  }
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  metadata?: MessageMetadata | null
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
  agent_name: string
}

// Agentes disponibles
const AGENTS = [
  { key: 'all', label: 'Todos', filter: null },
  { key: 'planificacion', label: 'Planificación', filter: 'Agente de Planificación - Web' },
  { key: 'rotaciones', label: 'Turnos y Rotaciones', filter: 'Agente de Rotaciones - Web' },
]

interface UserGroup {
  email: string
  conversations: Conversation[]
  totalMessages: number
  lastActive: string
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

// Debug payload display
function DebugPayload({ metadata }: { metadata: MessageMetadata }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const req = metadata.request_payload
  const res = metadata.response_info
  
  if (!req && !res) return null
  
  return (
    <div className="mt-2 border border-amber-900/30 rounded overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1 bg-amber-950/20 hover:bg-amber-950/30 transition-colors text-left"
      >
        <svg 
          width="8" 
          height="8" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          className={`text-amber-500/70 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-[9px] text-amber-500/70 font-mono flex-1">DEBUG</span>
        {req && (
          <span className="text-[8px] text-amber-600/60">
            {req.messages_count} msgs · {req.tools_count} tools
          </span>
        )}
      </button>
      
      {isExpanded && (
        <div className="px-2 py-2 space-y-2 bg-amber-950/10">
          {/* Request Payload */}
          {req && (
            <div>
              <p className="text-[8px] text-amber-600/80 uppercase tracking-wide mb-1 font-medium">
                Request Payload
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Model:</span>
                  <span className="text-amber-400/80 font-mono">{req.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tools:</span>
                  <span className="text-amber-400/80 font-mono">{req.tools_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Messages:</span>
                  <span className="text-amber-400/80 font-mono">{req.messages_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">System Prompt:</span>
                  <span className="text-amber-400/80 font-mono">{req.system_prompt_length} chars</span>
                </div>
              </div>
              
              {/* Messages preview */}
              {req.messages_preview && req.messages_preview.length > 0 && (
                <div className="mt-2">
                  <p className="text-[8px] text-zinc-600 mb-1">Mensajes enviados:</p>
                  <div className="flex flex-wrap gap-1">
                    {req.messages_preview.map((m, i) => (
                      <span 
                        key={i}
                        className={`text-[8px] px-1 py-0.5 rounded font-mono ${
                          m.role === 'user' 
                            ? 'bg-zinc-800 text-zinc-400' 
                            : 'bg-zinc-700 text-zinc-300'
                        }`}
                      >
                        {m.role === 'user' ? 'U' : 'A'}:{m.content_length}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Response Info */}
          {res && (
            <div className="pt-2 border-t border-amber-900/20">
              <p className="text-[8px] text-amber-600/80 uppercase tracking-wide mb-1 font-medium">
                Response Info
              </p>
              <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[9px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Stop:</span>
                  <span className={`font-mono ${
                    res.stop_reason === 'tool_use' ? 'text-blue-400' : 
                    res.stop_reason === 'end_turn' ? 'text-green-400' : 'text-zinc-400'
                  }`}>
                    {res.stop_reason || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tools:</span>
                  <span className="text-amber-400/80 font-mono">{res.tool_calls_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Text:</span>
                  <span className="text-amber-400/80 font-mono">{res.text_length} chars</span>
                </div>
              </div>
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
          {/* Debug payload para mensajes del assistant */}
          {message.metadata && (
            <DebugPayload metadata={message.metadata} />
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
              {conversation.agent_name || 'Agente desconocido'}
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
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string>('all')
  
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
  
  // Agrupar conversaciones por usuario (filtrando por agente)
  const userGroups = useMemo(() => {
    const groups = new Map<string, Conversation[]>()
    
    // Aplicar filtro de agente
    const agentFilter = AGENTS.find(a => a.key === selectedAgent)?.filter
    const filteredConvs = agentFilter 
      ? conversations.filter(c => c.agent_name === agentFilter)
      : conversations
    
    filteredConvs.forEach(conv => {
      // Inferir email del session_id si user_email está vacío
      const email = conv.user_email || 
        (conv.session_id?.includes('@') ? conv.session_id : null) ||
        'anónimo'
      
      if (!groups.has(email)) {
        groups.set(email, [])
      }
      groups.get(email)!.push(conv)
    })
    
    // Convertir a array de UserGroup
    const result: UserGroup[] = Array.from(groups.entries()).map(([email, convs]) => ({
      email,
      conversations: convs.sort((a, b) => 
        new Date(b.last_message_at || b.created_at).getTime() - 
        new Date(a.last_message_at || a.created_at).getTime()
      ),
      totalMessages: convs.reduce((sum, c) => sum + (c.message_count || 0), 0),
      lastActive: convs.reduce((latest, c) => {
        const t = c.last_message_at || c.created_at
        return t > latest ? t : latest
      }, '1970-01-01')
    }))
    
    // Ordenar grupos por última actividad
    return result.sort((a, b) => 
      new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    )
  }, [conversations, selectedAgent])
  
  // Filter groups
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return userGroups
    
    const search = searchTerm.toLowerCase()
    return userGroups
      .map(group => ({
        ...group,
        conversations: group.conversations.filter(conv =>
          conv.user_email?.toLowerCase().includes(search) ||
          conv.session_id?.toLowerCase().includes(search) ||
          conv.last_user_message?.toLowerCase().includes(search)
        )
      }))
      .filter(group => 
        group.email.toLowerCase().includes(search) ||
        group.conversations.length > 0
      )
  }, [userGroups, searchTerm])
  
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in')
      return
    }
    
    if (isLoaded && isSignedIn && isAuthorized) {
      loadConversations()
    }
  }, [isLoaded, isSignedIn, isAuthorized, router, loadConversations])
  
  // Early returns AFTER all hooks
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
      </div>
    )
  }
  
  if (!isSignedIn) {
    return null
  }
  
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
                Conversaciones de Agentes
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
          
          {/* Agent tabs */}
          <div className="flex items-center gap-1 mt-4">
            {AGENTS.map(agent => (
              <button
                key={agent.key}
                onClick={() => setSelectedAgent(agent.key)}
                className={`h-7 px-3 text-[10px] rounded transition-colors ${
                  selectedAgent === agent.key 
                    ? 'bg-zinc-700 text-zinc-200' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {agent.label}
              </button>
            ))}
          </div>
          
          {/* Search */}
          <div className="flex items-center gap-3 mt-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por email o mensaje..."
              className="flex-1 h-7 bg-zinc-900 border border-zinc-800 rounded px-2.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
            />
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
        ) : filteredGroups.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <p className="text-[11px] text-zinc-500">
                {searchTerm ? 'No se encontraron conversaciones' : 'Sin conversaciones'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map((group) => (
              <div key={group.email} className="border border-zinc-800/50 rounded-lg overflow-hidden">
                {/* User header - clickeable para expandir */}
                <button
                  onClick={() => setExpandedUser(expandedUser === group.email ? null : group.email)}
                  className="w-full text-left bg-zinc-900/80 hover:bg-zinc-900 px-4 py-3 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[11px] text-zinc-400 font-medium uppercase">
                      {group.email === 'anónimo' ? '?' : group.email.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[12px] text-zinc-200 font-medium">
                        {group.email}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {group.conversations.length} conversación{group.conversations.length !== 1 ? 'es' : ''} · {group.totalMessages} mensajes
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500">
                      {formatRelativeTime(group.lastActive)}
                    </span>
                    <svg 
                      width="12" 
                      height="12" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      className={`text-zinc-500 transition-transform ${expandedUser === group.email ? 'rotate-180' : ''}`}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </button>
                
                {/* Conversaciones del usuario */}
                {expandedUser === group.email && (
                  <div className="border-t border-zinc-800/50 divide-y divide-zinc-800/30">
                    {group.conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv)}
                        className="w-full text-left px-4 py-2.5 hover:bg-zinc-800/30 transition-colors group flex items-center justify-between"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                              {conv.message_count || 0} msg
                            </span>
                            <span className="text-[9px] text-zinc-600 font-mono">
                              {conv.id.slice(0, 8)}...
                            </span>
                          </div>
                          {conv.last_user_message && (
                            <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
                              {conv.last_user_message}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-zinc-600">
                            {formatRelativeTime(conv.last_message_at || conv.created_at)}
                          </span>
                          <svg 
                            width="10" 
                            height="10" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2"
                            className="text-zinc-700 group-hover:text-zinc-400 transition-colors"
                          >
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Stats */}
        <div className="mt-6 pt-4 border-t border-zinc-800">
          <p className="text-[10px] text-zinc-600 text-center">
            {filteredGroups.length} usuario{filteredGroups.length !== 1 ? 's' : ''} · {conversations.length} conversación{conversations.length !== 1 ? 'es' : ''}
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

