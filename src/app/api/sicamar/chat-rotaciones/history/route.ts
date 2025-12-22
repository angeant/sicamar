import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { currentUser } from '@clerk/nextjs/server'

const AGENT_NAME = 'Agente de Rotaciones - Web'

export async function GET(request: NextRequest) {
  try {
    // Obtener el usuario actual desde Clerk
    const user = await currentUser()
    const userEmail = user?.primaryEmailAddress?.emailAddress
    
    if (!userEmail) {
      return NextResponse.json({ success: true, messages: [], conversation_id: null })
    }
    
    const searchParams = request.nextUrl.searchParams
    const conversationId = searchParams.get('conversation_id')
    
    let query = supabaseServer
      .schema('sicamar')
      .from('conversations')
      .select(`
        id,
        session_id,
        user_email,
        agent_name,
        created_at,
        messages (
          id,
          role,
          content,
          tool_calls,
          created_at
        )
      `)
      .eq('agent_name', AGENT_NAME)
      .eq('user_email', userEmail)  // ✅ FILTRAR POR EMAIL DEL USUARIO
      .order('last_message_at', { ascending: false })
      .limit(1)
    
    // Si piden una conversación específica, verificar que sea del usuario
    if (conversationId) {
      query = query.eq('id', conversationId)
    }
    
    const { data: conversations, error } = await query
    
    if (error) {
      console.error('Error fetching conversation history:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    
    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ success: true, messages: [], conversation_id: null })
    }
    
    const conversation = conversations[0]
    const messages = (conversation.messages as Array<{
      id: string
      role: string
      content: string
      tool_calls: unknown
      created_at: string
    }> || []).sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    
    return NextResponse.json({ 
      success: true, 
      messages,
      conversation_id: conversation.id
    })
    
  } catch (error) {
    console.error('Error in conversation history API:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}


