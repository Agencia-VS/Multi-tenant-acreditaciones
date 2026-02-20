-- ============================================================
-- RLS Performance Fix Migration
-- Fecha: 2026-02-20
-- Fixes:
--   1. auth_rls_initplan   → (select auth.uid()) wrapper en 10 policies
--   2. multiple_permissive → split FOR ALL en INSERT/UPDATE/DELETE (6 tablas)
--   3. duplicate_index     → drop índice redundante en registrations
--
-- Contexto: Supabase linter recomienda que auth.uid() se envuelva
-- en (select auth.uid()) para que Postgres lo evalúe UNA vez por
-- query (InitPlan) en lugar de por cada fila.
-- FOR ALL policies que coexisten con FOR SELECT producen
-- múltiples policies permisivas para SELECT → se evalúan todas.
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  1. auth_rls_initplan — (select auth.uid()) wrapper     ║
-- ╚══════════════════════════════════════════════════════════╝

-- ── profiles ───────────────────────────────────────────────

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    user_id = (select auth.uid())
    OR is_superadmin()
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.manager_id IN (
        SELECT id FROM profiles p2 WHERE p2.user_id = (select auth.uid())
      )
      AND tm.member_profile_id = profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.profile_id = profiles.id
        AND has_tenant_access(e.tenant_id)
    )
  );

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (
    user_id = (select auth.uid()) OR is_superadmin()
  );

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT
  WITH CHECK (
    user_id IS NULL                        -- registro anónimo (formulario público)
    OR (select auth.uid()) = user_id       -- se crea a sí mismo
    OR is_superadmin()
  );

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE USING (
    is_superadmin()
    OR ((select auth.uid()) IS NOT NULL AND user_id = (select auth.uid()))
  );


-- ── audit_logs ─────────────────────────────────────────────

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT
  WITH CHECK ((select auth.uid()) IS NOT NULL);


-- ── registrations ──────────────────────────────────────────

DROP POLICY IF EXISTS "registrations_select" ON registrations;
CREATE POLICY "registrations_select" ON registrations
  FOR SELECT USING (
    -- Dueño del perfil
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = profile_id AND p.user_id = (select auth.uid()))
    -- Manager que lo envió
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = submitted_by AND p.user_id = (select auth.uid()))
    -- Admin del tenant del evento
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND has_tenant_access(e.tenant_id))
    -- Superadmin
    OR is_superadmin()
  );


-- ── team_members ───────────────────────────────────────────

DROP POLICY IF EXISTS "team_members_all" ON team_members;
CREATE POLICY "team_members_all" ON team_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = manager_id AND p.user_id = (select auth.uid()))
    OR is_superadmin()
  );


-- ── superadmins ────────────────────────────────────────────

DROP POLICY IF EXISTS "superadmins_select" ON superadmins;
CREATE POLICY "superadmins_select" ON superadmins
  FOR SELECT USING (
    user_id = (select auth.uid()) OR is_superadmin()
  );


-- ── tenant_admins ──────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_admins_select" ON tenant_admins;
CREATE POLICY "tenant_admins_select" ON tenant_admins
  FOR SELECT USING (
    user_id = (select auth.uid())
    OR has_tenant_access(tenant_id)
    OR is_superadmin()
  );


-- ╔══════════════════════════════════════════════════════════╗
-- ║  2. multiple_permissive_policies — split FOR ALL         ║
-- ║                                                          ║
-- ║  FOR ALL cubre SELECT+INSERT+UPDATE+DELETE.              ║
-- ║  Si ya existe un FOR SELECT, el SELECT se evalúa 2x.    ║
-- ║  Fix: reemplazar FOR ALL con INSERT + UPDATE + DELETE.   ║
-- ╚══════════════════════════════════════════════════════════╝

-- ── event_zone_rules ──────────────────────────────────────
-- zone_rules_manage (FOR ALL, raw auth.uid()) + zone_rules_select
-- Fix: drop ambos, recrear SELECT + INSERT/UPDATE/DELETE con helpers

