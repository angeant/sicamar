-- ============================================================================
-- MIGRACIÓN: Sistema de Rotaciones
-- ============================================================================
-- 
-- Estructura:
--   rotaciones: nombre, turnos (JSON con horarios), frecuencia, notas
--   empleado_rotacion: asignación empleado → rotación
--
-- ============================================================================

-- 1. Crear tabla de rotaciones
CREATE TABLE IF NOT EXISTS sicamar.rotaciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    turnos JSONB NOT NULL,                -- Array de turnos: [{nombre, entrada, salida}, ...]
    frecuencia_semanas INT DEFAULT 1,     -- Cada cuántas semanas rota (1, 2, 4...)
    notas TEXT,                           -- Excepciones, info adicional para el LLM
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Crear tabla de asignación empleado-rotación
CREATE TABLE IF NOT EXISTS sicamar.empleado_rotacion (
    id SERIAL PRIMARY KEY,
    empleado_id BIGINT NOT NULL REFERENCES sicamar.empleados(id),
    rotacion_id INT NOT NULL REFERENCES sicamar.rotaciones(id),
    fecha_desde DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_hasta DATE,  -- NULL = vigente
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_empleado_rotacion_empleado ON sicamar.empleado_rotacion(empleado_id);
CREATE INDEX IF NOT EXISTS idx_empleado_rotacion_vigente ON sicamar.empleado_rotacion(empleado_id) WHERE fecha_hasta IS NULL;
CREATE INDEX IF NOT EXISTS idx_rotaciones_activas ON sicamar.rotaciones(id) WHERE activo = true;

-- 4. Insertar rotaciones de ejemplo
INSERT INTO sicamar.rotaciones (nombre, turnos, frecuencia_semanas, notas) VALUES 
(
    '3 Turnos Estándar',
    '[{"nombre": "Mañana", "entrada": "06:00", "salida": "14:00"}, {"nombre": "Tarde", "entrada": "14:00", "salida": "22:00"}, {"nombre": "Noche", "entrada": "22:00", "salida": "06:00"}]'::jsonb,
    1,
    'Rotación semanal completa. Mañana → Tarde → Noche.'
),
(
    '2 Turnos',
    '[{"nombre": "Mañana", "entrada": "06:00", "salida": "14:00"}, {"nombre": "Tarde", "entrada": "14:00", "salida": "22:00"}]'::jsonb,
    1,
    'Rotación pendular sin turno noche.'
),
(
    '2 Turnos Quincenal',
    '[{"nombre": "Mañana", "entrada": "07:00", "salida": "15:00"}, {"nombre": "Tarde", "entrada": "15:00", "salida": "23:00"}]'::jsonb,
    2,
    'Rota cada 2 semanas.'
),
(
    'Fijo Mañana',
    '[{"nombre": "Mañana", "entrada": "06:00", "salida": "14:00"}]'::jsonb,
    1,
    'Turno fijo, siempre mañana.'
),
(
    'Fijo Admin',
    '[{"nombre": "Central", "entrada": "08:00", "salida": "17:00"}]'::jsonb,
    1,
    'Horario administrativo. Lunes a viernes.'
)
ON CONFLICT DO NOTHING;

-- 5. Vista para consulta rápida
CREATE OR REPLACE VIEW sicamar.v_empleados_rotaciones AS
SELECT 
    e.id AS empleado_id,
    e.legajo,
    e.nombre,
    e.apellido,
    e.dni,
    e.categoria,
    e.sector,
    e.cargo,
    e.activo,
    e.foto_url,
    e.foto_thumb_url,
    r.id AS rotacion_id,
    r.nombre AS rotacion_nombre,
    r.turnos,
    r.frecuencia_semanas,
    r.notas AS rotacion_notas,
    jsonb_array_length(r.turnos) AS cantidad_turnos,
    er.fecha_desde
FROM sicamar.empleados e
LEFT JOIN sicamar.empleado_rotacion er ON er.empleado_id = e.id AND er.fecha_hasta IS NULL
LEFT JOIN sicamar.rotaciones r ON r.id = er.rotacion_id AND r.activo = true
WHERE e.activo = true
ORDER BY e.apellido, e.nombre;

-- 6. Comentarios
COMMENT ON TABLE sicamar.rotaciones IS 'Tipos de rotación. turnos es un array JSON con nombre/entrada/salida de cada turno.';
COMMENT ON TABLE sicamar.empleado_rotacion IS 'Asignación de rotación por empleado';
COMMENT ON COLUMN sicamar.rotaciones.turnos IS 'Array JSON: [{"nombre":"Mañana","entrada":"06:00","salida":"14:00"}, ...]';
COMMENT ON COLUMN sicamar.rotaciones.frecuencia_semanas IS 'Cada cuántas semanas rota al siguiente turno (1=semanal, 2=quincenal)';
COMMENT ON COLUMN sicamar.rotaciones.notas IS 'Excepciones y notas adicionales para procesamiento por LLM';
