import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { currentUser } from '@clerk/nextjs/server'

const ALLOWED_EMAIL = 'angelo@kalia.app'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    
    const { id } = await params
    
    // Get all messages for this conversation from sicamar schema
    const { data: messages, error: messagesError } = await supabaseServer
      .schema('sicamar')
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
    
    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return NextResponse.json(
        { success: false, error: 'Error fetching messages', details: messagesError.message },
        { status: 500 }
      )
    }
    
    // Transform messages - handle different schema versions
    const transformedMessages = (messages || []).map(msg => {
      // Try to extract tool calls from various possible column names
      const rawToolCalls = msg.tool_calls || msg.tools || msg.function_calls
      const rawToolResults = msg.tool_results || msg.tools_results || msg.function_results
      
      let toolCalls
      if (rawToolCalls) {
        const toolCallsArray = Array.isArray(rawToolCalls) ? rawToolCalls : [rawToolCalls]
        toolCalls = toolCallsArray.map((tc: { name?: string; input?: Record<string, unknown>; arguments?: Record<string, unknown> }) => ({
          name: tc.name || 'unknown',
          input: tc.input || tc.arguments || {},
          result: rawToolResults?.find?.((tr: { name?: string }) => tr.name === tc.name) || null
        }))
      }
      
      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
        toolCalls
      }
    })
    
    return NextResponse.json({
      success: true,
      messages: transformedMessages
    })
    
  } catch (error) {
    console.error('Admin conversation detail error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

