import { watch } from "chokidar";
import { readFileSync, appendFileSync, existsSync } from "fs";
import { join } from "path";
import sql from "mssql";

// === CONFIGURACIÓN ===
const CONFIG = {
  // Carpeta donde Intelektron guarda las marcaciones
  marcacionesPath: "C:\\ProgramData\\Intelektron\\localhost\\Marcaciones",

  // URLs de Supabase
  apiUrl: "https://uimqzfmspegwzmdoqjfn.supabase.co/functions/v1/sicamar-marcaciones",
  heartbeatUrl: "https://uimqzfmspegwzmdoqjfn.supabase.co/functions/v1/sicamar-heartbeat",
  supabaseRestUrl: "https://uimqzfmspegwzmdoqjfn.supabase.co/rest/v1",

  // API Key de Supabase (anon key - segura para exponer)
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpbXF6Zm1zcGVnd3ptZG9xamZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0NjU1OTcsImV4cCI6MjA2NDA0MTU5N30.kaVxrifHrs-5UgSIp9HQaNMVXoBeUM5j3HoEGs1-McQ",

  // Archivo para guardar las marcaciones ya enviadas
  sentLog: "C:\\SyncMarcaciones\\sent.log",

  // Intervalos
  heartbeatInterval: 5 * 60 * 1000,  // 5 minutos
  comandosInterval: 60 * 1000,        // 1 minuto

  // SQL Server InWeb - SQLEXPRESS en puerto 1500
  sqlServer: {
    server: "localhost",
    port: 1500,
    database: "Sicamar_inweb",
    user: "sa",
    password: "Inicio2008",
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
  },
};

// === ESTADÍSTICAS ===
let stats = {
  archivos: 0,
  marcaciones: 0,
  errores: 0,
  comandos: 0,
  iniciadoEn: new Date().toISOString()
};

// === SQL SERVER ===
let sqlPool = null;

async function getSqlPool() {
  if (!sqlPool || !sqlPool.connected) {
    try {
      sqlPool = await sql.connect(CONFIG.sqlServer);
      log("🔌", "SQL Server conectado");
    } catch (error) {
      log("❌", `SQL Server error: ${error.message}`);
      throw error;
    }
  }
  return sqlPool;
}

// === LOGGING ===
function log(emoji, message) {
  const timestamp = new Date().toLocaleString('es-AR');
  console.log(`[${timestamp}] ${emoji} ${message}`);
}

// === MARCACIONES (sin cambios) ===

