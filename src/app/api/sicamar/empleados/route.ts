import { NextRequest, NextResponse } from 'next/server'

// GET: Lista de empleados
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const activos = searchParams.get('activos') === 'true'
  
  // Datos mock para desarrollo
  const empleados = [
    {
      id: 1,
      legajo: '001',
      nombre: 'Juan',
      apellido: 'Pérez',
      nombre_completo: 'Pérez, Juan',
      dni: '12345678',
      categoria: 'Operario A',
      sector: 'Producción',
      activo: true,
      fecha_ingreso: '2020-01-15',
    },
    {
      id: 2,
      legajo: '002',
      nombre: 'María',
      apellido: 'García',
      nombre_completo: 'García, María',
      dni: '23456789',
      categoria: 'Administrativo',
      sector: 'Administración',
      activo: true,
      fecha_ingreso: '2019-05-20',
    },
    {
      id: 3,
      legajo: '003',
      nombre: 'Carlos',
      apellido: 'López',
      nombre_completo: 'López, Carlos',
      dni: '34567890',
      categoria: 'Supervisor',
      sector: 'Producción',
      activo: true,
      fecha_ingreso: '2018-03-10',
    },
  ]

  const filtrados = activos ? empleados.filter(e => e.activo) : empleados

  return NextResponse.json({
    success: true,
    empleados: filtrados,
    count: filtrados.length,
  })
}
