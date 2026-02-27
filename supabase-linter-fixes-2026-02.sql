-- =============================================================
-- Supabase DB Linter fixes (2026-02)
-- Objetivo: resolver findings de seguridad reportados por DB Linter
-- =============================================================

-- 1) SECURITY DEFINER VIEW -> SECURITY INVOKER
-- Finding: security_definer_view on public.v_billing_summary
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'v_billing_summary'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.v_billing_summary SET (security_invoker = true)';
  END IF;
END $$;


-- 2) FUNCTION SEARCH PATH MUTABLE
-- Findings:
-- - public.set_registration_email_snapshot
-- - public.normalize_profile_document
-- Fix: set search_path fijo para todas las sobrecargas existentes.
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('set_registration_email_snapshot', 'normalize_profile_document')
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END $$;


-- 3) RLS POLICY ALWAYS TRUE
-- Finding: policy public.registrations_insert WITH CHECK (true)
-- Reemplazo por policy restrictiva (defense-in-depth).
DROP POLICY IF EXISTS registrations_insert ON public.registrations;

CREATE POLICY registrations_insert ON public.registrations
  FOR INSERT
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (
      -- Self-registration: el perfil pertenece al usuario autenticado
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = profile_id
          AND p.user_id = (select auth.uid())
      )
      -- Submitting on behalf: submitted_by pertenece al usuario autenticado
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = submitted_by
          AND p.user_id = (select auth.uid())
      )
      -- Tenant admin del evento
      OR EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.id = event_id
          AND public.has_tenant_access(e.tenant_id)
      )
      -- Superadmin
      OR public.is_superadmin()
    )
  );


-- 4) RLS PERFORMANCE: auth_rls_initplan + multiple_permissive_policies
-- Findings en: subscriptions, usage_records, invoices
-- Estrategia:
--   - Consolidar SELECT en una sola policy por tabla
--   - Incluir service_role en esa policy (evita segunda policy permissive)
--   - Usar (select auth.uid()) / (select auth.role())

-- SUBSCRIPTIONS
DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_service_all ON public.subscriptions;

CREATE POLICY subscriptions_select_access ON public.subscriptions
  FOR SELECT
  USING (
    (select auth.role()) = 'service_role'
    OR tenant_id IN (
      SELECT ta.tenant_id
      FROM public.tenant_admins ta
      WHERE ta.user_id = (select auth.uid())
    )
  );

CREATE POLICY subscriptions_service_write ON public.subscriptions
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY subscriptions_service_update ON public.subscriptions
  FOR UPDATE
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY subscriptions_service_delete ON public.subscriptions
  FOR DELETE
  USING ((select auth.role()) = 'service_role');


-- USAGE_RECORDS
DROP POLICY IF EXISTS usage_records_select_own ON public.usage_records;
DROP POLICY IF EXISTS usage_records_service_all ON public.usage_records;

CREATE POLICY usage_records_select_access ON public.usage_records
  FOR SELECT
  USING (
    (select auth.role()) = 'service_role'
    OR tenant_id IN (
      SELECT ta.tenant_id
      FROM public.tenant_admins ta
      WHERE ta.user_id = (select auth.uid())
    )
  );

CREATE POLICY usage_records_service_write ON public.usage_records
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY usage_records_service_update ON public.usage_records
  FOR UPDATE
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY usage_records_service_delete ON public.usage_records
  FOR DELETE
  USING ((select auth.role()) = 'service_role');


-- INVOICES
DROP POLICY IF EXISTS invoices_select_own ON public.invoices;
DROP POLICY IF EXISTS invoices_service_all ON public.invoices;

CREATE POLICY invoices_select_access ON public.invoices
  FOR SELECT
  USING (
    (select auth.role()) = 'service_role'
    OR tenant_id IN (
      SELECT ta.tenant_id
      FROM public.tenant_admins ta
      WHERE ta.user_id = (select auth.uid())
    )
  );

CREATE POLICY invoices_service_write ON public.invoices
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY invoices_service_update ON public.invoices
  FOR UPDATE
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY invoices_service_delete ON public.invoices
  FOR DELETE
  USING ((select auth.role()) = 'service_role');


-- 5) DUPLICATE INDEX
-- Findings:
--   - profiles: {profiles_document_identity_unique, uq_profiles_document_identity}
--   - registrations: {registrations_event_id_profile_id_key, uq_registrations_event_profile}
-- Mantener los índices/constraints “canónicos” y eliminar el duplicado uq_*.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS uq_profiles_document_identity;
DROP INDEX IF EXISTS public.uq_profiles_document_identity;

ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS uq_registrations_event_profile;
DROP INDEX IF EXISTS public.uq_registrations_event_profile;


-- 6) AUTH LEAKED PASSWORD PROTECTION (manual)
-- Este finding NO se corrige con SQL.
-- Activar en: Supabase Dashboard -> Authentication -> Password security
-- Habilitar: "Leaked password protection".
