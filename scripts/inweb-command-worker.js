/**
 * Worker que procesa comandos de Supabase y los ejecuta en InWeb SQL Server
 * 
 * Instalar en Windows Server: C:\SyncMarcaciones\inweb-command-worker.js
 * Requiere: npm install mssql node-fetch
 */

const sql = require('mssql');

// ==================== CONFIGURACIÓN ====================

const CONFIG = {
  // Supabase
  supabaseUrl: 'https://uimqzfmspegwzmdoqjfn.supabase.co',
  supabaseKey: process.env.SUPABASE_SERVICE_KEY || 'eyJhbG...', // Service role key
  
  // SQL Server InWeb (en la misma red del Windows Server)
  sqlServer: {
    server: '192.168.2.2',  // O 'localhost' si está en el mismo server
    database: 'Sicamar_inweb',
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    // Windows Auth
    authentication: {
      type: 'ntlm',
      options: {
        domain: '',
        userName: 'Administrador',
        password: ''
      }
    },
    // O SQL Auth (descomentar si usás usuario SQL):
    // user: 'sa',
    // password: 'Bejerman123!',
  },
  
  // Polling
  pollInterval: 60 * 1000,  // Cada 1 minuto
};

// ==================== SUPABASE CLIENT ====================

async function fetchPendingCommands() {
  const response = await fetch(
    `${CONFIG.supabaseUrl}/rest/v1/comandos_inweb?estado=eq.pendiente&order=created_at.asc&limit=10`,
    {
      headers: {
        'apikey': CONFIG.supabaseKey,
        'Authorization': `Bearer ${CONFIG.supabaseKey}`,
        'Accept': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Error fetching commands: ${response.statusText}`);
  }
  
  return response.json();
}

async function updateCommandStatus(id, estado, errorMensaje = null) {
  const body = {
    estado,
    processed_at: new Date().toISOString(),
  };
  if (errorMensaje) body.error_mensaje = errorMensaje;
  
  await fetch(
    `${CONFIG.supabaseUrl}/rest/v1/comandos_inweb?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': CONFIG.supabaseKey,
        'Authorization': `Bearer ${CONFIG.supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(body),
    }
  );
}

// ==================== SQL SERVER ====================

let sqlPool = null;

async function getSqlPool() {
  if (!sqlPool) {
    sqlPool = await sql.connect(CONFIG.sqlServer);
  }
  return sqlPool;
}

async function getEmpleadoCodigo(legajo) {
  const pool = await getSqlPool();
  const result = await pool.request()
    .input('legajo', sql.VarChar, legajo.toString().padStart(6, '0'))
    .query(`
      SELECT empCodigo FROM tbEmpleados 
      WHERE empLegajo = @legajo 
         OR empLegajo = LTRIM(RTRIM(@legajo))
         OR CAST(CAST(empLegajo AS INT) AS VARCHAR) = @legajo
    `);
  
  if (result.recordset.length === 0) {
    // Intentar sin padding
    const result2 = await pool.request()
      .input('legajo', sql.VarChar, legajo.toString())
      .query(`SELECT empCodigo FROM tbEmpleados WHERE empLegajo LIKE '%' + @legajo`);
    
    if (result2.recordset.length === 0) {
      throw new Error(`Empleado con legajo ${legajo} no encontrado en InWeb`);
    }
    return result2.recordset[0].empCodigo;
  }
  
  return result.recordset[0].empCodigo;
}

// ==================== COMANDOS ====================

async function ejecutarBloquear(legajo, datos) {
  const pool = await getSqlPool();
  const empCodigo = await getEmpleadoCodigo(legajo);
  
  // 1. Marcar empleado como eliminado
  await pool.request()
    .input('empCodigo', sql.Int, empCodigo)
    .query(`
      UPDATE tbEmpleados 
      SET empEliminado = 1, 
          empFechaEgreso = GETDATE()
      WHERE empCodigo = @empCodigo
    `);
  
  // 2. Quitar permisos en todos los lectores
  await pool.request()
    .input('empCodigo', sql.Int, empCodigo)
    .query(`
      UPDATE tbEmpleadoLectores 
      SET emplecPermiso = 0,
          emplecHasta = GETDATE()
      WHERE empCodigo = @empCodigo
    `);
  
  console.log(`[BLOQUEAR] Empleado ${legajo} (código ${empCodigo}) bloqueado`);
  return { success: true, empCodigo };
}

async function ejecutarDesbloquear(legajo, datos) {
  const pool = await getSqlPool();
  const empCodigo = await getEmpleadoCodigo(legajo);
  
  // 1. Reactivar empleado
  await pool.request()
    .input('empCodigo', sql.Int, empCodigo)
    .query(`
      UPDATE tbEmpleados 
      SET empEliminado = 0, 
          empFechaEgreso = '9999-12-31'
      WHERE empCodigo = @empCodigo
    `);
  
  // 2. Restaurar permisos en todos los lectores
  await pool.request()
    .input('empCodigo', sql.Int, empCodigo)
    .query(`
      UPDATE tbEmpleadoLectores 
      SET emplecPermiso = 1,
          emplecHasta = '9999-12-31'
      WHERE empCodigo = @empCodigo
    `);
  
  console.log(`[DESBLOQUEAR] Empleado ${legajo} (código ${empCodigo}) desbloqueado`);
  return { success: true, empCodigo };
}

async function ejecutarCrear(legajo, datos) {
  const pool = await getSqlPool();
  
  // Verificar que no exista
  const existing = await pool.request()
    .input('legajo', sql.VarChar, legajo)
    .query(`SELECT empCodigo FROM tbEmpleados WHERE empLegajo = @legajo`);
  
  if (existing.recordset.length > 0) {
    throw new Error(`Empleado con legajo ${legajo} ya existe`);
  }
  
  // 1. Crear persona
  const perResult = await pool.request()
    .input('nombre', sql.NVarChar, datos.nombre || '')
    .input('apellido', sql.NVarChar, datos.apellido || '')
    .input('dni', sql.VarChar, datos.dni || '')
    .query(`
      DECLARE @nuevoPer INT = (SELECT ISNULL(MAX(perCodigo), 0) + 1 FROM tbPersonas);
      
      INSERT INTO tbPersonas (perCodigo, perNombre, perApellido, perDocumento, docCodigo, perEliminado)
      VALUES (@nuevoPer, @nombre, @apellido, @dni, 0, 0);
      
      SELECT @nuevoPer as perCodigo;
    `);
  
  const perCodigo = perResult.recordset[0].perCodigo;
  
  // 2. Crear empleado
  const empResult = await pool.request()
    .input('legajo', sql.VarChar, legajo)
    .input('perCodigo', sql.Int, perCodigo)
    .input('contratista', sql.Bit, datos.eventual ? 1 : 0)
    .query(`
      DECLARE @nuevoEmp INT = (SELECT ISNULL(MAX(empCodigo), 0) + 1 FROM tbEmpleados);
      
      INSERT INTO tbEmpleados (empCodigo, empLegajo, perCodigo, orgCodigo, empContratista, empEliminado, empFechaIngreso, empFechaEgreso)
      VALUES (@nuevoEmp, @legajo, @perCodigo, 2, @contratista, 0, GETDATE(), '9999-12-31');
      
      SELECT @nuevoEmp as empCodigo;
    `);
  
  const empCodigo = empResult.recordset[0].empCodigo;
  
  // 3. Asignar tarjeta si viene
  if (datos.tarjeta) {
    await pool.request()
      .input('empCodigo', sql.Int, empCodigo)
      .input('tarjeta', sql.VarChar, datos.tarjeta)
      .query(`
        INSERT INTO tbEmpleadoHuellas (emphueCodigo, empCodigo, tpperTarjeta, emphueDedo)
        VALUES (
          (SELECT ISNULL(MAX(emphueCodigo), 0) + 1 FROM tbEmpleadoHuellas),
          @empCodigo,
          @tarjeta,
          0
        )
      `);
  }
  
  // 4. Habilitar en todos los relojes
  await pool.request()
    .input('empCodigo', sql.Int, empCodigo)
    .query(`
      INSERT INTO tbEmpleadoLectores (emplecCodigo, empCodigo, contCodigo, emplecPermiso, emplecDesde, emplecHasta, emplecDeAsistencia)
      SELECT 
        (SELECT ISNULL(MAX(emplecCodigo), 0) FROM tbEmpleadoLectores) + ROW_NUMBER() OVER (ORDER BY contCodigo),
        @empCodigo,
        contCodigo,
        1,
        GETDATE(),
        '9999-12-31',
        1
      FROM tbControladores 
      WHERE contEliminado = 0 OR contEliminado IS NULL
    `);
  
  console.log(`[CREAR] Empleado ${legajo} creado (código ${empCodigo})`);
  return { success: true, empCodigo, perCodigo };
}

// ==================== PROCESADOR ====================

const COMANDOS = {
  'BLOQUEAR': ejecutarBloquear,
  'DESBLOQUEAR': ejecutarDesbloquear,
  'CREAR': ejecutarCrear,
};

async function processCommand(command) {
  const { id, tipo, legajo, datos } = command;
  
  console.log(`\n[Procesando] ID=${id} Tipo=${tipo} Legajo=${legajo}`);
  
  const handler = COMANDOS[tipo.toUpperCase()];
  if (!handler) {
    throw new Error(`Tipo de comando desconocido: ${tipo}`);
  }
  
  return await handler(legajo, datos || {});
}

async function poll() {
  try {
    const commands = await fetchPendingCommands();
    
    if (commands.length === 0) {
      return;
    }
    
    console.log(`\n[Poll] ${commands.length} comando(s) pendiente(s)`);
    
    for (const cmd of commands) {
      try {
        await processCommand(cmd);
        await updateCommandStatus(cmd.id, 'procesado');
      } catch (error) {
        console.error(`[Error] Comando ${cmd.id}:`, error.message);
        await updateCommandStatus(cmd.id, 'error', error.message);
      }
    }
  } catch (error) {
    console.error('[Poll Error]', error.message);
  }
}

// ==================== MAIN ====================

async function main() {
  console.log('========================================');
  console.log('InWeb Command Worker');
  console.log('========================================');
  console.log(`Supabase: ${CONFIG.supabaseUrl}`);
  console.log(`SQL Server: ${CONFIG.sqlServer.server}`);
  console.log(`Poll Interval: ${CONFIG.pollInterval / 1000}s`);
  console.log('----------------------------------------');
  
  // Test conexión SQL
  try {
    await getSqlPool();
    console.log('[SQL Server] Conexión OK');
  } catch (error) {
    console.error('[SQL Server] Error de conexión:', error.message);
    process.exit(1);
  }
  
  // Ejecutar poll inicial
  await poll();
  
  // Loop de polling
  setInterval(poll, CONFIG.pollInterval);
  
  console.log('[Worker] Escuchando comandos...\n');
}

main().catch(console.error);

