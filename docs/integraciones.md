# Integraciones Externas

## Diagrama General

```
                    ┌─────────────┐
                    │   Kalia     │
                    │  (Supabase) │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│  Intelektron    │ │  Bejerman   │ │   WhatsApp      │
│  (Marcaciones)  │ │  (Sueldos)  │ │   (Futuro)      │
└─────────────────┘ └─────────────┘ └─────────────────┘
```

## Intelektron InWeb

Sistema de control de acceso con reloj biométrico.

### Conexión

| Parámetro | Valor |
|-----------|-------|
| Servidor | 192.168.2.2 (vía VPN) |
| Base de datos | Sicamar_inweb |
| Tipo | SQL Server |
| Auth | Windows (Administrador) |

### VPN

```
Archivo: SCM.ovpn
Servidor: sicamar.ddns.net:1194 (TCP)
IP asignada: 10.0.0.66
Red interna: 192.168.2.0/24
```

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| tbEmpleados | Datos laborales |
| tbPersonas | Datos personales |
| tbMarcaciones | Fichadas |
| tbTurnos | Definición turnos |

### Sincronización

```
Archivos .rei2 → Script Node.js → Edge Function → sicamar.marcaciones
```

- Frecuencia: Cada 5 minutos
- Monitoreo: servicio_heartbeat

### Datos migrados a Supabase

- Empleados (legajo, DNI, nombre, etc.)
- Fotos de empleados (storage)
- Turnos históricos (turnos_empleados)
- Marcaciones en tiempo real

---

## Bejerman Sueldos

Sistema de liquidación de sueldos legacy.

### Conexión

| Parámetro | Valor |
|-----------|-------|
| Servidor | 192.168.2.2 (vía VPN) |
| Base de datos | SJSCM |
| Tipo | SQL Server |
| Auth | Windows |

### Tablas Principales

| Tabla | Descripción | Registros |
|-------|-------------|-----------|
| leg | Legajos/Empleados | 230 (98 activos) |
| liq | Liquidaciones | 1,373 |
| nov | Novedades | 25,696 |
| cat | Categorías | 44 |
| sec | Sectores | 16 |
| car | Cargos | 176 |
| oso | Obras Sociales | 51 |

### Datos sincronizados a Supabase

| Campo Supabase | Campo Bejerman |
|----------------|----------------|
| legajo | leg_numero |
| dni | leg_docum |
| nombre | leg_nombre |
| apellido | leg_apellido |
| cuil | leg_cuil |
| fecha_ingreso | leg_fecing |
| salario_basico | leg_basico |
| categoria | cat.cat_descrip |
| sector | sec.sec_descrip |
| obra_social | oso.oso_descrip |

### Exportación a Bejerman

Formato TXT ancho fijo para importar novedades:

```
Pos 1-9:   LEGAJO    (derecha, espacios)
Pos 10-18: CONCEPTO  (derecha, espacios)
Pos 19-27: CANTIDAD  (9 chars, 2 dec implícitos)

Ejemplo:
      95      001000003900
```

### Estado de Transición

| Función | Sistema Actual | Objetivo |
|---------|----------------|----------|
| Liquidación | Bejerman | Kalia |
| Consulta histórico | Kalia | ✅ |
| Marcaciones | Kalia | ✅ |
| Vacaciones | Kalia | ✅ |
| Novedades | Bejerman | Kalia |
| Export AFIP | Bejerman | Bejerman |

---

## Docker Local (Desarrollo)

### SQL Server 2022

```bash
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=Bejerman123!" \
  -p 1433:1433 \
  --name sqlserver_bejerman \
  -v /path/to/extrafiles:/backup \
  -d mcr.microsoft.com/mssql/server:2022-latest
```

### Conexión

- Host: localhost
- Puerto: 1433
- Usuario: sa
- Password: Bejerman123!

### Bases restauradas

| Base | Origen | Datos hasta |
|------|--------|-------------|
| SJSCM | Bejerman Sueldos | Julio 2025 |

### Comandos útiles

```bash
# Listar bases
docker exec sqlserver_bejerman /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "Bejerman123!" -C \
  -Q "SELECT name FROM sys.databases"

# Query
docker exec sqlserver_bejerman /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "Bejerman123!" -C \
  -d SJSCM \
  -Q "SELECT TOP 10 * FROM leg WHERE leg_fecegr IS NULL"
```

---

## SCM2015 (Tango Gestión)

Sistema ERP de gestión comercial (no integrado actualmente).

### Módulos

| Módulo | Prefijo | Uso |
|--------|---------|-----|
| Ventas | GVA | Clientes, comprobantes |
| Stock | STA | Artículos, movimientos |
| Compras | CPA | Proveedores |
| Bancos | SBA | Cuentas |

---

## WhatsApp (Futuro)

Integración planificada:

| Función | Estado |
|---------|--------|
| Envío de recibos | Planificado |
| Recepción de certificados | Planificado |
| Consultas de saldo | Planificado |
| Avisos de ausencia | Planificado |

### Flujo propuesto

```
Empleado envía foto certificado
         ↓
OCR extrae datos
         ↓
Crea evento_asistencia
         ↓
Notifica a RRHH para aprobación
```

---

## Supabase Edge Functions

### sicamar-marcaciones

- **Método**: POST
- **Input**: `{ dni, fecha, hora, id_reloj, tipo, archivo_origen }`
- **Acción**: INSERT en sicamar.marcaciones

### sicamar-heartbeat

- **Método**: POST
- **Input**: `{ archivos, marcaciones, errores }`
- **Acción**: UPDATE servicio_heartbeat

---

## Contactos

| Área | Contacto |
|------|----------|
| IT Sicamar | Norberto (VPN/Red) |
| Intelektron | https://intelektron.com/ |

---

*Ver [marcaciones.md](./marcaciones.md) para detalle de sincronización*






