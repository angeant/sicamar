# Sistema de Marcaciones

## Arquitectura

```
┌─────────────────┐     VPN      ┌──────────────────┐     HTTPS     ┌─────────────┐
│  Reloj Huella   │─────────────▶│  Windows Server  │──────────────▶│  Supabase   │
│  Intelektron    │              │  192.168.2.2     │               │  Cloud      │
└─────────────────┘              └──────────────────┘               └─────────────┘
                                        │
                                        │ Genera archivos .rei2
                                        ▼
                                 C:\ProgramData\Intelektron\
                                 localhost\Marcaciones\
```

## Componentes

| Componente | Ubicación | Función |
|------------|-----------|---------|
| Reloj Intelektron | Planta | Huella dactilar |
| Windows Server | 192.168.2.2 | Recibe marcaciones |
| Script Node.js | C:\SyncMarcaciones\index.js | Sincroniza |
| Edge Function | sicamar-marcaciones | Inserta en Supabase |
| Heartbeat | sicamar-heartbeat | Monitoreo servicio |

## Conexión VPN

```
Archivo: SCM.ovpn
Servidor: sicamar.ddns.net:1194 (TCP)
IP VPN: 10.0.0.66
Red interna: 192.168.2.0/24
```

### Certificados

- `cert_export_CA.crt`
- `cert_export_AAntonelli.crt`
- `cert_export_AAntonelli.key`

## Formato Archivos .rei2

```
DNI,FECHA,HORA,?,ID_RELOJ,?,TIPO
35470528,03/12/2025,08:14:23,,1,,E
```

| Campo | Descripción |
|-------|-------------|
| DNI | ID biométrico (puede ser DNI o número tarjeta) |
| FECHA | DD/MM/YYYY |
| HORA | HH:MM:SS |
| ID_RELOJ | 1, 2, 3... |
| TIPO | E, S, EI, SI |

### Tipos de Marcación

| Tipo | Significado | Se convierte a |
|------|-------------|----------------|
| E | Entrada | E |
| S | Salida | S |
| EI | Entrada Intermedia | E |
| SI | Salida Intermedia | S |

## Script de Sincronización

### Configuración

```javascript
const CONFIG = {
  marcacionesPath: "C:\\ProgramData\\Intelektron\\localhost\\Marcaciones",
  apiUrl: "https://uimqzfmspegwzmdoqjfn.supabase.co/functions/v1/sicamar-marcaciones",
  heartbeatUrl: "https://uimqzfmspegwzmdoqjfn.supabase.co/functions/v1/sicamar-heartbeat",
  apiKey: "eyJhbG...",
  sentLog: "C:\\SyncMarcaciones\\sent.log",
  heartbeatInterval: 5 * 60 * 1000  // 5 minutos
}
```

### Instalación como Servicio (NSSM)

```powershell
nssm install SyncMarcaciones "C:\Program Files\nodejs\node.exe" "C:\SyncMarcaciones\index.js"
nssm set SyncMarcaciones AppDirectory "C:\SyncMarcaciones"
nssm start SyncMarcaciones
```

## Base de Datos InWeb (SQL Server)

### Conexión

- **Servidor**: 192.168.2.2
- **Base**: Sicamar_inweb
- **Auth**: Windows (Administrador)

### tbMarcaciones

```sql
marcCodigo          int         -- PK
empCodigo           int         -- FK a tbEmpleados
marcFecha           datetime    -- Fecha/hora
marcIdentificacion  varchar     -- ID biométrico
marcSentido         int         -- 200=E, 201=S, 202=EI, 203=SI
lectCodigo          int         -- Lector/Reloj
```

### Valores marcSentido

| Valor | Tipo | Cantidad histórica |
|-------|------|-------------------|
| 200 | Entrada | 1,111,090 |
| 201 | Salida | 1,082,588 |
| 202 | Entrada Intermedia | 3,557 |
| 203 | Salida Intermedia | 3,091 |

## Tabla Supabase: marcaciones

```sql
CREATE TABLE sicamar.marcaciones (
    id BIGINT PRIMARY KEY,
    id_biometrico VARCHAR(20) NOT NULL,
    fecha_hora TIMESTAMPTZ NOT NULL,
    tipo sicamar.tipo_marcacion NOT NULL,  -- ENUM: 'E', 'S'
    id_reloj INTEGER,
    archivo_origen VARCHAR(255),
    timestamp_sync TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (id_biometrico, fecha_hora, tipo)
);
```

## Vista: marcaciones_completas

```sql
CREATE VIEW sicamar.marcaciones_completas AS
SELECT 
    m.id,
    m.id_biometrico,
    e.legajo,
    e.dni,
    e.apellido || ', ' || e.nombre as nombre_completo,
    m.fecha_hora,
    m.tipo,
    CASE m.tipo 
        WHEN 'E' THEN 'Entrada'
        WHEN 'S' THEN 'Salida'
    END as tipo_descripcion
FROM sicamar.marcaciones m
LEFT JOIN sicamar.empleado_identificaciones ei 
    ON LTRIM(ei.id_biometrico, '0') = LTRIM(m.id_biometrico, '0')
LEFT JOIN sicamar.empleados e ON ei.empleado_id = e.id;
```

## Identificaciones Biométricas

Un empleado puede tener múltiples IDs (tarjeta, huella, etc.)

```sql
CREATE TABLE sicamar.empleado_identificaciones (
    id BIGINT PRIMARY KEY,
    empleado_id BIGINT REFERENCES sicamar.empleados(id),
    id_biometrico TEXT NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE
);
```

## Timezone

- Archivos `.rei2`: Hora local Argentina (UTC-3)
- Supabase: TIMESTAMPTZ (UTC)
- API: Devuelve `hora_local` convertida

## Heartbeat / Monitoreo

Tabla `servicio_heartbeat` registra:

| Campo | Descripción |
|-------|-------------|
| ultimo_ping | Último contacto |
| archivos_procesados | Total histórico |
| marcaciones_enviadas | Total histórico |
| errores | Contador errores |
| estado | activo/inactivo |
| version | Versión script |

## IDs Sin Identificar

Marcaciones de ex-empleados o IDs no registrados:

```sql
SELECT 
  m.id_biometrico,
  COUNT(*) as cantidad,
  MAX(m.fecha_hora) as ultima_actividad
FROM sicamar.marcaciones m
LEFT JOIN sicamar.empleado_identificaciones ei 
  ON m.id_biometrico = ei.id_biometrico
WHERE ei.id IS NULL
GROUP BY m.id_biometrico
ORDER BY cantidad DESC;
```

## Datos Históricos

| Fuente | Rango | Notas |
|--------|-------|-------|
| SQL Server (tbMarcaciones) | Hasta Feb 2023 | Histórico viejo |
| Archivos .rei2 | 2023 - presente | Fuente actual |
| Supabase | 2023 - presente | Sincronizado |

---

*Ver [database.md](./database.md) para estructura completa*



