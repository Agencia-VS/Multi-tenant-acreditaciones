-- ============================================================
-- Supabase Production Fixes — Linter Warnings
-- Ejecutar en Supabase SQL Editor ANTES de ir a producción
-- ============================================================

-- ─── 1. function_search_path_mutable ─────────────────────
-- La función trigger_set_updated_at() no tiene search_path fijo,
-- lo que podría permitir ataques de search_path hijacking.
ALTER FUNCTION public.trigger_set_updated_at() SET search_path = public;

-- ─── 2. auth_rls_initplan — tenant_providers ─────────────
-- Las políticas RLS que usan auth.uid() directamente causan
-- re-evaluación por fila. Envolver en (select ...) permite
-- que PostgreSQL lo evalúe una sola vez (initplan).

-- Política: providers_select
DROP POLICY IF EXISTS providers_select ON public.tenant_providers;
CREATE POLICY providers_select ON public.tenant_providers
  FOR SELECT USING (
    user_id = (select auth.uid())
    OR tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = (select auth.uid()) AND role IN ('admin', 'owner')
    )
  );

-- Política: providers_insert
DROP POLICY IF EXISTS providers_insert ON public.tenant_providers;
CREATE POLICY providers_insert ON public.tenant_providers
  FOR INSERT WITH CHECK (
    user_id = (select auth.uid())
  );

-- ─── 3. auth_leaked_password_protection ──────────────────
-- NOTA: Esta advertencia requiere plan Pro de Supabase.
-- En plan Free no se puede habilitar. Cuando se migre a Pro:
--   Dashboard → Authentication → Settings → Enable Leaked Password Protection

-- ============================================================
-- Verificación: correr después de aplicar
-- SELECT * FROM extensions.pg_lint;
-- ============================================================
