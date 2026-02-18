-- ============================================================================
-- FIX: Cruce de datos entre tenants en equipos (team_members)
-- Milestone 12 — 18 feb 2026
-- ============================================================================
--
-- PROBLEMA:
-- La tabla team_members es un directorio global de "frecuentes" del manager.
-- Al cargar un miembro en el formulario de registro de un evento, los campos
-- profesionales (cargo, medio, tipo_medio) vienen del perfil global,
-- que pudo haber sido actualizado por otro tenant/evento.
--
-- SOLUCIÓN ARQUITECTÓNICA:
-- team_members sigue siendo global (es un directorio de contactos personal).
-- La corrección se aplica en la CAPA DE SERVICIO:
--
-- 1. getTeamMembersForEvent() enriquece cada miembro con:
--    a) Datos de datos_base._tenant[tenantId] (tenant-scoped)
--    b) Datos de su registration existente en el mismo evento (si existe)
--
-- 2. El formulario usa valores tenant-scoped en vez de valores globales
--    para campos profesionales (cargo, medio, tipo_medio).
--
-- NO se modifica el schema de team_members.
-- La tabla profiles.datos_base ya tiene la estructura _tenant[tenantId]
-- desde M5 (saveTenantProfileData).
-- ============================================================================

-- Vista de ayuda: equipo enriquecido con datos de un evento específico
-- Uso: SELECT * FROM v_team_event_enriched WHERE manager_id = ? AND event_id = ?
CREATE OR REPLACE VIEW v_team_event_enriched AS
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

-- Índice para lookup rápido de registrations por profile + event
CREATE INDEX IF NOT EXISTS idx_registrations_profile_event 
  ON registrations(profile_id, event_id);

