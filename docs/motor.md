# Motor de Liquidación de Salarios Sicamar

## 1. Arquitectura de Personal y Categorización

El sistema clasifica cada legajo en uno de los siguientes grupos para aplicar las reglas de cálculo correspondientes.

### 1.1. Personal Jornalizado (Convenio UOM)

| Atributo | Valor |
|----------|-------|
| Convenio | UOM - Unión Obrera Metalúrgica |
| Población | Operarios de planta, mantenimiento, logística, pañol |
| Cantidad | ~390 legajos |
| Unidad de Medida | Horas |
| Frecuencia de Pago | Quincenal |
| Conceptos Clave | Valor Hora, Calorías, Presentismo Escalonado |

### 1.2. Personal Mensualizado (ASIMRA / Fuera de Convenio)

| Atributo | Valor |
|----------|-------|
| Convenio | ASIMRA / Fuera de Convenio |
| Población | Supervisores, Jefes, Administrativos, Gerencia |
| Cantidad | ~40 legajos |
| Unidad de Medida | Mes (30 días) |
| Frecuencia de Pago | Mensual |
| Conceptos Clave | Sueldo Básico, Ganancias (4ta Categoría), Presentismo Progresivo |

---

## 2. Cronograma de Liquidación

El sistema gestiona dos líneas de tiempo paralelas con fechas de corte estrictas.

### A. Ciclo Quincenal (Solo Jornalizados)

#### 1era Quincena (Adelanto)

| Etapa | Detalle |
|-------|---------|
| Período de Cómputo | Días 1 al 15 del mes actual |
| Fecha de Proceso (Corte) | Día 16 (08:00 AM) |
| Fecha de Pago | Día 20 (aprox) |

**Alcance:**
- Horas Normales (Diurnas/Nocturnas)
- Horas Extras (50% / 100%)
- Feriados trabajados en ese período

**NO incluye:**
- Presentismo (se paga a fin de mes)
- Calorías (se pagan por quincena según horas reales)

#### 2da Quincena (Cierre Mensual)

| Etapa | Detalle |
|-------|---------|
| Período de Cómputo | Día 16 al último día del mes (30/31) |
| Fecha de Proceso (Corte) | Día 1 del mes siguiente (08:00 AM) |
| Fecha de Pago | 4to día hábil del mes siguiente |

**Alcance:**
- Horas restantes
- Presentismo: Se calcula sobre el mes completo
- Deducciones Mensuales: Obra social, Sindicato, Embargos

### B. Ciclo Mensual (Solo Mensualizados)

| Etapa | Detalle |
|-------|---------|
| Período de Cómputo Sueldo | Mes calendario completo (1 al 30/31) |
| Período de Cómputo Extras (Supervisores) | Del día 23 del mes anterior al día 22 del mes actual |
| Fecha de Proceso | Día 23 (pre-carga de extras) y Día 1 (cierre final) |
| Fecha de Pago | 4to día hábil |

---

## 3. Matriz de Conceptos y Reglas de Cálculo

### 3.1. Horas Normales y Turnos

El sistema utiliza un **Valor Hora Base** definido por la categoría del empleado.

#### Hora Diurna (0010)

| Franja | Horario |
|--------|---------|
| Lunes a Viernes | 06:00 a 21:00 |
| Sábados | 06:00 a 13:00 |
| Factor | 1.0 |

#### Hora Nocturna (0020)

| Franja | Horario |
|--------|---------|
| Lunes a Viernes | 21:00 a 06:00 |
| Domingo a Viernes | Turno Noche |
| Factor | 1.133 (13.33% de recargo) |

#### Regla de Inicio de Semana (Turno Noche)

El turno que ingresa el **Domingo a las 22:00** se considera jornada normal de lunes.

- Técnicamente: Se computan como Horas Nocturnas Normales (0020)
- Split Contable: Para AFIP, las horas de 22:00 a 23:59 pertenecen al domingo (quincena anterior si es fin de mes) y de 00:00 en adelante al lunes

### 3.2. Horas Extras (Overtime)

