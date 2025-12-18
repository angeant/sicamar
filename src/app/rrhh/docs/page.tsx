'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Database,
  Server,
  Clock,
  Calculator,
  Palmtree,
  Link2,
  LayoutDashboard,
  ArrowLeft,
  ChevronRight,
  Search,
  Copy,
  Check,
  Terminal,
  Table2,
  Workflow,
  Code2,
  BookOpen,
} from 'lucide-react'

// Secciones de la documentación
const sections = [
  {
    id: 'overview',
    title: 'Overview',
    icon: LayoutDashboard,
    description: 'Arquitectura y flujos del sistema',
  },
  {
    id: 'motor',
    title: 'Motor',
    icon: BookOpen,
    description: 'Master Doc completo del motor de liquidación',
  },
  {
    id: 'database',
    title: 'Database',
    icon: Database,
    description: 'Schema Supabase, tablas y relaciones',
  },
  {
    id: 'api',
    title: 'API',
    icon: Code2,
    description: 'Endpoints REST disponibles',
  },
  {
    id: 'turnos',
    title: 'Turnos',
    icon: Clock,
    description: 'Sistema de turnos y rotaciones',
  },
  {
    id: 'liquidaciones',
    title: 'Liquidaciones',
    icon: Calculator,
    description: 'Fórmulas técnicas del engine',
  },
  {
    id: 'marcaciones',
    title: 'Marcaciones',
    icon: Terminal,
    description: 'Sincronización de fichadas',
  },
  {
    id: 'vacaciones',
    title: 'Vacaciones',
    icon: Palmtree,
    description: 'Eventos de asistencia y saldos',
  },
  {
    id: 'integraciones',
    title: 'Integraciones',
    icon: Link2,
    description: 'Conexiones externas',
  },
]

// Quick Reference Data
const quickRef = {
  schema: 'sicamar',
  projectId: 'uimqzfmspegwzmdoqjfn',
  tables: [
    { name: 'empleados', rows: '~143', desc: 'Nómina activa' },
    { name: 'marcaciones', rows: '~1,800', desc: 'Fichadas del reloj' },
    { name: 'jornadas_diarias', rows: '~860', desc: 'Jornadas calculadas' },
    { name: 'liquidacion_detalle', rows: '~500K', desc: 'Conceptos liquidados' },
    { name: 'novedades_liquidacion', rows: '~10K', desc: 'Novedades manuales' },
  ],
}

