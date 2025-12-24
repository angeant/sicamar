# Database Schema

**Schema**: `sicamar`  
**Plataforma**: Supabase (PostgreSQL)

## Tablas Principales

### empleados

Nómina de empleados sincronizada desde Bejerman.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | bigint | PK |
| `legajo` | text | Identificador único |
| `dni` | text | Documento |
| `nombre`, `apellido` | text | Datos personales |
| `activo` | bool | Estado laboral |
| `fecha_ingreso` | date | Antigüedad |
| `fecha_egreso` | date | Si corresponde |
| `categoria` | text | Categoría laboral |
| `codigo_categoria` | text | Código Bejerman |
| `sector` | text | Área de trabajo |
| `cargo` | text | Puesto |
| `obra_social` | text | OS asignada |
| `sindicato` | text | UOM/ASIMRA |
| `salario_basico` | numeric | Valor hora o sueldo |
| `clase` | text | Jornal/Mensual |
| `fuera_convenio` | bool | True = mensualizado |
| `bejerman_leg_numero` | int | PK en Bejerman |
| `bejerman_sync_at` | timestamptz | Última sync |
| `foto_url` | text | URL foto (storage) |

**Registros**: ~143

### marcaciones

Fichadas del reloj Intelektron.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | bigint | PK |
| `id_biometrico` | varchar | ID tarjeta/huella |
| `fecha_hora` | timestamptz | Momento de fichada |
| `tipo` | enum | 'E' (entrada) / 'S' (salida) |
| `id_reloj` | int | Lector origen |
| `archivo_origen` | varchar | Archivo .rei2 |

**Registros**: ~1,800

### jornadas_diarias

Registro diario de horas trabajadas. **Fuente de verdad para liquidación**.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | bigint | PK |
| `empleado_id` | bigint | FK empleados |
| `fecha` | date | Día |
| `turno_asignado` | varchar | Código turno |
| `hora_entrada_asignada` | time | Esperada |
| `hora_salida_asignada` | time | Esperada |
| `hora_entrada_real` | timestamptz | Fichada |
| `hora_salida_real` | timestamptz | Fichada |
| `horas_trabajadas` | numeric | Total |
| `horas_diurnas` | numeric | HD (06-21) |
| `horas_nocturnas` | numeric | HN (21-06) |
| `horas_extra_50` | numeric | Extras 50% |
| `horas_extra_100` | numeric | Extras 100% |
| `horas_feriado` | numeric | Feriados |
| `estado_empleado` | varchar | Si está de licencia |
| `tiene_inconsistencia` | bool | Requiere revisión |
| `tipo_inconsistencia` | varchar | Detalle |

**Registros**: ~860

### periodos_liquidacion

Cabecera de períodos de liquidación.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | PK |
| `anio` | int | Año |
| `mes` | int | Mes (1-12) |
| `quincena` | int | 1 o 2 (null = mensual) |
| `tipo` | varchar | PQN, SQN, MN, VAC, etc. |
| `descripcion` | varchar | Ej: "2da Quincena Nov 2025" |
| `estado` | varchar | borrador/en_proceso/cerrada |
| `total_empleados` | int | Cantidad liquidados |
| `total_haberes` | numeric | Suma haberes |
| `total_retenciones` | numeric | Suma retenciones |
| `total_neto` | numeric | Suma neto |
| `origen` | varchar | 'bejerman' o 'kalia' |

**Registros**: ~270

### liquidacion_detalle

Conceptos liquidados por empleado y período.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | bigint | PK |
| `periodo_id` | int | FK periodos_liquidacion |
| `legajo` | int | Número legajo |
| `empleado_id` | bigint | FK empleados |
| `concepto_codigo` | varchar | Código Bejerman |
| `concepto_descripcion` | varchar | Nombre |
| `concepto_tipo` | int | 0=haber, 1=NR, 2=ret, 4=contrib |
| `cantidad` | numeric | Horas, días, etc. |
| `valor_unitario` | numeric | Valor hora |
| `importe` | numeric | Total calculado |
| `formula_aplicada` | text | Fórmula usada |

**Registros**: ~500,000

### novedades_liquidacion

