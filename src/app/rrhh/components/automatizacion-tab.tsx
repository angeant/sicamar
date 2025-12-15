'use client'

import { useState } from 'react'

interface Tarea {
  id: string
  nombre: string
  antes: string
  ahora: string
  tiempoAntes: string
  tiempoAhora: string
  estado: 'automatizado' | 'semi-auto' | 'pendiente'
}

interface Categoria {
  id: string
  nombre: string
  tareas: Tarea[]
}

const categorias: Categoria[] = [
  {
    id: 'diarias',
    nombre: 'Diarias',
    tareas: [
      {
        id: 'd1',
        nombre: 'Controlar asistencia y fichadas',
        antes: 'Revisar manualmente InWeb entre 06:00-08:00 AM, exportar a Excel, cruzar con planilla de turnos, identificar ausencias y tardanzas una por una.',
        ahora: 'Sincronización automática con InWeb. Alertas en tiempo real de ausencias y tardanzas. Dashboard con métricas instantáneas.',
        tiempoAntes: '45-60 min',
        tiempoAhora: '5 min',
        estado: 'automatizado'
      },
      {
        id: 'd2',
        nombre: 'Gestionar avisos de ausencia',
        antes: 'Recibir mensajes individuales en WhatsApp personal, anotar en cuaderno o Excel, recordar avisar a supervisores manualmente.',
        ahora: 'Bot de WhatsApp recibe avisos, los registra automáticamente y notifica al supervisor del turno correspondiente.',
        tiempoAntes: '30 min',
        tiempoAhora: 'Automático',
        estado: 'pendiente'
      },
      {
        id: 'd3',
        nombre: 'Reclamar certificados médicos',
        antes: 'Llamar o escribir a empleados para pedir certificado, esperar físico, escanear, guardar en carpeta, actualizar Excel de licencias.',
        ahora: 'Empleado sube foto del certificado desde su celular. Se asocia automáticamente a la licencia y se almacena en el legajo digital.',
        tiempoAntes: '20 min/caso',
        tiempoAhora: '2 min/caso',
        estado: 'automatizado'
      },
      {
        id: 'd4',
        nombre: 'Coordinar reemplazos',
        antes: 'Llamar telefónicamente a supervisores, buscar disponibilidad en planilla, confirmar por WhatsApp, actualizar Excel de asignaciones.',
        ahora: 'Sistema sugiere reemplazos según polivalencias y disponibilidad. Notificación push al supervisor para confirmar.',
        tiempoAntes: '15-30 min/caso',
        tiempoAhora: '3 min/caso',
        estado: 'semi-auto'
      },
      {
        id: 'd5',
        nombre: 'Calcular y solicitar viandas',
        antes: 'Contar presentes en planilla, agregar extras y visitas manualmente, llamar o enviar email al proveedor antes de las 10 AM.',
        ahora: 'Cálculo automático según asistencia real más extras registrados. Envío automático al proveedor con reporte detallado.',
        tiempoAntes: '20 min',
        tiempoAhora: '1 click',
        estado: 'automatizado'
      },
      {
        id: 'd6',
        nombre: 'Gestionar horas extras',
        antes: 'Recibir solicitud verbal o por WhatsApp, verificar horas del mes, autorizar verbalmente, anotar para después cargar en liquidación.',
        ahora: 'Supervisor solicita desde app, sistema verifica topes legales, RRHH autoriza desde panel. Se refleja automáticamente en liquidación.',
        tiempoAntes: '10 min/solicitud',
        tiempoAhora: '30 seg/solicitud',
        estado: 'semi-auto'
      },
    ]
  },
  {
    id: 'semanales',
    nombre: 'Semanales',
    tareas: [
      {
        id: 's1',
        nombre: 'Actualizar rotación de turnos',
        antes: 'Abrir Excel maestro, copiar semana anterior, ajustar fechas, verificar excepciones, modificar celdas una por una, reenviar por email.',
        ahora: 'Generación automática según patrón configurado. Ajustes solo para excepciones. Publicación instantánea visible para todos.',
        tiempoAntes: '2-3 horas',
        tiempoAhora: '15 min',
        estado: 'automatizado'
      },
      {
        id: 's2',
        nombre: 'Comunicar cambios de turno',
        antes: 'Armar lista de afectados, enviar WhatsApp individual a cada uno, esperar confirmación, registrar quién leyó.',
        ahora: 'Notificación automática push y email a afectados al publicar cambio. Confirmación de lectura registrada.',
        tiempoAntes: '30-45 min',
        tiempoAhora: 'Automático',
        estado: 'semi-auto'
      },
      {
        id: 's3',
        nombre: 'Gestionar entrega de ropa y EPP',
        antes: 'Revisar Excel de entregas, coordinar con Pañol por teléfono, completar planilla de entrega a mano, archivar.',
        ahora: 'Registro digital de stock y entregas. Alertas de vencimiento de EPP. Firma digital del empleado en tablet.',
        tiempoAntes: '1-2 horas',
        tiempoAhora: '20 min',
        estado: 'automatizado'
      },
    ]
  },
  {
    id: 'liquidacion',
    nombre: 'Liquidación',
    tareas: [
      {
        id: 'l1',
        nombre: 'Corte de horas',
        antes: 'Exportar de InWeb a Excel, ordenar por empleado, sumar horas diurnas, nocturnas y extras manualmente, verificar contra planilla de turnos.',
        ahora: 'Un click genera el corte automático con todas las horas clasificadas y validadas contra los turnos asignados.',
        tiempoAntes: '4-6 horas',
        tiempoAhora: '10 min',
        estado: 'automatizado'
      },
      {
        id: 'l2',
        nombre: 'Liquidar sueldos',
        antes: 'Cargar horas en Bejerman, importar conceptos, ejecutar proceso de liquidación, revisar errores, corregir manualmente.',
        ahora: 'Liquidación integrada en Kalia. Todos los conceptos ya están cargados. Un click para liquidar con validación automática.',
        tiempoAntes: '4-6 horas',
        tiempoAhora: '30 min',
        estado: 'automatizado'
      },
      {
        id: 'l3',
        nombre: 'Calcular presentismo',
        antes: 'Revisar ausencias del mes por empleado, calcular porcentaje según convenio, considerar excepciones, cargar manualmente.',
        ahora: 'Cálculo automático basado en marcaciones y justificaciones. Reglas de convenio configuradas. Se aplica directo a liquidación.',
        tiempoAntes: '2-4 horas',
        tiempoAhora: '5 min',
        estado: 'automatizado'
      },
      {
        id: 'l4',
        nombre: 'Calcular calorías UOM',
        antes: 'Contar días trabajados por operario, aplicar valor de convenio, generar Excel, cargar en sistema de liquidación.',
        ahora: 'Conteo automático de días y aplicación de valor vigente. Se calcula e incluye en liquidación automáticamente.',
        tiempoAntes: '1-2 horas',
        tiempoAhora: '1 click',
        estado: 'automatizado'
      },
      {
        id: 'l5',
        nombre: 'Cargar novedades',
        antes: 'Revisar carpeta de novedades, transcribir datos uno por uno, verificar montos y períodos.',
        ahora: 'Carga centralizada con historial y validación. Las novedades se aplican automáticamente en cada liquidación.',
        tiempoAntes: '30-60 min',
        tiempoAhora: '10 min',
        estado: 'semi-auto'
      },
      {
        id: 'l6',
        nombre: 'Importar SIRADIG',
        antes: 'Descargar de AFIP empleado por empleado, copiar deducciones a Excel, calcular manualmente, cargar en liquidación.',
        ahora: 'Importación masiva desde archivo AFIP. Procesamiento automático y aplicación directa en liquidación.',
        tiempoAntes: '3-4 horas',
        tiempoAhora: '15 min',
        estado: 'semi-auto'
      },
      {
        id: 'l7',
        nombre: 'Validar y generar F.931',
        antes: 'Exportar libro sueldo, revisar totales, corregir diferencias manualmente, generar F.931 en AFIP.',
        ahora: 'Validación automática de totales. Alertas de inconsistencias antes de cerrar. Exportación directa para AFIP.',
        tiempoAntes: '2-3 horas',
        tiempoAhora: '30 min',
        estado: 'semi-auto'
      },
      {
        id: 'l8',
        nombre: 'Acreditación bancaria',
        antes: 'Exportar netos, formatear para Macro o Interbanking, validar CBUs, subir archivo a homebanking manualmente.',
        ahora: 'Generación automática del archivo bancario con CBUs validados. Listo para importar en el portal del banco.',
        tiempoAntes: '1-2 horas',
        tiempoAhora: '1 click',
        estado: 'automatizado'
      },
      {
        id: 'l9',
        nombre: 'Recibos de sueldo',
        antes: 'Generar PDFs, separar archivo por empleado manualmente, enviar por email uno por uno o imprimir.',
        ahora: 'Generación y distribución automática. Empleado accede desde app con su recibo firmado digitalmente.',
        tiempoAntes: '3-4 horas',
        tiempoAhora: '1 click',
        estado: 'automatizado'
      },
    ]
  },
  {
    id: 'eventuales',
    nombre: 'Eventuales',
    tareas: [
      {
        id: 'e1',
        nombre: 'Gestionar altas',
        antes: 'Formularios en papel, alta en AFIP manual, configurar reloj biométrico presencial, crear legajo físico, enviar documentación por email.',
        ahora: 'Wizard de onboarding digital: formulario online, alta automática en AFIP, sync con reloj, legajo digital completo.',
        tiempoAntes: '2-3 horas',
        tiempoAhora: '30 min',
        estado: 'semi-auto'
      },
      {
        id: 'e2',
        nombre: 'Gestionar bajas',
        antes: 'Redactar telegrama manual, baja en AFIP manual, avisar a sistemas para bloquear accesos, archivar legajo.',
        ahora: 'Proceso guiado: generación automática de documentación, baja en AFIP integrada, bloqueo automático de accesos.',
        tiempoAntes: '1-2 horas',
        tiempoAhora: '20 min',
        estado: 'semi-auto'
      },
      {
        id: 'e3',
        nombre: 'Control de vacaciones',
        antes: 'Llevar Excel de saldos, calcular días según antigüedad manualmente, verificar superposiciones, actualizar después de cada uso.',
        ahora: 'Saldos calculados automáticamente. Empleado solicita desde app. Validación de superposiciones. Actualización automática.',
        tiempoAntes: '30 min/solicitud',
        tiempoAhora: '2 min/solicitud',
        estado: 'automatizado'
      },
      {
        id: 'e4',
        nombre: 'Sanciones y apercibimientos',
        antes: 'Redactar documento en Word, imprimir, conseguir firma del empleado, escanear, archivar en legajo físico.',
        ahora: 'Plantillas predefinidas por tipo de falta. Firma digital en tablet. Archivo automático en legajo digital.',
        tiempoAntes: '45 min/sanción',
        tiempoAhora: '10 min/sanción',
        estado: 'semi-auto'
      },
      {
        id: 'e5',
        nombre: 'Comunicaciones masivas',
        antes: 'Redactar comunicado, imprimir copias, pegar en cartelera, enviar por WhatsApp grupo por grupo.',
        ahora: 'Crear comunicado, seleccionar destinatarios, envío automático por push, email y WhatsApp con confirmación de lectura.',
        tiempoAntes: '30-60 min',
        tiempoAhora: '5 min',
        estado: 'pendiente'
      },
      {
        id: 'e6',
        nombre: 'Atender consultas',
        antes: 'Empleado viene personalmente o llama. Buscar información en diferentes sistemas. Responder verbalmente.',
        ahora: 'Empleado consulta desde app sus recibos, saldos y turnos. Bot responde preguntas frecuentes. Solo casos complejos escalan.',
        tiempoAntes: '15-30 min/consulta',
        tiempoAhora: 'Autoservicio',
        estado: 'pendiente'
      },
    ]
  },
]

