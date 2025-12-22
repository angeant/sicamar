-- Migración: Crear tabla daily_planning en el schema sicamar
-- Esta tabla almacena la planificación diaria de cada empleado

-- Crear la tabla
CREATE TABLE IF NOT EXISTS sicamar.daily_planning (
  id SERIAL PRIMARY KEY,
  
  -- Empleado y fecha (clave única compuesta)
  employee_id INTEGER NOT NULL REFERENCES sicamar.empleados(id) ON DELETE CASCADE,
  operational_date DATE NOT NULL,
  
  -- Estado del día
  status VARCHAR(20) NOT NULL CHECK (status IN ('WORKING', 'ABSENT', 'REST')),
  
  -- Razón de ausencia (solo si status = 'ABSENT')
  absence_reason VARCHAR(30) CHECK (
    absence_reason IS NULL OR 
    absence_reason IN ('SICK', 'VACATION', 'ACCIDENT', 'LICENSE', 'SUSPENDED', 'ART', 'ABSENT_UNJUSTIFIED')
  ),
  
  -- Horarios normales (timestamp con zona horaria para manejar turnos nocturnos)
  normal_entry_at TIMESTAMP WITH TIME ZONE,
  normal_exit_at TIMESTAMP WITH TIME ZONE,
  
  -- Horarios extra (si entra antes o sale después de lo normal)
  extra_entry_at TIMESTAMP WITH TIME ZONE,
  extra_exit_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  notes TEXT,
  origin VARCHAR(20) DEFAULT 'web', -- 'web', 'chat', 'mcp', 'import'
  modified_by VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint única para upsert
  CONSTRAINT daily_planning_employee_date_unique UNIQUE (employee_id, operational_date)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_daily_planning_date ON sicamar.daily_planning(operational_date);
CREATE INDEX IF NOT EXISTS idx_daily_planning_employee ON sicamar.daily_planning(employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_planning_status ON sicamar.daily_planning(status);
CREATE INDEX IF NOT EXISTS idx_daily_planning_date_range ON sicamar.daily_planning(operational_date, employee_id);

-- Comentarios
COMMENT ON TABLE sicamar.daily_planning IS 'Planificación diaria de turnos y estados de empleados';
COMMENT ON COLUMN sicamar.daily_planning.operational_date IS 'Fecha operativa (fecha de SALIDA para turnos nocturnos)';
COMMENT ON COLUMN sicamar.daily_planning.normal_entry_at IS 'Timestamp de entrada normal (puede ser del día anterior para turnos nocturnos)';
COMMENT ON COLUMN sicamar.daily_planning.normal_exit_at IS 'Timestamp de salida normal';
COMMENT ON COLUMN sicamar.daily_planning.origin IS 'Origen de la planificación: web, chat, mcp, import';



