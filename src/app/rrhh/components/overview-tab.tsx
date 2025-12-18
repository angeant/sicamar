'use client'

import { useState, useEffect } from 'react'
import { 
  Cake, 
  Award, 
  Users, 
  AlertTriangle,
  RefreshCw,
  Calendar,
  Clock,
  TrendingUp
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface EventoEmpleado {
  id: number
  legajo: string
  nombre: string
  apellido: string
  tipo: 'cumpleaños' | 'aniversario'
  fecha_evento: string
  dias_faltantes: number
  años: number
}

interface EstadoEmpleado {
  tipo_estado: string
  estado_nombre: string
  estado_color: string
  count: number
}

export function OverviewTab() {
  const [eventos, setEventos] = useState<EventoEmpleado[]>([])
  const [estados, setEstados] = useState<EstadoEmpleado[]>([])
  const [totalEmpleados, setTotalEmpleados] = useState(0)
  const [loading, setLoading] = useState(true)

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const [eventosRes, estadosRes, empleadosRes] = await Promise.all([
        fetch('/api/sicamar/empleados/eventos?dias=7'),
        fetch('/api/sicamar/empleados/estados?vigentes=true'),
        fetch('/api/sicamar/empleados?activos=true')
      ])

      const eventosData = await eventosRes.json()
      const estadosData = await estadosRes.json()
      const empleadosData = await empleadosRes.json()

      setEventos(eventosData.eventos || [])
      setTotalEmpleados(empleadosData.empleados?.length || 0)

      // Agrupar estados por tipo - estadosData es el array directamente
      const estadosArray = Array.isArray(estadosData) ? estadosData : (estadosData.estados || [])
      const estadosAgrupados: Record<string, { count: number; nombre: string; color: string }> = {}
      for (const est of estadosArray) {
        const tipo = est.tipo_estado
        if (!estadosAgrupados[tipo]) {
          estadosAgrupados[tipo] = {
            count: 0,
            nombre: est.tipos_estado_empleado?.nombre || tipo,
            color: est.tipos_estado_empleado?.color || '#6B7280'
          }
        }
        estadosAgrupados[tipo].count++
      }
      
      setEstados(Object.entries(estadosAgrupados).map(([tipo, data]) => ({
        tipo_estado: tipo,
        estado_nombre: data.nombre,
        estado_color: data.color,
        count: data.count
      })))

    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const formatFechaEvento = (fechaStr: string, diasFaltantes: number) => {
    const fecha = new Date(fechaStr + 'T12:00:00')
    if (diasFaltantes === 0) return 'Hoy'
    if (diasFaltantes === 1) return 'Mañana'
    return format(fecha, "EEEE d 'de' MMMM", { locale: es })
  }

  const empleadosConEstado = estados.reduce((acc, e) => acc + e.count, 0)
  const empleadosActivos = totalEmpleados - empleadosConEstado

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-900">Vista General</h2>
          <p className="text-sm text-gray-500">
            {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
        <button 
          onClick={cargarDatos}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{empleadosActivos}</p>
              <p className="text-xs text-gray-500">Activos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{empleadosConEstado}</p>
              <p className="text-xs text-gray-500">Con novedad</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center">
              <Cake className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {eventos.filter(e => e.tipo === 'cumpleaños').length}
              </p>
              <p className="text-xs text-gray-500">Cumpleaños</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Award className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {eventos.filter(e => e.tipo === 'aniversario').length}
              </p>
              <p className="text-xs text-gray-500">Aniversarios</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Eventos Próximos */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <h3 className="font-medium text-gray-900 text-sm">Próximos 7 días</h3>
            </div>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : eventos.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Sin eventos próximos
              </p>
            ) : (
              <div className="space-y-3">
                {eventos.map((evento, idx) => (
                  <div 
                    key={`${evento.id}-${evento.tipo}`}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      evento.dias_faltantes === 0 
                        ? 'bg-gradient-to-r from-pink-50 to-amber-50 border border-pink-200' 
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      evento.tipo === 'cumpleaños' 
                        ? 'bg-pink-100' 
                        : 'bg-blue-100'
                    }`}>
                      {evento.tipo === 'cumpleaños' 
                        ? <Cake className="w-4 h-4 text-pink-600" />
                        : <Award className="w-4 h-4 text-blue-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {evento.apellido}, {evento.nombre}
                      </p>
                      <p className="text-xs text-gray-500">
                        {evento.tipo === 'cumpleaños' 
                          ? `Cumple ${evento.años} años`
                          : `${evento.años} años en la empresa`
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-medium ${
                        evento.dias_faltantes === 0 
                          ? 'text-pink-600' 
                          : evento.dias_faltantes === 1 
                            ? 'text-amber-600'
                            : 'text-gray-500'
                      }`}>
                        {formatFechaEvento(evento.fecha_evento, evento.dias_faltantes)}
                      </p>
                      {evento.dias_faltantes > 1 && (
                        <p className="text-[10px] text-gray-400">
                          en {evento.dias_faltantes} días
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Estado del Personal */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <h3 className="font-medium text-gray-900 text-sm">Estado del Personal</h3>
            </div>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Barra de progreso */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">
                      {empleadosActivos} de {totalEmpleados} disponibles
                    </span>
                    <span className="text-xs font-medium text-green-600">
                      {totalEmpleados > 0 ? Math.round((empleadosActivos / totalEmpleados) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${totalEmpleados > 0 ? (empleadosActivos / totalEmpleados) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Novedades por tipo */}
                {estados.length > 0 ? (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-gray-500 font-medium">Novedades activas:</p>
                    {estados.map(estado => (
                      <div 
                        key={estado.tipo_estado}
                        className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: estado.estado_color }}
                          />
                          <span className="text-sm text-gray-700">{estado.estado_nombre}</span>
                        </div>
                        <span 
                          className="text-sm font-medium px-2 py-0.5 rounded"
                          style={{ 
                            backgroundColor: `${estado.estado_color}15`,
                            color: estado.estado_color
                          }}
                        >
                          {estado.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">
                      Todo el personal disponible
                    </p>
                  </div>
                )}

                {/* Total */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Total nómina</span>
                    <span className="font-semibold text-gray-900">{totalEmpleados}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
