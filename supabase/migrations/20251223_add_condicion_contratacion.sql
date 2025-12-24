-- Migración: Agregar campo condicion_contratacion a la tabla empleados
-- Fecha: 2025-12-23
-- Descripción: Campo para indicar la condición de contratación del empleado (efectivo, eventual, a_prueba)

-- Agregar campo condicion_contratacion a la tabla empleados
ALTER TABLE sicamar.empleados 
ADD COLUMN IF NOT EXISTS condicion_contratacion VARCHAR(50) DEFAULT 'efectivo';

-- Agregar comentario explicativo
COMMENT ON COLUMN sicamar.empleados.condicion_contratacion IS 'Condición de contratación: efectivo, eventual, a_prueba';

-- Actualizar los registros existentes basándose en el estado_laboral actual
UPDATE sicamar.empleados 
SET condicion_contratacion = CASE 
  WHEN estado_laboral = 'pre_efectivo' THEN 'a_prueba'
  WHEN estado_laboral = 'efectivo' THEN 'efectivo'
  ELSE 'eventual'
END
WHERE condicion_contratacion IS NULL;

-- Valores permitidos:
-- 'efectivo' - Empleado con contrato indefinido
-- 'eventual' - Empleado eventual/temporario
-- 'a_prueba' - Empleado en período de prueba previo a ser contratado


