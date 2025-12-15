import { NextRequest, NextResponse } from 'next/server'

// GET: Eventos recientes de empleados
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const dias = parseInt(searchParams.get('dias') || '7')
  
  // Datos mock para desarrollo
  const eventos = [
    {
      id: 1,
      tipo: 'cumpleaños',
      empleado_id: 1,
      empleado_nombre: 'Pérez, Juan',
      fecha: new Date().toISOString().split('T')[0],
      descripcion: 'Cumple 35 años',
    },
    {
      id: 2,
      tipo: 'aniversario',
      empleado_id: 2,
      empleado_nombre: 'García, María',
      fecha: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      descripcion: 'Cumple 5 años en la empresa',
    },
  ]

  return NextResponse.json({
    success: true,
    eventos,
    dias,
  })
}