DROP POLICY IF EXISTS "zone_rules_manage" ON event_zone_rules;
DROP POLICY IF EXISTS "zone_rules_select" ON event_zone_rules;

CREATE POLICY "zone_rules_select" ON event_zone_rules
  FOR SELECT USING (true);

CREATE POLICY "zone_rules_insert" ON event_zone_rules
  FOR INSERT WITH CHECK (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_zone_rules.event_id
        AND can_edit_tenant(e.tenant_id)
    )
  );

CREATE POLICY "zone_rules_update" ON event_zone_rules
  FOR UPDATE USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_zone_rules.event_id
        AND can_edit_tenant(e.tenant_id)
    )
  );

CREATE POLICY "zone_rules_delete" ON event_zone_rules
  FOR DELETE USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_zone_rules.event_id
        AND can_edit_tenant(e.tenant_id)
    )
  );


-- ── email_templates ──────────────────────────────────────
-- email_templates_all (FOR ALL) + email_templates_select
-- Fix: SELECT con has_tenant_access (lectura), write con can_edit_tenant

DROP POLICY IF EXISTS "email_templates_all" ON email_templates;
DROP POLICY IF EXISTS "email_templates_select" ON email_templates;

CREATE POLICY "email_templates_select" ON email_templates
  FOR SELECT USING (
    has_tenant_access(tenant_id) OR is_superadmin()
  );

CREATE POLICY "email_templates_insert" ON email_templates
  FOR INSERT WITH CHECK (
    can_edit_tenant(tenant_id) OR is_superadmin()
  );

CREATE POLICY "email_templates_update" ON email_templates
  FOR UPDATE USING (
    can_edit_tenant(tenant_id) OR is_superadmin()
  );

CREATE POLICY "email_templates_delete" ON email_templates
  FOR DELETE USING (
    can_edit_tenant(tenant_id) OR is_superadmin()
  );


-- ── email_zone_content ──────────────────────────────────
-- email_zone_content_modify (FOR ALL) + email_zone_content_select

DROP POLICY IF EXISTS "email_zone_content_modify" ON email_zone_content;
DROP POLICY IF EXISTS "email_zone_content_select" ON email_zone_content;

CREATE POLICY "email_zone_content_select" ON email_zone_content
  FOR SELECT USING (
    is_superadmin() OR has_tenant_access(tenant_id)
  );

CREATE POLICY "email_zone_content_insert" ON email_zone_content
  FOR INSERT WITH CHECK (
    is_superadmin() OR can_edit_tenant(tenant_id)
  );

CREATE POLICY "email_zone_content_update" ON email_zone_content
  FOR UPDATE USING (
    is_superadmin() OR can_edit_tenant(tenant_id)
  );

CREATE POLICY "email_zone_content_delete" ON email_zone_content
  FOR DELETE USING (
    is_superadmin() OR can_edit_tenant(tenant_id)
  );


-- ── event_days ──────────────────────────────────────────
-- event_days_modify (FOR ALL) + event_days_select + event_days_select_all (legacy)

DROP POLICY IF EXISTS "event_days_modify" ON event_days;
DROP POLICY IF EXISTS "event_days_select" ON event_days;
DROP POLICY IF EXISTS "event_days_select_all" ON event_days;

CREATE POLICY "event_days_select" ON event_days
  FOR SELECT USING (true);

CREATE POLICY "event_days_insert" ON event_days
  FOR INSERT WITH CHECK (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_days.event_id
        AND can_edit_tenant(e.tenant_id)
    )
  );

CREATE POLICY "event_days_update" ON event_days
  FOR UPDATE USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_days.event_id
        AND can_edit_tenant(e.tenant_id)
    )
  );

CREATE POLICY "event_days_delete" ON event_days
  FOR DELETE USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_days.event_id
        AND can_edit_tenant(e.tenant_id)
    )
  );


-- ── event_invitations ──────────────────────────────────
-- event_invitations_modify (FOR ALL) + event_invitations_select

