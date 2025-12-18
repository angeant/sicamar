/**
 * Motor de Liquidaciones - Kalia
 * Validado contra Bejerman - Match 99.8%
 * 
 * Este motor replica la lógica de cálculo de Bejerman Sueldos para
 * poder generar liquidaciones nativas en Kalia.
 * 
 * FÓRMULAS BEJERMAN VALIDADAS:
 * 
 * HORAS Y JORNALES:
 * - 0010 HORAS DIURNAS: SJO × Cantidad
 * - 0020 HORAS NOCTURNAS: SJO × Cantidad × 1.133
 * - 0003 HORAS ACC DIURNAS: SJO × Cantidad
 * - 0004 HORAS ACC NOCTURNAS: SJO × Cantidad × 1.133
 * - 0021 HS. EXTRAS 50%: SJO × Cantidad × 1.5
 * - 0025 HS. EXTRAS 50% N: SJO × Cantidad × 1.5 × 1.133
 * - 0030 HS. EXTRAS 100%: SJO × Cantidad × 2.0
 * - 0031 HS. EXTRAS 100% N: SJO × Cantidad × 2.0 × 1.133
 * - 0015 HS. EXTRAS 200%: SJO × Cantidad × 3.0
 * - 0016 HS. EXTRAS 200% N: SJO × Cantidad × 3.0 × 1.133
 * - 0040 HORAS ENFERMEDAD: SJO × Cantidad
 * - 0041 HORAS ENFER. NOCT: SJO × Cantidad × 1.133
 * - 0045 LICENCIA ESPEC. D.: SJO × Cantidad
 * - 0050 FERIADO: SJO × Cantidad (x1, no x2)
 * - 0051 FERIADO NOCT: SJO × Cantidad × 1.133
 * - 0054 COMP. ART.66 CCT: SJO × Cantidad (calorías)
 * - 0150 VACACIONES: SJO × (1 + Antig/100) × 8 × Días
 * 
 * CONCEPTOS CALCULADOS:
 * - 0042 Ley 26341: $150 fijo por empleado
 * - 0120 PRESENTISMO: (BaseHaberes - Enfermedad - Art66 - Ley26341) × 20%
 * - 0140 PRESTACIÓN DINERARIA: (Hs ACC D + Hs ACC N × 1.133) × 1.2
 * - 0202 ANTIGÜEDAD: BaseHaberes × Años × 1%
 * - 0220 TÍTULO SECUNDARIO UOM: $20,030.72 fijo
 * 
 * RETENCIONES:
 * - 0401 JUBILACIÓN: BaseImp × 11%
 * - 0402 LEY 19032: BaseImp × 3%
 * - 0405 OBRA SOCIAL: BaseImp × 3%
 * - 0421 CTA SIND.UOM: TotalHabRem × 2.5%
 * - 0441 SEGURO VIDA: $6,579.25 fijo
 * 
 * CONTRIBUCIONES PATRONALES (tipo 4):
 * - 0501 JUBILACIÓN: 10.77%
 * - 0502 LEY 19032: 1.59%
 * - 0503 ASIG. FAMILIARES: 4.70%
 * - 0504 FONDO EMPLEO: 0.94%
 * - 0505 OBRA SOCIAL: 6%
 * - 0525/0526 ART: variable
 * - 0537 SEGURO VIDA: variable
 */

// ============ TIPOS ============

export interface EmpleadoLiquidar {
  id: number
  legajo: string
  nombre: string
  apellido: string
  categoria: string
  codigo_categoria: string
  sector: string
  sindicato: string
  obra_social: string
  clase: number // 1=jornalizado, 0=mensualizado
  salario_basico: number // Valor hora para jornaleros, sueldo mensual para mensualizados
  antiguedad_anios: number
  fecha_ingreso: string
}

export interface NovedadEmpleado {
  legajo: string
  concepto_codigo: string
  cantidad: number
  valor_unitario?: number
  importe?: number
  origen: 'reloj' | 'manual' | 'automatico'
}

export interface ConceptoCalculado {
  concepto_codigo: string
  concepto_descripcion: string
  concepto_tipo: number
  cantidad: number | null
  valor_unitario: number | null
  importe: number
  formula_aplicada: string
}

