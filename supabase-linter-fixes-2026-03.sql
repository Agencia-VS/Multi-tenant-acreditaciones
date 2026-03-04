-- =============================================================
-- Supabase Linter Fixes — Marzo 2026
--
-- 1. v_registration_full: SECURITY DEFINER → SECURITY INVOKER
-- 2. normalize_match: set search_path = ''
-- 3. check_and_create_registration: set search_path = ''
-- 4. auth_leaked_password_protection: requiere plan Pro (Dashboard)
-- =============================================================

-- ─── 1. Vista v_registration_full — SECURITY INVOKER ──────
-- La vista fue re-creada sin security_invoker en production-fixes,
-- lo que la dejó con SECURITY DEFINER (default de Postgres < 15).
-- Esto bypasea RLS del usuario que consulta.
DROP VIEW IF EXISTS v_registration_full;

CREATE VIEW v_registration_full
  WITH (security_invoker = true)
AS
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

GRANT SELECT ON v_registration_full TO authenticated;

-- ─── 2. normalize_match — fijar search_path ───────────────
-- search_path mutable permite ataques de schema injection.
-- Se fija a '' (vacío) para que solo funcione con nombres
-- fully-qualified. Como la función es IMMUTABLE y solo usa
-- built-in ops (lower, trim, replace, coalesce), no necesita
-- ningún schema en el path.
ALTER FUNCTION normalize_match(text) SET search_path = '';

-- ─── 3. check_and_create_registration — fijar search_path ─
-- La función fue re-creada en case-insensitive-rules.sql sin
-- SET search_path. Fijamos a 'public' porque referencia tablas
-- y funciones en public (event_quotas, registrations, etc.).
ALTER FUNCTION check_and_create_registration SET search_path = public;

-- ─── 4. auth_leaked_password_protection ────────────────────
-- NOTA: Requiere plan Pro de Supabase (no disponible en Free).
-- Cuando se migre a Pro, habilitar desde:
--   Dashboard → Authentication → Settings → Leaked Password Protection
-- =============================================================

-- ─── Verificación ──────────────────────────────────────────
-- Después de aplicar, verificar en:
--   Supabase Dashboard → Database → Linter
-- Debe mostrar solo auth_leaked_password_protection (requiere Pro).
-- =============================================================
