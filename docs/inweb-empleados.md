# Gestión de Empleados en InWeb

## Arquitectura de Sincronización

```
┌─────────────────┐                    ┌──────────────────┐                    ┌─────────────┐
│  InWeb          │  ── SQL Query ──▶  │  Windows Server  │  ── HTTPS ──────▶  │  Supabase   │
│  (SQL Server)   │                    │  sync-empleados  │                    │  Cloud      │
└─────────────────┘                    └──────────────────┘                    └─────────────┘
     tbEmpleados                         cada 30 min                         sicamar.empleados
     tbPersonas                                                               
```

## Tablas InWeb

### tbPersonas (datos personales)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| perCodigo | int | PK |
| perNombre | nvarchar(125) | Nombre |
| perApellido | nvarchar(125) | Apellido |
| perDocumento | varchar(255) | DNI |
| docCodigo | int | Tipo doc (0=DNI) |

### tbEmpleados (datos laborales)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| empCodigo | int | PK |
| empLegajo | varchar(255) | Número de legajo |
| perCodigo | int | FK a tbPersonas |
| orgCodigo | int | Organización (2=SICAMAR) |
| empContratista | bit | 1=eventual, 0=fijo |
| empEliminado | bit | Baja lógica |
| empFechaIngreso | datetime | Alta |
| empFechaEgreso | datetime | Baja (9999-12-31 = activo) |

## Crear Empleado Nuevo en InWeb

### Empleado Fijo

```sql
-- 1. Crear persona
DECLARE @nuevoPer INT = (SELECT ISNULL(MAX(perCodigo), 0) + 1 FROM tbPersonas);

INSERT INTO tbPersonas (perCodigo, perNombre, perApellido, perDocumento, docCodigo, perEliminado)
VALUES (@nuevoPer, 'JUAN', 'PEREZ', '40123456', 0, 0);

-- 2. Crear empleado
DECLARE @nuevoEmp INT = (SELECT ISNULL(MAX(empCodigo), 0) + 1 FROM tbEmpleados);

INSERT INTO tbEmpleados (
  empCodigo, 
  empLegajo, 
  perCodigo, 
  orgCodigo,           -- 2 = SICAMAR METALES
  empContratista,      -- 0 = fijo
  empEliminado, 
  empFechaIngreso,
  empFechaEgreso
)
VALUES (
  @nuevoEmp,
  '999',               -- Legajo nuevo
  @nuevoPer,
  2,
  0,
  0,
  GETDATE(),
  '9999-12-31'
);

SELECT @nuevoEmp as NuevoEmpleadoID;
```

### Empleado Eventual

```sql
-- Mismo proceso pero con empContratista = 1
INSERT INTO tbEmpleados (
  empCodigo, empLegajo, perCodigo, orgCodigo,
  empContratista,  -- 1 = eventual
  empEliminado, empFechaIngreso, empFechaEgreso
)
VALUES (
  @nuevoEmp, '999', @nuevoPer, 2,
  1,  -- EVENTUAL
  0, GETDATE(), DATEADD(month, 3, GETDATE())  -- contrato 3 meses
);
```

## Dar de Baja un Empleado

```sql
UPDATE tbEmpleados 
SET empFechaEgreso = GETDATE(),
    empEliminado = 1
WHERE empLegajo = '999';
```

## Consultar Marcaciones

```sql
-- Por legajo
SELECT 
  e.empLegajo,
  p.perApellido + ', ' + p.perNombre as Empleado,
  m.marcFecha,
  CASE m.marcSentido 
    WHEN 200 THEN 'ENTRADA' 
    WHEN 201 THEN 'SALIDA'
    WHEN 202 THEN 'ENTRADA INTER'
    WHEN 203 THEN 'SALIDA INTER'
  END as Tipo
FROM tbMarcaciones m
JOIN tbEmpleados e ON m.empCodigo = e.empCodigo
JOIN tbPersonas p ON e.perCodigo = p.perCodigo
WHERE e.empLegajo = '999'
ORDER BY m.marcFecha DESC;

-- Todas las de hoy
SELECT 
  e.empLegajo,
  p.perApellido,
  m.marcFecha,
  m.marcSentido
FROM tbMarcaciones m
JOIN tbEmpleados e ON m.empCodigo = e.empCodigo
JOIN tbPersonas p ON e.perCodigo = p.perCodigo
WHERE CAST(m.marcFecha as DATE) = CAST(GETDATE() as DATE)
ORDER BY m.marcFecha DESC;
```

## Edge Function: sicamar-sync-empleados

Endpoint para sincronizar empleados desde el script Node.js.

### Request

```
POST https://uimqzfmspegwzmdoqjfn.supabase.co/functions/v1/sicamar-sync-empleados
Authorization: Bearer <anon_key>
Content-Type: application/json

{
  "empleados": [
    {
      "empCodigo": 1422,
      "empLegajo": "999",
      "dni": "40123456",
      "nombre": "JUAN",
      "apellido": "PEREZ",
      "fechaIngreso": "2024-01-15",
      "fechaEgreso": "9999-12-31",
      "eliminado": false,
      "contratista": false
    }
  ]
}
```

### Response

```json
{
  "success": true,
  "message": "Sync completado: 1 nuevos, 0 actualizados, 0 desactivados",
  "results": {
    "inserted": 1,
    "updated": 0,
    "deactivated": 0,
    "errors": []
  }
}
```

## Instalación del Sync en Windows Server

### 1. Copiar script

```powershell
copy sync-empleados-inweb.js C:\SyncMarcaciones\
```

### 2. Instalar dependencias

```powershell
cd C:\SyncMarcaciones
npm install mssql
```

### 3. Integrar con servicio existente

Agregar al final de `index.js`:

```javascript
// Importar sync de empleados
const { syncEmpleados } = require('./sync-empleados-inweb');

// Ejecutar sync de empleados cada 30 min
setInterval(syncEmpleados, 30 * 60 * 1000);

// Ejecutar una vez al iniciar
syncEmpleados();
```

### 4. O ejecutar como servicio separado

```powershell
nssm install SyncEmpleados "C:\Program Files\nodejs\node.exe" "C:\SyncMarcaciones\sync-empleados-inweb.js"
nssm set SyncEmpleados AppDirectory "C:\SyncMarcaciones"
nssm start SyncEmpleados
```

## Conexión desde Docker (desarrollo)

```bash
# Listar bases
docker exec sqlserver_bejerman /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'Bejerman123!' -C \
  -Q "SELECT name FROM sys.databases"

# Query empleados
docker exec sqlserver_bejerman /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'Bejerman123!' -C -d Sicamar_inweb \
  -Q "SELECT TOP 10 e.empLegajo, p.perApellido FROM tbEmpleados e JOIN tbPersonas p ON e.perCodigo = p.perCodigo WHERE e.orgCodigo = 2"
```

