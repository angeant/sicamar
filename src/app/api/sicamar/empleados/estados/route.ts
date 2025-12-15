import { NextRequest, NextResponse } from 'next/server'

// GET: Estados de empleados
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const vigentes = searchParams.get('vigentes') === 'true'
  
  // Datos mock para desarrollo
  const estados = [
    { codigo: 'activo', descripcion: 'Activo', count: 150 },
    { codigo: 'licencia', descripcion: 'En Licencia', count: 5 },
    { codigo: 'vacaciones', descripcion: 'De Vacaciones', count: 8 },
    { codigo: 'suspension', descripcion: 'Suspendido', count: 2 },
  ]

  return NextResponse.json({
    success: true,
    estados: vigentes ? estados.filter(e => e.codigo !== 'suspension') : estados,
  })
}