Se rigen por la **"Regla del Bloque Cerrado"**.

| Regla | Detalle |
|-------|---------|
| Unidad Mínima | Bloques de 30 minutos (0.5 hs) |
| Condición | `(Check_In <= Inicio_Bloque) AND (Check_Out >= Fin_Bloque)` |
| Importante | No se pagan minutos sueltos ni fracciones menores |

#### Tipificación de Extras

| Código | Tipo | Cuándo Aplica |
|--------|------|---------------|
| 0021 | Extra 50% Diurna | Lun-Vie fuera de turno (06-21) y Sábados 06-13 |
| 0025 | Extra 50% Nocturna | Lun-Vie fuera de turno (21-06) |
| 0030 | Extra 100% Diurna | Sábados después de 13:00, Domingos (06-21), Feriados |
| 0031 | Extra 100% Nocturna | Sábados > 21:00, Domingos > 21:00, Feriados Noche |

### 3.3. Adicional "Calorías" (Compensación Art. 66)

| Atributo | Valor |
|----------|-------|
| Aplica a | Exclusivo UOM (Horneros, Colada, Basculantes) |
| Código Bejerman | 0054 |
| Regla de Negocio | Compensación por "reducción de jornada no gozada" |
| Condición | Haber trabajado más de 6 horas en puesto "caliente" en el día |

**Fórmula:**
```
(Días Trabajados en Sector) × 1.5 horas × Valor Hora Normal
```

**Ejemplo:** Trabajó 10 días en la quincena → Cobra 15 horas adicionales de sueldo básico.

### 3.4. Presentismo (El Premio)

Se paga a fin de mes, pero se evalúa día a día.

#### Para Jornalizados (UOM)

| Atributo | Valor |
|----------|-------|
| Código | 0120 |
| Monto | 20% de los Haberes Remunerativos |

**Penalidades (Escala):**

| Ausencias | Premio |
|-----------|--------|
| 0 Ausencias | 20% |
| 1 Ausencia Injustificada/Enfermedad | 10% |
| 2 o más Ausencias | 0% |

**Puntualidad:** Las llegadas tarde NO restan el premio (solo se descuenta el tiempo no trabajado).

#### Para Mensualizados

| Atributo | Valor |
|----------|-------|
| Monto | 20% del Básico |
| Penalidades | Descuento progresivo del 5% por cada día de ausencia |

Escala: 1 falta = 15%, 2 faltas = 10%, etc.

### 3.5. Adicionales Fijos y Antigüedad

#### Antigüedad (0202)

| Convenio | Regla |
|----------|-------|
| UOM | 1% acumulativo por año de servicio |
| Fuera de Convenio | Regla mixta (antiguos 33%, nuevos 1%) |

#### Título

Monto fijo por título secundario/técnico presentado.

---

## 4. Gestión de Inasistencias y Licencias

### Clasificación de Ausencias

#### Ausente con Aviso (Justificado)

- **Tipos:** Enfermedad (requiere certificado), Licencia Gremial, Estudio
- **Impacto:** Se paga el día (bajo concepto 0040 Horas Enfermedad), pero pierde el Presentismo (en UOM baja al 10%)

#### Ausente sin Aviso / Particular

- **Impacto:** No se paga el día. Pierde Presentismo.

### Vacaciones (0150)

| Aspecto | Regla |
|---------|-------|
| Pago | Se pagan por adelantado (Plus vacacional: divisor 25) |
| Descuento | Se descuentan los días no trabajados (divisor 30) en el mes siguiente |
| Control de Stock | Saldo en días corridos, pero validación operativa para no consumir días hábiles sueltos dejando saldo de fines de semana |

---

## 5. Deducciones y Retenciones

Sobre el Total Bruto, el sistema calcula:

### Aportes Obligatorios

| Código | Concepto | Alícuota |
|--------|----------|----------|
| 0401 | Jubilación | 11% |
| 0402 | Ley 19.032 (PAMI) | 3% |
| 0405 | Obra Social | 3% |

### Obra Social por Convenio

