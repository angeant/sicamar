import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { currentUser } from '@clerk/nextjs/server'

const ALLOWED_EMAIL = 'angelo@kalia.app'

export async function GET() {
  try {
    // Auth check
    const user = await currentUser()
    const userEmail = user?.primaryEmailAddress?.emailAddress
    
    if (!user || userEmail !== ALLOWED_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }
    
    // Query conversations from sicamar schema
    const { data: conversations, error: conversationsError } = await supabaseServer
      .schema('sicamar')
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(100)
    
    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError)
      return NextResponse.json(
        { success: false, error: 'Error fetching conversations', details: conversationsError.message },
        { status: 500 }
      )
    }
    
    // For each conversation, get message count and last user message
    const conversationsWithStats = await Promise.all(
      (conversations || []).map(async (conv) => {
        // Get message count
        const { count } = await supabaseServer
          .schema('sicamar')
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
        
        // Get last user message
        const { data: lastUserMsg } = await supabaseServer
          .schema('sicamar')
          .from('messages')
          .select('content')
          .eq('conversation_id', conv.id)
          .eq('role', 'user')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        return {
          id: conv.id,
          session_id: conv.session_id || conv.id.slice(0, 16),
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          last_message_at: conv.last_message_at || conv.updated_at,
          message_count: count || 0,
          last_user_message: lastUserMsg?.content || null,
          user_email: conv.user_email || null,
          agent_name: 'Agente de Planificación - Web'
        }
      })
    )
    
    // Filter out conversations with no messages (probably test/empty)
    const filteredConversations = conversationsWithStats.filter(c => c.message_count > 0)
    
    return NextResponse.json({
      success: true,
      conversations: filteredConversations,
      total: filteredConversations.length
    })
    
  } catch (error) {
    console.error('Admin conversations error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