Novedades manuales para liquidación.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | bigint | PK |
| `empleado_id` | bigint | FK empleados |
| `legajo` | int | Número |
| `concepto_codigo` | varchar | Código |
| `tipo` | varchar | haber/retencion/no_remunerativo |
| `cantidad` | numeric | Si aplica |
| `importe` | numeric | Monto fijo |
| `periodo_id` | int | FK período destino |
| `estado` | varchar | pendiente/aprobada/procesada |
| `recurrente` | bool | Se repite mensualmente |
| `meses_restantes` | int | Si es recurrente |

**Registros**: ~10,000

### eventos_asistencia

Vacaciones, licencias, ausencias.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | bigint | PK |
| `empleado_id` | bigint | FK empleados |
| `tipo` | varchar | vacaciones, enfermedad, licencia, etc. |
| `fecha_inicio` | date | Inicio |
| `fecha_fin` | date | Fin |
| `estado` | varchar | programado/en_curso/completado |
| `dias_corridos` | int | Total calendario |
| `dias_habiles` | int | L-V sin feriados |
| `dias_finde` | int | Sábados y domingos |
| `dias_feriados` | int | Feriados en el período |
| `requiere_justificacion` | bool | Necesita certificado |
| `justificacion_url` | text | URL del certificado |
| `codigo_bejerman` | varchar | Código para exportar |
| `procesado_liquidacion` | bool | Ya se liquidó |

### saldos_vacaciones

Contador anual de vacaciones por empleado.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | bigint | PK |
| `empleado_id` | bigint | FK empleados |
| `anio` | int | Año |
| `antiguedad_anios` | int | Años en la empresa |
| `dias_correspondientes` | int | Según antigüedad |
| `dias_pendientes_anterior` | int | Arrastre |
| `dias_tomados_manual` | int | Ajuste manual |
| `dias_habiles_tope` | int | Máximo L-V permitido |
| `dias_habiles_consumidos` | int | L-V ya tomados |
| `francos_compensatorios` | int | Findes trabajados |

---

## Tablas de Turnos

### turnos

Definición de turnos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | bigint | PK |
| `codigo` | text | MAÑANA, TARDE, NOCHE, CENTRAL |
| `descripcion` | text | Nombre completo |
| `hora_entrada` | time | L-V |
| `hora_salida` | time | L-V |
| `hora_entrada_sabado` | time | Sábado |
| `hora_salida_sabado` | time | Sábado |
| `trabaja_sabado` | bool | |
| `trabaja_domingo` | bool | |
| `es_rotativo` | bool | |

### bloques_rotacion

Grupos de empleados que rotan juntos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | PK |
| `codigo` | varchar | A, B, C, D, etc. |
| `nombre` | varchar | Bloque A, Bloque B |
| `planta` | varchar | planta_1, planta_2, etc. |
| `tipo_rotacion` | varchar | tres_turnos, dos_turnos, fijo |
| `secuencia_turnos` | int[] | IDs de turnos en orden |

**Registros**: 12

### grupos_rotacion

Squads dentro de bloques.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | PK |
| `bloque_id` | int | FK bloques_rotacion |
| `codigo` | varchar | FUND-A, ACOND-B |
| `nombre` | varchar | Fundición A |
| `color` | varchar | #HEX |

**Registros**: 9

### grupo_miembros

Empleados asignados a cada grupo.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | PK |
| `grupo_id` | int | FK grupos_rotacion |
| `empleado_id` | bigint | FK empleados |
| `es_lider` | bool | Líder del squad |
| `fecha_desde` | date | Inicio asignación |
| `activo` | bool | |

**Registros**: 73

### rotaciones_semanales

Turno de cada bloque por semana.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | PK |
| `bloque_id` | int | FK bloques_rotacion |
| `semana_inicio` | date | Lunes de la semana |
| `turno_id` | bigint | FK turnos |
| `confirmado` | bool | |

**Registros**: 80

---

## Tablas Kalia (Sistema Nervioso)

### kalia_turnos_cerrados

Registro de cada turno trabajado con acreditaciones.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | bigint | PK |
| `empleado_id` | bigint | FK |
| `fecha` | date | Día |
| `turno_codigo` | varchar | MAÑANA, etc. |
| `tipo_asignacion` | varchar | rotacion, extra_50, cobertura |
| `estado` | varchar | ok, tardanza, ausente, licencia |
| `horas_hd` | numeric | Hora diurna |
| `horas_hn` | numeric | Hora nocturna |
| `horas_ex_50` | numeric | Extra 50% |
| `horas_ex_100` | numeric | Extra 100% |
| `calorias` | int | Horas de calorías |
| `vianda` | bool | Consumió vianda |
| `presentismo_ok` | bool | No perdió presentismo |