// Contenido por sección
const content: Record<string, React.ReactNode> = {
  overview: <OverviewContent />,
  motor: <MotorContent />,
  database: <DatabaseContent />,
  api: <ApiContent />,
  turnos: <TurnosContent />,
  liquidaciones: <LiquidacionesContent />,
  marcaciones: <MarcacionesContent />,
  vacaciones: <VacacionesContent />,
  integraciones: <IntegracionesContent />,
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSections = sections.filter(
    s => 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-neutral-200 sticky top-0 z-50 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/rrhh" 
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver a RRHH</span>
            </Link>
            <div className="h-6 w-px bg-neutral-200" />
            <div className="flex items-center gap-2">
              <Image
                src="/sicamar.png"
                alt="Sicamar"
                width={100}
                height={32}
                className="h-6 w-auto"
              />
              <span className="text-sm font-medium text-neutral-600">/</span>
              <span className="text-sm font-medium text-neutral-900">Docs</span>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 h-8 bg-neutral-50 border border-neutral-200 rounded text-sm focus:outline-none focus:border-neutral-400"
            />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 border-r border-neutral-100 min-h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto">
          <nav className="py-4">
            <div className="px-4 mb-4">
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Documentación</p>
            </div>
            <ul className="space-y-0.5">
              {filteredSections.map(section => {
                const Icon = section.icon
                const isActive = activeSection === section.id
                return (
                  <li key={section.id}>
                    <button
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                        isActive 
                          ? 'bg-neutral-100 text-neutral-900 font-medium' 
                          : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#C4322F]' : 'text-neutral-400'}`} />
                      {section.title}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-4xl px-8 py-8">
            {content[activeSection]}
          </div>
        </main>

        {/* Right Sidebar - Quick Reference */}
        <aside className="w-64 flex-shrink-0 border-l border-neutral-100 min-h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto hidden lg:block">
          <div className="p-4">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-3">Quick Reference</p>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-neutral-500 mb-1">Schema</p>
                <CodeBadge>{quickRef.schema}</CodeBadge>
              </div>
              
              <div>
                <p className="text-xs text-neutral-500 mb-1">Project ID</p>
                <CodeBadge copyable>{quickRef.projectId}</CodeBadge>
              </div>
              
              <div>
                <p className="text-xs text-neutral-500 mb-2">Tablas principales</p>
                <ul className="space-y-1.5">
                  {quickRef.tables.map(t => (
                    <li key={t.name} className="text-xs">
                      <code className="text-[#C4322F] font-mono">{t.name}</code>
                      <span className="text-neutral-400 ml-1">({t.rows})</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

// Componente para badges de código
function CodeBadge({ children, copyable }: { children: string, copyable?: boolean }) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div className="flex items-center gap-1.5 group">
      <code className="text-xs font-mono bg-neutral-100 px-2 py-1 rounded text-neutral-700">
        {children}
      </code>
      {copyable && (
        <button 
          onClick={handleCopy}
          className="p-1 text-neutral-400 hover:text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        </button>
      )}
    </div>
  )
}

// Componente para bloques de código
function CodeBlock({ children, title }: { children: string, title?: string }) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div className="relative group">
      {title && (
        <div className="text-xs text-neutral-500 mb-1">{title}</div>
      )}
      <pre className="bg-neutral-900 text-neutral-100 p-4 rounded text-xs font-mono overflow-x-auto">
        {children}
      </pre>
      <button 
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 bg-neutral-800 rounded text-neutral-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

// Componente para tablas
function DocTable({ headers, rows }: { headers: string[], rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200">
            {headers.map((h, i) => (
              <th key={i} className="text-left py-2 px-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-neutral-50">
              {row.map((cell, j) => (
                <td key={j} className="py-2 px-3 text-neutral-700">
                  {j === 0 ? <code className="text-xs font-mono text-[#C4322F]">{cell}</code> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ====== CONTENIDO DE SECCIONES ======

function MotorContent() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-neutral-900 mb-2">Motor de Liquidación de Salarios</h1>
        <p className="text-sm text-neutral-600">
          Master Doc completo del sistema de liquidación Sicamar.
        </p>
      </div>

      {/* 1. Arquitectura de Personal */}
      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">1. Arquitectura de Personal y Categorización</h2>
        <p className="text-sm text-neutral-600 mb-4">
          El sistema clasifica cada legajo en uno de los siguientes grupos para aplicar las reglas de cálculo correspondientes.
        </p>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-medium text-neutral-700 mb-2">1.1. Personal Jornalizado (Convenio UOM)</h3>
            <DocTable 
              headers={['Atributo', 'Valor']}
              rows={[
                ['Convenio', 'UOM - Unión Obrera Metalúrgica'],
                ['Población', 'Operarios de planta, mantenimiento, logística, pañol'],
                ['Cantidad', '~390 legajos'],
                ['Unidad de Medida', 'Horas'],
                ['Frecuencia de Pago', 'Quincenal'],
                ['Conceptos Clave', 'Valor Hora, Calorías, Presentismo Escalonado'],
              ]}
            />
          </div>
          
          <div>
            <h3 className="text-xs font-medium text-neutral-700 mb-2">1.2. Personal Mensualizado (ASIMRA / Fuera de Convenio)</h3>
            <DocTable 
              headers={['Atributo', 'Valor']}
              rows={[
                ['Convenio', 'ASIMRA / Fuera de Convenio'],
                ['Población', 'Supervisores, Jefes, Administrativos, Gerencia'],
                ['Cantidad', '~40 legajos'],
                ['Unidad de Medida', 'Mes (30 días)'],
                ['Frecuencia de Pago', 'Mensual'],
                ['Conceptos Clave', 'Sueldo Básico, Ganancias (4ta Categoría), Presentismo Progresivo'],
              ]}
            />
          </div>
        </div>
      </section>

      {/* 2. Cronograma de Liquidación */}
      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">2. Cronograma de Liquidación</h2>
        <p className="text-sm text-neutral-600 mb-4">
          El sistema gestiona dos líneas de tiempo paralelas con fechas de corte estrictas.
        </p>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-medium text-neutral-700 mb-2">A. Ciclo Quincenal (Solo Jornalizados)</h3>
            <div className="space-y-3">
              <div className="bg-neutral-50 p-3 rounded">
                <p className="text-xs font-medium text-neutral-700 mb-2">1era Quincena (Adelanto)</p>
                <DocTable 
                  headers={['Etapa', 'Detalle']}
                  rows={[
                    ['Período de Cómputo', 'Días 1 al 15 del mes actual'],
                    ['Fecha de Proceso (Corte)', 'Día 16 (08:00 AM)'],
                    ['Fecha de Pago', 'Día 20 (aprox)'],
                  ]}
                />
                <p className="text-xs text-neutral-500 mt-2">
                  <strong>Incluye:</strong> Horas Normales, Horas Extras, Feriados trabajados. <br/>
                  <strong>NO incluye:</strong> Presentismo (fin de mes), Calorías (por quincena).
                </p>
              </div>
              
              <div className="bg-neutral-50 p-3 rounded">
                <p className="text-xs font-medium text-neutral-700 mb-2">2da Quincena (Cierre Mensual)</p>
                <DocTable 
                  headers={['Etapa', 'Detalle']}
                  rows={[
                    ['Período de Cómputo', 'Día 16 al último día del mes'],
                    ['Fecha de Proceso (Corte)', 'Día 1 del mes siguiente (08:00 AM)'],
                    ['Fecha de Pago', '4to día hábil del mes siguiente'],
                  ]}
                />
                <p className="text-xs text-neutral-500 mt-2">
                  <strong>Incluye:</strong> Horas restantes, Presentismo (mes completo), Deducciones mensuales.
                </p>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-xs font-medium text-neutral-700 mb-2">B. Ciclo Mensual (Solo Mensualizados)</h3>
            <DocTable 
              headers={['Etapa', 'Detalle']}
              rows={[
                ['Período de Cómputo Sueldo', 'Mes calendario completo (1 al 30/31)'],
                ['Período de Cómputo Extras', 'Del día 23 del mes anterior al día 22 del mes actual'],
                ['Fecha de Proceso', 'Día 23 (pre-carga) y Día 1 (cierre final)'],
                ['Fecha de Pago', '4to día hábil'],
              ]}
            />
          </div>
        </div>
      </section>

      {/* 3. Matriz de Conceptos */}
      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">3. Matriz de Conceptos y Reglas de Cálculo</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-medium text-neutral-700 mb-2">3.1. Horas Normales y Turnos</h3>
            <DocTable 
              headers={['Tipo', 'Horario', 'Factor']}
              rows={[
                ['Hora Diurna (0010)', 'L-V: 06:00-21:00, Sáb: 06:00-13:00', '1.0'],
                ['Hora Nocturna (0020)', 'L-V: 21:00-06:00', '1.133 (+13.33%)'],
              ]}
            />
            <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2 text-xs text-amber-800">
              <strong>Regla Turno Noche:</strong> El turno que ingresa el Domingo a las 22:00 se considera jornada normal de lunes.
            </div>
          </div>
          
          <div>
            <h3 className="text-xs font-medium text-neutral-700 mb-2">3.2. Horas Extras (Regla del Bloque Cerrado)</h3>
            <div className="bg-neutral-50 p-3 rounded mb-3">
              <p className="text-xs text-neutral-600">
                <strong>Unidad Mínima:</strong> Bloques de 30 minutos (0.5 hs)<br/>
                <strong>Condición:</strong> <code className="text-[#C4322F]">(Check_In &lt;= Inicio_Bloque) AND (Check_Out &gt;= Fin_Bloque)</code><br/>
                <strong>Importante:</strong> No se pagan minutos sueltos ni fracciones menores.
              </p>
            </div>
            <DocTable 
              headers={['Código', 'Tipo', 'Cuándo Aplica']}
              rows={[
                ['0021', 'Extra 50% Diurna', 'L-V fuera de turno (06-21), Sáb 06-13'],
                ['0025', 'Extra 50% Nocturna', 'L-V fuera de turno (21-06)'],
                ['0030', 'Extra 100% Diurna', 'Sáb >13:00, Dom (06-21), Feriados'],
                ['0031', 'Extra 100% Nocturna', 'Sáb >21:00, Dom >21:00, Feriados Noche'],
              ]}
            />
          </div>
          
          <div>
            <h3 className="text-xs font-medium text-neutral-700 mb-2">3.3. Adicional "Calorías" (Art. 66)</h3>
            <DocTable 
              headers={['Atributo', 'Valor']}
              rows={[
                ['Aplica a', 'Exclusivo UOM (Horneros, Colada, Basculantes)'],
                ['Código', '0054'],
                ['Condición', 'Más de 6 horas en puesto "caliente"'],
              ]}
            />
            <div className="bg-neutral-50 p-3 rounded mt-2">
              <p className="text-xs font-mono text-neutral-700">
                Fórmula: (Días Trabajados en Sector) × 1.5 horas × Valor Hora Normal
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Ejemplo: 10 días en la quincena → Cobra 15 horas adicionales
              </p>
            </div>
          </div>
          
          <div>
            <h3 className="text-xs font-medium text-neutral-700 mb-2">3.4. Presentismo (El Premio)</h3>
            <p className="text-xs text-neutral-500 mb-2">Se paga a fin de mes, pero se evalúa día a día.</p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-50 p-3 rounded">
                <p className="text-xs font-medium text-neutral-700 mb-2">Jornalizados (UOM) - Código 0120</p>
                <DocTable 
                  headers={['Ausencias', 'Premio']}
                  rows={[
                    ['0 Ausencias', '20%'],
                    ['1 Ausencia', '10%'],
                    ['2+ Ausencias', '0%'],
                  ]}
                />
                <p className="text-xs text-neutral-500 mt-1">Las llegadas tarde NO restan el premio.</p>
              </div>
              <div className="bg-neutral-50 p-3 rounded">
                <p className="text-xs font-medium text-neutral-700 mb-2">Mensualizados</p>
                <p className="text-xs text-neutral-600">
                  Monto: 20% del Básico<br/>
                  Descuento: 5% por cada día de ausencia
                </p>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-xs font-medium text-neutral-700 mb-2">3.5. Antigüedad (0202)</h3>
            <DocTable 
              headers={['Convenio', 'Regla']}
              rows={[
                ['UOM', '1% acumulativo por año de servicio'],
                ['Fuera de Convenio', 'Regla mixta (antiguos 33%, nuevos 1%)'],
              ]}
            />
          </div>
        </div>
      </section>

      {/* 4. Inasistencias */}
      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">4. Gestión de Inasistencias y Licencias</h2>
        <DocTable 
          headers={['Tipo', 'Impacto en Pago', 'Impacto en Presentismo']}
          rows={[
            ['Ausente con Aviso (Enfermedad)', 'Se paga (concepto 0040)', 'Baja a 10% (UOM)'],
            ['Ausente sin Aviso', 'No se paga', 'Pierde 100%'],
            ['Vacaciones (0150)', 'Adelantado (divisor 25)', 'No afecta'],
          ]}
        />
      </section>

      {/* 5. Deducciones */}
      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">5. Deducciones y Retenciones</h2>
        
        <div className="space-y-3">
          <DocTable 
            headers={['Código', 'Concepto', 'Alícuota']}
            rows={[
              ['0401', 'Jubilación', '11%'],
              ['0402', 'Ley 19.032 (PAMI)', '3%'],
              ['0405', 'Obra Social', '3%'],
              ['0421', 'Sindicato UOM (Afiliados)', '2.5%'],
              ['—', 'Sindicato ASIMRA', '3%'],
              ['0419/0423', 'Embargos Judiciales', 'Según decreto'],
              ['0698', 'Ganancias (4ta Cat.)', 'Según escala AFIP'],
            ]}
          />
          
          <div className="bg-neutral-50 p-3 rounded text-xs">
            <strong>Prioridad Embargos:</strong> Alimentos &gt; Comerciales<br/>
            <strong>Ganancias Input:</strong> F.572 (SiRADIG) importado desde AFIP (XML)
          </div>
        </div>
      </section>

      {/* 6. Beneficios */}
      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">6. Logística y Beneficios No Remunerativos</h2>
        <DocTable 
          headers={['Beneficio', 'Regla', 'Detalle']}
          rows={[
            ['Viandas', 'Jornada > 12 horas', 'Corte 08:00 AM, Kalia envía a proveedor'],
            ['Guardería (0273)', 'Contra factura', 'Tope ~$166.000 (Decreto 144/22)'],
            ['Ropa de Trabajo', 'Marzo + Septiembre', 'Relevamiento de talles por Bot'],
          ]}
        />
      </section>

      {/* 7. I/O */}
      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">7. Interfaces de Entrada y Salida (I/O)</h2>
        
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-neutral-700 mb-2">INPUTS (Lo que Kalia lee)</p>
            <DocTable 
              headers={['Origen', 'Contenido', 'Frecuencia']}
              rows={[
                ['InWeb (SQL)', 'Fichadas (CheckIn, CheckOut)', '5 min'],
                ['AFIP (ZIP/XML)', 'Formulario 572 (Ganancias)', 'Mensual'],
                ['Kalia App', 'Novedades, avisos, certificados', 'Tiempo real'],
              ]}
            />
          </div>
          
          <div>
            <p className="text-xs font-medium text-neutral-700 mb-2">OUTPUTS (Lo que Kalia genera)</p>
            <DocTable 
              headers={['Archivo', 'Formato', 'Destino']}
              rows={[
                ['Novedades (Fmt 3)', 'TXT Ancho Fijo', 'Bejerman'],
                ['Importes (Fmt 6)', 'TXT Ancho Fijo', 'Bejerman'],
                ['Libro Sueldo Digital', 'TXT Encriptado', 'AFIP (F.931)'],
                ['Acreditación Bancaria', 'TXT BCRA (150 chars)', 'Banco Macro/Interbanking'],
                ['Recibos de Sueldo', 'PDF', 'WhatsApp'],
              ]}
            />
            <CodeBlock title="Sintaxis Bejerman">{`Legajo(9) + Concepto(9) + Valor(9)
Relleno con ceros a la izquierda

Ejemplo:
      95      001000003900`}</CodeBlock>
          </div>
        </div>
      </section>

      {/* 8. Edge Cases */}
      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">8. Procesos de Borde (Edge Cases)</h2>
        <DocTable 
          headers={['Caso', 'Tratamiento']}
          rows={[
            ['Retroactivos (paritarias)', 'Liquidación complementaria "AJUSTE 0X/202X"'],
            ['Baja/Despido', 'Liquidación final + Bloqueo InWeb + Telegrama'],
            ['Feriados trabajados', 'Se paga como Extra 100% (0030)'],
            ['Canje de Feriados', 'Encuesta de adhesión para días puente'],
          ]}
        />
      </section>
    </div>
  )
}

function OverviewContent() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-neutral-900 mb-2">Overview</h1>
        <p className="text-sm text-neutral-600">
          Arquitectura general y flujos del sistema RRHH de Sicamar.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Diagrama de Integración</h2>
        <CodeBlock>{`┌─────────────────┐     VPN      ┌──────────────────┐     HTTPS     ┌─────────────┐
│  Reloj Huella   │─────────────▶│  Windows Server  │──────────────▶│  Supabase   │
│  Intelektron    │              │  192.168.2.2     │               │  Cloud      │
└─────────────────┘              └──────────────────┘               └─────────────┘
                                        │
                                 Script Node.js
                                 (archivos .rei2)`}</CodeBlock>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Flujo de Datos</h2>
        <div className="flex items-center gap-2 text-sm text-neutral-600 flex-wrap">
          <span className="bg-neutral-100 px-2 py-1 rounded">Fichadas</span>
          <ChevronRight className="w-4 h-4 text-neutral-400" />
          <span className="bg-neutral-100 px-2 py-1 rounded">Marcaciones</span>
          <ChevronRight className="w-4 h-4 text-neutral-400" />
          <span className="bg-neutral-100 px-2 py-1 rounded">Jornadas</span>
          <ChevronRight className="w-4 h-4 text-neutral-400" />
          <span className="bg-neutral-100 px-2 py-1 rounded">Novedades</span>
          <ChevronRight className="w-4 h-4 text-neutral-400" />
          <span className="bg-[#C4322F]/10 text-[#C4322F] px-2 py-1 rounded font-medium">Liquidación</span>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Stack Tecnológico</h2>
        <DocTable 
          headers={['Componente', 'Tecnología']}
          rows={[
            ['Frontend', 'Next.js 15 + Tailwind + shadcn/ui'],
            ['Backend', 'Supabase (PostgreSQL + Edge Functions)'],
            ['Auth', 'Clerk (OTP email)'],
            ['Reloj', 'Intelektron InWeb (SQL Server via VPN)'],
          ]}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Tipos de Liquidación</h2>
        <DocTable 
          headers={['Código', 'Nombre', 'Aplicación']}
          rows={[
            ['PQN', '1era Quincena', 'Jornalizados (1-15)'],
            ['SQN', '2da Quincena', 'Jornalizados (16-fin)'],
            ['MN', 'Mensual', 'Mensualizados'],
            ['VAC', 'Vacaciones', 'Ambos'],
            ['SA1', 'SAC 1er Semestre', 'Ambos'],
            ['SA2', 'SAC 2do Semestre', 'Ambos'],
          ]}
        />
      </section>
    </div>
  )
}

function DatabaseContent() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-neutral-900 mb-2">Database Schema</h1>
        <p className="text-sm text-neutral-600">
          Schema <code className="text-[#C4322F]">sicamar</code> en Supabase (PostgreSQL).
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Tablas Principales</h2>
        <DocTable 
          headers={['Tabla', 'Registros', 'Descripción']}
          rows={[
            ['empleados', '~143', 'Nómina sincronizada desde Bejerman'],
            ['marcaciones', '~1,800', 'Fichadas del reloj Intelektron'],
            ['jornadas_diarias', '~860', 'Horas calculadas por día'],
            ['periodos_liquidacion', '~270', 'Cabecera de liquidaciones'],
            ['liquidacion_detalle', '~500K', 'Conceptos por empleado'],
            ['novedades_liquidacion', '~10K', 'Novedades manuales'],
            ['eventos_asistencia', '—', 'Vacaciones, licencias'],
            ['saldos_vacaciones', '—', 'Contador anual por empleado'],
          ]}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Tabla: empleados</h2>
        <DocTable 
          headers={['Campo', 'Tipo', 'Descripción']}
          rows={[
            ['id', 'bigint', 'PK'],
            ['legajo', 'text', 'Identificador único'],
            ['dni', 'text', 'Documento'],
            ['nombre, apellido', 'text', 'Datos personales'],
            ['categoria', 'text', 'Categoría laboral'],
            ['sector', 'text', 'Área de trabajo'],
            ['salario_basico', 'numeric', 'Valor hora o sueldo'],
            ['clase', 'text', 'Jornal/Mensual'],
            ['bejerman_leg_numero', 'int', 'PK en Bejerman'],
          ]}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Tablas Kalia (Sistema Nervioso)</h2>
        <DocTable 
          headers={['Tabla', 'Descripción']}
          rows={[
            ['kalia_turnos_cerrados', 'Registro de cada turno trabajado'],
            ['kalia_periodos', 'Acumulado por empleado para liquidación'],
            ['kalia_sectores', 'Áreas con condiciones especiales'],
            ['kalia_puestos', 'Puestos de trabajo'],
            ['kalia_polivalencias', 'Matriz empleado × puesto (niveles 1-4)'],
          ]}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Query de ejemplo</h2>
        <CodeBlock title="Empleados activos con su turno">{`SELECT 
  e.legajo,
  e.apellido || ', ' || e.nombre as nombre,
  e.categoria,
  g.nombre as grupo,
  t.codigo as turno_actual
FROM sicamar.empleados e
LEFT JOIN sicamar.grupo_miembros gm ON gm.empleado_id = e.id AND gm.activo
LEFT JOIN sicamar.grupos_rotacion g ON g.id = gm.grupo_id
LEFT JOIN sicamar.rotaciones_semanales rs ON rs.bloque_id = g.bloque_id 
  AND rs.semana_inicio = date_trunc('week', CURRENT_DATE)
LEFT JOIN sicamar.turnos t ON t.id = rs.turno_id
WHERE e.activo = true
ORDER BY e.legajo;`}</CodeBlock>
      </section>
    </div>
  )
}

function ApiContent() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-neutral-900 mb-2">API Reference</h1>
        <p className="text-sm text-neutral-600">
          Base URL: <code className="text-[#C4322F]">/api/sicamar</code>
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Endpoints Disponibles</h2>
        <DocTable 
          headers={['Ruta', 'Métodos', 'Descripción']}
          rows={[
            ['/empleados', 'GET, POST, PATCH', 'CRUD empleados'],
            ['/empleados/[id]', 'GET, PATCH', 'Detalle/edición'],
            ['/marcaciones', 'GET', 'Fichadas del día'],
            ['/jornadas', 'GET, POST', 'Jornadas calculadas'],
            ['/jornadas/procesar-turno-dia', 'POST', 'Calcular jornadas'],
            ['/liquidaciones', 'GET, POST', 'Períodos'],
            ['/liquidaciones/[id]', 'GET', 'Detalle con empleados'],
            ['/liquidaciones/ejecutar', 'POST', 'Calcular liquidación'],
            ['/vacaciones/eventos', 'GET, POST, PATCH', 'Eventos asistencia'],
          ]}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Ejemplo: GET /empleados</h2>
        <CodeBlock>{`// Query params
?activo=true&sector=Fundición&search=perez

// Response
{
  "empleados": [
    {
      "id": 1,
      "legajo": "95",
      "nombre": "Juan",
      "apellido": "Pérez",
      "categoria": "Operario A",
      "sector": "Fundición",
      "activo": true
    }
  ],
  "total": 98
}`}</CodeBlock>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Response Format</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-neutral-500 mb-2">Success</p>
            <CodeBlock>{`{
  "success": true,
  "data": { ... },
  "count": 100
}`}</CodeBlock>
          </div>
          <div>
            <p className="text-xs text-neutral-500 mb-2">Error</p>
            <CodeBlock>{`{
  "success": false,
  "error": "Mensaje",
  "code": "NOT_FOUND"
}`}</CodeBlock>
          </div>
        </div>
      </section>
    </div>
  )
}

function TurnosContent() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-neutral-900 mb-2">Sistema de Turnos</h1>
        <p className="text-sm text-neutral-600">
          Rotaciones, bloques y tipos de hora.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Definición de Turnos</h2>
        <DocTable 
          headers={['Código', 'Horario L-V', 'Sábado', 'Domingo']}
          rows={[
            ['MAÑANA', '06:00 - 14:00', '06:00 - 13:00', 'No'],
            ['TARDE', '14:00 - 22:00', 'No trabaja', 'No'],
            ['NOCHE', '22:00 - 06:00', 'Termina 06:00', 'Entra 00:00'],
            ['CENTRAL', '08:00 - 17:00', 'No trabaja', 'No'],
          ]}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Tipos de Hora</h2>
        <DocTable 
          headers={['Código', 'Nombre', 'Multiplicador', 'Franja']}
          rows={[
            ['HD', 'Hora Diurna', '1.00x', '06:00 - 21:00'],
            ['HN', 'Hora Nocturna', '1.13x', '21:00 - 06:00'],
            ['EX_50_D', 'Extra 50% Diurna', '1.50x', 'Extras diurnas'],
            ['EX_50_N', 'Extra 50% Nocturna', '1.695x', 'Extras nocturnas'],
            ['EX_100', 'Extra 100%', '2.00x', 'Sáb >13hs, Dom, Feriados'],
          ]}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Sábado Inglés</h2>
        <CodeBlock>{`SÁBADO
────────────────────────────────────────────────
00:00 ─────── 13:00 ─────────────────────── 24:00
│             │                               │
│   Normal    │         EXTRA 100%            │
│  o Ex 50%   │       "Sáb Inglés"            │
────────────────────────────────────────────────

DOMINGO = Todo Extra 100%
(Excepción: Turno Noche entra 00:00 → normal)`}</CodeBlock>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Bloques de Rotación</h2>
        <p className="text-sm text-neutral-600 mb-3">
          Grupos de empleados que rotan juntos en la secuencia de turnos.
        </p>
        <CodeBlock>{`Semana actual:     Semana siguiente:
───────────────    ──────────────────
Bloque A: MAÑANA   Bloque A: TARDE
Bloque B: TARDE    Bloque B: NOCHE
Bloque C: NOCHE    Bloque C: MAÑANA`}</CodeBlock>
      </section>
    </div>
  )
}

function LiquidacionesContent() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-neutral-900 mb-2">Motor de Liquidaciones</h1>
        <p className="text-sm text-neutral-600">
          Fórmulas validadas contra Bejerman Sueldos (match 99.8%).
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Uso del Motor</h2>
        <CodeBlock>{`import { LiquidacionEngine } from '@/lib/liquidacion-engine'

const engine = new LiquidacionEngine(
  { fecha_desde: '2025-12-01', fecha_hasta: '2025-12-15', tipo: 'PQN' },
  conceptos
)

const resultado = engine.liquidarEmpleado(empleado, novedades)
// resultado.conceptos = Array de conceptos calculados
// resultado.totales = { haberes, retenciones, neto }`}</CodeBlock>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Fórmulas de Horas (Tipo 0 = Haber)</h2>
        <DocTable 
          headers={['Código', 'Concepto', 'Fórmula']}
          rows={[
            ['0010', 'HORAS DIURNAS', 'SJO × Cantidad'],
            ['0020', 'HORAS NOCTURNAS', 'SJO × Cantidad × 1.133'],
            ['0021', 'HS. EXTRAS 50%', 'SJO × Cantidad × 1.5'],
            ['0025', 'HS. EXTRAS 50% N', 'SJO × Cantidad × 1.5 × 1.133'],
            ['0030', 'HS. EXTRAS 100%', 'SJO × Cantidad × 2.0'],
            ['0050', 'FERIADO', 'SJO × Cantidad'],
          ]}
        />
        <p className="text-xs text-neutral-500 mt-2">SJO = Sueldo o Jornal (valor hora)</p>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Retenciones (Tipo 2)</h2>
        <DocTable 
          headers={['Código', 'Concepto', 'Alícuota']}
          rows={[
            ['0401', 'JUBILACIÓN', '11%'],
            ['0402', 'LEY 19032 (PAMI)', '3%'],
            ['0405', 'OBRA SOCIAL', '3%'],
            ['0421', 'CTA SIND. UOM', '2.5%'],
            ['0441', 'SEGURO VIDA UOM', '$6,579.25 fijo'],
          ]}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Conceptos Calculados</h2>
        <DocTable 
          headers={['Código', 'Concepto', 'Fórmula']}
          rows={[
            ['0120', 'PRESENTISMO', '(Base - Enf - Art66) × 20%'],
            ['0202', 'ANTIGÜEDAD', 'Base × Años × 1%'],
            ['0042', 'Ley 26341', '$150 fijo'],
          ]}
        />
      </section>
    </div>
  )
}

function MarcacionesContent() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-neutral-900 mb-2">Sistema de Marcaciones</h1>
        <p className="text-sm text-neutral-600">
          Sincronización de fichadas desde reloj Intelektron.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Arquitectura</h2>
        <CodeBlock>{`Reloj Huella ──VPN──▶ Windows Server ──HTTPS──▶ Supabase
                      192.168.2.2
                           │
                    Script Node.js
                    (archivos .rei2)`}</CodeBlock>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Formato .rei2</h2>
        <CodeBlock>{`DNI,FECHA,HORA,?,ID_RELOJ,?,TIPO
35470528,03/12/2025,08:14:23,,1,,E`}</CodeBlock>
        <DocTable 
          headers={['Tipo', 'Significado', 'Se convierte a']}
          rows={[
            ['E', 'Entrada', 'E'],
            ['S', 'Salida', 'S'],
            ['EI', 'Entrada Intermedia', 'E'],
            ['SI', 'Salida Intermedia', 'S'],
          ]}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Conexión VPN</h2>
        <DocTable 
          headers={['Parámetro', 'Valor']}
          rows={[
            ['Archivo', 'SCM.ovpn'],
            ['Servidor', 'sicamar.ddns.net:1194 (TCP)'],
            ['IP asignada', '10.0.0.66'],
            ['Red interna', '192.168.2.0/24'],
          ]}
        />
      </section>
    </div>
  )
}

function VacacionesContent() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-neutral-900 mb-2">Vacaciones y Eventos</h1>
        <p className="text-sm text-neutral-600">
          Sistema unificado de ausencias.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Días por Antigüedad</h2>
        <DocTable 
          headers={['Antigüedad', 'Días Corridos', 'Días Hábiles (Tope)']}
          rows={[
            ['< 5 años', '14', '10'],
            ['5-9 años', '21', '15'],
            ['10-19 años', '28', '20'],
            ['≥ 20 años', '35', '25'],
          ]}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Regla: Corridos vs Hábiles</h2>
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
          <p className="font-medium mb-1">⚠️ Problema</p>
          <p>Un empleado con 14 días corridos no puede tomar 14 martes sueltos (serían 14 días hábiles = casi 3 semanas).</p>
        </div>
        <div className="mt-3 bg-neutral-50 border border-neutral-200 rounded p-3 text-sm">
          <p className="font-medium mb-1">Solución</p>
          <p>El sistema maneja dos contadores: <strong>Saldo Legal (Corridos)</strong> y <strong>Saldo Operativo (Hábiles)</strong>.</p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Tipos de Novedad</h2>
        <DocTable 
          headers={['Código', 'Tipo', 'Requiere Certificado']}
          rows={[
            ['0010', 'Enfermedad común', 'Sí'],
            ['0020', 'Accidente laboral (ART)', 'Sí'],
            ['0040', 'Licencia por examen', 'Sí'],
            ['0050', 'Licencia por nacimiento', 'Sí'],
            ['0080', 'Franco compensatorio', 'No'],
            ['0090', 'Vacaciones', 'No'],
            ['0100', 'Falta injustificada', 'No'],
          ]}
        />
      </section>
    </div>
  )
}

