import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { currentUser } from '@clerk/nextjs/server'

const ALLOWED_EMAIL = 'angelo@kalia.app'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Auth check
    const user = await currentUser()
    const userEmail = user?.primaryEmailAddress?.emailAddress
    
    if (!user || userEmail !== ALLOWED_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }
    
    // Obtener mensajes de la conversación con tool_calls
    const { data: messages, error } = await supabaseServer
      .schema('sicamar')
      .from('messages')
      .select('id, role, content, created_at, tool_calls, metadata')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json(
        { success: false, error: 'Error fetching messages', details: error.message },
        { status: 500 }
      )
    }
    
    // Formatear mensajes para incluir toolCalls en el formato esperado
    const formattedMessages = (messages || []).map(msg => {
      // Parsear tool_calls si existe
      let toolCalls = null
      if (msg.tool_calls) {
        try {
          // tool_calls puede ser un array de objetos con { name, input, result }
          toolCalls = Array.isArray(msg.tool_calls) 
            ? msg.tool_calls.map((tc: { name: string; input: Record<string, unknown>; result?: string }) => ({
                name: tc.name,
                input: tc.input,
                result: typeof tc.result === 'string' 
                  ? { data: tc.result, success: !tc.result.includes('Error') }
                  : tc.result
              }))
            : null
        } catch {
          console.log('Could not parse tool_calls:', msg.tool_calls)
        }
      }
      
      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
        toolCalls: toolCalls,
        metadata: msg.metadata
      }
    })
    
    return NextResponse.json({
      success: true,
      conversation_id: id,
      messages: formattedMessages,
      total: formattedMessages.length
    })
    
  } catch (error) {
    console.error('Admin conversation detail error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
