/**
 * Módulo de sincronización de empleados InWeb → Supabase
 * 
 * Para usar: agregar a tu script de SyncMarcaciones o ejecutar independiente
 * 
 * Requiere: npm install mssql node-fetch
 */

const sql = require('mssql');

const CONFIG = {
  // SQL Server InWeb
  sqlServer: {
    server: '192.168.2.2',
    database: 'Sicamar_inweb',
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    // Windows Auth (desde el server con usuario Administrador)
    authentication: {
      type: 'ntlm',
      options: {
        domain: '',
        userName: 'Administrador',
        password: '' // Dejar vacío si usa Windows Auth integrada
      }
    },
    // O si usás SQL Auth:
    // user: 'sa',
    // password: 'TuPassword',
  },
  
  // Supabase Edge Function
  supabaseUrl: 'https://uimqzfmspegwzmdoqjfn.supabase.co/functions/v1/sicamar-sync-empleados',
  supabaseKey: process.env.SUPABASE_ANON_KEY || 'eyJhbG...', // Tu anon key
  
  // Intervalo de sync (30 minutos)
  syncInterval: 30 * 60 * 1000,
  
  // Solo empleados de SICAMAR METALES (orgCodigo = 2)
  orgCodigo: 2,
};

/**
 * Query para obtener empleados de InWeb
 */
const QUERY_EMPLEADOS = `
  SELECT 
    e.empCodigo,
    e.empLegajo,
    p.perDocumento as dni,
    p.perNombre as nombre,
    p.perApellido as apellido,
    CONVERT(varchar, e.empFechaIngreso, 23) as fechaIngreso,
    CONVERT(varchar, e.empFechaEgreso, 23) as fechaEgreso,
    ISNULL(e.empEliminado, 0) as eliminado,
    ISNULL(e.empContratista, 0) as contratista
  FROM tbEmpleados e
  INNER JOIN tbPersonas p ON e.perCodigo = p.perCodigo
  WHERE e.orgCodigo = @orgCodigo
    AND (p.perEliminado = 0 OR p.perEliminado IS NULL)
  ORDER BY e.empCodigo
`;

/**
 * Conectar a SQL Server y obtener empleados
 */
async function getEmpleadosFromInweb() {
  let pool;
  try {
    pool = await sql.connect(CONFIG.sqlServer);
    
    const result = await pool.request()
      .input('orgCodigo', sql.Int, CONFIG.orgCodigo)
      .query(QUERY_EMPLEADOS);
    
    console.log(`[InWeb] Obtenidos ${result.recordset.length} empleados`);
    return result.recordset;
    
  } catch (error) {
    console.error('[InWeb] Error conectando:', error.message);
    throw error;
  } finally {
    if (pool) await pool.close();
  }
}

/**
 * Enviar empleados a Supabase
 */
async function syncToSupabase(empleados) {
  try {
    const response = await fetch(CONFIG.supabaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.supabaseKey}`,
        'apikey': CONFIG.supabaseKey,
      },
      body: JSON.stringify({ empleados }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Error en sync');
    }
    
    console.log(`[Supabase] ${result.message}`);
    if (result.results?.errors?.length > 0) {
      console.warn('[Supabase] Errores:', result.results.errors);
    }
    
    return result;
    
  } catch (error) {
    console.error('[Supabase] Error:', error.message);
    throw error;
  }
}

/**
 * Ejecutar sincronización completa
 */
async function syncEmpleados() {
  const startTime = new Date();
  console.log(`\n[Sync] Iniciando sincronización de empleados - ${startTime.toISOString()}`);
  
  try {
    // 1. Obtener empleados de InWeb
    const empleados = await getEmpleadosFromInweb();
    
    if (empleados.length === 0) {
      console.log('[Sync] No hay empleados para sincronizar');
      return;
    }
    
    // 2. Enviar a Supabase en batches de 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < empleados.length; i += BATCH_SIZE) {
      const batch = empleados.slice(i, i + BATCH_SIZE);
      console.log(`[Sync] Enviando batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(empleados.length/BATCH_SIZE)}`);
      await syncToSupabase(batch);
    }
    
    const duration = (new Date() - startTime) / 1000;
    console.log(`[Sync] Completado en ${duration.toFixed(1)}s`);
    
  } catch (error) {
    console.error('[Sync] Error:', error.message);
  }
}

/**
 * Iniciar loop de sincronización
 */
function startSyncLoop() {
  console.log('[SyncEmpleados] Iniciando servicio...');
  console.log(`[SyncEmpleados] Intervalo: ${CONFIG.syncInterval / 60000} minutos`);
  
  // Ejecutar inmediatamente
  syncEmpleados();
  
  // Luego cada X minutos
  setInterval(syncEmpleados, CONFIG.syncInterval);
}

// Si se ejecuta directamente
if (require.main === module) {
  startSyncLoop();
}

// Exportar para usar como módulo
module.exports = { syncEmpleados, getEmpleadosFromInweb, syncToSupabase };

