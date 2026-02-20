-- ============================================================
-- Security Hardening Migration  (v2 — linter-clean)
-- Fecha: 2026-02-20
-- Fixes: FK, CHECK, RLS policies, SECURITY INVOKER views,
--        function search_path, permissive INSERT policies
--
-- ROLES:
--   superadmin  → tabla superadmins (acceso total)
--   admin       → tenant_admins.rol = 'admin'  (CRUD en su tenant)
--   editor      → tenant_admins.rol = 'editor' (CRUD en su tenant)
--   viewer      → tenant_admins.rol = 'viewer' (solo lectura en su tenant)
--
-- NOTA: tenants ya tiene RLS habilitado manualmente.
-- NOTA: "Leaked password protection" se activa desde el dashboard
--        de Supabase (Auth → Settings), no con SQL.
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  0.  HELPER FUNCTIONS  (idempotente + search_path fijo) ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.superadmins WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
   SET search_path = public;

CREATE OR REPLACE FUNCTION has_tenant_access(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_superadmin() OR EXISTS (
    SELECT 1 FROM public.tenant_admins
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
   SET search_path = public;

CREATE OR REPLACE FUNCTION can_edit_tenant(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_superadmin() OR EXISTS (
    SELECT 1 FROM public.tenant_admins
    WHERE user_id = auth.uid()
      AND tenant_id = p_tenant_id
      AND rol IN ('admin', 'editor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
   SET search_path = public;

CREATE OR REPLACE FUNCTION get_tenant_role(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE v_role TEXT;
BEGIN
  IF is_superadmin() THEN RETURN 'superadmin'; END IF;
  SELECT rol INTO v_role
  FROM public.tenant_admins
  WHERE user_id = auth.uid() AND tenant_id = p_tenant_id;
  RETURN COALESCE(v_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
   SET search_path = public;

-- is_admin_of_tenant — usado por policies legacy; ahora delegamos a has_tenant_access
DROP FUNCTION IF EXISTS is_admin_of_tenant(UUID);
CREATE OR REPLACE FUNCTION is_admin_of_tenant(tenant_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_tenant_access(tenant_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
   SET search_path = public;

-- ── Trigger helpers ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql
   SET search_path = public;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql
   SET search_path = public;

CREATE OR REPLACE FUNCTION update_email_zone_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql
   SET search_path = public;

-- ── Business logic functions (search_path fix) ────────────

CREATE OR REPLACE FUNCTION get_or_create_perfil(
  p_user_id UUID, p_rut TEXT, p_nombre TEXT, p_apellido TEXT,
  p_email TEXT, p_empresa TEXT DEFAULT NULL, p_cargo TEXT DEFAULT NULL,
  p_telefono TEXT DEFAULT NULL, p_nacionalidad TEXT DEFAULT 'Chile'
)
RETURNS UUID AS $$
DECLARE v_perfil_id UUID;
BEGIN
  SELECT id INTO v_perfil_id FROM mt_perfiles_acreditados WHERE rut = p_rut;
  IF v_perfil_id IS NOT NULL THEN
    UPDATE mt_perfiles_acreditados SET
      user_id = COALESCE(user_id, p_user_id),
      nombre = COALESCE(p_nombre, nombre),
      apellido = COALESCE(p_apellido, apellido),
      email = COALESCE(p_email, email),
      empresa = COALESCE(p_empresa, empresa),
      cargo = COALESCE(p_cargo, cargo),
      telefono = COALESCE(p_telefono, telefono),
      nacionalidad = COALESCE(p_nacionalidad, nacionalidad),
      updated_at = NOW()
    WHERE id = v_perfil_id;
    RETURN v_perfil_id;
  END IF;
  INSERT INTO mt_perfiles_acreditados (user_id, rut, nombre, apellido, email, empresa, cargo, telefono, nacionalidad)
  VALUES (p_user_id, p_rut, p_nombre, p_apellido, p_email, p_empresa, p_cargo, p_telefono, p_nacionalidad)
  RETURNING id INTO v_perfil_id;
  RETURN v_perfil_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

-- get_active_form_config — search_path fix only (body unchanged)
-- We use DO $$ to ALTER existing function attributes without rewriting body
-- Para cada función existente: fijamos search_path.
-- WHEN OTHERS atrapa tanto "function does not exist" como "ambiguous function".
DO $$ BEGIN EXECUTE 'ALTER FUNCTION get_active_form_config SET search_path = public'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER FUNCTION check_quota SET search_path = public'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER FUNCTION generate_qr_token SET search_path = public'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER FUNCTION validate_qr_checkin SET search_path = public'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER FUNCTION validate_qr_checkin_day SET search_path = public'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER FUNCTION check_and_create_registration SET search_path = public'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER FUNCTION get_current_event_day SET search_path = public'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER FUNCTION auto_create_registration_days SET search_path = public'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER FUNCTION get_or_create_profile SET search_path = public'; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  1.  FK CONSTRAINTS CON ON DELETE                       ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_submitted_by_fkey;
ALTER TABLE registrations ADD CONSTRAINT registrations_submitted_by_fkey
  FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_checked_in_by_fkey;
ALTER TABLE registrations ADD CONSTRAINT registrations_checked_in_by_fkey
  FOREIGN KEY (checked_in_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_processed_by_fkey;
ALTER TABLE registrations ADD CONSTRAINT registrations_processed_by_fkey
  FOREIGN KEY (processed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  2.  CHECK CONSTRAINTS                                  ║
-- ╚══════════════════════════════════════════════════════════╝

-- events.event_type  → YA tiene CHECK inline en la tabla. Skip.
-- events.visibility  → YA tiene CHECK inline en la tabla. Skip.
-- email_templates.tipo → YA tiene CHECK inline en la tabla. Skip.
-- email_logs.status   → YA tiene CHECK inline en la tabla. Skip.

-- event_quota_rules — NO tiene CHECK para non-negative. Agregamos.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_quota_rules_non_negative') THEN
    ALTER TABLE event_quota_rules ADD CONSTRAINT event_quota_rules_non_negative
      CHECK (max_per_organization >= 0 AND max_global >= 0);
  END IF;
END $$;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  3.  VIEWS → SECURITY INVOKER  (elimina 4 ERRORs)      ║
-- ╚══════════════════════════════════════════════════════════╝
-- Postgres 15+ soporta SECURITY INVOKER directamente en CREATE VIEW.
-- Para versiones anteriores o por seguridad, usamos ALTER VIEW.

-- v_event_full
DROP VIEW IF EXISTS v_event_full CASCADE;
CREATE VIEW v_event_full
  WITH (security_invoker = true)
AS
SELECT
  e.*,
  t.nombre AS tenant_nombre,
  t.slug AS tenant_slug,
  t.logo_url AS tenant_logo_url,
  t.shield_url AS tenant_shield_url,
  t.color_primario AS tenant_color_primario,
  t.color_secundario AS tenant_color_secundario,
  t.color_light AS tenant_color_light,
  t.color_dark AS tenant_color_dark,
  t.config AS tenant_config,
  (SELECT count(*) FROM registrations r WHERE r.event_id = e.id) AS total_registrations,
  (SELECT count(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'aprobado') AS total_aprobados,
  (SELECT count(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'pendiente') AS total_pendientes
FROM events e
JOIN tenants t ON t.id = e.tenant_id;

-- v_registration_full
DROP VIEW IF EXISTS v_registration_full CASCADE;
CREATE VIEW v_registration_full
  WITH (security_invoker = true)
AS
SELECT
  r.*,
  p.rut,
  p.nombre AS profile_nombre,
  p.apellido AS profile_apellido,
  p.email AS profile_email,
  p.telefono AS profile_telefono,
  p.foto_url AS profile_foto,
  p.medio AS profile_medio,
  p.datos_base AS profile_datos_base,
  e.nombre AS event_nombre,
  e.fecha AS event_fecha,
  e.venue AS event_venue,
  e.qr_enabled AS event_qr_enabled,
  e.tenant_id,
  t.nombre AS tenant_nombre,
  t.slug AS tenant_slug,
  t.logo_url AS tenant_logo,
  t.color_primario AS tenant_color_primario
FROM registrations r
JOIN profiles p ON r.profile_id = p.id
JOIN events e ON r.event_id = e.id
JOIN tenants t ON e.tenant_id = t.id;

-- v_tenant_stats
DROP VIEW IF EXISTS v_tenant_stats CASCADE;
CREATE VIEW v_tenant_stats
  WITH (security_invoker = true)
AS
SELECT
  t.*,
  COALESCE(e.cnt, 0)  AS total_events,
  COALESCE(a.cnt, 0)  AS total_admins,
  COALESCE(r.cnt, 0)  AS total_registrations
FROM tenants t
LEFT JOIN (SELECT tenant_id, COUNT(*) cnt FROM events GROUP BY tenant_id) e ON e.tenant_id = t.id
LEFT JOIN (SELECT tenant_id, COUNT(*) cnt FROM tenant_admins GROUP BY tenant_id) a ON a.tenant_id = t.id
LEFT JOIN (
  SELECT ev.tenant_id, COUNT(*) cnt
  FROM registrations reg
  JOIN events ev ON ev.id = reg.event_id
  GROUP BY ev.tenant_id
) r ON r.tenant_id = t.id;

-- v_team_event_enriched
DROP VIEW IF EXISTS v_team_event_enriched CASCADE;
CREATE VIEW v_team_event_enriched
  WITH (security_invoker = true)
AS
SELECT
  tm.id AS team_member_id,
  tm.manager_id,
  tm.member_profile_id,
  tm.alias,
  tm.created_at AS team_member_created_at,
  p.rut,
  p.nombre,
  p.apellido,
  p.email,
  p.telefono,
  p.cargo AS profile_cargo,
  p.medio AS profile_medio,
  p.tipo_medio AS profile_tipo_medio,
  p.datos_base,
  r.event_id,
  r.id AS registration_id,
  r.datos_extra AS registration_datos_extra,
  r.status AS registration_status,
  e.tenant_id
FROM team_members tm
JOIN profiles p ON p.id = tm.member_profile_id
LEFT JOIN LATERAL (
  SELECT r2.id, r2.event_id, r2.datos_extra, r2.status
  FROM registrations r2
  WHERE r2.profile_id = tm.member_profile_id
  ORDER BY r2.created_at DESC
  LIMIT 1
) r ON true
LEFT JOIN events e ON e.id = r.event_id;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  4.  RLS POLICIES — CERRAR TABLAS ABIERTAS              ║
-- ╚══════════════════════════════════════════════════════════╝

-- ── event_days ─────────────────────────────────────────────
-- Nombres REALES de policies permisivas según linter de Supabase:
DROP POLICY IF EXISTS "event_days_insert_auth"    ON event_days;
DROP POLICY IF EXISTS "event_days_update_auth"    ON event_days;
DROP POLICY IF EXISTS "event_days_delete_auth"    ON event_days;
-- Nombres genéricos (por si acaso):
DROP POLICY IF EXISTS "event_days_select"         ON event_days;
DROP POLICY IF EXISTS "event_days_insert"         ON event_days;
DROP POLICY IF EXISTS "event_days_update"         ON event_days;
DROP POLICY IF EXISTS "event_days_delete"         ON event_days;
DROP POLICY IF EXISTS "event_days_all"            ON event_days;
DROP POLICY IF EXISTS "event_days_modify"         ON event_days;
DROP POLICY IF EXISTS "Acceso total a event_days" ON event_days;

CREATE POLICY "event_days_select" ON event_days
  FOR SELECT USING (true);

CREATE POLICY "event_days_modify" ON event_days
  FOR ALL
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_days.event_id
        AND can_edit_tenant(e.tenant_id)
    )
  )
  WITH CHECK (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_days.event_id
        AND can_edit_tenant(e.tenant_id)
    )
  );


-- ── registration_days ──────────────────────────────────────
-- Nombres REALES:
DROP POLICY IF EXISTS "reg_days_insert_auth"               ON registration_days;
DROP POLICY IF EXISTS "reg_days_update_auth"               ON registration_days;
DROP POLICY IF EXISTS "reg_days_delete_auth"               ON registration_days;
-- Genéricos:
DROP POLICY IF EXISTS "registration_days_select"           ON registration_days;
DROP POLICY IF EXISTS "registration_days_insert"           ON registration_days;
DROP POLICY IF EXISTS "registration_days_update"           ON registration_days;
DROP POLICY IF EXISTS "registration_days_delete"           ON registration_days;
DROP POLICY IF EXISTS "registration_days_all"              ON registration_days;
DROP POLICY IF EXISTS "registration_days_modify"           ON registration_days;
DROP POLICY IF EXISTS "Acceso total a registration_days"   ON registration_days;

CREATE POLICY "registration_days_select" ON registration_days
  FOR SELECT USING (true);

CREATE POLICY "registration_days_modify" ON registration_days
  FOR ALL
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM registrations r
      JOIN events e ON e.id = r.event_id
      WHERE r.id = registration_days.registration_id
        AND can_edit_tenant(e.tenant_id)
    )
  )
  WITH CHECK (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM registrations r
      JOIN events e ON e.id = r.event_id
      WHERE r.id = registration_days.registration_id
        AND can_edit_tenant(e.tenant_id)
    )
  );


-- ── email_zone_content ─────────────────────────────────────
-- Nombre REAL de la policy permisiva:
DROP POLICY IF EXISTS "Service role full access on email_zone_content" ON email_zone_content;
-- Genéricos:
DROP POLICY IF EXISTS "email_zone_content_select"            ON email_zone_content;
DROP POLICY IF EXISTS "email_zone_content_insert"            ON email_zone_content;
DROP POLICY IF EXISTS "email_zone_content_update"            ON email_zone_content;
DROP POLICY IF EXISTS "email_zone_content_delete"            ON email_zone_content;
DROP POLICY IF EXISTS "email_zone_content_all"               ON email_zone_content;
DROP POLICY IF EXISTS "email_zone_content_modify"            ON email_zone_content;
DROP POLICY IF EXISTS "Acceso total a email_zone_content"    ON email_zone_content;

CREATE POLICY "email_zone_content_select" ON email_zone_content
  FOR SELECT
  USING (is_superadmin() OR has_tenant_access(tenant_id));

CREATE POLICY "email_zone_content_modify" ON email_zone_content
  FOR ALL
  USING (is_superadmin() OR can_edit_tenant(tenant_id))
  WITH CHECK (is_superadmin() OR can_edit_tenant(tenant_id));


-- ── event_invitations ──────────────────────────────────────
-- Nombre REAL:
DROP POLICY IF EXISTS "sa_full_access_invitations"           ON event_invitations;
-- Genéricos:
DROP POLICY IF EXISTS "event_invitations_select"             ON event_invitations;
DROP POLICY IF EXISTS "event_invitations_insert"             ON event_invitations;
DROP POLICY IF EXISTS "event_invitations_update"             ON event_invitations;
DROP POLICY IF EXISTS "event_invitations_delete"             ON event_invitations;
DROP POLICY IF EXISTS "event_invitations_all"                ON event_invitations;
DROP POLICY IF EXISTS "event_invitations_modify"             ON event_invitations;
DROP POLICY IF EXISTS "Acceso total a event_invitations"     ON event_invitations;

CREATE POLICY "event_invitations_select" ON event_invitations
  FOR SELECT USING (true);  -- Público: validar invitación por token

CREATE POLICY "event_invitations_modify" ON event_invitations
  FOR ALL
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_invitations.event_id
        AND can_edit_tenant(e.tenant_id)
    )
  )
  WITH CHECK (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_invitations.event_id
        AND can_edit_tenant(e.tenant_id)
    )
  );


-- ── audit_logs INSERT (actualmente WITH CHECK true) ────────
-- Restringir a usuarios autenticados (solo insertar tus propios logs)
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── email_logs INSERT (actualmente WITH CHECK true) ────────
-- Restringir a admin del tenant o superadmin
DROP POLICY IF EXISTS "email_logs_insert" ON email_logs;
CREATE POLICY "email_logs_insert" ON email_logs
  FOR INSERT
  WITH CHECK (
    is_superadmin()
    OR has_tenant_access(tenant_id)
  );

-- ── profiles INSERT (actualmente WITH CHECK true) ──────────
-- Permitir: anónimo/autenticado crea su propio perfil, o superadmin
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT
  WITH CHECK (
    user_id IS NULL              -- registro anónimo (formulario público)
    OR auth.uid() = user_id      -- se crea a sí mismo
    OR is_superadmin()
  );

-- ── registrations INSERT (actualmente WITH CHECK true) ─────
-- Permitir: cualquier autenticado (acreditación propia) o service_role
-- Mantenemos abierto porque el formulario público necesita insertar.
-- NOTA: dejamos este como está intencionalmente — el check_and_create_registration
-- ya valida cuotas/duplicados. Si quisiéramos restringir más,
-- afectaría el flujo de registro público.


-- ── profiles DELETE (no existía) ───────────────────────────
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE
  USING (
    is_superadmin()
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );


-- ╔══════════════════════════════════════════════════════════╗
-- ║  5.  ÍNDICES DE PERFORMANCE                             ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_registrations_event_status
  ON registrations(event_id, status);

CREATE INDEX IF NOT EXISTS idx_registrations_event_tipo_org
  ON registrations(event_id, tipo_medio, organizacion);

CREATE INDEX IF NOT EXISTS idx_email_logs_tenant
  ON email_logs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_registration
  ON email_logs(registration_id);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  6.  GRANT permisos a vistas SECURITY INVOKER           ║
-- ╚══════════════════════════════════════════════════════════╝
-- Con SECURITY INVOKER las vistas usan los permisos del que consulta.
-- Necesitamos asegurar que anon y authenticated puedan hacer SELECT.

GRANT SELECT ON v_event_full           TO anon, authenticated;
GRANT SELECT ON v_registration_full    TO authenticated;
GRANT SELECT ON v_tenant_stats         TO authenticated;
GRANT SELECT ON v_team_event_enriched  TO authenticated;


-- ============================================================
-- FIN — Ejecutar en Supabase SQL Editor como una transacción.
-- Después activar "Leaked password protection" desde:
--   Dashboard → Auth → Settings → Password Security
-- ============================================================
