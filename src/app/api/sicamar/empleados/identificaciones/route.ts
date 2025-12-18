import { supabaseSicamar } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET: Ver identificaciones actuales
export async function GET() {
  try {
    const { data, error } = await supabaseSicamar
      .from('empleado_identificaciones')
      .select(`
        *,
        empleado:empleados(id, legajo, apellido, nombre)
      `)
      .eq('activo', true)
      .order('empleado_id')
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ 
      data,
      count: data?.length || 0
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: Crear/actualizar identificaciones masivamente
// Recibe: { mapeos: [{empleado_id, id_biometrico}, ...] }
// O: { auto: true } para auto-generar desde marcaciones
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (body.auto) {
      // Auto-generar: obtener IDs únicos de marcaciones y crear registros
      // Primero obtener todos los id_biometrico únicos de marcaciones
      const { data: marcaciones } = await supabaseSicamar
        .from('marcaciones')
        .select('id_biometrico')
      
      const idsUnicos = [...new Set((marcaciones || []).map(m => m.id_biometrico))]
      
      // Obtener empleados
      const { data: empleados } = await supabaseSicamar
        .from('empleados')
        .select('id, legajo')
        .eq('activo', true)
      
      // Crear mapeo legajo -> empleado_id
      const empleadoPorLegajo = new Map<number, number>()
      for (const emp of empleados || []) {
        empleadoPorLegajo.set(emp.legajo, emp.id)
      }
      
      // Ver si algún id_biometrico contiene un legajo
      // Los IDs biométricos tienen formato como 27711466
      // Intento extraer últimos 3 dígitos por si son legajos
      const mapeos: { empleado_id: number; id_biometrico: string }[] = []
      
      for (const idBio of idsUnicos) {
        // Intento 1: últimos 3 dígitos
        const ultimos3 = parseInt(idBio.slice(-3))
        if (empleadoPorLegajo.has(ultimos3)) {
          mapeos.push({
            empleado_id: empleadoPorLegajo.get(ultimos3)!,
            id_biometrico: idBio
          })
          continue
        }
        
        // Intento 2: el id_biometrico completo como número
        const idNum = parseInt(idBio)
        if (empleadoPorLegajo.has(idNum)) {
          mapeos.push({
            empleado_id: empleadoPorLegajo.get(idNum)!,
            id_biometrico: idBio
          })
        }
      }
      
      return NextResponse.json({
        message: 'Auto-mapeo (preview)',
        idsUnicos: idsUnicos.length,
        empleados: empleados?.length,
        mapeosEncontrados: mapeos.length,
        mapeos: mapeos.slice(0, 10),
        sinMapear: idsUnicos.filter(id => !mapeos.find(m => m.id_biometrico === id)).slice(0, 10)
      })
    }
    
    if (body.mapeos && Array.isArray(body.mapeos)) {
      // Insertar mapeos manuales
      const registros = body.mapeos.map((m: { empleado_id: number; id_biometrico: string }) => ({
        empleado_id: m.empleado_id,
        id_biometrico: m.id_biometrico,
        activo: true
      }))
      
      const { data, error } = await supabaseSicamar
        .from('empleado_identificaciones')
        .upsert(registros, { onConflict: 'id_biometrico' })
        .select()
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({ success: true, count: data?.length })
    }
    
    return NextResponse.json({ error: 'Se requiere mapeos o auto' }, { status: 400 })
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


