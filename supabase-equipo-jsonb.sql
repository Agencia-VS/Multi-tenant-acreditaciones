-- ============================================================================
-- Agregar campo JSONB para equipo de personas frecuentes
-- ============================================================================

-- Agregar columna equipo_frecuente a mt_perfiles_acreditados
ALTER TABLE mt_perfiles_acreditados 
ADD COLUMN IF NOT EXISTS equipo_frecuente JSONB DEFAULT '[]'::jsonb;

-- Comentario descriptivo
COMMENT ON COLUMN mt_perfiles_acreditados.equipo_frecuente IS 
'Array de personas frecuentes del responsable. Estructura: [{id, nombre, apellido, rut, email, telefono, cargo, tipo_medio, nacionalidad, veces_usado}]';

-- Índice GIN para búsquedas eficientes dentro del JSONB
CREATE INDEX IF NOT EXISTS idx_perfiles_equipo_frecuente 
ON mt_perfiles_acreditados USING GIN (equipo_frecuente);

-- ============================================================================
-- Verificar cambio
-- ============================================================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'mt_perfiles_acreditados'
AND column_name = 'equipo_frecuente';
