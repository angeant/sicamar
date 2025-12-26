# Motor de Liquidaciones

## Estado de Implementación

| Módulo | Estado |
|--------|--------|
| Turnos y Rotaciones | ✅ |
| Jornadas | ✅ |
| Novedades | ✅ |
| Parámetros | ✅ |
| Motor de Cálculo | ✅ |
| Wizard UI | ✅ |
| Histórico Bejerman | ✅ (269 períodos) |

## Archivo Principal

`/src/lib/liquidacion-engine.ts`

## Uso Básico

```typescript
import { LiquidacionEngine } from '@/lib/liquidacion-engine'

const engine = new LiquidacionEngine(
  { fecha_desde: '2025-12-01', fecha_hasta: '2025-12-15', tipo: 'PQN' },
  conceptos // Array de ConceptoDefinicion
)

const resultado = engine.liquidarEmpleado(empleado, novedades)

// resultado.conceptos = Array de conceptos calculados
// resultado.totales = { haberes, retenciones, neto }
```

## Tipos de Liquidación

| Código | Nombre | Clase | Es Quincena |
|--------|--------|-------|-------------|
| PQN | 1era Quincena | Jornal | Sí |
| SQN | 2da Quincena | Jornal | Sí |
| MN | Mensual | Mensual | No |
| VAC | Vacaciones | Ambos | No |
| SA1 | SAC 1er Semestre | Ambos | No |
| SA2 | SAC 2do Semestre | Ambos | No |
| FID | Liquidación Final | Ambos | No |

## Fórmulas Bejerman (Validadas)

### Horas y Jornales (Tipo 0 = Haber)

| Código | Concepto | Fórmula |
|--------|----------|---------|
| 0010 | HORAS DIURNAS | SJO × Cantidad |
| 0020 | HORAS NOCTURNAS | SJO × Cantidad × 1.133 |
| 0003 | HORAS ACC DIURNAS | SJO × Cantidad |
| 0004 | HORAS ACC NOCTURNAS | SJO × Cantidad × 1.133 |
| 0021 | HS. EXTRAS 50% | SJO × Cantidad × 1.5 |
| 0025 | HS. EXTRAS 50% N | SJO × Cantidad × 1.5 × 1.133 |
| 0030 | HS. EXTRAS 100% | SJO × Cantidad × 2.0 |
| 0031 | HS. EXTRAS 100% N | SJO × Cantidad × 2.0 × 1.133 |
| 0040 | HORAS ENFERMEDAD | SJO × Cantidad |
| 0041 | HORAS ENFER. NOCT | SJO × Cantidad × 1.133 |
| 0050 | FERIADO | SJO × Cantidad |
| 0051 | FERIADO NOCT | SJO × Cantidad × 1.133 |
| 0054 | CALORÍAS (Art.66) | SJO × Cantidad |
| 0150 | VACACIONES | SJO × (1 + Antig/100) × 8 × Días |

**SJO** = Sueldo o Jornal (valor hora para jornalizados)

### Conceptos Calculados

| Código | Concepto | Fórmula |
|--------|----------|---------|
| 0042 | Ley 26341 | $150 fijo |
| 0120 | PRESENTISMO | (Base - Enf - Art66 - Ley26341) × 20% |
| 0140 | PRESTACIÓN DINERARIA | Manual |
| 0202 | ANTIGÜEDAD | Base × Años × 1% |
| 0220 | TÍTULO SEC. UOM | $20,030.72 fijo |

### Base para Presentismo y Antigüedad

```javascript
const CONCEPTOS_BASE = ['0003', '0004', '0010', '0020', '0040', '0041', '0045', '0048', '0050', '0051']

const base = conceptos
  .filter(c => CONCEPTOS_BASE.includes(c.codigo))
  .reduce((sum, c) => sum + c.importe, 0)
```

## Retenciones (Tipo 2)

