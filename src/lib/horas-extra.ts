/**
 * 📐 ALGORITMO DE VALORACIÓN DE HORAS EXTRAS (Kalia Core)
 * 
 * Este módulo implementa la lógica de cálculo y clasificación de horas extra
 * según el convenio colectivo de trabajo.
 * 
 * REGLA ESPECIAL FIN DE SEMANA:
 * - Sábado desde las 13:00 hs → TODO es hora extra al 100%
 * - Domingo completo → TODO es hora extra al 100%
 */

// Códigos de concepto para liquidación
export const CODIGOS_HORA_EXTRA = {
  EXTRA_50_DIU: '0021',   // Hora Extra al 50% Diurna
  EXTRA_50_NOC: '0025',   // Hora Extra al 50% Nocturna  
  EXTRA_100_DIU: '0030',  // Hora Extra al 100% Diurna
  EXTRA_100_NOC: '0031',  // Hora Extra al 100% Nocturna
} as const

export type TipoHoraExtra = keyof typeof CODIGOS_HORA_EXTRA

export type TipoDia = 'WEEKDAY' | 'SATURDAY' | 'SUNDAY' | 'HOLIDAY'

/**
 * Verificar si un momento está en período de "todo extra 100%"
 * - Sábado desde las 13:00 hs
 * - Domingo completo
 */
export function esHoraExtra100Total(fecha: Date): boolean {
  const diaSemana = fecha.getDay()
  const hora = fecha.getHours()
  
  // Domingo completo → extra 100%
  if (diaSemana === 0) return true
  
  // Sábado desde las 13:00 → extra 100%
  if (diaSemana === 6 && hora >= 13) return true
  
  return false
}

/**
 * REGLA MADRE: Grid de 30 Minutos (Snap-to-Grid)
 * 
 * El tiempo extra no es continuo. El sistema divide el día en slots de 30 minutos.
 * - Condición de Pago: (Fichada_IN <= Inicio_Slot) AND (Fichada_OUT >= Fin_Slot)
 * - Si llega 1 minuto tarde al inicio del slot -> Slot Perdido
 * - Si se va 1 minuto antes del fin del slot -> Slot Perdido
 * - Unidad de Medida: 0.5 horas
 */
export function calcularBloques30Min(
  horaEntrada: Date,
  horaSalida: Date,
  jornadaEsperadaHoras: number
): { inicio: Date; fin: Date }[] {
  const bloques: { inicio: Date; fin: Date }[] = []
  
  // Calcular hora fin de jornada normal
  const finJornadaNormal = new Date(horaEntrada.getTime() + jornadaEsperadaHoras * 60 * 60 * 1000)
  
  // Si no hay tiempo extra, retornar vacío
  if (horaSalida <= finJornadaNormal) {
    return bloques
  }
  
  // Crear bloques de 30 minutos desde el fin de jornada normal
  let slotInicio = new Date(finJornadaNormal)
  
  // Ajustar al próximo slot de 30 min (00 o 30)
  const minutos = slotInicio.getMinutes()
  if (minutos > 0 && minutos < 30) {
    slotInicio.setMinutes(30, 0, 0)
  } else if (minutos > 30) {
    slotInicio.setHours(slotInicio.getHours() + 1, 0, 0, 0)
  }
  
  while (slotInicio < horaSalida) {
    const slotFin = new Date(slotInicio.getTime() + 30 * 60 * 1000)
    
    // Solo contar el bloque si el empleado estuvo TODO el slot
    // Entrada <= Inicio del slot AND Salida >= Fin del slot
    if (horaEntrada <= slotInicio && horaSalida >= slotFin) {
      bloques.push({ inicio: new Date(slotInicio), fin: new Date(slotFin) })
    }
    
    slotInicio = slotFin
  }
  
  return bloques
}

/**
 * Crear bloques de 30 minutos para TODA la jornada (no solo extras)
 * Usado para calcular horas que van 100% al ser sábado 13+ o domingo
 */
export function calcularBloquesJornadaCompleta(
  horaEntrada: Date,
  horaSalida: Date
): { inicio: Date; fin: Date }[] {
  const bloques: { inicio: Date; fin: Date }[] = []
  
  // Crear bloques de 30 minutos desde la entrada
  let slotInicio = new Date(horaEntrada)
  
  // Ajustar al próximo slot de 30 min (00 o 30) si la entrada no está alineada
  const minutos = slotInicio.getMinutes()
  if (minutos > 0 && minutos < 30) {
    slotInicio.setMinutes(30, 0, 0)
  } else if (minutos > 30) {
    slotInicio.setHours(slotInicio.getHours() + 1, 0, 0, 0)
  }
  
  while (slotInicio < horaSalida) {
    const slotFin = new Date(slotInicio.getTime() + 30 * 60 * 1000)
    
    // Solo contar el bloque si el empleado estuvo TODO el slot
    if (horaEntrada <= slotInicio && horaSalida >= slotFin) {
      bloques.push({ inicio: new Date(slotInicio), fin: new Date(slotFin) })
    }
    
    slotInicio = slotFin
  }
  
  return bloques
}