DROP POLICY IF EXISTS "event_invitations_modify" ON event_invitations;
DROP POLICY IF EXISTS "event_invitations_select" ON event_invitations;

CREATE POLICY "event_invitations_select" ON event_invitations
  FOR SELECT USING (true);  -- Público: validar invitación por token

CREATE POLICY "event_invitations_insert" ON event_invitations
  FOR INSERT WITH CHECK (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_invitations.event_id
        AND can_edit_tenant(e.tenant_id)
    )
  );

CREATE POLICY "event_invitations_update" ON event_invitations
  FOR UPDATE USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_invitations.event_id
        AND can_edit_tenant(e.tenant_id)
    )
  );

CREATE POLICY "event_invitations_delete" ON event_invitations
  FOR DELETE USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_invitations.event_id
        AND can_edit_tenant(e.tenant_id)
    )
  );


-- ── registration_days ──────────────────────────────────
-- registration_days_modify (FOR ALL) + registration_days_select + reg_days_select_all (legacy)

DROP POLICY IF EXISTS "registration_days_modify" ON registration_days;
DROP POLICY IF EXISTS "registration_days_select" ON registration_days;
DROP POLICY IF EXISTS "reg_days_select_all" ON registration_days;

CREATE POLICY "registration_days_select" ON registration_days
  FOR SELECT USING (true);

CREATE POLICY "registration_days_insert" ON registration_days
  FOR INSERT WITH CHECK (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM registrations r
      JOIN events e ON e.id = r.event_id
      WHERE r.id = registration_days.registration_id
        AND can_edit_tenant(e.tenant_id)
    )
  );

CREATE POLICY "registration_days_update" ON registration_days
  FOR UPDATE USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM registrations r
      JOIN events e ON e.id = r.event_id
      WHERE r.id = registration_days.registration_id
        AND can_edit_tenant(e.tenant_id)
    )
  );

CREATE POLICY "registration_days_delete" ON registration_days
  FOR DELETE USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM registrations r
      JOIN events e ON e.id = r.event_id
      WHERE r.id = registration_days.registration_id
        AND can_edit_tenant(e.tenant_id)
    )
  );


-- ╔══════════════════════════════════════════════════════════╗
-- ║  3. DUPLICATE INDEX                                      ║
-- ╚══════════════════════════════════════════════════════════╝
-- registrations tiene dos índices idénticos sobre (event_id, profile_id):
--   - registrations_event_id_profile_id_key  (UNIQUE constraint original)
--   - uq_registration_event_profile          (añadido después, redundante)

-- Intentar como constraint primero, luego como index
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS uq_registration_event_profile;
DROP INDEX IF EXISTS uq_registration_event_profile;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  4. ÍNDICES PARA FK SIN COBERTURA                        ║
-- ╚══════════════════════════════════════════════════════════╝
-- Sin índice en la columna FK, un DELETE en la tabla referenciada
-- causa un sequential scan en la tabla hija (lock contention).

CREATE INDEX IF NOT EXISTS idx_registrations_checked_in_by
  ON registrations(checked_in_by);

CREATE INDEX IF NOT EXISTS idx_registrations_processed_by
  ON registrations(processed_by);

CREATE INDEX IF NOT EXISTS idx_team_members_member_profile_id
  ON team_members(member_profile_id);


-- ============================================================
-- FIN — Ejecutar en Supabase SQL Editor.
-- Resumen de cambios:
--   • 10 policies: auth.uid() → (select auth.uid())
--   • 6 tablas: FOR ALL → INSERT + UPDATE + DELETE separados
--   • 2 policies legacy eliminadas (event_days_select_all, reg_days_select_all)
--   • 1 índice duplicado eliminado
--   • 3 índices para FK sin cobertura (checked_in_by, processed_by, member_profile_id)
--   • Bonus: email_templates write ops ahora usan can_edit_tenant()
--            (antes has_tenant_access permitía a viewers escribir)
-- ============================================================
