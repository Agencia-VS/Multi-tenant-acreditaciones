-- =====================================================
-- MIGRACIÓN COMPLETA: Sistema 100% Supabase
-- =====================================================
-- Ejecutar en Supabase SQL Editor en orden
-- =====================================================

-- =====================================================
-- PARTE 1: Extender mt_tenants (datos estáticos del equipo)
-- =====================================================

ALTER TABLE mt_tenants
ADD COLUMN IF NOT EXISTS color_primario TEXT DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS color_secundario TEXT DEFAULT '#FFFFFF',
ADD COLUMN IF NOT EXISTS color_light TEXT DEFAULT '#CCCCCC',
ADD COLUMN IF NOT EXISTS color_dark TEXT DEFAULT '#333333',
ADD COLUMN IF NOT EXISTS shield_url TEXT,
ADD COLUMN IF NOT EXISTS background_url TEXT,
ADD COLUMN IF NOT EXISTS arena_logo_url TEXT,
ADD COLUMN IF NOT EXISTS arena_nombre TEXT,
ADD COLUMN IF NOT EXISTS social_facebook TEXT,
ADD COLUMN IF NOT EXISTS social_twitter TEXT,
ADD COLUMN IF NOT EXISTS social_instagram TEXT,
ADD COLUMN IF NOT EXISTS social_youtube TEXT;

-- =====================================================
-- PARTE 2: Extender mt_eventos (datos dinámicos del partido)
-- =====================================================

ALTER TABLE mt_eventos
ADD COLUMN IF NOT EXISTS opponent_tenant_id UUID REFERENCES mt_tenants(id),
ADD COLUMN IF NOT EXISTS fecha DATE,
ADD COLUMN IF NOT EXISTS hora TIME,
ADD COLUMN IF NOT EXISTS venue TEXT,
ADD COLUMN IF NOT EXISTS league TEXT,
ADD COLUMN IF NOT EXISTS fecha_limite_acreditacion TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Índice para búsquedas rápidas de eventos activos
CREATE INDEX IF NOT EXISTS idx_mt_eventos_tenant_active 
ON mt_eventos(tenant_id, is_active) 
WHERE is_active = true;

-- =====================================================
-- PARTE 3: Datos de ejemplo - Universidad Católica
-- =====================================================

-- Actualizar tenant cruzados con todos los datos
UPDATE mt_tenants SET
  color_primario = '#1e5799',
  color_secundario = '#207cca',
  color_light = '#7db9e8',
  color_dark = '#2989d8',
  shield_url = '/UCimg/EscudoUC.png',
  background_url = '/UCimg/Claro.jpg',
  arena_logo_url = '/UCimg/ClaroArenaL.png',
  arena_nombre = 'Claro Arena',
  social_facebook = 'https://www.facebook.com/cruzados.cl/?locale=es_LA',
  social_twitter = 'https://x.com/Cruzados',
  social_instagram = 'https://www.instagram.com/cruzados_oficial/?hl=es-la',
  social_youtube = 'https://www.youtube.com/user/OficialCruzados'
WHERE slug = 'cruzados';

-- Actualizar tenant colocolo con datos de ejemplo
UPDATE mt_tenants SET
  color_primario = '#000000',
  color_secundario = '#FFFFFF',
  color_light = '#CCCCCC',
  color_dark = '#333333',
  shield_url = '/colocolo/shield.png',
  background_url = '/colocolo/background.jpg',
  arena_logo_url = '/colocolo/arena.png',
  arena_nombre = 'Estadio Monumental'
WHERE slug = 'colocolo';

-- =====================================================
-- PARTE 4: Insertar/Actualizar evento de ejemplo
-- =====================================================

-- Primero verificar si ya existe un evento activo para cruzados
-- Si existe, actualizarlo. Si no, insertarlo.

-- Opción: Insertar nuevo evento (si no tienes uno)
INSERT INTO mt_eventos (
  tenant_id,
  opponent_tenant_id,
  nombre,
  descripcion,
  fecha,
  hora,
  venue,
  league,
  fecha_limite_acreditacion,
  is_active
) 
SELECT 
  t.id as tenant_id,
  (SELECT id FROM mt_tenants WHERE slug = 'colocolo') as opponent_tenant_id,
  'vs Deportes Concepción' as nombre,
  'Partido correspondiente a la Liga de Primera Mercado Libre' as descripcion,
  '2026-02-08'::DATE as fecha,
  '20:30:00'::TIME as hora,
  'Claro Arena' as venue,
  'Liga de Primera Mercado Libre' as league,
  '2026-02-07 18:00:00+00'::TIMESTAMP WITH TIME ZONE as fecha_limite_acreditacion,
  true as is_active
FROM mt_tenants t
WHERE t.slug = 'cruzados'
AND NOT EXISTS (
  SELECT 1 FROM mt_eventos e 
  WHERE e.tenant_id = t.id AND e.is_active = true
);

-- Si el evento ya existe, actualizarlo
UPDATE mt_eventos SET
  fecha = '2026-02-08',
  hora = '20:30:00',
  venue = 'Claro Arena',
  league = 'Liga de Primera Mercado Libre',
  fecha_limite_acreditacion = '2026-02-07 18:00:00+00'
WHERE tenant_id = (SELECT id FROM mt_tenants WHERE slug = 'cruzados')
AND is_active = true;

-- =====================================================
-- PARTE 5: Vista útil para consultas (opcional pero recomendado)
-- =====================================================

CREATE OR REPLACE VIEW v_evento_completo AS
SELECT 
  e.id as evento_id,
  e.nombre as evento_nombre,
  e.descripcion,
  e.fecha,
  e.hora,
  e.venue,
  e.league,
  e.fecha_limite_acreditacion,
  e.is_active,
  -- Tenant (dueño del evento)
  t.id as tenant_id,
  t.slug as tenant_slug,
  t.nombre as tenant_nombre,
  t.logo_url as tenant_logo,
  t.color_primario,
  t.color_secundario,
  t.color_light,
  t.color_dark,
  t.shield_url,
  t.background_url,
  t.arena_logo_url,
  t.arena_nombre,
  t.social_facebook,
  t.social_twitter,
  t.social_instagram,
  t.social_youtube,
  -- Oponente
  o.id as opponent_id,
  o.slug as opponent_slug,
  o.nombre as opponent_nombre,
  o.logo_url as opponent_logo,
  o.shield_url as opponent_shield_url,
  o.color_primario as opponent_color_primario
FROM mt_eventos e
JOIN mt_tenants t ON e.tenant_id = t.id
LEFT JOIN mt_tenants o ON e.opponent_tenant_id = o.id;

-- =====================================================
-- VERIFICACIÓN: Consultar datos insertados
-- =====================================================

SELECT 
  tenant_slug,
  tenant_nombre,
  evento_nombre,
  fecha,
  hora,
  venue,
  opponent_nombre,
  color_primario,
  shield_url
FROM v_evento_completo
WHERE is_active = true;
