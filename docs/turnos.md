# Sistema de Turnos

## Tipos de Empleados

| Tipo | Turnos | Liquidación |
|------|--------|-------------|
| **Planta (Convenio)** | 3 turnos rotativos 24/7 | Quincenal (PQN/SQN) |
| **Fuera de Convenio** | Turno Central fijo | Mensual (MN) |

## Definición de Turnos

| Código | Horario L-V | Horario Sábado | Trabaja Dom |
|--------|-------------|----------------|-------------|
| `MAÑANA` | 06:00 - 14:00 | 06:00 - 13:00 | No |
| `TARDE` | 14:00 - 22:00 | No trabaja | No |
| `NOCHE` | 22:00 - 06:00 | Termina 06:00 | Entra 00:00 |
| `CENTRAL` | 08:00 - 17:00 | No trabaja | No |

### Turno Noche - Caso especial

Los **domingos** el turno noche entra a las **00:00** (medianoche) para iniciar la semana.

## Tipos de Hora

| Código | Nombre | Multiplicador | Franja |
|--------|--------|---------------|--------|
| `HD` | Hora Diurna | 1.00x | 06:00 - 21:00 |
| `HN` | Hora Nocturna | 1.13x | 21:00 - 06:00 |
| `EX_50_D` | Extra 50% Diurna | 1.50x | Extras diurnas |
| `EX_50_N` | Extra 50% Nocturna | 1.695x | Extras nocturnas |
| `EX_100` | Extra 100% | 2.00x | Sáb >13hs, Dom, Feriados |

## Sábado Inglés

```
SÁBADO
────────────────────────────────────────────────────
00:00 ─────── 13:00 ─────────────────────────── 24:00
│             │                                 │
│   Normal    │           EXTRA 100%            │
│  o Ex 50%   │         "Sáb Inglés"            │
────────────────────────────────────────────────────

DOMINGO = Todo Extra 100%
(Excepción: Turno Noche entra 00:00 → cuenta como normal)
```

## Segmentos por Turno

### Ejemplo: Turno Mañana L-V

```
00:00      06:00           14:00           21:00      24:00
│          │               │               │          │
│ EX_50_N  │      HD       │    EX_50_D    │  EX_50_N │
│ (antes)  │  (NORMAL)     │   (después)   │          │
│          │  OBLIGATORIO  │               │          │
```

### Ejemplo: Turno Mañana Sábado

```
06:00      13:00                          24:00
│          │                               │
│    HD    │           EX_100              │
│ (NORMAL) │      "Sábado Inglés"          │
```

## Bloques de Rotación

Grupos de empleados que rotan juntos en la secuencia de turnos.

| Bloque | Planta | Tipo | Secuencia |
|--------|--------|------|-----------|
| A | planta_1 | tres_turnos | MAÑANA → TARDE → NOCHE |
| B | planta_1 | tres_turnos | TARDE → NOCHE → MAÑANA |
| C | planta_1 | tres_turnos | NOCHE → MAÑANA → TARDE |
| D | planta_2 | tres_turnos | ... |

### Semana actual

```
Bloque A: MAÑANA
Bloque B: TARDE
Bloque C: NOCHE
```

### Semana siguiente (rotan)

```
Bloque A: TARDE
Bloque B: NOCHE
Bloque C: MAÑANA
```

## Grupos (Squads)

Dentro de cada bloque hay grupos funcionales:

| Código | Nombre | Bloque |
|--------|--------|--------|
| FUND-A | Fundición A | A |
| ACOND-A | Acondicionamiento A | A |
| FUND-B | Fundición B | B |
| ... | ... | ... |

## Tabla: rotaciones_semanales

Asignación semanal de turno por bloque.

```sql
SELECT 
  b.codigo as bloque,
  t.codigo as turno,
  r.semana_inicio,
  r.confirmado
FROM sicamar.rotaciones_semanales r
JOIN sicamar.bloques_rotacion b ON r.bloque_id = b.id
JOIN sicamar.turnos t ON r.turno_id = t.id
WHERE r.semana_inicio = '2025-12-16'
ORDER BY b.codigo;
```

## Tabla: turnos_empleados (histórico InWeb)

Importación del histórico de turnos desde InWeb.

| Campo | Descripción |
|-------|-------------|
| `emp_codigo` | ID empleado InWeb |
| `tur_codigo` | Código turno InWeb |
| `fecha_inicio` | Desde |
| `fecha_fin` | Hasta |
| `tur_nombre` | Nombre del turno |

**Registros**: ~55,000

## Flujo de Asignación

```
1. RRHH define rotaciones semanales
   └─▶ rotaciones_semanales

2. Sistema genera asignaciones diarias
   └─▶ kalia_asignaciones_semana

3. Empleado ficha
   └─▶ marcaciones

4. Se calcula jornada
   └─▶ jornadas_diarias

5. Se cierra turno
   └─▶ kalia_turnos_cerrados
```

---

*Ver [database.md](./database.md) para detalle de tablas*







