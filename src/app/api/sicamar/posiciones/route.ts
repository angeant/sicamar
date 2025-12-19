import { supabaseSicamar } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET: Obtener nómina con posiciones desde la vista v_nomina_posiciones
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const soloActivos = searchParams.get('activos') !== 'false'
    
    // Obtener datos de la vista
    const { data: posiciones, error: viewError } = await supabaseSicamar
      .from('v_nomina_posiciones')
      .select('*')
      .order('nombre_completo')

    if (viewError) {
      // Si la vista no existe, hacemos el query manualmente
      if (viewError.message.includes('does not exist')) {
        const fallbackQuery = supabaseSicamar
          .from('empleados')
          .select(`
            id,
            legajo,
            nombre,
            apellido,
            categoria,
            sector,
            cargo,
            activo,
            foto_url,
            foto_thumb_url
          `)
        
        if (soloActivos) {
          fallbackQuery.eq('activo', true)
        }
        
        const { data: empleados, error: empError } = await fallbackQuery
          .order('apellido')
          .order('nombre')
        
        if (empError) {
          console.error('Error fetching empleados fallback:', empError)
          return NextResponse.json({ error: empError.message }, { status: 500 })
        }
        
        // Mapear a formato esperado
        const mappedData = (empleados || []).map(emp => ({
          empleado_id: emp.id,
          legajo: emp.legajo,
          nombre_completo: `${emp.apellido}, ${emp.nombre}`,
          categoria: emp.categoria,
          sector: emp.sector,
          cargo: emp.cargo,
          activo: emp.activo,
          foto_url: emp.foto_url,
          foto_thumb_url: emp.foto_thumb_url,
          posicion_id: null,
          posicion_codigo: null,
          posicion_nombre: null,
          planta: null,
          rotation_type: null,
          is_locked: false,
          fecha_desde: null
        }))
        
        return NextResponse.json({ 
          data: mappedData,
          source: 'fallback'
        })
      }
      
      console.error('Error fetching v_nomina_posiciones:', viewError)
      return NextResponse.json({ error: viewError.message }, { status: 500 })
    }

    // Obtener fotos de empleados
    const { data: empleados } = await supabaseSicamar
      .from('empleados')
      .select('id, foto_url, foto_thumb_url')
    
    // Crear mapa de fotos por empleado_id
    const fotosMap = new Map<number, { foto_url: string | null, foto_thumb_url: string | null }>()
    for (const emp of empleados || []) {
      fotosMap.set(emp.id, { 
        foto_url: emp.foto_url, 
        foto_thumb_url: emp.foto_thumb_url 
      })
    }

    // Mergear fotos con datos de la vista
    const dataConFotos = (posiciones || []).map(pos => {
      const fotos = fotosMap.get(pos.empleado_id) || { foto_url: null, foto_thumb_url: null }
      return {
        ...pos,
        foto_url: fotos.foto_url,
        foto_thumb_url: fotos.foto_thumb_url
      }
    })

    return NextResponse.json({ 
      data: dataConFotos,
      source: 'view'
    })
  } catch (error: unknown) {
    console.error('Error in posiciones API:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