function parseMarcacion(line, filename) {
  const parts = line.split(",");
  if (parts.length < 7) return null;

  const [dni, fecha, hora, , idReloj, , tipo] = parts;
  if (!dni || !fecha || !hora || !tipo) return null;

  const [dia, mes, anio] = fecha.split("/");
  const fechaISO = `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;

  let tipoNorm = tipo.trim().toUpperCase();
  if (tipoNorm === 'EI') tipoNorm = 'E';
  if (tipoNorm === 'SI') tipoNorm = 'S';
  if (tipoNorm !== 'E' && tipoNorm !== 'S') return null;

  return {
    dni: dni.trim(),
    fecha: fechaISO,
    hora: hora.trim(),
    id_reloj: parseInt(idReloj) || 0,
    tipo: tipoNorm,
    archivo_origen: filename
  };
}

function yaEnviada(marcacion) {
  if (!existsSync(CONFIG.sentLog)) return false;
  const sent = readFileSync(CONFIG.sentLog, "utf-8");
  const key = `${marcacion.dni}-${marcacion.fecha}-${marcacion.hora}-${marcacion.tipo}`;
  return sent.includes(key);
}

function marcarEnviada(marcacion) {
  const key = `${marcacion.dni}-${marcacion.fecha}-${marcacion.hora}-${marcacion.tipo}\n`;
  appendFileSync(CONFIG.sentLog, key);
}

async function enviarMarcacion(marcacion) {
  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": CONFIG.anonKey,
        "Authorization": `Bearer ${CONFIG.anonKey}`
      },
      body: JSON.stringify(marcacion)
    });

    if (response.ok) {
      log("✅", `Enviada: ${marcacion.dni} ${marcacion.fecha} ${marcacion.hora} ${marcacion.tipo}`);
      marcarEnviada(marcacion);
      stats.marcaciones++;
      return true;
    } else {
      const errorText = await response.text();
      if (errorText.includes('duplicate') || response.status === 200) {
        marcarEnviada(marcacion);
        return true;
      }
      log("❌", `Error HTTP ${response.status}: ${errorText}`);
      stats.errores++;
      return false;
    }
  } catch (error) {
    log("❌", `Error de red: ${error.message}`);
    stats.errores++;
    return false;
  }
}

async function procesarArchivo(filepath) {
  const filename = filepath.split("\\").pop();
  log("📁", `Procesando: ${filename}`);

  try {
    const content = readFileSync(filepath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());

    let nuevas = 0;
    for (const line of lines) {
      const marcacion = parseMarcacion(line, filename);
      if (!marcacion) continue;
      if (yaEnviada(marcacion)) continue;

      await enviarMarcacion(marcacion);
      nuevas++;
      await new Promise(r => setTimeout(r, 100));
    }

    if (nuevas > 0) {
      stats.archivos++;
      log("📊", `${filename}: ${nuevas} marcaciones nuevas enviadas`);
    }
  } catch (error) {
    log("❌", `Error procesando ${filename}: ${error.message}`);
    stats.errores++;
  }
}

// === HEARTBEAT ===

async function enviarHeartbeat() {
  try {
    const response = await fetch(CONFIG.heartbeatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": CONFIG.anonKey,
        "Authorization": `Bearer ${CONFIG.anonKey}`
      },
      body: JSON.stringify({
        archivos: stats.archivos,
        marcaciones: stats.marcaciones,
        comandos: stats.comandos,
        errores: stats.errores,
        iniciado_en: stats.iniciadoEn,
        uptime_minutos: Math.floor((Date.now() - new Date(stats.iniciadoEn).getTime()) / 60000)
      })
    });

    if (response.ok) {
      log("💓", `Heartbeat OK - Marc: ${stats.marcaciones}, Cmd: ${stats.comandos}, Err: ${stats.errores}`);
    } else {
      log("⚠️", `Heartbeat falló: HTTP ${response.status}`);
    }
  } catch (error) {
    log("⚠️", `Heartbeat error: ${error.message}`);
  }
}

// === COMANDOS INWEB (NUEVO) ===

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
  
  log("🚫", `BLOQUEADO: legajo ${legajo} (código ${empCodigo})`);
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
  
  log("✅", `DESBLOQUEADO: legajo ${legajo} (código ${empCodigo})`);
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
  
  log("🆕", `CREADO: legajo ${legajo} (código ${empCodigo})`);
  return { empCodigo, perCodigo };
}

async function procesarComandos() {
  try {
    // Fetch comandos pendientes de Supabase (schema sicamar)
    const response = await fetch(
      `${CONFIG.supabaseRestUrl}/comandos_inweb?estado=eq.pendiente&order=created_at.asc&limit=10`,
      {
        headers: {
          "apikey": CONFIG.anonKey,
          "Authorization": `Bearer ${CONFIG.anonKey}`,
          "Accept": "application/json",
          "Accept-Profile": "sicamar",  // Schema sicamar
        },
      }
    );
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Service key no configurada, silenciar error
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const comandos = await response.json();
    if (!comandos || comandos.length === 0) return;
    
    log("📨", `${comandos.length} comando(s) pendiente(s)`);
    
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
        
        stats.comandos++;
        
        // Marcar como procesado
        await fetch(`${CONFIG.supabaseRestUrl}/comandos_inweb?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            "apikey": CONFIG.anonKey,
            "Authorization": `Bearer ${CONFIG.anonKey}`,
            "Content-Type": "application/json",
            "Accept-Profile": "sicamar",
            "Content-Profile": "sicamar",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ 
            estado: 'procesado', 
            processed_at: new Date().toISOString() 
          }),
        });
        
      } catch (error) {
        log("❌", `Error comando ${cmd.id}: ${error.message}`);
        stats.errores++;
        
        // Marcar como error
        await fetch(`${CONFIG.supabaseRestUrl}/comandos_inweb?id=eq.${cmd.id}`, {
          method: 'PATCH',
          headers: {
            "apikey": CONFIG.anonKey,
            "Authorization": `Bearer ${CONFIG.anonKey}`,
            "Content-Type": "application/json",
            "Accept-Profile": "sicamar",
            "Content-Profile": "sicamar",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ 
            estado: 'error', 
            error_mensaje: error.message,
            processed_at: new Date().toISOString() 
          }),
        });
      }
    }
  } catch (error) {
    // Solo loguear si no es error de auth (service key no configurada)
    if (!error.message.includes('401') && !error.message.includes('403')) {
      log("⚠️", `Error procesando comandos: ${error.message}`);
    }
  }
}

// === INICIAR ===
console.log("");
console.log("╔════════════════════════════════════════════════════╗");
console.log("║     🚀 SYNC MARCACIONES + COMANDOS SICAMAR v3.0    ║");
console.log("╚════════════════════════════════════════════════════╝");
console.log("");
log("📂", `Monitoreando: ${CONFIG.marcacionesPath}`);
log("🔗", `API: ${CONFIG.apiUrl}`);
log("🗄️", `SQL Server: ${CONFIG.sqlServer.server}`);
log("💓", `Heartbeat cada ${CONFIG.heartbeatInterval / 60000} minutos`);
log("📨", `Comandos cada ${CONFIG.comandosInterval / 1000} segundos`);
console.log("");

// Iniciar watcher de marcaciones
const watcher = watch(CONFIG.marcacionesPath, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 100
  }
});

watcher
  .on("add", procesarArchivo)
  .on("change", procesarArchivo)
  .on("error", error => {
    log("❌", `Error watcher: ${error}`);
    stats.errores++;
  });

// Test conexión SQL al inicio
getSqlPool().catch(() => {
  log("⚠️", "SQL Server no disponible. Comandos InWeb deshabilitados.");
});

// Heartbeat inicial
setTimeout(enviarHeartbeat, 10000);

// Intervalos
setInterval(enviarHeartbeat, CONFIG.heartbeatInterval);
setInterval(procesarComandos, CONFIG.comandosInterval);

// Procesar comandos pendientes al inicio
setTimeout(procesarComandos, 5000);

log("👀", "Esperando cambios en archivos .rei2 y comandos...");
console.log("");