export function AutomatizacionTab() {
  const [selectedCategoria, setSelectedCategoria] = useState<string>('diarias')
  const [expandedTarea, setExpandedTarea] = useState<string | null>(null)

  const categoriaActual = categorias.find(c => c.id === selectedCategoria)

  const totalTareas = categorias.reduce((sum, cat) => sum + cat.tareas.length, 0)
  const tareasAutomatizadas = categorias.reduce(
    (sum, cat) => sum + cat.tareas.filter(t => t.estado === 'automatizado').length, 0
  )

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-2xl font-light text-gray-900 tracking-tight">
          Automatización
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Guía de transición del área de RRHH
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-8 mb-12 pb-12 border-b border-gray-100">
        <div>
          <div className="text-3xl font-light text-gray-900">{totalTareas}</div>
          <div className="text-xs text-gray-400 mt-1">tareas documentadas</div>
        </div>
        <div>
          <div className="text-3xl font-light text-gray-900">{tareasAutomatizadas}</div>
          <div className="text-xs text-gray-400 mt-1">automatizadas</div>
        </div>
        <div>
          <div className="text-3xl font-light text-[#C4322F]">70-80%</div>
          <div className="text-xs text-gray-400 mt-1">reducción de tiempo</div>
        </div>
      </div>

      {/* Categorías */}
      <div className="flex gap-6 mb-8">
        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCategoria(cat.id)
              setExpandedTarea(null)
            }}
            className={`text-sm pb-2 border-b-2 transition-colors ${
              selectedCategoria === cat.id
                ? 'text-gray-900 border-gray-900'
                : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            {cat.nombre}
          </button>
        ))}
      </div>

      {/* Tareas */}
      <div className="space-y-1">
        {categoriaActual?.tareas.map((tarea, index) => {
          const isExpanded = expandedTarea === tarea.id

          return (
            <div key={tarea.id}>
              <button
                onClick={() => setExpandedTarea(isExpanded ? null : tarea.id)}
                className="w-full text-left py-4 flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-300 w-5">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={`text-sm ${isExpanded ? 'text-gray-900' : 'text-gray-600 group-hover:text-gray-900'}`}>
                    {tarea.nombre}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-xs ${
                    tarea.estado === 'automatizado' ? 'text-[#C4322F]' :
                    tarea.estado === 'semi-auto' ? 'text-gray-400' :
                    'text-gray-300'
                  }`}>
                    {tarea.estado === 'automatizado' ? 'auto' :
                     tarea.estado === 'semi-auto' ? 'semi' : 'dev'}
                  </span>
                  <span className={`text-xs text-gray-300 transition-transform ${isExpanded ? 'rotate-45' : ''}`}>
                    +
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="pb-8 pl-9">
                  <div className="grid grid-cols-2 gap-8">
                    {/* Antes */}
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-[10px] uppercase tracking-wider text-gray-400">Antes</span>
                        <span className="text-xs text-gray-300">{tarea.tiempoAntes}</span>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        {tarea.antes}
                      </p>
                    </div>

                    {/* Ahora */}
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-[10px] uppercase tracking-wider text-[#C4322F]">Ahora</span>
                        <span className="text-xs text-[#C4322F]/70">{tarea.tiempoAhora}</span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {tarea.ahora}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {index < (categoriaActual?.tareas.length || 0) - 1 && (
                <div className="border-b border-gray-50" />
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-gray-100">
        <p className="text-xs text-gray-400 leading-relaxed max-w-xl">
          Kalia no reemplaza al equipo de RRHH, lo potencia. Las tareas repetitivas se automatizan 
          para que el equipo pueda enfocarse en lo que importa: las personas.
        </p>
      </div>
    </div>
  )
}