| Código | Concepto | Base | Alícuota |
|--------|----------|------|----------|
| 0401 | JUBILACIÓN | Base Imponible | 11% |
| 0402 | LEY 19032 (PAMI) | Base Imponible | 3% |
| 0405 | OBRA SOCIAL | Base Imponible | 3% |
| 0421 | CTA SIND. UOM | Total Haberes Rem | 2.5% |
| 0441 | SEGURO VIDA UOM | Fijo | $6,579.25 |

**Base Imponible** = Total Haberes Remunerativos

## Contribuciones Patronales (Tipo 4)

| Código | Concepto | Base | Alícuota |
|--------|----------|------|----------|
| 0501 | JUBILACIÓN | Base - Detracción | 10.77% |
| 0502 | LEY 19032 | Base - Detracción | 1.59% |
| 0503 | ASIG. FAMILIARES | Base - Detracción | 4.70% |
| 0504 | FONDO EMPLEO | Base - Detracción | 0.94% |
| 0505 | OBRA SOCIAL | Total Haberes | 6% |
| 0525 | ART (alícuota) | Total Haberes | Variable |
| 0526 | ART (suma fija) | Fijo | $1,543.00 |
| 0537 | SEGURO VIDA | Fijo | $6,579.25 |

**Detracción** = $7,003.68 (SMVM parcial)

## Flujo de Liquidación

```
1. CREAR PERÍODO
   INSERT periodos_liquidacion (estado='borrador')

2. RECOPILAR NOVEDADES
   a) Sumar horas de jornadas_diarias
   b) Obtener eventos_asistencia (vacaciones, etc.)
   c) Obtener novedades_liquidacion manuales

3. GENERAR BORRADOR
   Para cada empleado:
   - Calcular haberes desde horas
   - Calcular presentismo y antigüedad
   - Calcular retenciones
   - INSERT liquidacion_detalle

4. REVISIÓN
   - Detectar anomalías (variación > 20%)
   - Aprobar/editar
   - estado='en_proceso'

5. CIERRE
   - Validar neto > 0
   - Exportar TXT para Bejerman
   - estado='cerrada'
```

## Tipos de Concepto

| Tipo | Nombre | Efecto |
|------|--------|--------|
| 0 | Haber Remunerativo | Suma al neto, base para retenciones |
| 1 | No Remunerativo | Suma al neto, no aporta |
| 2 | Retención | Resta del neto |
| 4 | Contribución Patronal | Informativo, no afecta neto |
| 6 | Informativo | No afecta |

## Formato Exportación Bejerman

### TXT Ancho Fijo (30 caracteres)

```
Pos 1-9:   LEGAJO    (derecha, espacios)
Pos 10-18: CONCEPTO  (derecha, espacios)
Pos 19-27: CANTIDAD  (9 chars, 2 dec implícitos)

Ejemplo:
      95      001000003900
```

### Con Importe (100 caracteres)

```
Pos 1-9:   LEGAJO
Pos 10-18: CONCEPTO
Pos 19-27: IMPORTE (2 dec implícitos)
Pos 28-100: Padding
```

## Datos del Empleado

### Estáticos (del legajo)

| Campo | Uso |
|-------|-----|
| legajo | Identificación |
| categoria, codigo_categoria | Valor hora |
| sindicato | Cuota sindical |
| obra_social | Retención OS |
| salario_basico | SJO o sueldo |
| fecha_ingreso | Antigüedad |
| fuera_convenio | Tipo liquidación |

### Dinámicos (del período)

| Origen | Datos |
|--------|-------|
| jornadas_diarias | Horas HD, HN, EX |
| eventos_asistencia | Vacaciones, licencias |
| novedades_liquidacion | Embargos, bonos, ajustes |

## Interfaz

### Tab Liquidaciones

`/src/app/rrhh/components/liquidaciones-tab.tsx`

### Wizard Nueva Liquidación

1. Definir Período (año, mes, tipo)
2. Confirmar Creación
3. Pre-Liquidación (resumen)
4. Completado

---

*Ver [database.md](./database.md) para tablas relacionadas*







