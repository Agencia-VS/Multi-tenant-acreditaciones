-- ============================================================================
-- Migración: Actualizar vista v_registration_full
-- Agrega tenant_color_primario para el dashboard de acreditado
-- ============================================================================

DROP VIEW IF EXISTS v_registration_full;

CREATE VIEW v_registration_full AS
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
