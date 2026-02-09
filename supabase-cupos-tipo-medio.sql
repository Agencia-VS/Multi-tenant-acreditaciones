-- ============================================================================
-- MIGRACIÓN: Cupos por Tipo de Medio por Empresa
-- ============================================================================
-- Las restricciones funcionan así:
--   Cada tipo_medio (ej: "Sitio Web", "Radiales con caseta") tiene un 
--   cupo_por_empresa que limita cuántas acreditaciones puede enviar
--   cada empresa para ese tipo de medio en un evento.
--
-- Ejemplo: Si "Sitio Web" tiene cupo_por_empresa = 2, entonces
--   ESPN Chile puede acreditar máximo 2 personas como "Sitio Web",
--   CNN Chile también puede acreditar máximo 2, etc.
-- ============================================================================

-- 1. Tabla de cupos por tipo de medio
CREATE TABLE IF NOT EXISTS mt_cupos_tipo_medio (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES mt_tenants(id) ON DELETE CASCADE,
  evento_id INT NOT NULL REFERENCES mt_eventos(id) ON DELETE CASCADE,
  tipo_medio TEXT NOT NULL,
  cupo_por_empresa INT NOT NULL DEFAULT 0, -- 0 = sin límite
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, evento_id, tipo_medio)
);

-- 2. Agregar columna tipo_medio a mt_acreditados (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mt_acreditados' AND column_name = 'tipo_medio'
  ) THEN
    ALTER TABLE mt_acreditados ADD COLUMN tipo_medio TEXT;
  END IF;
END $$;

-- 3. Índice para búsquedas rápidas de cupo
CREATE INDEX IF NOT EXISTS idx_acreditados_tipo_medio_empresa 
  ON mt_acreditados(tenant_id, evento_id, tipo_medio, empresa);

CREATE INDEX IF NOT EXISTS idx_cupos_tipo_medio_lookup
  ON mt_cupos_tipo_medio(tenant_id, evento_id);

-- 4. RLS para mt_cupos_tipo_medio
ALTER TABLE mt_cupos_tipo_medio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cupos_tipo_medio_select" ON mt_cupos_tipo_medio 
  FOR SELECT USING (true);
CREATE POLICY "cupos_tipo_medio_insert" ON mt_cupos_tipo_medio 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "cupos_tipo_medio_update" ON mt_cupos_tipo_medio 
  FOR UPDATE USING (true);
CREATE POLICY "cupos_tipo_medio_delete" ON mt_cupos_tipo_medio 
  FOR DELETE USING (true);

-- 5. Comentarios
COMMENT ON TABLE mt_cupos_tipo_medio IS 
  'Configura cupos por tipo de medio por empresa para cada evento de un tenant';
COMMENT ON COLUMN mt_cupos_tipo_medio.cupo_por_empresa IS 
  'Máximo de acreditaciones por empresa para este tipo de medio. 0 = sin límite';
COMMENT ON COLUMN mt_cupos_tipo_medio.tipo_medio IS 
  'Nombre del tipo de medio (ej: Sitio Web, Radiales con caseta, Televisión)';