/**
 * Clasificar un bloque de 30 minutos según día y hora
 * 
 * MATRIZ DE TIPOS:
 * 
 * A. Extra 50% Diurna (0021): 1.5x
 *    - Lun-Vie: 06:00 a 21:00
 *    - Sábado: 06:00 a 13:00
 * 
 * B. Extra 50% Nocturna (0025): 1.5x + Plus Nocturnidad
 *    - Lun-Vie: 21:00 a 06:00
 *    - Sábado: 00:00 a 06:00
 * 
 * C. Extra 100% Diurna (0030): 2.0x
 *    - Sábado: desde 13:00 (Trigger "Sábado Inglés")
 *    - Domingo: 06:00 a 21:00
 *    - Feriados: 06:00 a 21:00
 * 
 * D. Extra 100% Nocturna (0031): 2.0x + Plus Nocturnidad
 *    - Sábado: después de 21:00
 *    - Domingo: 00:00-06:00 y después de 21:00
 *    - Feriados: franja nocturna
 */
export function clasificarBloque(bloqueInicio: Date, tipoDia: TipoDia): TipoHoraExtra {
  const hora = bloqueInicio.getHours()
  const esNocturno = hora >= 21 || hora < 6
  
  if (tipoDia === 'HOLIDAY' || tipoDia === 'SUNDAY') {
    return esNocturno ? 'EXTRA_100_NOC' : 'EXTRA_100_DIU'
  }
  
  if (tipoDia === 'SATURDAY') {
    if (hora >= 13) {
      return esNocturno ? 'EXTRA_100_NOC' : 'EXTRA_100_DIU'
    } else {
      return esNocturno ? 'EXTRA_50_NOC' : 'EXTRA_50_DIU'
    }
  }
  
  // WEEKDAY (Lun-Vie)
  return esNocturno ? 'EXTRA_50_NOC' : 'EXTRA_50_DIU'
}

/**
 * Determinar el tipo de día
 */
export function getTipoDia(fecha: Date, esFeriado: boolean): TipoDia {
  if (esFeriado) return 'HOLIDAY'
  
  const diaSemana = fecha.getDay()
  if (diaSemana === 0) return 'SUNDAY'
  if (diaSemana === 6) return 'SATURDAY'
  return 'WEEKDAY'
}

/**
 * Calcular y clasificar todas las horas extra de una jornada
 * 
 * REGLA ESPECIAL FIN DE SEMANA:
 * - Sábado desde las 13:00 hs → TODAS las horas (incluyendo jornada normal) son extra al 100%
 * - Domingo completo → TODAS las horas son extra al 100%
 */