function IntegracionesContent() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-neutral-900 mb-2">Integraciones Externas</h1>
        <p className="text-sm text-neutral-600">
          Conexiones con sistemas externos.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Sistemas Conectados</h2>
        <DocTable 
          headers={['Sistema', 'Tipo', 'Uso']}
          rows={[
            ['Intelektron InWeb', 'SQL Server via VPN', 'Marcaciones en tiempo real'],
            ['Bejerman Sueldos', 'SQL Server via VPN', 'Nómina y liquidaciones'],
            ['Supabase', 'PostgreSQL Cloud', 'Backend principal'],
          ]}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Docker Local (Desarrollo)</h2>
        <CodeBlock>{`docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=Bejerman123!" \\
  -p 1433:1433 --name sqlserver_bejerman \\
  -d mcr.microsoft.com/mssql/server:2022-latest

# Conexión: localhost:1433, sa/Bejerman123!`}</CodeBlock>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Formato Export Bejerman</h2>
        <CodeBlock>{`Pos 1-9:   LEGAJO    (derecha, espacios)
Pos 10-18: CONCEPTO  (derecha, espacios)
Pos 19-27: CANTIDAD  (9 chars, 2 dec implícitos)

Ejemplo:
      95      001000003900`}</CodeBlock>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900 mb-3">Estado de Transición</h2>
        <DocTable 
          headers={['Función', 'Actual', 'Objetivo']}
          rows={[
            ['Liquidación', 'Bejerman', 'Kalia'],
            ['Marcaciones', 'Kalia', '✅'],
            ['Vacaciones', 'Kalia', '✅'],
            ['Export AFIP', 'Bejerman', 'Bejerman'],
          ]}
        />
      </section>
    </div>
  )
}

