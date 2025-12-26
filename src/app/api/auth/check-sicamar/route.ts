import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// Super admins - siempre tienen acceso a todo
const SUPER_ADMIN_EMAILS = [
  'angelo@kalia.app',
  'uguareschi@gmail.com',
]

// Emails con acceso a Sicamar
const SICAMAR_EMAILS = [
  'rreale@sicamar.com.ar',
  'sicamarmetalessa@gmail.com',
]

// IDs de usuarios con acceso a Sicamar (fallback)
const SICAMAR_USER_IDS = [
  '62f9915b-45b9-425e-a28f-045be9575886', // rreale@sicamar.com.ar
  '2b3c7fb8-a31d-4213-9b02-109efbfe02ae', // sicamarmetalessa@gmail.com
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const email = searchParams.get('email')
    
    console.log('[check-sicamar] Checking access for:', { userId, email })
    
    if (!userId) {
      return NextResponse.json({ isMember: false, error: 'userId required' }, { status: 400 })
    }
    
    // Super admins siempre tienen acceso
    if (email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
      return NextResponse.json({ 
        isMember: true, 
        role: 'superadmin',
        source: 'superadmin' 
      })
    }
    
    // Verificar por email primero (más confiable que userId)
    if (email && SICAMAR_EMAILS.includes(email.toLowerCase())) {
      return NextResponse.json({ 
        isMember: true, 
        role: 'member',
        source: 'email' 
      })
    }
    
    // Fallback: verificar contra lista de IDs
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

