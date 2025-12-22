# API Reference

Base URL: `/api/sicamar`

## Empleados

### GET /empleados

Lista empleados con filtros.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `activo` | bool | Filtrar por estado |
| `sector` | string | Filtrar por sector |
| `search` | string | Buscar por nombre/legajo |

**Response:**
```json
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
}
```

### GET /empleados/[id]

Detalle de un empleado.

### PATCH /empleados/[id]

Actualiza campos de empleado.

### GET /empleados/estados

Lista estados actuales de empleados (enfermedad, licencia, etc.)

---

## Marcaciones

### GET /marcaciones

Fichadas del día.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `fecha` | date | Fecha a consultar (YYYY-MM-DD) |

**Response:**
```json
{
  "marcaciones": [
    {
      "id": 123,
      "id_biometrico": "35470528",
      "fecha_hora": "2025-12-17T06:14:23-03:00",
      "tipo": "E",
      "empleado": {
        "legajo": "95",
        "nombre_completo": "PÉREZ, Juan"
      }
    }
  ]
}
```

### GET /marcaciones/empleado

Marcaciones de un empleado en rango de fechas.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `empleado_id` | int | ID empleado |
| `desde` | date | Fecha inicio |
| `hasta` | date | Fecha fin |

---

## Jornadas

### GET /jornadas

Jornadas calculadas de un período.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `desde` | date | Fecha inicio |
| `hasta` | date | Fecha fin |
| `empleado_id` | int | Filtrar por empleado |

**Response:**
```json
{
  "jornadas": [
    {
      "id": 1,
      "empleado_id": 45,
      "fecha": "2025-12-16",
      "turno_asignado": "MAÑANA",
      "horas_diurnas": 7.5,
      "horas_nocturnas": 0,
      "horas_extra_50": 1.5,
      "estado_empleado": null,
      "tiene_inconsistencia": false
    }
  ]
}
```

### POST /jornadas/procesar-turno-dia

Calcula jornadas de un turno y día específico.

**Body:**
```json
{
  "fecha": "2025-12-16",
  "turno": "MAÑANA"
}
```

### POST /jornadas/regenerar

Recalcula jornadas de un período.

**Body:**
```json
{
  "desde": "2025-12-01",
  "hasta": "2025-12-15"
}
```

---

## Liquidaciones

### GET /liquidaciones

Lista períodos de liquidación.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `anio` | int | Filtrar por año |
| `tipo` | string | PQN, SQN, MN, etc. |

**Response:**
```json
{
  "liquidaciones": [
    {
      "id": 330,
      "anio": 2025,
      "mes": 12,
      "quincena": 1,
      "tipo": "PQN",
      "descripcion": "1era Quincena Dic 2025",
      "estado": "cerrada",
      "total_empleados": 88,
      "total_neto": 15234567.89
    }
  ]
}
```

### GET /liquidaciones/[id]

Detalle de un período con todos los empleados y conceptos.

**Response:**
```json
{
  "periodo": { ... },
  "empleados": [
    {
      "legajo": 95,
      "nombre_completo": "PÉREZ, Juan",
      "conceptos": [
        {
          "concepto_codigo": "0010",
          "concepto_descripcion": "HORAS DIURNAS",
          "concepto_tipo": 0,
          "cantidad": 80,
          "importe": 340000.00
        }
      ],
      "totales": {
        "haberes": 450000.00,
        "retenciones": 85000.00,
        "neto": 365000.00
      }
    }
  ]
}
```

### POST /liquidaciones/ejecutar

Ejecuta cálculo de liquidación para un período.

**Body:**
```json
{
  "periodo_id": 330,
  "empleados_ids": [1, 2, 3],
  "recalcular": true
}
```

### POST /liquidaciones/procesar

Procesa novedades y genera conceptos.

---

## Vacaciones / Eventos

### GET /vacaciones/eventos

Lista eventos de asistencia.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `empleado_id` | int | Filtrar por empleado |
| `tipo` | string | vacaciones, enfermedad, etc. |
| `estado` | string | programado, en_curso, completado |
| `anio` | int | Año |

### POST /vacaciones/eventos

Crea nuevo evento de asistencia.

**Body:**
```json
{
  "empleado_id": 45,
  "tipo": "vacaciones",
  "fecha_inicio": "2025-12-22",
  "fecha_fin": "2025-12-31",
  "observaciones": "Vacaciones de fin de año"
}
```

### PATCH /vacaciones/eventos/[id]

Actualiza evento (aprobar, cancelar, etc.)

**Body:**
```json
{
  "estado": "completado"
}
```

---

## Response Format

### Success

```json
{
  "success": true,
  "data": { ... },
  "count": 100
}
```

### Error

```json
{
  "success": false,
  "error": "Mensaje de error",
  "code": "ERROR_CODE"
}
```

---

## Códigos de Error Comunes

| Código | HTTP | Descripción |
|--------|------|-------------|
| `NOT_FOUND` | 404 | Recurso no encontrado |
| `VALIDATION_ERROR` | 400 | Datos inválidos |
| `DUPLICATE` | 409 | Ya existe |
| `PERIODO_CERRADO` | 400 | No se puede modificar |

---

*Ver [database.md](./database.md) para estructura de datos*




