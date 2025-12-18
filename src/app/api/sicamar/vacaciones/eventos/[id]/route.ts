import { supabaseServer } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { estado, aprobado_por, rechazado_por, motivo_rechazo } = body

    const { data, error } = await supabaseServer.rpc('update_evento_vacaciones_sicamar', {
      p_id: parseInt(id),
      p_estado: estado,
      p_aprobado_por: aprobado_por || null,
      p_rechazado_por: rechazado_por || null,
      p_motivo_rechazo: motivo_rechazo || null
    })

    if (error) {
      console.error('Error updating evento:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ evento: data })
  } catch (error: any) {
    console.error('Error in PATCH evento:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabaseServer.rpc('delete_evento_sicamar', {
      p_id: parseInt(id)
    })

    if (error) {
      console.error('Error deleting evento:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE evento:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