| Convenio | Obra Social |
|----------|-------------|
| UOM | O.S. Metalúrgica |
| ASIMRA | O.S. Supervisores |
| Jerárquicos | OSDE / Swiss Medical (derivan aportes) |

### Sindicato

| Código | Convenio | Alícuota |
|--------|----------|----------|
| 0421 | UOM (Afiliados) | 2.5% |
| — | UOM (No afiliados) | Cuota Solidaria |
| — | ASIMRA | 3% |

### Embargos Judiciales (0419 / 0423)

- Monto fijo o % decretado por juez
- **Prioridad:** Alimentos > Comerciales

### Impuesto a las Ganancias (0698)

| Atributo | Valor |
|----------|-------|
| Aplica a | 4ta Categoría (Sueldos altos) |
| Input | Formulario F.572 (SiRADIG) importado desde AFIP (XML) |
| Ajuste | Código 6986 para correcciones retroactivas |

---

## 6. Logística y Beneficios No Remunerativos

### 6.1. Viandas (Comedor)

| Regla | Detalle |
|-------|---------|
| Condición | Se otorga comida si la jornada supera las 12 horas (8 turno + 4 extras) |
| Corte | 08:00 AM |
| Proceso | Kalia cuenta [Presentes + Extras Confirmadas] y envía email al proveedor |

### 6.2. Reintegro Guardería (0273)

| Atributo | Valor |
|----------|-------|
| Concepto | No Remunerativo (Decreto 144/22) |
| Monto | Contra presentación de factura |
| Tope | Variable (aprox $166.000, ajustable) |

### 6.3. Ropa de Trabajo

| Atributo | Valor |
|----------|-------|
| Frecuencia | Entrega en Marzo (Invierno) y Septiembre (Verano) |
| Gestión | Relevamiento de talles por Bot |

---

## 7. Interfaces de Entrada y Salida (I/O)

### INPUTS (Lo que Kalia lee)

| Origen | Contenido | Frecuencia |
|--------|-----------|------------|
| InWeb (SQL) | Tabla de Fichadas (CheckIn, CheckOut) | 5 min |
| AFIP (ZIP/XML) | Formulario 572 (Ganancias) | Mensual |
| Kalia App | Novedades de usuarios (Avisos de falta, confirmación de extras, fotos de certificados) | Tiempo real |

### OUTPUTS (Lo que Kalia genera)

#### Archivos para Bejerman (TXT Ancho Fijo)

| Formato | Uso | Conceptos |
|---------|-----|-----------|
| Formato 3 (Novedades) | Horas | 0010, 0020, 0021, 0054, 0120 |
| Formato 6 (Importes) | Montos fijos | 0419 (Embargos), ajustes |

**Sintaxis:** `Legajo(9) + Concepto(9) + Valor(9)` — Relleno con ceros a la izquierda.

#### Otros Outputs

| Archivo | Destino |
|---------|---------|
| Libro Sueldo Digital (TXT) | AFIP (F.931) — Encriptado |
| Acreditación Bancaria (TXT) | Banco Macro / Interbanking — Norma BCRA (150 chars) |
| Recibos de Sueldo (PDF) | WhatsApp con solicitud de conformidad |

---

## 8. Procesos de Borde (Edge Cases)

### Retroactivos

Si una paritaria se cierra el día 20 con vigencia desde el 1, se debe generar una liquidación complementaria de **"Ajuste" (AJUSTE 0X/202X)**.

### Baja / Despido

| Paso | Acción |
|------|--------|
| 1 | Liquidación final inmediata (Vacaciones no gozadas + SAC prop + Indemnización) |
| 2 | Bloqueo inmediato de InWeb |
| 3 | Envío de telegrama (físico) y aviso digital |

### Ajuste de Turnos (Feriados)

| Escenario | Tratamiento |
|-----------|-------------|
| Encuesta de adhesión | Para trabajar feriados y canjear por días puente |
| Si se trabaja Feriado | Se paga como Extra 100% (0030) |

---

*Última actualización: Diciembre 2025*






