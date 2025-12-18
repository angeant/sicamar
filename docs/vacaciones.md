# Vacaciones y Eventos de Asistencia

## Concepto Unificado

Todas las ausencias se manejan como **eventos de asistencia**:

| Tipo | Código Bejerman | Con goce |
|------|-----------------|----------|
| vacaciones | 0090 | Sí |
| enfermedad | 0010 | Sí |
| accidente_laboral | 0020 | Sí |
| licencia_examen | 0040 | Sí |
| licencia_nacimiento | 0050 | Sí |
| licencia_fallecimiento | 0060 | Sí |
| suspensión | 0070 | No |
| franco_compensatorio | 0080 | Sí |
| falta_injustificada | 0100 | No |

## Días por Antigüedad (Ley Argentina)

| Antigüedad | Días Corridos | Días Hábiles (Tope) |
|------------|---------------|---------------------|
| < 5 años | 14 | 10 |
| 5-9 años | 21 | 15 |
| 10-19 años | 28 | 20 |
| ≥ 20 años | 35 | 25 |

## Regla Crítica: Corridos vs Hábiles

### El problema

La ley otorga días **corridos** (calendario), pero un empleado podría "hacer trampa" tomando solo días hábiles sueltos:

```
Empleado con 14 días corridos (< 5 años)

Si se toma 2 semanas JUNTAS:
└─ 14 días corridos = 10 días hábiles (L-V) + 4 finde ✅

Si se toma 14 MARTES sueltos:
└─ 14 días = 14 días hábiles (casi 3 semanas) ❌
   ¡Se llevó 4 días de más!
```

### La solución

El sistema maneja **DOS contadores**:

1. **Saldo Legal (Corridos)**: Lo que dice la ley
2. **Saldo Operativo (Hábiles)**: Máximo días L-V permitidos

```
EJEMPLO: TORRES (3 años, 14 días legales)

Se tomó 10 martes sueltos...

📅 SALDO CORRIDOS
├─ Legal: 14 días
├─ Tomados: 10 días
└─ Disponible: 4 días  ← ¡TIENE SALDO!

💼 SALDO HÁBILES
├─ Tope: 10 días (14 × 5/7)
├─ Tomados: 10 días
└─ Disponible: 0 días  ← ¡AGOTADO!

🏖️ FINDES RESIDUALES: 4 días
   No canjeables por días L-V

⚠️ ¿Puede pedir otro martes? → NO
```

## Tabla: saldos_vacaciones

| Campo | Descripción |
|-------|-------------|
| empleado_id | FK |
| anio | Año |
| antiguedad_anios | Años en la empresa |
| dias_correspondientes | Según antigüedad |
| dias_pendientes_anterior | Arrastre |
| dias_adelantados | Tomados de más |
| dias_habiles_tope | Máximo L-V (calculado) |
| dias_habiles_consumidos | L-V ya tomados |
| francos_compensatorios | Findes trabajados a favor |

## Tabla: eventos_asistencia

| Campo | Descripción |
|-------|-------------|
| empleado_id | FK |
| tipo | vacaciones, enfermedad, etc. |
| fecha_inicio | Desde |
| fecha_fin | Hasta |
| estado | programado/en_curso/completado/cancelado |
| dias_corridos | Total calendario |
| dias_habiles | L-V sin feriados |
| dias_finde | Sábados y domingos |
| dias_feriados | Feriados que caen en L-V |
| requiere_justificacion | Necesita certificado |
| justificacion_url | URL del archivo |
| codigo_bejerman | Para exportar |
| procesado_liquidacion | Ya se liquidó |

## Cálculo de Días

Ejemplo: Vacaciones del 22 al 31 de diciembre 2025

```
22   23   24   25   26   27   28   29   30   31
Lun  Mar  Mie  Jue  Vie  Sab  Dom  Lun  Mar  Mie
────────────────────────────────────────────────
✓    ✓    ✓    🎄   ✓    🏖️   🏖️   ✓    ✓    ✓
HD   HD   HD  FERI  HD  FINDE FINDE HD   HD   HD

Días corridos: 10
Días HÁBILES: 7  ← SE DESCUENTAN DEL SALDO
Fines de semana: 2
Feriados: 1 (Navidad)
```

