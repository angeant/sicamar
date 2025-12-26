/**
 * Servicio unificado de sincronización Sicamar
 * 
 * Funciones:
 * 1. Marcaciones: Lee archivos .rei2 y envía a Supabase (cada 5 min)
 * 2. Comandos: Polling de Supabase y ejecuta en InWeb SQL Server (cada 1 min)
 * 3. Heartbeat: Envía señal de vida a Supabase (cada 5 min)
 * 
 * Instalar en: C:\SyncMarcaciones\sync-service.js
 * Requiere: npm install mssql chokidar
 */

const fs = require('fs');
const path = require('path');
const sql = require('mssql');

// ==================== CONFIGURACIÓN ====================

const CONFIG = {
  // Supabase
  supabase: {
    url: 'https://uimqzfmspegwzmdoqjfn.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY || 'TU_ANON_KEY_AQUI',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || 'TU_SERVICE_KEY_AQUI',
  },
  
  // SQL Server InWeb
  sqlServer: {
    server: '192.168.2.2',
    database: 'Sicamar_inweb',
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    // Usar SQL Auth para simplicidad
    user: 'sa',
    password: 'Bejerman123!',
    // O Windows Auth (descomentar):
    // authentication: { type: 'ntlm', options: { domain: '', userName: 'Administrador', password: '' } },
  },
  
  // Marcaciones
  marcaciones: {
    path: 'C:\\ProgramData\\Intelektron\\localhost\\Marcaciones',
    sentLog: 'C:\\SyncMarcaciones\\sent.log',
    pollInterval: 5 * 60 * 1000,  // 5 minutos
  },
  
  // Comandos InWeb
  comandos: {
    pollInterval: 60 * 1000,  // 1 minuto
  },
  
  // Heartbeat
  heartbeat: {
    interval: 5 * 60 * 1000,  // 5 minutos
  },
};

// ==================== UTILIDADES ====================

function log(module, message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = { info: '●', error: '✖', success: '✔', warn: '⚠' }[type] || '●';
  console.log(`[${timestamp}] ${prefix} [${module}] ${message}`);
}

