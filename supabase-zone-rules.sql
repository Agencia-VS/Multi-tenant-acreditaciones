-- ============================================================================
-- Migración: Reglas de Auto-Asignación de Zonas
-- Similar a event_quota_rules: el admin configura mapeo cargo → zona por evento
-- ============================================================================

-- Tabla de reglas: "Si cargo = X, asignar zona = Y"
CREATE TABLE IF NOT EXISTS event_zone_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  cargo VARCHAR(255) NOT NULL,
  zona VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, cargo)
);

CREATE INDEX IF NOT EXISTS idx_zone_rules_event ON event_zone_rules(event_id);

-- RLS
ALTER TABLE event_zone_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY zone_rules_select ON event_zone_rules FOR SELECT USING (true);
CREATE POLICY zone_rules_manage ON event_zone_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM tenant_admins ta
    JOIN events e ON e.tenant_id = ta.tenant_id
    WHERE e.id = event_zone_rules.event_id AND ta.user_id = auth.uid()
  )
);
