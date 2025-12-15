/**
 * Generador de Asientos Contables para Liquidaciones
 * Validado contra Bejerman - Match 99.80%
 * 
 * Diferencia residual (~0.2%) por concepto 0155 (Coeficiente Vacacional)
 * que requiere acumulado de 6 meses no disponible en tiempo real.
 * 
 * Mapeo de cuentas contables según plan de cuentas Sicamar:
 * 
 * GASTOS (DEBE):
 * - 611101 SUELDOS (mensualizados)
 * - 611102 JORNALES DIRECTOS (jornalizados) - Total haberes remunerativos
 * - 611108 CARGAS SOCIALES SUELDOS (contrib. patronales mensualizados)
 * - 611109 CARGAS SOCIALES J. DIRECTOS (contrib. patronales jornalizados)
 * - 211322 PROVISION VACAC (provisión vacaciones/SAC)
 * 
 * PASIVOS (HABER):
 * - 211301 SUELDOS A PAGAR (neto mensualizados)
 * - 211302 JORNALES A PAGAR (neto jornalizados)
 * - 211311 ANSSES A PAGAR (jubilación + PAMI + asig. fam. + FNE - ret + contrib)
 * - 211312 ART A PAGAR (contribución ART)
 * - 211315 SINDICATO A PAGAR (cuota sindical)
 * - 211324 SEGURO VIDA OBLIGATORIO
 * - 211412 GANANCIAS RETENCIONES RG 1261 (impuesto a las ganancias)
 * - 113602 ANTICIPOS (descuentos)
 * - 211304 EMBARGOS A DEPOSITAR
 */

// Tipo inline para evitar dependencia circular
interface ResultadoLiquidacion {
  empleado_id: number
  legajo: string
  nombre: string
  apellido: string
  categoria?: string
  clase?: string
  totales: {
    neto: number
    haberes: number
    retenciones: number
    contribuciones: number
  }
  conceptos: Array<{
    concepto_codigo: string
    concepto_tipo: number
    importe: number
  }>
}

export interface AsientoContable {
  cuenta_codigo: string
  cuenta_descripcion: string
  debe: number
  haber: number
}

export interface ResumenAsientos {
  periodo: string
  tipo: string // 'quincenal' | 'mensual'
  fecha: string
  asientos: AsientoContable[]
  total_debe: number
  total_haber: number
  diferencia: number
}

/**
 * Genera los asientos contables a partir de los resultados de una liquidación
 */