export function calcularHorasExtra(
  horaEntrada: Date,
  horaSalida: Date,
  jornadaEsperadaHoras: number,
  esFeriado: boolean = false
): {
  extra_50_diu: number
  extra_50_noc: number
  extra_100_diu: number
  extra_100_noc: number
  bloques_detalle: { inicio: Date; fin: Date; tipo: TipoHoraExtra }[]
  // Nuevos campos para horas normales que pasan a ser extra 100%
  horas_normales_a_100: number
} {
  const resultado = {
    extra_50_diu: 0,
    extra_50_noc: 0,
    extra_100_diu: 0,
    extra_100_noc: 0,
    bloques_detalle: [] as { inicio: Date; fin: Date; tipo: TipoHoraExtra }[],
    horas_normales_a_100: 0
  }
  
  // Verificar si aplica regla especial de fin de semana
  // (sábado desde 13:00 o domingo completo = todo al 100%)
  const diaSemana = horaEntrada.getDay()
  const horaInicio = horaEntrada.getHours()
  
  // CASO ESPECIAL: Domingo o Sábado desde 13hs → TODA la jornada es extra 100%
  const esFinDeSemanaCritico = 
    diaSemana === 0 || // Domingo
    (diaSemana === 6 && horaInicio >= 13) || // Sábado desde 13hs
    esFeriado
  
  if (esFinDeSemanaCritico) {
    // Todas las horas de la jornada son extra al 100%
    const bloquesTotales = calcularBloquesJornadaCompleta(horaEntrada, horaSalida)
    
    for (const bloque of bloquesTotales) {
      const hora = bloque.inicio.getHours()
      const esNocturno = hora >= 21 || hora < 6
      const tipoExtra: TipoHoraExtra = esNocturno ? 'EXTRA_100_NOC' : 'EXTRA_100_DIU'
      
      if (esNocturno) {
        resultado.extra_100_noc += 0.5
      } else {
        resultado.extra_100_diu += 0.5
      }
      
      resultado.bloques_detalle.push({
        inicio: bloque.inicio,
        fin: bloque.fin,
        tipo: tipoExtra
      })
    }
    
    // Marcar que las horas "normales" de jornada se convirtieron en extra 100%
    resultado.horas_normales_a_100 = Math.min(
      (resultado.extra_100_diu + resultado.extra_100_noc),
      jornadaEsperadaHoras
    )
    
    return resultado
  }
  
  // CASO SÁBADO ANTES DE 13HS: Jornada normal hasta 13hs, luego todo extra 100%
  if (diaSemana === 6 && horaInicio < 13) {
    // Calcular horas normales hasta las 13hs
    const las13hs = new Date(horaEntrada)
    las13hs.setHours(13, 0, 0, 0)
    
    // Bloques ANTES de las 13hs (pueden ser extra 50% si exceden jornada)
    const bloquesAntes13 = calcularBloques30Min(horaEntrada, las13hs, jornadaEsperadaHoras)
    
    for (const bloque of bloquesAntes13) {
      const tipoDia = getTipoDia(bloque.inicio, esFeriado)
      const tipoExtra = clasificarBloque(bloque.inicio, tipoDia)
      
      switch (tipoExtra) {
        case 'EXTRA_50_DIU':
          resultado.extra_50_diu += 0.5
          break
        case 'EXTRA_50_NOC':
          resultado.extra_50_noc += 0.5
          break
        case 'EXTRA_100_DIU':
          resultado.extra_100_diu += 0.5
          break
        case 'EXTRA_100_NOC':
          resultado.extra_100_noc += 0.5
          break
      }
      
      resultado.bloques_detalle.push({
        inicio: bloque.inicio,
        fin: bloque.fin,
        tipo: tipoExtra
      })
    }
    
    // Bloques DESDE las 13hs → TODOS son extra 100%
    if (horaSalida > las13hs) {
      const bloquesDesde13 = calcularBloquesJornadaCompleta(las13hs, horaSalida)
      
      for (const bloque of bloquesDesde13) {
        const hora = bloque.inicio.getHours()
        const esNocturno = hora >= 21 || hora < 6
        const tipoExtra: TipoHoraExtra = esNocturno ? 'EXTRA_100_NOC' : 'EXTRA_100_DIU'
        
        if (esNocturno) {
          resultado.extra_100_noc += 0.5
        } else {
          resultado.extra_100_diu += 0.5
        }
        
        resultado.bloques_detalle.push({
          inicio: bloque.inicio,
          fin: bloque.fin,
          tipo: tipoExtra
        })
      }
    }
    
    return resultado
  }
  
  // CASO NORMAL (Lun-Vie): Solo las horas que exceden la jornada son extra
  const bloques = calcularBloques30Min(horaEntrada, horaSalida, jornadaEsperadaHoras)
  
  for (const bloque of bloques) {
    const tipoDia = getTipoDia(bloque.inicio, esFeriado)
    const tipoExtra = clasificarBloque(bloque.inicio, tipoDia)
    
    switch (tipoExtra) {
      case 'EXTRA_50_DIU':
        resultado.extra_50_diu += 0.5
        break
      case 'EXTRA_50_NOC':
        resultado.extra_50_noc += 0.5
        break
      case 'EXTRA_100_DIU':
        resultado.extra_100_diu += 0.5
        break
      case 'EXTRA_100_NOC':
        resultado.extra_100_noc += 0.5
        break
    }
    
    resultado.bloques_detalle.push({
      inicio: bloque.inicio,
      fin: bloque.fin,
      tipo: tipoExtra
    })
  }
  
  return resultado
}

/**
 * CASOS DE BORDE (Edge Cases)
 * 
 * 1. Cruce de las 21:00 (Nocturnidad)
 *    - Extras 18:00-22:00 un Martes:
 *      - 18:00-21:00 = Extra 50% Diurna
 *      - 21:00-22:00 = Extra 50% Nocturna
 *    - El sistema parte la jornada automáticamente
 * 
 * 2. REGLA ESPECIAL FIN DE SEMANA (Sábado Inglés + Domingo)
 *    - Sábado desde las 13:00 hs → TODAS las horas son extra al 100%
 *    - Domingo completo → TODAS las horas son extra al 100%
 *    
 *    Ejemplo Sábado:
 *    - Jornada 06:00-14:00 un Sábado:
 *      - 06:00-13:00 = Jornada normal (7h)
 *      - 13:00-14:00 = Extra 100% Diurna (1h)
 *    
 *    Ejemplo Sábado turno completo desde 13hs:
 *    - Jornada 13:00-20:00 un Sábado:
 *      - TODAS las 7h = Extra 100% Diurna
 *    
 *    Ejemplo Domingo:
 *    - Cualquier jornada en Domingo = 100% Extra
 *      - 06:00-21:00 = Extra 100% Diurna
 *      - 21:00-06:00 = Extra 100% Nocturna
 * 
 * 3. Inicio de Semana (Domingo Noche)
 *    - Turno Noche ingresa Domingo 22:00:
 *      - Es su Jornada Normal de Lunes (no extra)
 *    - Si entran a las 20:00 (2h antes):
 *      - 20:00-22:00 = Extra 100% Diurna
 */

// Constantes útiles
export const HORA_INICIO_NOCHE = 21  // 21:00
export const HORA_FIN_NOCHE = 6      // 06:00
export const HORA_SABADO_INGLES = 13 // 13:00 - Trigger de cambio a 100%


