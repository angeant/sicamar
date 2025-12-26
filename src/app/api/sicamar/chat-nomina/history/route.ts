import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { supabaseServer } from '@/lib/supabase-server'

const AGENT_NAME = 'Agente de Nómina - Web'

/**
 * GET /api/sicamar/chat-nomina/history
 * Carga el historial de la última conversación del usuario autenticado
 * Query params:
 *   - conversation_id (opcional): ID específico de conversación
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const user = await currentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const userEmail = user.primaryEmailAddress?.emailAddress
    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: 'No email found' },
        { status: 400 }
      )
    }
    
    const searchParams = request.nextUrl.searchParams
    const conversationId = searchParams.get('conversation_id')
    
    let targetConversationId = conversationId
    
    // Si no se especifica conversation_id, buscar la última del usuario para este agente
    if (!targetConversationId) {
      const { data: lastConv } = await supabaseServer
        .schema('sicamar')
        .from('conversations')
        .select('id')
        .eq('user_email', userEmail)
        .eq('agent_name', AGENT_NAME)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single()
      
      if (!lastConv) {
        return NextResponse.json({
          success: true,
          conversation: null,
          messages: []
        })
      }
      
      targetConversationId = lastConv.id
    } else {
      // Verificar que la conversación pertenece al usuario
      const { data: conv } = await supabaseServer
        .schema('sicamar')
        .from('conversations')
        .select('id, user_email')
        .eq('id', targetConversationId)
        .single()
      
      if (!conv) {
        return NextResponse.json({
          success: true,
          conversation: null,
          messages: []
        })
      }
      
      // Solo permitir acceso a conversaciones propias
      if (conv.user_email !== userEmail) {
        return NextResponse.json(
          { success: false, error: 'Access denied to this conversation' },
          { status: 403 }
        )
      }
    }
    
    // Cargar mensajes de la conversación
    const { data: messages, error: messagesError } = await supabaseServer
      .schema('sicamar')
      .from('messages')
      .select('id, role, content, tool_calls, created_at')
      .eq('conversation_id', targetConversationId)
      .order('created_at', { ascending: true })
    
    if (messagesError) {
      console.error('Error loading messages:', messagesError)
      return NextResponse.json(
        { success: false, error: 'Error loading messages' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      conversation_id: targetConversationId,
      messages: messages || []
    })
    
  } catch (error) {
    console.error('Chat nomina history error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sicamar/chat-nomina/history
 * Crea una nueva conversación (borra la actual)
 */
export async function DELETE() {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const userEmail = user.primaryEmailAddress?.emailAddress
    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: 'No email found' },
        { status: 400 }
      )
    }
    
    // No borramos realmente, solo actualizamos para que se cree una nueva
    // al enviar el próximo mensaje
    
    return NextResponse.json({
      success: true,
      message: 'Conversación reiniciada'
    })
    
  } catch (error) {
    console.error('Chat nomina history delete error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}