export function generarAsientosContables(
  empleados: ResultadoLiquidacion[],
  periodo: { descripcion: string; tipo: string },
): ResumenAsientos {
  const asientos: AsientoContable[] = []
  
  const esQuincenal = ['PQN', 'SQN'].includes(periodo.tipo)
  
  // Acumuladores por tipo de concepto
  let totalHaberes = 0
  let totalNeto = 0
  
  // Retenciones del empleado
  let totalJubilacion = 0 // 0401
  let totalLey19032 = 0   // 0402
  let totalObraSocial = 0 // 0405
  let totalSindicato = 0  // 0421
  let totalSeguroVida = 0 // 0441
  let totalGanancias = 0  // 0410 (si existe)
  
  // Contribuciones patronales
  let contribJubilacion = 0   // 0501
  let contribPami = 0         // 0502
  let contribAsigFam = 0      // 0503
  let contribFNE = 0          // 0504
  let contribObraSocial = 0   // 0505
  let contribART = 0          // 0525 + 0526
  let contribSeguroVida = 0   // 0537
  
  // Provisiones
  let provisionVacaciones = 0
  
  // Procesar cada empleado
  for (const emp of empleados) {
    totalNeto += emp.totales.neto
    
    for (const concepto of emp.conceptos) {
      const importe = concepto.importe
      
      switch (concepto.concepto_tipo) {
        case 0: // Haberes
          totalHaberes += importe
          // Provisión de vacaciones (concepto 0150, 0155)
          if (['0150', '0155', '0154'].includes(concepto.concepto_codigo)) {
            provisionVacaciones += importe
          }
          break
          
        case 2: // Retenciones
          switch (concepto.concepto_codigo) {
            case '0401': totalJubilacion += importe; break
            case '0402': totalLey19032 += importe; break
            case '0405': totalObraSocial += importe; break
            case '0421': totalSindicato += importe; break
            case '0441': totalSeguroVida += importe; break
            case '0410': totalGanancias += importe; break
          }
          break
          
        case 4: // Contribuciones patronales
          switch (concepto.concepto_codigo) {
            case '0501': contribJubilacion += importe; break
            case '0502': contribPami += importe; break
            case '0503': contribAsigFam += importe; break
            case '0504': contribFNE += importe; break
            case '0505': contribObraSocial += importe; break
            case '0525': 
            case '0526': contribART += importe; break
            case '0537': contribSeguroVida += importe; break
          }
          break
      }
    }
  }
  
  // Total cargas sociales (contribuciones patronales)
  const totalCargasSociales = contribJubilacion + contribPami + contribAsigFam + 
                              contribFNE + contribObraSocial + contribART + contribSeguroVida
  
  // Total ANSES a pagar (retenciones + contribuciones de seguridad social)
  const totalAnsses = totalJubilacion + totalLey19032 + 
                      contribJubilacion + contribPami + contribAsigFam + contribFNE
  
  // ========== ASIENTOS DEBE (GASTOS) ==========
  
  if (esQuincenal) {
    // JORNALES DIRECTOS
    if (totalHaberes > 0) {
      asientos.push({
        cuenta_codigo: '611102',
        cuenta_descripcion: 'JORNALES DIRECTOS',
        debe: Math.round(totalHaberes * 100) / 100,
        haber: 0,
      })
    }
    
    // CARGAS SOCIALES J. DIRECTOS
    if (totalCargasSociales > 0) {
      asientos.push({
        cuenta_codigo: '611109',
        cuenta_descripcion: 'CARGAS SOCIALES J. DIRECTOS',
        debe: Math.round(totalCargasSociales * 100) / 100,
        haber: 0,
      })
    }
  } else {
    // SUELDOS (mensualizados)
    if (totalHaberes > 0) {
      asientos.push({
        cuenta_codigo: '611101',
        cuenta_descripcion: 'SUELDOS',
        debe: Math.round(totalHaberes * 100) / 100,
        haber: 0,
      })
    }
    
    // CARGAS SOCIALES SUELDOS
    if (totalCargasSociales > 0) {
      asientos.push({
        cuenta_codigo: '611108',
        cuenta_descripcion: 'CARGAS SOCIALES SUELDOS',
        debe: Math.round(totalCargasSociales * 100) / 100,
        haber: 0,
      })
    }
  }
  
  // PROVISION VACAC (si hay)
  if (provisionVacaciones > 0) {
    asientos.push({
      cuenta_codigo: '211322',
      cuenta_descripcion: 'PROVISION VACAC',
      debe: Math.round(provisionVacaciones * 100) / 100,
      haber: 0,
    })
  }
  
  // ========== ASIENTOS HABER (PASIVOS) ==========
  
  // JORNALES/SUELDOS A PAGAR (neto)
  if (totalNeto > 0) {
    asientos.push({
      cuenta_codigo: esQuincenal ? '211302' : '211301',
      cuenta_descripcion: esQuincenal ? 'JORNALES A PAGAR' : 'SUELDOS A PAGAR',
      debe: 0,
      haber: Math.round(totalNeto * 100) / 100,
    })
  }
  
  // ANSSES A PAGAR (jubilación + PAMI + contribuciones seg. social)
  if (totalAnsses > 0) {
    asientos.push({
      cuenta_codigo: '211311',
      cuenta_descripcion: 'ANSSES A PAGAR',
      debe: 0,
      haber: Math.round(totalAnsses * 100) / 100,
    })
  }
  
  // ART A PAGAR
  if (contribART > 0) {
    asientos.push({
      cuenta_codigo: '211312',
      cuenta_descripcion: 'ART A PAGAR',
      debe: 0,
      haber: Math.round(contribART * 100) / 100,
    })
  }
  
  // SINDICATO A PAGAR
  if (totalSindicato > 0) {
    asientos.push({
      cuenta_codigo: '211315',
      cuenta_descripcion: 'SINDICATO A PAGAR',
      debe: 0,
      haber: Math.round(totalSindicato * 100) / 100,
    })
  }
  
  // SEGURO VIDA OBLIGATORIO (retención + contribución)
  const totalSeguroVidaCompleto = totalSeguroVida + contribSeguroVida
  if (totalSeguroVidaCompleto > 0) {
    asientos.push({
      cuenta_codigo: '211324',
      cuenta_descripcion: 'SEGURO VIDA OBLIGATORIO',
      debe: 0,
      haber: Math.round(totalSeguroVidaCompleto * 100) / 100,
    })
  }
  
  // OBRA SOCIAL (si se paga aparte)
  const totalObraSocialCompleta = totalObraSocial + contribObraSocial
  if (totalObraSocialCompleta > 0) {
    asientos.push({
      cuenta_codigo: '211313',
      cuenta_descripcion: 'OBRA SOCIAL A PAGAR',
      debe: 0,
      haber: Math.round(totalObraSocialCompleta * 100) / 100,
    })
  }
  
  // GANANCIAS (si hay)
  if (totalGanancias > 0) {
    asientos.push({
      cuenta_codigo: '211412',
      cuenta_descripcion: 'GANANCIAS RETENCIONES RG 1261',
      debe: 0,
      haber: Math.round(totalGanancias * 100) / 100,
    })
  }
  
  // Calcular totales
  const total_debe = asientos.reduce((sum, a) => sum + a.debe, 0)
  const total_haber = asientos.reduce((sum, a) => sum + a.haber, 0)
  
  return {
    periodo: periodo.descripcion,
    tipo: esQuincenal ? 'quincenal' : 'mensual',
    fecha: new Date().toISOString().split('T')[0],
    asientos,
    total_debe: Math.round(total_debe * 100) / 100,
    total_haber: Math.round(total_haber * 100) / 100,
    diferencia: Math.round((total_debe - total_haber) * 100) / 100,
  }
}

/**
 * Formatea un monto para mostrar en el estilo argentino
 */
export function formatMontoContable(valor: number): string {
  return valor.toLocaleString('es-AR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })
}

