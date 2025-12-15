import { NextRequest, NextResponse } from 'next/server'

// GET: Lista de liquidaciones/períodos
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const anio = searchParams.get('anio') || new Date().getFullYear().toString()
  
  // Datos mock para desarrollo
  const liquidaciones = [
    {
      id: 1,
      anio: parseInt(anio),
      mes: 12,
      quincena: null,
      tipo: 'MN',
      tipo_label: 'Mensual',
      descripcion: `Liquidación Mensual ${anio}-12`,
      estado: 'cerrada',
      estado_label: 'Cerrada',
      total_empleados: 145,
      fecha_liquidacion: `${anio}-12-05`,
      fecha_periodo: `${anio}-12-01`,
    },
    {
      id: 2,
      anio: parseInt(anio),
      mes: 11,
      quincena: null,
      tipo: 'MN',
      tipo_label: 'Mensual',
      descripcion: `Liquidación Mensual ${anio}-11`,
      estado: 'cerrada',
      estado_label: 'Cerrada',
      total_empleados: 143,
      fecha_liquidacion: `${anio}-11-05`,
      fecha_periodo: `${anio}-11-01`,
    },
  ]

  return NextResponse.json({
    success: true,
    liquidaciones,
    count: liquidaciones.length,
    anio: parseInt(anio),
  })
}

// POST: Crear nueva liquidación
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    return NextResponse.json({
      success: true,
      message: 'Liquidación creada (mock)',
      liquidacion: {
        id: Date.now(),
        ...body,
        estado: 'borrador',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error al crear liquidación' },
      { status: 500 }
    )
  }
}
