# Overview - Arquitectura RRHH

## Diagrama de Integración

```
┌─────────────────┐     VPN      ┌──────────────────┐     HTTPS     ┌─────────────┐
│  Reloj Huella   │─────────────▶│  Windows Server  │──────────────▶│  Supabase   │
│  Intelektron    │              │  192.168.2.2     │               │  Cloud      │
└─────────────────┘              └──────────────────┘               └─────────────┘
                                        │
                                 Script Node.js
                                 (archivos .rei2)
```

## Flujo de Datos Principal

```
Fichadas ─▶ Marcaciones ─▶ Jornadas ─▶ Novedades ─▶ Liquidación
```

1. **Fichadas**: Empleado marca entrada/salida en reloj
2. **Marcaciones**: Script sincroniza a Supabase cada 5 min
3. **Jornadas**: Se calculan horas HD/HN/EX por día
4. **Novedades**: Se agregan licencias, extras, ajustes
5. **Liquidación**: Motor calcula haberes y retenciones

## Componentes del Sistema

### Frontend (`/src/app/rrhh`)

| Tab | Archivo | Función |
|-----|---------|---------|
| Overview | `overview-tab.tsx` | Dashboard resumen |
| Nómina | `nomina-tab.tsx` | Lista de empleados |
| Marcaciones | `marcaciones-tab.tsx` | Fichadas del día |
| Jornadas | `jornadas-tab.tsx` | Horas por empleado |
| Novedades | `novedades-tab.tsx` | Carga manual |
| Liquidaciones | `liquidaciones-tab.tsx` | Períodos y wizard |
| Vacaciones | `vacaciones-tab.tsx` | Eventos y saldos |
| Turnos | `turnos-rotaciones-tab.tsx` | Rotaciones semanales |

### API (`/src/app/api/sicamar`)

| Ruta | Métodos | Propósito |
|------|---------|-----------|
| `/empleados` | GET, POST, PATCH | CRUD empleados |
| `/marcaciones` | GET | Consulta fichadas |
| `/jornadas` | GET, POST | Jornadas calculadas |
| `/liquidaciones` | GET, POST | Períodos y detalle |
| `/vacaciones/eventos` | GET, POST, PATCH | Eventos asistencia |

### Motor de Cálculo

```typescript
// /src/lib/liquidacion-engine.ts
import { LiquidacionEngine } from '@/lib/liquidacion-engine'

const engine = new LiquidacionEngine(parametros, conceptos)
const resultado = engine.liquidarEmpleado(empleado, novedades)
```

## Ciclos Operativos

```
TURNO (8hs)  ───▶  SEMANA  ───▶  QUINCENA  ───▶  MES
    │               │              │              │
  horas          rotación      liquidación    cierre
  presentismo    extras        PQN/SQN        contable
```

### Tipos de Liquidación

| Código | Nombre | Aplicación |
|--------|--------|------------|
| PQN | 1era Quincena | Jornalizados (1-15) |
| SQN | 2da Quincena | Jornalizados (16-fin) |
| MN | Mensual | Mensualizados |
| VAC | Vacaciones | Ambos |
| SA1 | SAC 1er Sem | Ambos |
| SA2 | SAC 2do Sem | Ambos |
| FID | Final/Despido | Ambos |

## Convenciones

### Nomenclatura de campos

- Tablas: `snake_case` (`empleados`, `jornadas_diarias`)
- Columnas: `snake_case` (`fecha_ingreso`, `turno_id`)
- Foreign keys: `{tabla_singular}_id`

### Estados comunes

| Campo | Valores típicos |
|-------|-----------------|
| `estado` | pendiente, en_proceso, cerrada |
| `activo` | true/false |
| `procesado_liquidacion` | true/false |

---

*Ver [database.md](./database.md) para detalle de tablas*




