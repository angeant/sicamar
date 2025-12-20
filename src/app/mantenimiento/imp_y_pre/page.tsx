'use client'

import Link from 'next/link'

const AGENTES = [
  {
    nombre: 'Agente de Solicitudes',
    quien: 'Cualquier empleado o supervisor',
    que: [
      'Reportar una falla o anomalía con foto y descripción',
      'El agente clasifica automáticamente por criticidad y área',
      'Notifica al supervisor correspondiente',
      'Genera trazabilidad desde el primer momento'
    ]
  },
  {
    nombre: 'Agente de Ejecución',
    quien: 'Técnicos de mantenimiento',
    que: [
      'Ver tareas asignadas del día',
      'Registrar avance con voz o texto',
      'Adjuntar fotos de evidencia (antes/después)',
      'Consultar historial del equipo y manuales',
      'Cerrar la OT desde el celular'
    ]
  },
  {
    nombre: 'Agente de Planificación',
    quien: 'Planificador y supervisores de mantenimiento',
    que: [
      'Vista consolidada de todas las OTs abiertas',
      'Asignar técnicos y prioridades',
      'Consultar disponibilidad de repuestos',
      'Gestionar el Master Plan preventivo',
      'Coordinar tareas de la Parada Anual'
    ]
  },
  {
    nombre: 'Agente de Gestión',
    quien: 'Gerencia de Mantenimiento y Planta',
    que: [
      'KPIs en tiempo real: MTBF, MTTR, costos',
      'Estado del plan preventivo',
      'Análisis de fallas recurrentes',
      'Costos por equipo, área y contratista',
      'Reportes para auditoría'
    ]
  }
]

const METODOLOGIA = [
  {
    semana: 'Semana 1',
    foco: 'Relevamiento',
    actividades: [
      'Intercambio intensivo con el líder del proyecto',
      'Traspaso de información: equipos, áreas, técnicos, flujos actuales',
      'Primeros bocetos de la estructura de datos del sistema',
      'Definición de prioridades y casos de uso críticos'
    ]
  },
  {
    semana: 'Semana 2',
    foco: 'Automatización',
    actividades: [
      'Construcción de la estructura de datos',
      'Configuración de flujos de OT y estados',
      'Primeras automatizaciones de notificaciones y triaje',
      'Integración con Kalia app'
    ]
  },
  {
    semana: 'Semana 3',
    foco: 'Agentes y Capacitación',
    actividades: [
      'Desarrollo de los agentes de IA especializados',
      'Capacitación al personal: técnicos, supervisores, operarios',
      'Pruebas en planta con casos reales',
      'Ajustes según feedback de usuarios'
    ]
  },
  {
    semana: 'Semana 4',
    foco: 'Entrega',
    actividades: [
      'Go-live completo del sistema',
      'Acompañamiento en las primeras jornadas de uso real',
      'Documentación y cierre formal',
      'Entrega final'
    ]
  }
]

const RESULTADOS = [
  {
    titulo: 'Visibilidad total',
    detalle: 'Cada falla reportada queda registrada desde el primer segundo. No más comunicación informal que se pierde.'
  },
  {
    titulo: 'Respuesta rápida',
    detalle: 'Los supervisores reciben las solicitudes clasificadas por criticidad. Saben qué atender primero.'
  },
  {
    titulo: 'Técnicos empoderados',
    detalle: 'Tienen todo en el celular: tareas, historial, manuales. Cierran OTs en el momento, no al final del día.'
  },
  {
    titulo: 'Evidencia fotográfica',
    detalle: 'Fotos del antes y después. Trazabilidad completa para auditorías y análisis de fallas.'
  },
  {
    titulo: 'Datos para decidir',
    detalle: 'KPIs reales, no estimados. Costos por equipo, tiempos de respuesta, cumplimiento del preventivo.'
  },
  {
    titulo: 'Cualquiera puede reportar',
    detalle: 'Operarios, supervisores de producción, cualquier empleado. Baja la barrera de entrada al sistema.'
  }
]

export default function ImplementacionPresupuestoPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-neutral-100 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
        <div className="max-w-4xl mx-auto px-8 py-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#C4322F] tracking-[0.3em] uppercase">Sicamar</p>
            <p className="text-base font-light text-neutral-400">Mantenimiento</p>
          </div>
          <Link href="/mantenimiento" className="text-sm text-neutral-400 hover:text-[#C4322F] transition-colors">
            ← Volver
          </Link>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-4xl mx-auto px-8 py-14">
        {/* Título */}
        <div className="mb-20">
          <h1 className="text-4xl font-light text-neutral-300 tracking-wide mb-5">
            Sistema de Gestión de Mantenimiento
          </h1>
          <p className="text-base text-neutral-500 leading-relaxed max-w-2xl mb-4">
            Mantenimiento se suma a la renovación general que está atravesando Sicamar. 
            Una estructuración de datos a medida de las necesidades de la compañía, 
            que deja al área lista para operar con agentes de inteligencia artificial.
          </p>
          <p className="text-base text-neutral-500 leading-relaxed max-w-2xl mb-8">
            El objetivo: alta agilidad en la gestión, reducción de errores, 
            optimización de procesos y trazabilidad completa. 
            Desde que un operario detecta una falla hasta que el técnico la cierra con foto de evidencia, 
            todo queda registrado y accesible para cualquier empleado de planta.
          </p>
          <div className="inline-flex items-center gap-3 px-5 py-3 bg-neutral-50 rounded-lg">
            <span className="text-sm text-neutral-500">Implementación:</span>
            <span className="text-base font-medium text-[#C4322F]">4 semanas</span>
          </div>
        </div>

        {/* Agentes */}
        <section className="mb-20">
          <h2 className="text-xl font-light text-neutral-400 mb-10 pb-4 border-b border-neutral-100">
            Agentes Especializados
          </h2>

          <div className="space-y-10">
            {AGENTES.map((agente, idx) => (
              <div key={idx} className="border-l-2 border-neutral-100 pl-6 hover:border-[#C4322F]/40 transition-colors">
                <div className="flex items-baseline gap-4 mb-3">
                  <h3 className="text-base font-medium text-neutral-700">{agente.nombre}</h3>
                  <span className="text-xs text-neutral-400 uppercase tracking-wider">{agente.quien}</span>
                </div>
                <ul className="space-y-2">
                  {agente.que.map((item, i) => (
                    <li key={i} className="text-sm text-neutral-500 pl-4 relative before:content-['·'] before:absolute before:left-0 before:text-neutral-300">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Metodología */}
        <section className="mb-20">
          <h2 className="text-xl font-light text-neutral-400 mb-10 pb-4 border-b border-neutral-100">
            Metodología de Implementación
          </h2>

          <div className="space-y-8">
            {METODOLOGIA.map((semana, idx) => (
              <div key={idx} className="flex gap-8">
                <div className="flex-shrink-0 w-28">
                  <p className="text-sm font-medium text-[#C4322F]">{semana.semana}</p>
                  <p className="text-xs text-neutral-400 uppercase tracking-wider">{semana.foco}</p>
                </div>
                <div className="flex-1 border-l border-neutral-100 pl-8">
                  <ul className="space-y-2">
                    {semana.actividades.map((act, i) => (
                      <li key={i} className="text-base text-neutral-600 pl-5 relative before:content-['→'] before:absolute before:left-0 before:text-neutral-300">
                        {act}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 p-6 bg-neutral-50/70 rounded-lg space-y-4">
            <p className="text-sm text-neutral-600 leading-relaxed">
              <span className="font-medium text-neutral-700">Trabajo en planta:</span> No es una implementación remota. 
              Hay presencia física para relevar, capacitar y ajustar en tiempo real. Los agentes se entrenan 
              con los casos reales de Sicamar, no con plantillas genéricas.
            </p>
            <p className="text-sm text-neutral-600 leading-relaxed">
              <span className="font-medium text-neutral-700">Post-entrega:</span> Se incluyen mejoras menores que 
              puedan ir surgiendo en el propio uso y entendimiento del sistema durante las semanas siguientes.
            </p>
          </div>
        </section>

        {/* Qué se logra */}
        <section className="mb-20">
          <h2 className="text-xl font-light text-neutral-400 mb-10 pb-4 border-b border-neutral-100">
            Qué se logra
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {RESULTADOS.map((resultado, idx) => (
              <div key={idx} className="p-5 border border-neutral-100 rounded-lg hover:border-neutral-200 transition-colors">
                <h3 className="text-base font-medium text-neutral-700 mb-2">{resultado.titulo}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{resultado.detalle}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Presupuesto */}
        <section className="mb-16">
          <h2 className="text-xl font-light text-neutral-400 mb-8 pb-4 border-b border-neutral-100">
            Inversión
          </h2>
          
          {/* Implementación */}
          <div className="bg-neutral-50/50 rounded-lg p-10 text-center mb-8">
            <p className="text-xs uppercase tracking-[0.15em] text-neutral-400 mb-3">Implementación</p>
            <p className="text-4xl font-light text-neutral-700">
              USD <span className="text-[#C4322F]">12,000</span>
            </p>
            <p className="text-sm text-neutral-400 mt-3">Entrega completa en 4 semanas</p>
          </div>

          {/* Mantenimiento mensual */}
          <div className="border border-neutral-100 rounded-lg p-6 mb-5">
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-base font-medium text-neutral-700">Mantenimiento mensual</p>
              <p className="text-base text-neutral-600">USD <span className="text-[#C4322F]">200</span>/mes</p>
            </div>
            <p className="text-sm text-neutral-500 leading-relaxed">
              Incluye servidores, base de datos cloud de alta velocidad, hosting y soporte del módulo. 
              No incluye consumo de agentes AI.
            </p>
          </div>

          {/* Pool AI */}
          <div className="border border-neutral-100 rounded-lg p-6">
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-base font-medium text-neutral-700">Pool de agentes AI</p>
              <p className="text-base text-neutral-600">USD <span className="text-[#C4322F]">39</span>/mes por usuario</p>
            </div>
            <p className="text-sm text-neutral-500 leading-relaxed">
              Los usuarios del área de Mantenimiento (supervisores, técnicos) se suman al pool de créditos AI 
              compartido que ya utilizan otras áreas. Cada usuario que use el sistema en la diaria 
              —conectarse, ver órdenes, cargar imágenes, etc.— agrega USD 39/mes al pool. 
              Si el consumo total excede el pool, se factura el excedente por separado.
            </p>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-100">
        <div className="max-w-4xl mx-auto px-8 h-14 flex items-center justify-center text-sm text-neutral-300">
          Sicamar Metales S.A. · powered by Kalia
        </div>
      </footer>
    </div>
  )
}