**Registros**: ~420

### kalia_periodos

Acumulado por empleado para liquidación.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | bigint | PK |
| `empleado_id` | bigint | FK |
| `tipo` | varchar | Q1, Q2, MES |
| `anio`, `mes` | int | Período |
| `total_horas_hd` | numeric | Suma |
| `total_horas_hn` | numeric | Suma |
| `presentismo_ok` | bool | |
| `periodo_liquidacion_id` | bigint | FK al cierre |

**Registros**: 88

### kalia_sectores

Áreas con condiciones especiales.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | PK |
| `codigo` | varchar | FUND, ACOND, LOG |
| `nombre` | varchar | Fundición, Acondicionamiento |
| `aplica_calorias` | bool | True si paga calorías |
| `aplica_insalubridad` | bool | |

**Registros**: 6

### kalia_puestos

Puestos de trabajo.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | PK |
| `codigo` | varchar | BAL, HRO, APL |
| `nombre` | varchar | Balancero, Hornero |
| `sector_id` | int | FK |
| `criticidad` | varchar | critica, alta, normal |

**Registros**: 13

### kalia_polivalencias

Matriz de competencias empleado × puesto.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | PK |
| `empleado_id` | bigint | FK |
| `puesto_id` | int | FK |
| `nivel` | int | 1-4 |

**Niveles**:
- 1: En capacitación
- 2: Bajo supervisión
- 3: Autónomo
- 4: Capacitador

---

## Tablas de Catálogos

### conceptos_liquidacion

Catálogo de 600 conceptos de Bejerman.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | PK |
| `codigo` | varchar | 0010, 0020, 0401 |
| `descripcion` | varchar | HORAS DIURNAS |
| `tipo` | int | 0=haber, 2=retención |
| `multiplicador` | numeric | Factor |
| `formula` | text | Fórmula Bejerman |
| `valor_generico` | numeric | Porcentaje o monto |

### valores_categoria

Valor hora por categoría.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `codigo_categoria` | varchar | CAT-01, CAT-02 |
| `descripcion` | varchar | Operario A |
| `valor_hora_base` | numeric | $$ |
| `fecha_vigencia_desde` | date | |
| `convenio` | varchar | UOM, ASIMRA |

**Registros**: 11

### parametros_liquidacion

Alícuotas y montos fijos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `codigo` | varchar | JUBILACION_RET |
| `descripcion` | varchar | Retención Jubilación |
| `valor` | numeric | 0.11 |
| `tipo` | varchar | porcentaje/monto/tope |

**Registros**: 20

### feriados

Calendario de feriados.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | PK |
| `fecha` | date | UNIQUE |
| `nombre` | varchar | Navidad |
| `tipo` | varchar | nacional, provincial |
| `es_laborable` | bool | Trabajado igual |

### tipos_novedad

Tipos de licencia con código Bejerman.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | PK |
| `codigo` | varchar | 0010, 0090 |
| `descripcion` | varchar | Enfermedad, Vacaciones |
| `tipo` | varchar | haber, retencion, no_rem |

**Registros**: 17

---

## Vistas

### v_saldo_vacaciones (sugerida)

```sql
SELECT 
  s.*,
  s.dias_correspondientes + s.dias_pendientes_anterior - s.dias_adelantados AS dias_corridos_disponibles,
  s.dias_habiles_tope - s.dias_habiles_consumidos AS dias_habiles_disponibles,
  (s.dias_correspondientes - (s.dias_habiles_consumidos * 7 / 5)) AS dias_finde_residuales,
  (s.dias_habiles_consumidos < s.dias_habiles_tope) AS puede_pedir_dia_habil
FROM sicamar.saldos_vacaciones s;
```

---

## Diagrama ER Simplificado

```
empleados ─────────┬───────── marcaciones
    │              │
    │              └───────── jornadas_diarias
    │
    ├───────── eventos_asistencia
    │
    ├───────── saldos_vacaciones
    │
    ├───────── novedades_liquidacion ──── periodos_liquidacion
    │                                            │
    │                                            └─── liquidacion_detalle
    │
    ├───────── grupo_miembros ──── grupos_rotacion ──── bloques_rotacion
    │
    └───────── kalia_turnos_cerrados ──── kalia_periodos
```

---

*Ver [api.md](./api.md) para endpoints*