async function supabaseFetch(endpoint, options = {}) {
  const url = `${CONFIG.supabase.url}${endpoint}`;
  const key = options.useServiceKey ? CONFIG.supabase.serviceKey : CONFIG.supabase.anonKey;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status} ${response.statusText}`);
  }
  
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ==================== SQL SERVER ====================

let sqlPool = null;

async function getSqlPool() {
  if (!sqlPool || !sqlPool.connected) {
    try {
      sqlPool = await sql.connect(CONFIG.sqlServer);
      log('SQL', 'Conexión establecida', 'success');
    } catch (error) {
      log('SQL', `Error de conexión: ${error.message}`, 'error');
      throw error;
    }
  }
  return sqlPool;
}

// ==================== MARCACIONES ====================

let sentMarcaciones = new Set();

function loadSentLog() {
  try {
    if (fs.existsSync(CONFIG.marcaciones.sentLog)) {
      const content = fs.readFileSync(CONFIG.marcaciones.sentLog, 'utf8');
      sentMarcaciones = new Set(content.split('\n').filter(Boolean));
      log('Marcaciones', `Cargadas ${sentMarcaciones.size} marcaciones enviadas`);
    }
  } catch (error) {
    log('Marcaciones', `Error cargando log: ${error.message}`, 'warn');
  }
}

function saveSentLog() {
  try {
    fs.writeFileSync(CONFIG.marcaciones.sentLog, [...sentMarcaciones].join('\n'));
  } catch (error) {
    log('Marcaciones', `Error guardando log: ${error.message}`, 'error');
  }
}

function parseMarcacion(line, archivo) {
  // Formato: DNI,FECHA,HORA,?,ID_RELOJ,?,TIPO
  const parts = line.split(',');
  if (parts.length < 7) return null;
  
  const [dni, fecha, hora, , idReloj, , tipo] = parts;
  if (!dni || !fecha || !hora || !tipo) return null;
  
  // Normalizar tipo
  let tipoNorm = tipo.trim().toUpperCase();
  if (tipoNorm === 'EI') tipoNorm = 'E';
  if (tipoNorm === 'SI') tipoNorm = 'S';
  if (tipoNorm !== 'E' && tipoNorm !== 'S') return null;
  
  return {
    dni: dni.trim(),
    fecha: fecha.trim(),
    hora: hora.trim(),
    id_reloj: parseInt(idReloj) || null,
    tipo: tipoNorm,
    archivo_origen: archivo,
  };
}

async function procesarArchivoMarcaciones(filePath) {
  const archivo = path.basename(filePath);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    
    let enviadas = 0;
    let duplicadas = 0;
    
    for (const line of lines) {
      const marcacion = parseMarcacion(line, archivo);
      if (!marcacion) continue;
      
      const key = `${marcacion.dni}|${marcacion.fecha}|${marcacion.hora}|${marcacion.tipo}`;
      if (sentMarcaciones.has(key)) {
        duplicadas++;
        continue;
      }
      
      try {
        await supabaseFetch('/functions/v1/sicamar-marcaciones', {
          method: 'POST',
          body: JSON.stringify(marcacion),
        });
        sentMarcaciones.add(key);
        enviadas++;
      } catch (error) {
        if (!error.message.includes('duplicate')) {
          log('Marcaciones', `Error enviando: ${error.message}`, 'error');
        }
      }
    }
    
    if (enviadas > 0) {
      log('Marcaciones', `${archivo}: ${enviadas} enviadas, ${duplicadas} duplicadas`, 'success');
      saveSentLog();
    }
  } catch (error) {
    log('Marcaciones', `Error procesando ${archivo}: ${error.message}`, 'error');
  }
}

async function syncMarcaciones() {
  try {
    if (!fs.existsSync(CONFIG.marcaciones.path)) {
      log('Marcaciones', `Directorio no existe: ${CONFIG.marcaciones.path}`, 'warn');
      return;
    }
    
    const files = fs.readdirSync(CONFIG.marcaciones.path)
      .filter(f => f.endsWith('.rei2'))
      .map(f => path.join(CONFIG.marcaciones.path, f));
    
    for (const file of files) {
      await procesarArchivoMarcaciones(file);
    }
  } catch (error) {
    log('Marcaciones', `Error en sync: ${error.message}`, 'error');
  }
}

// ==================== COMANDOS INWEB ====================

async function getEmpleadoCodigo(pool, legajo) {
  const result = await pool.request()
    .input('legajo', sql.VarChar, legajo.toString())
    .query(`
      SELECT TOP 1 empCodigo FROM tbEmpleados 
      WHERE empLegajo = @legajo 
         OR LTRIM(RTRIM(empLegajo)) = @legajo
         OR TRY_CAST(empLegajo AS INT) = TRY_CAST(@legajo AS INT)
      ORDER BY empCodigo DESC
    `);
  
  if (result.recordset.length === 0) {
    throw new Error(`Empleado legajo ${legajo} no encontrado`);
  }
  return result.recordset[0].empCodigo;
}

async function ejecutarBloquear(pool, legajo) {
  const empCodigo = await getEmpleadoCodigo(pool, legajo);
  
  await pool.request()
    .input('empCodigo', sql.Int, empCodigo)
    .query(`
      UPDATE tbEmpleados SET empEliminado = 1, empFechaEgreso = GETDATE() WHERE empCodigo = @empCodigo;
      UPDATE tbEmpleadoLectores SET emplecPermiso = 0, emplecHasta = GETDATE() WHERE empCodigo = @empCodigo;
    `);
  
  log('Comandos', `BLOQUEAR legajo ${legajo} (código ${empCodigo})`, 'success');
  return { empCodigo };
}

async function ejecutarDesbloquear(pool, legajo) {
  const empCodigo = await getEmpleadoCodigo(pool, legajo);
  
  await pool.request()
    .input('empCodigo', sql.Int, empCodigo)
    .query(`
      UPDATE tbEmpleados SET empEliminado = 0, empFechaEgreso = '9999-12-31' WHERE empCodigo = @empCodigo;
      UPDATE tbEmpleadoLectores SET emplecPermiso = 1, emplecHasta = '9999-12-31' WHERE empCodigo = @empCodigo;
    `);
  
  log('Comandos', `DESBLOQUEAR legajo ${legajo} (código ${empCodigo})`, 'success');
  return { empCodigo };
}

async function ejecutarCrear(pool, legajo, datos) {
  // Verificar que no exista
  const existing = await pool.request()
    .input('legajo', sql.VarChar, legajo)
    .query(`SELECT empCodigo FROM tbEmpleados WHERE empLegajo = @legajo`);
  
  if (existing.recordset.length > 0) {
    throw new Error(`Legajo ${legajo} ya existe`);
  }
  
  // Crear persona
  const perResult = await pool.request()
    .input('nombre', sql.NVarChar, datos.nombre || '')
    .input('apellido', sql.NVarChar, datos.apellido || '')
    .input('dni', sql.VarChar, datos.dni || '')
    .query(`
      DECLARE @per INT = (SELECT ISNULL(MAX(perCodigo), 0) + 1 FROM tbPersonas);
      INSERT INTO tbPersonas (perCodigo, perNombre, perApellido, perDocumento, docCodigo, perEliminado)
      VALUES (@per, @nombre, @apellido, @dni, 0, 0);
      SELECT @per as perCodigo;
    `);
  const perCodigo = perResult.recordset[0].perCodigo;
  
  // Crear empleado
  const empResult = await pool.request()
    .input('legajo', sql.VarChar, legajo)
    .input('perCodigo', sql.Int, perCodigo)
    .input('contratista', sql.Bit, datos.eventual ? 1 : 0)
    .query(`
      DECLARE @emp INT = (SELECT ISNULL(MAX(empCodigo), 0) + 1 FROM tbEmpleados);
      INSERT INTO tbEmpleados (empCodigo, empLegajo, perCodigo, orgCodigo, empContratista, empEliminado, empFechaIngreso, empFechaEgreso)
      VALUES (@emp, @legajo, @perCodigo, 2, @contratista, 0, GETDATE(), '9999-12-31');
      SELECT @emp as empCodigo;
    `);
  const empCodigo = empResult.recordset[0].empCodigo;
  
  // Asignar tarjeta
  if (datos.tarjeta) {
    await pool.request()
      .input('empCodigo', sql.Int, empCodigo)
      .input('tarjeta', sql.VarChar, datos.tarjeta)
      .query(`
        INSERT INTO tbEmpleadoHuellas (emphueCodigo, empCodigo, tpperTarjeta, emphueDedo)
        VALUES ((SELECT ISNULL(MAX(emphueCodigo), 0) + 1 FROM tbEmpleadoHuellas), @empCodigo, @tarjeta, 0)
      `);
  }
  
  // Habilitar en relojes
  await pool.request()
    .input('empCodigo', sql.Int, empCodigo)
    .query(`
      INSERT INTO tbEmpleadoLectores (emplecCodigo, empCodigo, contCodigo, emplecPermiso, emplecDesde, emplecHasta, emplecDeAsistencia)
      SELECT (SELECT ISNULL(MAX(emplecCodigo), 0) FROM tbEmpleadoLectores) + ROW_NUMBER() OVER (ORDER BY contCodigo),
             @empCodigo, contCodigo, 1, GETDATE(), '9999-12-31', 1
      FROM tbControladores WHERE contEliminado = 0 OR contEliminado IS NULL
    `);
  
  log('Comandos', `CREAR legajo ${legajo} (código ${empCodigo})`, 'success');
  return { empCodigo, perCodigo };
}

async function syncComandos() {
  try {
    // Fetch comandos pendientes
    const comandos = await supabaseFetch(
      '/rest/v1/comandos_inweb?estado=eq.pendiente&order=created_at.asc&limit=10',
      { useServiceKey: true }
    );
    
    if (!comandos || comandos.length === 0) return;
    
    log('Comandos', `${comandos.length} comando(s) pendiente(s)`);
    
    const pool = await getSqlPool();
    
    for (const cmd of comandos) {
      try {
        const { id, tipo, legajo, datos } = cmd;
        
        switch (tipo.toUpperCase()) {
          case 'BLOQUEAR':
            await ejecutarBloquear(pool, legajo);
            break;
          case 'DESBLOQUEAR':
            await ejecutarDesbloquear(pool, legajo);
            break;
          case 'CREAR':
            await ejecutarCrear(pool, legajo, datos || {});
            break;
          default:
            throw new Error(`Tipo desconocido: ${tipo}`);
        }
        
        // Marcar como procesado
        await supabaseFetch(`/rest/v1/comandos_inweb?id=eq.${id}`, {
          method: 'PATCH',
          useServiceKey: true,
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ estado: 'procesado', processed_at: new Date().toISOString() }),
        });
        
      } catch (error) {
        log('Comandos', `Error en comando ${cmd.id}: ${error.message}`, 'error');
        
        // Marcar como error
        await supabaseFetch(`/rest/v1/comandos_inweb?id=eq.${cmd.id}`, {
          method: 'PATCH',
          useServiceKey: true,
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ estado: 'error', error_mensaje: error.message, processed_at: new Date().toISOString() }),
        });
      }
    }
  } catch (error) {
    log('Comandos', `Error en sync: ${error.message}`, 'error');
  }
}

// ==================== HEARTBEAT ====================

async function sendHeartbeat() {
  try {
    await supabaseFetch('/functions/v1/sicamar-heartbeat', {
      method: 'POST',
      body: JSON.stringify({ service: 'sync-service', timestamp: new Date().toISOString() }),
    });
    log('Heartbeat', 'OK', 'success');
  } catch (error) {
    log('Heartbeat', `Error: ${error.message}`, 'error');
  }
}

// ==================== MAIN ====================

async function main() {
  console.log('\n========================================');
  console.log('  SICAMAR SYNC SERVICE');
  console.log('========================================');
  console.log(`Supabase:    ${CONFIG.supabase.url}`);
  console.log(`SQL Server:  ${CONFIG.sqlServer.server}`);
  console.log(`Marcaciones: ${CONFIG.marcaciones.path}`);
  console.log('----------------------------------------\n');
  
  // Cargar log de marcaciones enviadas
  loadSentLog();
  
  // Test conexión SQL
  try {
    await getSqlPool();
  } catch (error) {
    log('INIT', 'No se pudo conectar a SQL Server. Continuando solo con marcaciones...', 'warn');
  }
  
  // Ejecutar inmediatamente
  await syncMarcaciones();
  await syncComandos();
  await sendHeartbeat();
  
  // Programar intervalos
  setInterval(syncMarcaciones, CONFIG.marcaciones.pollInterval);
  setInterval(syncComandos, CONFIG.comandos.pollInterval);
  setInterval(sendHeartbeat, CONFIG.heartbeat.interval);
  
  log('INIT', 'Servicio iniciado. Escuchando...', 'success');
}

// Manejo de errores
process.on('uncaughtException', (error) => {
  log('FATAL', error.message, 'error');
});

process.on('unhandledRejection', (error) => {
  log('FATAL', error.message, 'error');
});

// Iniciar
main().catch(console.error);