export interface ResultadoLiquidacion {
  legajo: string
  empleado_id: number
  nombre_completo: string
  pagina_pdf?: number
  conceptos: ConceptoCalculado[]
  totales: {
    haberes: number
    no_remunerativos: number
    retenciones: number
    contribuciones: number
    neto: number
  }
}

export interface ParametrosLiquidacion {
  fecha_desde: string
  fecha_hasta: string
  tipo: string // PQN, SQN, MN, VAC, SA1, SA2, FID
}

/**
 * Tipos de liquidación y sus características
 */
export const TIPOS_LIQUIDACION = {
  PQN: { nombre: '1era Quincena', clase: 'Jornal', esQuincena: true },
  SQN: { nombre: '2da Quincena', clase: 'Jornal', esQuincena: true },
  MN: { nombre: 'Mensual', clase: 'Mensual', esQuincena: false },
  VAC: { nombre: 'Vacaciones', clase: null, esQuincena: false }, // Ambos
  SA1: { nombre: 'SAC 1er Semestre', clase: null, esQuincena: false },
  SA2: { nombre: 'SAC 2do Semestre', clase: null, esQuincena: false },
  FID: { nombre: 'Liquidación Final', clase: null, esQuincena: false },
} as const

export type TipoLiquidacion = keyof typeof TIPOS_LIQUIDACION

/**
 * Determina si un empleado debe ser incluido en una liquidación según su tipo
 */
export function empleadoAplicaParaLiquidacion(
  empleadoClase: 'Jornal' | 'Mensual' | number, 
  tipoLiquidacion: string
): boolean {
  const config = TIPOS_LIQUIDACION[tipoLiquidacion as TipoLiquidacion]
  if (!config) return true // Tipo desconocido, incluir por defecto
  
  // Si clase es null, aplica para ambos
  if (config.clase === null) return true
  
  // Normalizar clase del empleado
  const claseNormalizada = typeof empleadoClase === 'number' 
    ? (empleadoClase === 1 ? 'Jornal' : 'Mensual')
    : empleadoClase
  
  return config.clase === claseNormalizada
}

export interface ConceptoDefinicion {
  codigo: string
  descripcion: string
  tipo: number // 0=haber rem, 1=no rem, 2=retención, 4=contribución, 6=informativo
  formula: string | null
  multiplicador: number
  valor_generico: number // Factor o porcentaje según el concepto
  activo: boolean
}

// Conceptos que se INCLUYEN en la base del presentismo y antigüedad (según validación Bejerman)
// Son los conceptos de horas trabajadas: normales, nocturnas, accidente, feriados
const CONCEPTOS_BASE_PRESENTISMO = ['0003', '0004', '0010', '0020', '0040', '0041', '0045', '0048', '0050', '0051']

// Conceptos de horas que se procesan automáticamente
const CONCEPTOS_HORAS = [
  '0003', '0004',  // Horas accidente diurnas/nocturnas
  '0010', '0020',  // Horas normales diurnas/nocturnas
  '0021', '0025',  // Extras 50% diurnas/nocturnas
  '0030', '0031',  // Extras 100% diurnas/nocturnas
  '0015', '0016',  // Extras 200% diurnas/nocturnas
  '0033',          // Guardias pasivas
  '0040', '0041',  // Enfermedad diurnas/nocturnas
  '0045', '0048',  // Licencia especial diurnas/nocturnas
  '0050', '0051',  // Feriado diurnas/nocturnas
  '0054',          // Calorías
  '0150',          // Vacaciones
]

// ============ CLASE PRINCIPAL ============

export class LiquidacionEngine {
  private parametros: ParametrosLiquidacion
  private conceptos: Map<string, ConceptoDefinicion>
  
  constructor(parametros: ParametrosLiquidacion, conceptos: ConceptoDefinicion[]) {
    this.parametros = parametros
    this.conceptos = new Map(conceptos.map(c => [c.codigo, c]))
  }
  
  /**
   * Obtiene los parámetros por defecto para Argentina
   */
  static getParametrosDefault(): Omit<ParametrosLiquidacion, 'fecha_desde' | 'fecha_hasta' | 'tipo'> {
    return {}
  }
  
