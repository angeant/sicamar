import { supabaseSicamar } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET: Obtener marcaciones de un empleado en un rango de fechas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const empleadoId = searchParams.get('empleado_id')
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')
    
    if (!empleadoId) {
      return NextResponse.json({ error: 'Se requiere empleado_id' }, { status: 400 })
    }
    
    // Obtener el ID biométrico del empleado
    const { data: identificaciones } = await supabaseSicamar
      .from('empleado_identificaciones')
      .select('id_biometrico')
      .eq('empleado_id', parseInt(empleadoId))
      .eq('activo', true)
    
    if (!identificaciones || identificaciones.length === 0) {
      return NextResponse.json({ 
        success: true, 
        marcaciones: [],
        mensaje: 'Empleado sin ID biométrico asociado'
      })
    }
    
    const idsBiometricos = identificaciones.map(i => i.id_biometrico)
    
    // Calcular rango de fechas en UTC
    // desde y hasta vienen como YYYY-MM-DD en hora Argentina
    // Convertir a UTC para la query
    const desdeUTC = desde ? `${desde}T03:00:00Z` : undefined // 00:00 Argentina = 03:00 UTC
    const hastaUTC = hasta ? `${hasta}T26:59:59Z` : undefined // 23:59 Argentina = 26:59 UTC (o sea 02:59 del día siguiente)
    
    // Buscar marcaciones
    let query = supabaseSicamar
      .from('marcaciones')
      .select('id_biometrico, tipo, fecha_hora')
      .in('id_biometrico', idsBiometricos)
      .order('fecha_hora', { ascending: true })
    
    if (desdeUTC) {
      query = query.gte('fecha_hora', desdeUTC)
    }
    if (hastaUTC) {
      // Para "hasta", usar el final del día siguiente para capturar turnos noche
      const hastaDate = new Date(hasta + 'T12:00:00Z')
      hastaDate.setDate(hastaDate.getDate() + 1)
      const hastaExtendidoUTC = hastaDate.toISOString().split('T')[0] + 'T06:00:00Z'
      query = query.lte('fecha_hora', hastaExtendidoUTC)
    }
    
    const { data: marcaciones, error } = await query
    
    if (error) {
      console.error('Error fetching marcaciones:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      empleado_id: parseInt(empleadoId),
      ids_biometricos: idsBiometricos,
      marcaciones: marcaciones || [],
      total: marcaciones?.length || 0
    })
    
  } catch (error: unknown) {
    console.error('Error in marcaciones/empleado:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}



