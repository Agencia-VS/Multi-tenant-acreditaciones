-- ============================================================
-- M17 — Eventos Públicos / Privados / Invitación
-- Agrega columna visibility a events + tabla event_invitations
-- ============================================================

-- 1. Columna visibility en events
ALTER TABLE events
ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'public'
CHECK (visibility IN ('public', 'invite_only'));

-- 1b. Token de invitación compartible (uno por evento)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS invite_token UUID DEFAULT gen_random_uuid();

COMMENT ON COLUMN events.visibility IS 'public = visible en landing; invite_only = requiere token de invitación';
COMMENT ON COLUMN events.invite_token IS 'Token UUID compartible para eventos invite_only. Se genera al crear el evento.';

-- 2. Tabla de invitaciones
CREATE TABLE IF NOT EXISTS event_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email VARCHAR(320) NOT NULL,
  nombre VARCHAR(255),
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'accepted', 'expired')),
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, email)
);

CREATE INDEX IF NOT EXISTS idx_event_invitations_token ON event_invitations(token);
CREATE INDEX IF NOT EXISTS idx_event_invitations_event ON event_invitations(event_id);

-- 3. RLS
ALTER TABLE event_invitations ENABLE ROW LEVEL SECURITY;

-- Superadmin y admin del tenant pueden gestionar invitaciones
DROP POLICY IF EXISTS "sa_full_access_invitations" ON event_invitations;
CREATE POLICY "sa_full_access_invitations" ON event_invitations
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Recrear vista v_event_full para incluir visibility
-- DROP + CREATE porque PostgreSQL no permite CREATE OR REPLACE si cambian las columnas
DROP VIEW IF EXISTS v_event_full;
CREATE VIEW v_event_full AS
SELECT 
  e.*,
  t.nombre AS tenant_nombre,
  t.slug AS tenant_slug,
  t.logo_url AS tenant_logo,
  t.color_primario AS tenant_color_primario,
  t.color_secundario AS tenant_color_secundario,
  t.color_light AS tenant_color_light,
  t.color_dark AS tenant_color_dark,
  t.shield_url AS tenant_shield,
  t.background_url AS tenant_background,
  t.config AS tenant_config
FROM events e
JOIN tenants t ON e.tenant_id = t.id;