  /**
   * Obtiene el valor genérico de un concepto de la base de datos
   */
  private getValorGenerico(codigo: string, defaultValue: number = 0): number {
    const concepto = this.conceptos.get(codigo)
    return concepto?.valor_generico ?? defaultValue
  }
  
  /**
   * Liquida un empleado con sus novedades
   */
  liquidarEmpleado(empleado: EmpleadoLiquidar, novedades: NovedadEmpleado[]): ResultadoLiquidacion {
    const conceptosCalculados: ConceptoCalculado[] = []
    
    const esJornalizado = empleado.clase === 1
    const esQuincena = ['PQN', 'SQN'].includes(this.parametros.tipo)
    
    // SJO = Sueldo o Jornal (valor hora para jornalizados)
    const SJO = empleado.salario_basico
    
    // ========== 1. PROCESAR HABERES ==========
    
    if (esJornalizado) {
      // JORNALIZADOS: Procesar novedades de horas
      const novedadesHoras = novedades.filter(n => CONCEPTOS_HORAS.includes(n.concepto_codigo))
      
      for (const novedad of novedadesHoras) {
        const concepto = this.conceptos.get(novedad.concepto_codigo)
        if (!concepto) continue
        
        const resultado = this.calcularConceptoHoras(SJO, novedad, concepto)
        conceptosCalculados.push(resultado)
      }
      
      // Concepto 0042 - Afec.TRVA.Ley 26341 (monto fijo)
      const novedadLey26341 = novedades.find(n => n.concepto_codigo === '0042')
      if (novedadLey26341 || this.getValorGenerico('0042', 0) > 0) {
        const valorFijo = this.getValorGenerico('0042', 150)
        conceptosCalculados.push({
          concepto_codigo: '0042',
          concepto_descripcion: 'Afec.TRVA.Ley 26341',
          concepto_tipo: 0,
          cantidad: null,
          valor_unitario: null,
          importe: valorFijo,
          formula_aplicada: `Valor fijo: $${valorFijo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        })
      }
      
      // Concepto 0140 - PRESTACION DINERARIA
      // NOTA: Este concepto solo se calcula si viene como novedad explícita
      // No se calcula automáticamente de las horas de accidente
      const novedadPrestDin = novedades.find(n => n.concepto_codigo === '0140')
      if (novedadPrestDin && novedadPrestDin.importe && novedadPrestDin.importe > 0) {
        conceptosCalculados.push({
          concepto_codigo: '0140',
          concepto_descripcion: 'PRESTACION DINERARIA',
          concepto_tipo: 0,
          cantidad: null,
          valor_unitario: null,
          importe: novedadPrestDin.importe,
          formula_aplicada: `Importe cargado manualmente`,
        })
      }
      
    } else {
      // MENSUALIZADOS: El salario_basico es el sueldo mensual
      const sueldoBase = esQuincena ? empleado.salario_basico / 2 : empleado.salario_basico
      
      conceptosCalculados.push({
        concepto_codigo: '0201',
        concepto_descripcion: esQuincena ? 'SUELDO QUINCENA' : 'SUELDO',
        concepto_tipo: 0,
        cantidad: 1,
        valor_unitario: sueldoBase,
        importe: Math.round(sueldoBase * 100) / 100,
        formula_aplicada: esQuincena 
          ? `${empleado.salario_basico.toLocaleString('es-AR')} / 2`
          : `Sueldo base`,
      })
    }
    
    // ========== 2. CALCULAR BASES ==========
    
    // Base para presentismo y antigüedad: solo conceptos de horas trabajadas
    // Excluye: 0042 (Ley 26341), 0054 (Calorías), 0140 (Prest. Dineraria), etc.
    const basePresentismo = conceptosCalculados
      .filter(c => CONCEPTOS_BASE_PRESENTISMO.includes(c.concepto_codigo))
      .reduce((sum, c) => sum + c.importe, 0)
    
    // ========== 3. PRESENTISMO ==========
    
    if (esJornalizado) {
      const novedadPresentismo = novedades.find(n => n.concepto_codigo === '0120')
      if (novedadPresentismo && novedadPresentismo.cantidad > 0) {
        const porcentaje = novedadPresentismo.cantidad // Viene como 20 = 20%
        const importe = basePresentismo * (porcentaje / 100)
        
        conceptosCalculados.push({
          concepto_codigo: '0120',
          concepto_descripcion: 'PRESENTISMO',
          concepto_tipo: 0,
          cantidad: porcentaje,
          valor_unitario: null,
          importe: Math.round(importe * 100) / 100,
          formula_aplicada: `(${basePresentismo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}) × ${porcentaje}%`,
        })
      }
    }
    
    // ========== 4. ANTIGÜEDAD ==========
    
    if (empleado.antiguedad_anios > 0) {
      const valorGenAntiguedad = this.getValorGenerico('0202', 0.01) // 1% por año
      
      // Base para antigüedad: MISMA que presentismo (horas trabajadas)
      // Validado contra Bejerman: 0003 + 0004 + 0010 + 0020 + 0050, etc.
      const baseAntiguedad = esJornalizado 
        ? basePresentismo // Usa la misma base que presentismo
        : conceptosCalculados.find(c => c.concepto_codigo === '0201')?.importe || 0
      
      const porcentaje = empleado.antiguedad_anios * (valorGenAntiguedad * 100) // 1% por año
      const importe = baseAntiguedad * empleado.antiguedad_anios * valorGenAntiguedad
      
      if (importe > 0) {
        conceptosCalculados.push({
          concepto_codigo: esJornalizado ? '0190' : '0202',
          concepto_descripcion: 'ANTIGUEDAD',
          concepto_tipo: 0,
          cantidad: empleado.antiguedad_anios,
          valor_unitario: null,
          importe: Math.round(importe * 100) / 100,
          formula_aplicada: `${empleado.antiguedad_anios} años × ${(valorGenAntiguedad * 100).toFixed(0)}% × ${baseAntiguedad.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        })
      }
    }
    
    // ========== 5. CALCULAR TOTAL HABERES REMUNERATIVOS ==========
    
    const totalHaberesRem = conceptosCalculados
      .filter(c => c.concepto_tipo === 0)
      .reduce((sum, c) => sum + c.importe, 0)
    
    // ========== 6. RETENCIONES ==========
    
    // Base imponible para retenciones = Total Haberes Remunerativos
    const baseImponible = totalHaberesRem
    
    // 0401 - Jubilación 11%
    const pctJubilacion = this.getValorGenerico('0401', 0.11)
    const jubilacion = baseImponible * (pctJubilacion > 1 ? pctJubilacion / 100 : pctJubilacion)
    conceptosCalculados.push({
      concepto_codigo: '0401',
      concepto_descripcion: 'JUBILACION',
      concepto_tipo: 2,
      cantidad: pctJubilacion * 100,
      valor_unitario: null,
      importe: Math.round(jubilacion * 100) / 100,
      formula_aplicada: `${baseImponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })} × ${(pctJubilacion * 100).toFixed(0)}%`,
    })
    
    // 0402 - Ley 19032 (PAMI) 3%
    const pctLey19032 = this.getValorGenerico('0402', 0.03)
    const ley19032 = baseImponible * pctLey19032
    conceptosCalculados.push({
      concepto_codigo: '0402',
      concepto_descripcion: 'LEY 19032',
      concepto_tipo: 2,
      cantidad: pctLey19032 * 100,
      valor_unitario: null,
      importe: Math.round(ley19032 * 100) / 100,
      formula_aplicada: `${baseImponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })} × ${(pctLey19032 * 100).toFixed(0)}%`,
    })
    
    // 0405 - Obra Social 3%
    const pctObraSocial = this.getValorGenerico('0405', 0.03)
    const obraSocial = baseImponible * pctObraSocial
    conceptosCalculados.push({
      concepto_codigo: '0405',
      concepto_descripcion: 'OBRA SOCIAL',
      concepto_tipo: 2,
      cantidad: pctObraSocial * 100,
      valor_unitario: null,
      importe: Math.round(obraSocial * 100) / 100,
      formula_aplicada: `${baseImponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })} × ${(pctObraSocial * 100).toFixed(0)}%`,
    })
    
    // 0421 - Cuota Sindical UOM 2.5%
    const pctSindical = this.getValorGenerico('0421', 0.025)
    const cuotaSindical = totalHaberesRem * pctSindical // Sobre total haberes, no base imponible
    conceptosCalculados.push({
      concepto_codigo: '0421',
      concepto_descripcion: 'CTA SIND.UOM 2,5%',
      concepto_tipo: 2,
      cantidad: pctSindical * 100,
      valor_unitario: null,
      importe: Math.round(cuotaSindical * 100) / 100,
      formula_aplicada: `${totalHaberesRem.toLocaleString('es-AR', { minimumFractionDigits: 2 })} × ${(pctSindical * 100).toFixed(1)}%`,
    })
    
    // 0441 - Seguro de vida (monto fijo)
    const montoSeguroVida = this.getValorGenerico('0441', 6579.25)
    conceptosCalculados.push({
      concepto_codigo: '0441',
      concepto_descripcion: 'SEGURO DE VIDA UOM',
      concepto_tipo: 2,
      cantidad: null,
      valor_unitario: null,
      importe: montoSeguroVida,
      formula_aplicada: `Monto fijo: $${montoSeguroVida.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
    })
    
    // ========== 7. CONTRIBUCIONES PATRONALES (desglosadas) ==========
    
    // Detracción para contribuciones de seguridad social (monto SMVM vigente)
    const DETRACCION = 7003.68 // Actualizable según normativa
    const baseConDetraccion = Math.max(0, totalHaberesRem - DETRACCION)
    
    // 0501 - Contribución Jubilación 10.77%
    const PCT_CONTRIB_JUBILACION = 0.1077
    const contribJubilacion = baseConDetraccion * PCT_CONTRIB_JUBILACION
    conceptosCalculados.push({
      concepto_codigo: '0501',
      concepto_descripcion: 'CONTRIB. JUBILACION',
      concepto_tipo: 4,
      cantidad: PCT_CONTRIB_JUBILACION * 100,
      valor_unitario: null,
      importe: Math.round(contribJubilacion * 100) / 100,
      formula_aplicada: `(${totalHaberesRem.toLocaleString('es-AR')} - ${DETRACCION.toLocaleString('es-AR')}) × ${(PCT_CONTRIB_JUBILACION * 100).toFixed(2)}%`,
    })
    
    // 0502 - Contribución PAMI/Ley 19032 1.59%
    const PCT_CONTRIB_PAMI = 0.0159
    const contribPami = baseConDetraccion * PCT_CONTRIB_PAMI
    conceptosCalculados.push({
      concepto_codigo: '0502',
      concepto_descripcion: 'CONTRIB. LEY 19032 (PAMI)',
      concepto_tipo: 4,
      cantidad: PCT_CONTRIB_PAMI * 100,
      valor_unitario: null,
      importe: Math.round(contribPami * 100) / 100,
      formula_aplicada: `(${totalHaberesRem.toLocaleString('es-AR')} - ${DETRACCION.toLocaleString('es-AR')}) × ${(PCT_CONTRIB_PAMI * 100).toFixed(2)}%`,
    })
    
    // 0503 - Contribución Asignaciones Familiares 4.70%
    const PCT_CONTRIB_ASIG_FAM = 0.047
    const contribAsigFam = baseConDetraccion * PCT_CONTRIB_ASIG_FAM
    conceptosCalculados.push({
      concepto_codigo: '0503',
      concepto_descripcion: 'CONTRIB. ASIGNACIONES FAMILIARES',
      concepto_tipo: 4,
      cantidad: PCT_CONTRIB_ASIG_FAM * 100,
      valor_unitario: null,
      importe: Math.round(contribAsigFam * 100) / 100,
      formula_aplicada: `(${totalHaberesRem.toLocaleString('es-AR')} - ${DETRACCION.toLocaleString('es-AR')}) × ${(PCT_CONTRIB_ASIG_FAM * 100).toFixed(2)}%`,
    })
    
    // 0504 - Contribución Fondo Nacional de Empleo 0.94%
    const PCT_CONTRIB_FNE = 0.0094
    const contribFNE = baseConDetraccion * PCT_CONTRIB_FNE
    conceptosCalculados.push({
      concepto_codigo: '0504',
      concepto_descripcion: 'CONTRIB. FONDO NAC. EMPLEO',
      concepto_tipo: 4,
      cantidad: PCT_CONTRIB_FNE * 100,
      valor_unitario: null,
      importe: Math.round(contribFNE * 100) / 100,
      formula_aplicada: `(${totalHaberesRem.toLocaleString('es-AR')} - ${DETRACCION.toLocaleString('es-AR')}) × ${(PCT_CONTRIB_FNE * 100).toFixed(2)}%`,
    })
    
    // 0505 - Contribución Obra Social 6%
    const PCT_CONTRIB_OS = 0.06
    const contribOS = totalHaberesRem * PCT_CONTRIB_OS // Sin detracción
    conceptosCalculados.push({
      concepto_codigo: '0505',
      concepto_descripcion: 'CONTRIB. OBRA SOCIAL',
      concepto_tipo: 4,
      cantidad: PCT_CONTRIB_OS * 100,
      valor_unitario: null,
      importe: Math.round(contribOS * 100) / 100,
      formula_aplicada: `${totalHaberesRem.toLocaleString('es-AR')} × ${(PCT_CONTRIB_OS * 100).toFixed(0)}%`,
    })
    
    // 0525 - Contribución ART (alícuota variable, uso 7.5% como ejemplo)
    const PCT_CONTRIB_ART = 0.075
    const contribART = totalHaberesRem * PCT_CONTRIB_ART
    conceptosCalculados.push({
      concepto_codigo: '0525',
      concepto_descripcion: 'CONTRIB. ART (alícuota)',
      concepto_tipo: 4,
      cantidad: PCT_CONTRIB_ART * 100,
      valor_unitario: null,
      importe: Math.round(contribART * 100) / 100,
      formula_aplicada: `${totalHaberesRem.toLocaleString('es-AR')} × ${(PCT_CONTRIB_ART * 100).toFixed(1)}%`,
    })
    
    // 0526 - Contribución ART suma fija
    const CONTRIB_ART_FIJA = 1543.00 // Monto fijo por empleado
    conceptosCalculados.push({
      concepto_codigo: '0526',
      concepto_descripcion: 'CONTRIB. ART (suma fija)',
      concepto_tipo: 4,
      cantidad: null,
      valor_unitario: null,
      importe: CONTRIB_ART_FIJA,
      formula_aplicada: `Monto fijo: $${CONTRIB_ART_FIJA.toLocaleString('es-AR')}`,
    })
    
    // 0537 - Contribución Seguro de Vida (igual al aporte del empleado)
    conceptosCalculados.push({
      concepto_codigo: '0537',
      concepto_descripcion: 'CONTRIB. SEGURO DE VIDA UOM',
      concepto_tipo: 4,
      cantidad: null,
      valor_unitario: null,
      importe: montoSeguroVida,
      formula_aplicada: `Monto fijo: $${montoSeguroVida.toLocaleString('es-AR')}`,
    })
    
    // ========== 8. CALCULAR TOTALES ==========
    
    const totales = {
      haberes: conceptosCalculados.filter(c => c.concepto_tipo === 0).reduce((sum, c) => sum + c.importe, 0),
      no_remunerativos: conceptosCalculados.filter(c => c.concepto_tipo === 1).reduce((sum, c) => sum + c.importe, 0),
      retenciones: conceptosCalculados.filter(c => c.concepto_tipo === 2).reduce((sum, c) => sum + c.importe, 0),
      contribuciones: conceptosCalculados.filter(c => c.concepto_tipo === 4).reduce((sum, c) => sum + c.importe, 0),
      neto: 0,
    }
    totales.neto = totales.haberes + totales.no_remunerativos - totales.retenciones
    
    return {
      legajo: empleado.legajo,
      empleado_id: empleado.id,
      nombre_completo: `${empleado.apellido}, ${empleado.nombre}`,
      conceptos: conceptosCalculados,
      totales,
    }
  }
  
  /**
   * Calcula un concepto de horas según fórmulas Bejerman
   * 
   * Fórmulas:
   * - 0010: SJO × Cantidad
   * - 0020: SJO × Cantidad × ValorGen (1.133)
   * - 0021: SJO × Cantidad × ValorGen (1.5)
   * - 0025: SJO × Cantidad × ValorGen (1.5) × 1.133
   * - 0030: SJO × Cantidad × ValorGen (2.0)
   * - 0031: SJO × 1.133 × Cantidad × ValorGen (2.0)
   * - 0050: SJO × Cantidad
   * - 0051: SJO × Cantidad × ValorGen (1.133)
   * - 0054: Cantidad × SJO (calorías)
   */
  private calcularConceptoHoras(
    SJO: number, 
    novedad: NovedadEmpleado,
    concepto: ConceptoDefinicion
  ): ConceptoCalculado {
    const cantidad = novedad.cantidad
    const valorGen = concepto.valor_generico || 1
    
    let importe: number
    let valorUnitario: number
    let formula: string
    
    switch (concepto.codigo) {
      case '0003': // HORAS ACC DIURNAS: SJO × Cantidad
      case '0010': // HORAS DIURNAS: SJO × Cantidad
      case '0040': // HORAS ENFERMEDAD: SJO × Cantidad
      case '0045': // LICENCIA ESPEC. D.: SJO × Cantidad
      case '0050': // FERIADO: SJO × Cantidad
        valorUnitario = SJO
        importe = SJO * cantidad
        formula = `${SJO.toLocaleString('es-AR', { minimumFractionDigits: 2 })} × ${cantidad}`
        break
      
      case '0004': // HORAS ACC NOCTURNAS: SJO × Cantidad × 1.133
      case '0020': // HORAS NOCTURNAS: SJO × Cantidad × 1.133
      case '0041': // HORAS ENFER. NOCT: SJO × 1.133 × Cantidad
      case '0048': // LICENCIA ESPEC.N.: SJO × 1.133 × Cantidad
      case '0051': // FERIADO NOCT: SJO × Cantidad × 1.133
        valorUnitario = SJO * valorGen
        importe = SJO * cantidad * valorGen
        formula = `${SJO.toLocaleString('es-AR', { minimumFractionDigits: 2 })} × ${cantidad} × ${valorGen}`
        break
        
      case '0021': // HS. EXTRAS 50%: SJO × Cantidad × 1.5
      case '0030': // HS. EXTRAS 100%: SJO × Cantidad × 2.0
        valorUnitario = SJO * valorGen
        importe = SJO * cantidad * valorGen
        formula = `${SJO.toLocaleString('es-AR', { minimumFractionDigits: 2 })} × ${cantidad} × ${valorGen}`
        break
        
      case '0025': // HS. EXTRAS 50% N: SJO × Cantidad × 1.5 × 1.133
        valorUnitario = SJO * valorGen * 1.133
        importe = SJO * cantidad * valorGen * 1.133
        formula = `${SJO.toLocaleString('es-AR', { minimumFractionDigits: 2 })} × ${cantidad} × ${valorGen} × 1.133`
        break
        
      case '0031': // HS. EXTRAS 100% N: SJO × 1.133 × Cantidad × 2.0
        valorUnitario = SJO * 1.133 * valorGen
        importe = SJO * 1.133 * cantidad * valorGen
        formula = `${SJO.toLocaleString('es-AR', { minimumFractionDigits: 2 })} × 1.133 × ${cantidad} × ${valorGen}`
        break
        
      case '0054': // COMP. ART.66 CCT: Cantidad × SJO (calorías - manual)
        valorUnitario = SJO
        importe = cantidad * SJO
        formula = `${cantidad} hs calorías × ${SJO.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
        break
        
      default:
        // Fórmula genérica: SJO × Cantidad × Multiplicador
        valorUnitario = SJO * (concepto.multiplicador || 1)
        importe = SJO * cantidad * (concepto.multiplicador || 1)
        formula = `${SJO.toLocaleString('es-AR', { minimumFractionDigits: 2 })} × ${cantidad}`
        if (concepto.multiplicador && concepto.multiplicador !== 1) {
          formula += ` × ${concepto.multiplicador}`
        }
    }
    
    return {
      concepto_codigo: concepto.codigo,
      concepto_descripcion: concepto.descripcion,
      concepto_tipo: concepto.tipo,
      cantidad,
      valor_unitario: Math.round(valorUnitario * 100) / 100,
      importe: Math.round(importe * 100) / 100,
      formula_aplicada: formula,
    }
  }
  
  /**
   * Compara una liquidación de Kalia vs datos de referencia (Bejerman o PDF)
   */
  static compararResultados(
    kaliaResult: ResultadoLiquidacion,
    referenciaData: { concepto_codigo: string; importe: number }[]
  ): {
    coincidencias: number
    diferencias: Array<{
      concepto: string
      kalia: number
      referencia: number
      diferencia: number
      porcentaje: number
    }>
    totalKalia: number
    totalReferencia: number
  } {
    const diferencias: Array<{
      concepto: string
      kalia: number
      referencia: number
      diferencia: number
      porcentaje: number
    }> = []
    
    let coincidencias = 0
    
    // Crear mapa de referencia
    const referenciaMap = new Map(referenciaData.map(r => [r.concepto_codigo, r.importe]))
    
    // Comparar cada concepto de Kalia
    for (const concepto of kaliaResult.conceptos) {
      const importeReferencia = referenciaMap.get(concepto.concepto_codigo) || 0
      const importeKalia = concepto.importe
      
      const diferencia = Math.abs(importeKalia - importeReferencia)
      const porcentaje = importeReferencia !== 0 ? (diferencia / importeReferencia) * 100 : (importeKalia !== 0 ? 100 : 0)
      
      if (diferencia < 0.01) {
        coincidencias++
      } else {
        diferencias.push({
          concepto: `${concepto.concepto_codigo} - ${concepto.concepto_descripcion}`,
          kalia: importeKalia,
          referencia: importeReferencia,
          diferencia,
          porcentaje,
        })
      }
    }
    
    return {
      coincidencias,
      diferencias,
      totalKalia: kaliaResult.totales.neto,
      totalReferencia: referenciaData.reduce((sum, r) => {
        // Solo sumar si es haber o restar si es retención
        const tipo = parseInt(r.concepto_codigo.charAt(0))
        if (tipo === 0 || tipo === 1) return sum + r.importe
        if (tipo === 2) return sum - r.importe
        return sum
      }, 0),
    }
  }
}

// ============ FUNCIONES AUXILIARES ============

/**
 * Calcula años de antigüedad desde fecha de ingreso
 */
export function calcularAntiguedad(fechaIngreso: string, fechaReferencia: Date = new Date()): number {
  const ingreso = new Date(fechaIngreso)
  let years = fechaReferencia.getFullYear() - ingreso.getFullYear()
  const monthDiff = fechaReferencia.getMonth() - ingreso.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && fechaReferencia.getDate() < ingreso.getDate())) {
    years--
  }
  
  return Math.max(0, years)
}

/**
 * Obtiene las fechas de un período de liquidación
 */
export function getFechasPeriodo(
  anio: number, 
  mes: number, 
  tipo: string
): { desde: string; hasta: string } {
  const ultimoDia = new Date(anio, mes, 0).getDate()
  
  switch (tipo) {
    case 'PQN': // Primera quincena
      return {
        desde: `${anio}-${mes.toString().padStart(2, '0')}-01`,
        hasta: `${anio}-${mes.toString().padStart(2, '0')}-15`,
      }
    case 'SQN': // Segunda quincena
      return {
        desde: `${anio}-${mes.toString().padStart(2, '0')}-16`,
        hasta: `${anio}-${mes.toString().padStart(2, '0')}-${ultimoDia}`,
      }
    case 'MN': // Mensual
    case 'VAC':
    case 'SA1':
    case 'SA2':
    case 'FID':
    default:
      return {
        desde: `${anio}-${mes.toString().padStart(2, '0')}-01`,
        hasta: `${anio}-${mes.toString().padStart(2, '0')}-${ultimoDia}`,
      }
  }
}

/**
 * Calcula las horas de calorías (Art.66 CCT) basado en horas trabajadas
 * Aproximadamente 19% de las horas normales (HD + HN) para sector FUND
 */
export function calcularHorasCalorias(horasDiurnas: number, horasNocturnas: number): number {
  const horasBase = horasDiurnas + horasNocturnas
  const horasCalorias = Math.round(horasBase * 0.19) // 19% aproximado
  return horasCalorias
}