## Función: calcular_dias_habiles

```sql
CREATE FUNCTION sicamar.calcular_dias_habiles(
  fecha_inicio DATE, 
  fecha_fin DATE
) RETURNS INTEGER AS $$
DECLARE
  dias_habiles INTEGER := 0;
  fecha_actual DATE := fecha_inicio;
BEGIN
  WHILE fecha_actual <= fecha_fin LOOP
    -- Si es L-V y no es feriado
    IF EXTRACT(DOW FROM fecha_actual) BETWEEN 1 AND 5
       AND NOT EXISTS (
         SELECT 1 FROM sicamar.feriados 
         WHERE fecha = fecha_actual
       )
    THEN
      dias_habiles := dias_habiles + 1;
    END IF;
    fecha_actual := fecha_actual + 1;
  END LOOP;
  RETURN dias_habiles;
END;
$$ LANGUAGE plpgsql;
```

## Trigger Automático

Al insertar/actualizar un evento, se calculan:
- `dias_corridos`
- `dias_habiles`
- `dias_finde`
- `dias_feriados`

## Vista: v_saldo_vacaciones (sugerida)

```sql
SELECT 
  s.*,
  e.legajo,
  e.apellido || ', ' || e.nombre as nombre_completo,
  -- Días corridos disponibles
  s.dias_correspondientes 
    + s.dias_pendientes_anterior 
    - s.dias_adelantados AS dias_corridos_disponibles,
  -- Días hábiles disponibles
  s.dias_habiles_tope 
    - s.dias_habiles_consumidos AS dias_habiles_disponibles,
  -- Findes residuales (no canjeables)
  GREATEST(0, 
    (s.dias_correspondientes + s.dias_pendientes_anterior - s.dias_adelantados)
    - (s.dias_habiles_tope - s.dias_habiles_consumidos) * 7 / 5
  ) AS dias_finde_residuales,
  -- ¿Puede pedir más días L-V?
  (s.dias_habiles_consumidos < s.dias_habiles_tope) AS puede_pedir_dia_habil
FROM sicamar.saldos_vacaciones s
JOIN sicamar.empleados e ON s.empleado_id = e.id;
```

## Francos Compensatorios

Cuando un empleado trabaja fin de semana o feriado:

```
Trabaja SÁBADO o DOMINGO
         ↓
saldos_vacaciones.francos_compensatorios += 1
         ↓
Cuando toma el franco:
INSERT eventos_asistencia (tipo='franco_compensatorio')
         ↓
Vista calcula:
francos_disponibles = francos_a_favor - francos_tomados
```

## Estados de Evento

| Estado | Descripción |
|--------|-------------|
| pendiente_aprobacion | Esperando OK de RRHH |
| programado | Aprobado, futuro |
| en_curso | Hoy está entre fecha_inicio y fecha_fin |
| completado | Ya pasó |
| cancelado | Anulado |

## Flujo de Solicitud

```
1. Empleado solicita → estado='pendiente_aprobacion'
2. RRHH aprueba → estado='programado'
3. Llega la fecha → estado='en_curso'
4. Termina → estado='completado'
```

## Tipos de Novedad (Catálogo)

| Código | Nombre | Requiere Certificado |
|--------|--------|---------------------|
| 0010 | Enfermedad común | Sí |
| 0020 | Accidente laboral (ART) | Sí |
| 0040 | Licencia por examen | Sí |
| 0050 | Licencia por nacimiento | Sí |
| 0060 | Licencia por fallecimiento | Sí |
| 0080 | Franco compensatorio | No |
| 0090 | Vacaciones | No |
| 0100 | Falta injustificada | No |

## Mensaje cuando no puede pedir más

> "Tenés saldo de vacaciones disponible (X días), pero corresponden a los 
> fines de semana de tu período legal. Ya consumiste todos tus días hábiles 
> (laborales) permitidos. Estos días solo pueden tomarse en conjunto con 
> un fin de semana o no son canjeables por días de producción."

---

*Ver [database.md](./database.md) para estructura de tablas*


