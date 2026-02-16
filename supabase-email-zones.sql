-- ============================================================================
-- Email Zone Content — Instrucciones por zona para emails
-- ============================================================================
-- Permite configurar contenido específico por zona para los emails de 
-- aprobación/rechazo. Cada zona puede tener sus propias instrucciones de 
-- acceso, información específica y notas importantes.
-- ============================================================================

-- Tabla principal
CREATE TABLE IF NOT EXISTS email_zone_content (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('aprobacion', 'rechazo')),
  zona text NOT NULL,
  titulo text DEFAULT '',                   -- título descriptivo de la sección (ej: "Acceso Reporteros Gráficos")
  instrucciones_acceso text DEFAULT '',     -- HTML: instrucciones de acceso específicas para esta zona
  info_especifica text DEFAULT '',          -- HTML: información particular de la zona
  notas_importantes text DEFAULT '',        -- HTML: advertencias / notas en rojo
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, tipo, zona)
);

-- Agregar campo info_general a email_templates para contenido común a todas las zonas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_templates' AND column_name = 'info_general'
  ) THEN
    ALTER TABLE email_templates ADD COLUMN info_general text DEFAULT '';
  END IF;
END $$;

-- RLS
ALTER TABLE email_zone_content ENABLE ROW LEVEL SECURITY;

-- Política simple: acceso total para service role (la API usa admin client)
CREATE POLICY "Service role full access on email_zone_content"
  ON email_zone_content FOR ALL
  USING (true)
  WITH CHECK (true);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_email_zone_content_tenant_tipo
  ON email_zone_content(tenant_id, tipo);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION update_email_zone_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_email_zone_content_updated_at ON email_zone_content;
CREATE TRIGGER trigger_email_zone_content_updated_at
  BEFORE UPDATE ON email_zone_content
  FOR EACH ROW EXECUTE FUNCTION update_email_zone_content_updated_at();

-- ============================================================================
-- Ejemplo de uso:
-- 
-- INSERT INTO email_zone_content (tenant_id, tipo, zona, titulo, instrucciones_acceso, info_especifica, notas_importantes)
-- VALUES (
--   'uuid-del-tenant',
--   'aprobacion',
--   'Cancha',
--   'Acceso Reporteros Gráficos',
--   '<p>Primero deben acreditarse en Prensa...</p>',
--   '<p>El ingreso a cancha debe realizarse portando el peto.</p>',
--   '<p style="color: #dc2626;">¡Atención! Ningún reportero gráfico puede acceder a la zona de exclusión.</p>'
-- );
-- ============================================================================
