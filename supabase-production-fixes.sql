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
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = (select auth.uid()))
    OR tenant_id IN (
      SELECT tenant_id FROM public.tenant_admins
      WHERE user_id = (select auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = (select auth.uid()))
  );

-- Política: providers_insert
DROP POLICY IF EXISTS providers_insert ON public.tenant_providers;
CREATE POLICY providers_insert ON public.tenant_providers
  FOR INSERT WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = (select auth.uid()))
  );

-- ─── 3. Vista v_registration_full — agregar document_number ──
-- La vista no exponía document_number/document_type de profiles,
-- lo que impedía buscar por número de documento en el admin.
DROP VIEW IF EXISTS v_registration_full;

CREATE VIEW v_registration_full AS
SELECT 
  r.*,
  p.rut,
  p.document_type AS profile_document_type,
  p.document_number AS profile_document_number,
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

-- Re-aplicar permisos
GRANT SELECT ON v_registration_full TO authenticated;

-- ─── 4. auth_leaked_password_protection ──────────────────
-- NOTA: Esta advertencia requiere plan Pro de Supabase.
-- En plan Free no se puede habilitar. Cuando se migre a Pro:
--   Dashboard → Authentication → Settings → Enable Leaked Password Protection

-- ============================================================
-- Verificación: correr después de aplicar
-- SELECT * FROM extensions.pg_lint;
-- ============================================================
