import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// IDs de usuarios con acceso a Sicamar (hardcoded para ahora)
const SICAMAR_USER_IDS = [
  '62f9915b-45b9-425e-a28f-045be9575886', // rreale@sicamar.com.ar
  '2b3c7fb8-a31d-4213-9b02-109efbfe02ae', // sicamarmetalessa@gmail.com
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({ isMember: false, error: 'userId required' }, { status: 400 })
    }
    
    // Por ahora, verificar contra lista hardcoded
    // TODO: Migrar a tabla user_organizations cuando esté creada
    const isMember = SICAMAR_USER_IDS.includes(userId)
    
    // También intentar verificar en la base de datos
    try {
      const { data: membership } = await supabaseServer
        .from('user_organizations')
        .select('id, role')
        .eq('user_id', userId)
        .eq('organization_slug', 'sicamar')
        .single()
      
      if (membership) {
        return NextResponse.json({ 
          isMember: true, 
          role: membership.role,
          source: 'database' 
        })
      }
    } catch {
      // Tabla no existe o no hay registro, usar fallback
    }
    
    return NextResponse.json({ 
      isMember, 
      source: 'hardcoded' 
    })
    
  } catch (error) {
    console.error('Error checking Sicamar membership:', error)
    return NextResponse.json({ isMember: false, error: 'Internal error' }, { status: 500 })
  }
}

