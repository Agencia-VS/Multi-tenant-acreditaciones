-- ============================================================================
-- ACCREDIA v2 — Schema Completo (Borrón y Cuenta Nueva)
-- Sistema Multi-Tenant de Acreditación con Identidad Única
-- ============================================================================
-- EJECUTAR ESTE SCRIPT EN UNA BASE DE DATOS LIMPIA O DESPUÉS DE DROP CASCADE
-- ============================================================================

-- 0. LIMPIAR SCHEMA ANTERIOR (si existe)
-- ============================================================================
DROP VIEW IF EXISTS v_evento_completo CASCADE;
DROP TABLE IF EXISTS mt_email_logs CASCADE;
DROP TABLE IF EXISTS mt_email_templates CASCADE;
DROP TABLE IF EXISTS mt_cupos_tipo_medio CASCADE;
DROP TABLE IF EXISTS mt_zonas_acreditacion CASCADE;
DROP TABLE IF EXISTS mt_areas_prensa CASCADE;
DROP TABLE IF EXISTS mt_acreditados CASCADE;
DROP TABLE IF EXISTS mt_form_configs CASCADE;
DROP TABLE IF EXISTS mt_perfiles_acreditados CASCADE;
DROP TABLE IF EXISTS mt_admin_tenants CASCADE;
DROP TABLE IF EXISTS mt_superadmins CASCADE;
DROP TABLE IF EXISTS mt_eventos CASCADE;
DROP TABLE IF EXISTS mt_tenants CASCADE;
-- Tablas legacy
DROP TABLE IF EXISTS acreditaciones CASCADE;
DROP TABLE IF EXISTS acreditados CASCADE;
DROP TABLE IF EXISTS medios CASCADE;
DROP TABLE IF EXISTS zonas_acreditacion CASCADE;

-- Nuevas tablas v2
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS checkins CASCADE;
DROP TABLE IF EXISTS registrations CASCADE;
DROP TABLE IF EXISTS event_quota_rules CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS tenant_admins CASCADE;
DROP TABLE IF EXISTS superadmins CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Funciones legacy
DROP FUNCTION IF EXISTS is_superadmin() CASCADE;
DROP FUNCTION IF EXISTS has_tenant_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_tenant_role(UUID) CASCADE;
DROP FUNCTION IF EXISTS can_edit_tenant(UUID) CASCADE;
DROP FUNCTION IF EXISTS vincular_perfil_por_rut(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_or_create_perfil(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_active_form_config(TEXT, TEXT, UUID) CASCADE;

-- ============================================================================
-- 1. EXTENSIONES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TABLAS CORE
-- ============================================================================

-- --------------------------------------------------------------------------
-- 2.1 PROFILES — Identidad Global del Usuario
-- El usuario es dueño de su dato. Identificado por RUT/DNI.
-- Puede existir sin login (creado por un Manager).
-- --------------------------------------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Identificador único global
  rut VARCHAR(20) UNIQUE NOT NULL,
  
  -- Datos personales core
  nombre VARCHAR(255) NOT NULL,
  apellido VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telefono VARCHAR(50),
  nacionalidad VARCHAR(100) DEFAULT 'Chilena',
  
  -- Foto base del perfil
  foto_url TEXT,
  
  -- Datos profesionales frecuentes
  cargo VARCHAR(100),          -- Periodista, Fotógrafo, Camarógrafo, etc.
  medio VARCHAR(255),          -- Canal 13, Radio ADN, etc.
  tipo_medio VARCHAR(100),     -- TV, Radio, Prensa Escrita, Web, etc.
  
  -- Datos extra reutilizables (talla_polera, seguro, licencia, etc.)
  datos_base JSONB DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_rut ON profiles(rut);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_email ON profiles(email);

-- --------------------------------------------------------------------------
-- 2.2 TENANTS — Clientes/Organizaciones
-- Cada tenant opera en su propia URL (app.com/slug)
-- --------------------------------------------------------------------------
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  activo BOOLEAN DEFAULT true,
  
  -- Branding
  logo_url TEXT,
  color_primario VARCHAR(7) DEFAULT '#1a1a2e',
  color_secundario VARCHAR(7) DEFAULT '#e94560',
  color_light VARCHAR(7) DEFAULT '#f5f5f5',
  color_dark VARCHAR(7) DEFAULT '#0f0f1a',
  
  -- Assets opcionales
  shield_url TEXT,
  background_url TEXT,
  
  -- Config extra (JSON flexible)
  config JSONB DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);

-- --------------------------------------------------------------------------
-- 2.3 EVENTS — Eventos por Tenant
-- Contiene config de formulario dinámico y switch de QR
-- --------------------------------------------------------------------------
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Datos del evento
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  fecha DATE,
  hora TIME,
  venue VARCHAR(255),
  
  -- Estado
  is_active BOOLEAN DEFAULT true,
  fecha_limite_acreditacion TIMESTAMPTZ,
  
  -- Oponente (para deportes)
  opponent_name VARCHAR(255),
  opponent_logo_url TEXT,
  league VARCHAR(255),
  
  -- QR Switch (punto del doc maestro)
  qr_enabled BOOLEAN DEFAULT false,
  
  -- =========================================================================
  -- MOTOR DE FORMULARIOS DINÁMICOS
  -- =========================================================================
  -- Cada evento define qué campos EXTRA necesita además del perfil base.
  -- El sistema detecta qué datos ya tiene el usuario y solo muestra los faltantes.
  -- 
  -- Estructura de form_fields: Array de objetos con:
  -- {
  --   "key": "talla_polera",              -- identificador único del campo
  --   "label": "Talla de Polera",         -- etiqueta visible
  --   "type": "text|select|file|number|email|textarea|checkbox|date",
  --   "options": ["S","M","L","XL"],      -- solo para type=select
  --   "required": true,                   -- obligatorio o no
  --   "profile_field": "datos_base.talla_polera",  -- mapeo al perfil (auto-fill)
  --   "section": "personal|profesional|documentos|extra",  -- sección visual
  --   "placeholder": "Selecciona tu talla",
  --   "help_text": "Requerido para credencial",
  --   "order": 1                          -- orden de aparición
  -- }
  -- =========================================================================
  form_fields JSONB DEFAULT '[]',
  
  -- Config extra del evento
  config JSONB DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_tenant ON events(tenant_id);
CREATE INDEX idx_events_active ON events(is_active) WHERE is_active = true;

-- --------------------------------------------------------------------------
-- 2.4 EVENT_QUOTA_RULES — Motor de Restricciones de Cupos
-- =========================================================================
-- Reglas configurables: "Si Tipo de Medio = Radial, máx 5 por Organización"
-- El sistema bloquea el envío en tiempo real si se excede.
-- --------------------------------------------------------------------------
CREATE TABLE event_quota_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  
  -- Regla: para este tipo_medio, máximo N por organización
  tipo_medio VARCHAR(100) NOT NULL,
  max_per_organization INT NOT NULL DEFAULT 0,  -- 0 = sin límite
  
  -- También se puede limitar globalmente (total de ese tipo_medio en el evento)
  max_global INT DEFAULT 0,  -- 0 = sin límite
  
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, tipo_medio)
);

CREATE INDEX idx_quota_rules_event ON event_quota_rules(event_id);

-- --------------------------------------------------------------------------
-- 2.5 REGISTRATIONS — El "Ticket" de Acreditación
-- Vincula Usuario + Evento + Organización + Respuestas extra
-- --------------------------------------------------------------------------
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Datos de esta inscripción específica
  organizacion VARCHAR(255),     -- medio/empresa para ESTE evento
  tipo_medio VARCHAR(100),       -- tipo de medio para ESTE evento  
  cargo VARCHAR(100),            -- cargo para ESTE evento
  
  -- Estado del flujo
  status VARCHAR(20) DEFAULT 'pendiente' 
    CHECK (status IN ('pendiente', 'aprobado', 'rechazado', 'revision')),
  motivo_rechazo TEXT,
  
  -- ¿Quién envió esta inscripción? (Manager o el propio usuario)
  submitted_by UUID REFERENCES profiles(id),
  
  -- Respuestas a campos dinámicos del evento (solo los extras)
  datos_extra JSONB DEFAULT '{}',
  
  -- QR Token (se genera al aprobar si qr_enabled)
  qr_token VARCHAR(255) UNIQUE,
  qr_generated_at TIMESTAMPTZ,
  
  -- Check-in
  checked_in BOOLEAN DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES auth.users,
  
  -- Admin que procesó
  processed_by UUID REFERENCES auth.users,
  processed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Una persona solo puede registrarse una vez por evento
  UNIQUE(event_id, profile_id)
);

CREATE INDEX idx_registrations_event ON registrations(event_id);
CREATE INDEX idx_registrations_profile ON registrations(profile_id);
CREATE INDEX idx_registrations_status ON registrations(status);
CREATE INDEX idx_registrations_org ON registrations(organizacion);
CREATE INDEX idx_registrations_tipo_medio ON registrations(tipo_medio);
CREATE INDEX idx_registrations_qr ON registrations(qr_token);
CREATE INDEX idx_registrations_submitted_by ON registrations(submitted_by);

-- --------------------------------------------------------------------------
-- 2.6 TEAM_MEMBERS — Equipo del Manager
-- Un Manager puede gestionar una lista de personas bajo su cuenta
-- --------------------------------------------------------------------------
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Alias amigable para el manager
  alias VARCHAR(255),
  notas TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(manager_id, member_profile_id)
);

CREATE INDEX idx_team_manager ON team_members(manager_id);

-- --------------------------------------------------------------------------
-- 2.7 SUPERADMINS — Administradores Globales
-- --------------------------------------------------------------------------
CREATE TABLE superadmins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email VARCHAR(255) NOT NULL,
  nombre VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 2.8 TENANT_ADMINS — Administradores por Tenant
-- --------------------------------------------------------------------------
CREATE TABLE tenant_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rol VARCHAR(20) DEFAULT 'admin' CHECK (rol IN ('admin', 'editor', 'viewer')),
  nombre VARCHAR(255),
  email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_tenant_admins_tenant ON tenant_admins(tenant_id);

-- --------------------------------------------------------------------------
-- 2.9 AUDIT_LOGS — Registro de Auditoría
-- Quién aprobó, rechazó o editó cada solicitud
-- --------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  
  -- Qué pasó
  action VARCHAR(100) NOT NULL,     -- 'registration.approved', 'event.created', etc.
  entity_type VARCHAR(100),          -- 'registration', 'event', 'tenant', etc.
  entity_id UUID,
  
  -- Detalles extra
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- --------------------------------------------------------------------------
-- 2.10 EMAIL_TEMPLATES — Plantillas de Email por Tenant
-- --------------------------------------------------------------------------
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,  -- aprobacion, rechazo, confirmacion, recordatorio
  subject VARCHAR(500),
  body_html TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, tipo)
);

-- --------------------------------------------------------------------------
-- 2.11 EMAIL_LOGS — Registro de Emails Enviados
-- --------------------------------------------------------------------------
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  to_email VARCHAR(255) NOT NULL,
  tipo VARCHAR(50),
  subject VARCHAR(500),
  status VARCHAR(20) DEFAULT 'sent',
  error TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 3. VISTAS
-- ============================================================================

-- Vista completa de evento con datos del tenant
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

-- Vista de registros con datos del perfil y evento
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
  t.logo_url AS tenant_logo
FROM registrations r
JOIN profiles p ON r.profile_id = p.id
JOIN events e ON r.event_id = e.id
JOIN tenants t ON e.tenant_id = t.id;

-- ============================================================================
-- 4. FUNCIONES HELPER
-- ============================================================================

-- Verificar si el usuario actual es superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM superadmins WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Verificar si tiene acceso a un tenant
CREATE OR REPLACE FUNCTION has_tenant_access(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_superadmin() OR EXISTS (
    SELECT 1 FROM tenant_admins 
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Obtener rol en un tenant
CREATE OR REPLACE FUNCTION get_tenant_role(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF is_superadmin() THEN
    RETURN 'superadmin';
  END IF;
  
  SELECT rol INTO v_role 
  FROM tenant_admins 
  WHERE user_id = auth.uid() AND tenant_id = p_tenant_id;
  
  RETURN COALESCE(v_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Verificar si puede editar en un tenant
CREATE OR REPLACE FUNCTION can_edit_tenant(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_superadmin() OR EXISTS (
    SELECT 1 FROM tenant_admins 
    WHERE user_id = auth.uid() 
      AND tenant_id = p_tenant_id 
      AND rol IN ('admin', 'editor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =========================================================================
-- Buscar o crear perfil por RUT
-- Core de la "Identidad Única": si el RUT ya existe, retorna el perfil
-- existente con datos precargados. Si no, crea uno nuevo.
-- =========================================================================
CREATE OR REPLACE FUNCTION get_or_create_profile(
  p_rut VARCHAR,
  p_nombre VARCHAR,
  p_apellido VARCHAR,
  p_email VARCHAR DEFAULT NULL,
  p_telefono VARCHAR DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- Buscar perfil existente por RUT
  SELECT id INTO v_profile_id FROM profiles WHERE rut = p_rut;
  
  IF v_profile_id IS NOT NULL THEN
    -- Actualizar datos si se proporcionan y el perfil existe
    UPDATE profiles SET
      nombre = COALESCE(NULLIF(p_nombre, ''), nombre),
      apellido = COALESCE(NULLIF(p_apellido, ''), apellido),
      email = COALESCE(NULLIF(p_email, ''), email),
      telefono = COALESCE(NULLIF(p_telefono, ''), telefono),
      user_id = COALESCE(p_user_id, user_id),
      updated_at = now()
    WHERE id = v_profile_id;
    
    RETURN v_profile_id;
  END IF;
  
  -- Crear nuevo perfil
  INSERT INTO profiles (rut, nombre, apellido, email, telefono, user_id)
  VALUES (p_rut, p_nombre, p_apellido, p_email, p_telefono, p_user_id)
  RETURNING id INTO v_profile_id;
  
  RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- Verificar cupo disponible para un tipo de medio + organización en un evento
-- Retorna: {available: boolean, used: int, max: int, message: text}
-- =========================================================================
CREATE OR REPLACE FUNCTION check_quota(
  p_event_id UUID,
  p_tipo_medio VARCHAR,
  p_organizacion VARCHAR
)
RETURNS JSONB AS $$
DECLARE
  v_rule RECORD;
  v_used_org INT;
  v_used_global INT;
  v_result JSONB;
BEGIN
  -- Buscar regla para este tipo_medio en este evento
  SELECT * INTO v_rule 
  FROM event_quota_rules 
  WHERE event_id = p_event_id AND tipo_medio = p_tipo_medio;
  
  -- Si no hay regla, permitir sin límite
  IF v_rule IS NULL THEN
    RETURN jsonb_build_object(
      'available', true,
      'used_org', 0,
      'max_org', 0,
      'used_global', 0,
      'max_global', 0,
      'message', 'Sin restricción de cupo'
    );
  END IF;
  
  -- Contar registros existentes de esta organización + tipo_medio
  SELECT COUNT(*) INTO v_used_org
  FROM registrations
  WHERE event_id = p_event_id 
    AND tipo_medio = p_tipo_medio 
    AND organizacion = p_organizacion
    AND status != 'rechazado';
  
  -- Contar registros globales de este tipo_medio
  SELECT COUNT(*) INTO v_used_global
  FROM registrations
  WHERE event_id = p_event_id 
    AND tipo_medio = p_tipo_medio
    AND status != 'rechazado';
  
  -- Verificar límite por organización
  IF v_rule.max_per_organization > 0 AND v_used_org >= v_rule.max_per_organization THEN
    RETURN jsonb_build_object(
      'available', false,
      'used_org', v_used_org,
      'max_org', v_rule.max_per_organization,
      'used_global', v_used_global,
      'max_global', v_rule.max_global,
      'message', format('Se alcanzó el límite de %s cupos de %s para %s', 
        v_rule.max_per_organization, p_tipo_medio, p_organizacion)
    );
  END IF;
  
  -- Verificar límite global
  IF v_rule.max_global > 0 AND v_used_global >= v_rule.max_global THEN
    RETURN jsonb_build_object(
      'available', false,
      'used_org', v_used_org,
      'max_org', v_rule.max_per_organization,
      'used_global', v_used_global,
      'max_global', v_rule.max_global,
      'message', format('Se alcanzó el límite global de %s cupos para %s', 
        v_rule.max_global, p_tipo_medio)
    );
  END IF;
  
  -- Cupo disponible
  RETURN jsonb_build_object(
    'available', true,
    'used_org', v_used_org,
    'max_org', v_rule.max_per_organization,
    'used_global', v_used_global,
    'max_global', v_rule.max_global,
    'message', format('Cupo disponible: %s/%s por organización', 
      v_used_org, v_rule.max_per_organization)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =========================================================================
-- Generar token QR seguro al aprobar una inscripción
-- Token = hash de (registration_id + event_id + timestamp + random)
-- =========================================================================
CREATE OR REPLACE FUNCTION generate_qr_token(p_registration_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Generar token alfanumérico encriptado
  v_token := encode(
    digest(
      p_registration_id::text || now()::text || gen_random_uuid()::text,
      'sha256'
    ),
    'hex'
  );
  
  -- Guardar el token
  UPDATE registrations 
  SET qr_token = v_token, qr_generated_at = now()
  WHERE id = p_registration_id;
  
  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- Validar QR en puerta: escaneo -> check-in
-- Retorna info del registro o error
-- =========================================================================
CREATE OR REPLACE FUNCTION validate_qr_checkin(
  p_qr_token VARCHAR,
  p_scanner_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_reg RECORD;
BEGIN
  -- Buscar registro por token
  SELECT r.*, p.nombre, p.apellido, p.rut, p.foto_url,
         e.nombre AS event_nombre, e.qr_enabled
  INTO v_reg
  FROM registrations r
  JOIN profiles p ON r.profile_id = p.id
  JOIN events e ON r.event_id = e.id
  WHERE r.qr_token = p_qr_token;
  
  -- Token no encontrado
  IF v_reg IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'status', 'not_found',
      'message', 'QR no válido o no encontrado'
    );
  END IF;
  
  -- No aprobado
  IF v_reg.status != 'aprobado' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'status', 'not_approved',
      'message', format('Acreditación en estado: %s', v_reg.status),
      'nombre', v_reg.nombre || ' ' || v_reg.apellido
    );
  END IF;
  
  -- Ya ingresó (re-entrada)
  IF v_reg.checked_in THEN
    RETURN jsonb_build_object(
      'valid', false,
      'status', 'already_checked_in',
      'message', format('Ya ingresó a las %s', to_char(v_reg.checked_in_at, 'HH24:MI')),
      'nombre', v_reg.nombre || ' ' || v_reg.apellido,
      'foto_url', v_reg.foto_url,
      'checked_in_at', v_reg.checked_in_at
    );
  END IF;
  
  -- CHECK-IN exitoso
  UPDATE registrations 
  SET checked_in = true, 
      checked_in_at = now(),
      checked_in_by = p_scanner_user_id
  WHERE id = v_reg.id;
  
  RETURN jsonb_build_object(
    'valid', true,
    'status', 'checked_in',
    'message', 'Ingreso autorizado',
    'registration_id', v_reg.id,
    'nombre', v_reg.nombre || ' ' || v_reg.apellido,
    'rut', v_reg.rut,
    'foto_url', v_reg.foto_url,
    'organizacion', v_reg.organizacion,
    'tipo_medio', v_reg.tipo_medio,
    'cargo', v_reg.cargo,
    'event_nombre', v_reg.event_nombre
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_registrations_updated_at
  BEFORE UPDATE ON registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_quota_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE superadmins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- --------------- PROFILES ---------------
-- Cualquiera puede crear un perfil (registro público)
CREATE POLICY profiles_insert ON profiles 
  FOR INSERT WITH CHECK (true);

-- Tu propio perfil o si eres admin
CREATE POLICY profiles_select ON profiles 
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_superadmin()
    OR EXISTS (
      SELECT 1 FROM team_members tm WHERE tm.manager_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      ) AND tm.member_profile_id = profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.profile_id = profiles.id
        AND has_tenant_access(e.tenant_id)
    )
  );

-- Solo tu propio perfil o superadmin
CREATE POLICY profiles_update ON profiles 
  FOR UPDATE USING (
    user_id = auth.uid() OR is_superadmin()
  );

-- --------------- TENANTS ---------------
-- Lectura pública (para slugs, landing pages, etc.)
CREATE POLICY tenants_select ON tenants 
  FOR SELECT USING (true);

CREATE POLICY tenants_insert ON tenants 
  FOR INSERT WITH CHECK (is_superadmin());

CREATE POLICY tenants_update ON tenants 
  FOR UPDATE USING (is_superadmin());

CREATE POLICY tenants_delete ON tenants 
  FOR DELETE USING (is_superadmin());

-- --------------- EVENTS ---------------
-- Eventos activos son públicos
CREATE POLICY events_select ON events 
  FOR SELECT USING (true);

CREATE POLICY events_insert ON events 
  FOR INSERT WITH CHECK (is_superadmin() OR has_tenant_access(tenant_id));

CREATE POLICY events_update ON events 
  FOR UPDATE USING (is_superadmin() OR has_tenant_access(tenant_id));

CREATE POLICY events_delete ON events 
  FOR DELETE USING (is_superadmin());

-- --------------- EVENT_QUOTA_RULES ---------------
CREATE POLICY quota_rules_select ON event_quota_rules 
  FOR SELECT USING (true);

CREATE POLICY quota_rules_insert ON event_quota_rules 
  FOR INSERT WITH CHECK (
    is_superadmin() OR EXISTS (
      SELECT 1 FROM events e WHERE e.id = event_id AND has_tenant_access(e.tenant_id)
    )
  );

CREATE POLICY quota_rules_update ON event_quota_rules 
  FOR UPDATE USING (
    is_superadmin() OR EXISTS (
      SELECT 1 FROM events e WHERE e.id = event_id AND has_tenant_access(e.tenant_id)
    )
  );

CREATE POLICY quota_rules_delete ON event_quota_rules 
  FOR DELETE USING (
    is_superadmin() OR EXISTS (
      SELECT 1 FROM events e WHERE e.id = event_id AND has_tenant_access(e.tenant_id)
    )
  );

-- --------------- REGISTRATIONS ---------------
-- Insertar: público (formulario abierto)
CREATE POLICY registrations_insert ON registrations 
  FOR INSERT WITH CHECK (true);

-- Leer: tu propio, tu equipo, o admin del tenant
CREATE POLICY registrations_select ON registrations 
  FOR SELECT USING (
    -- Dueño del perfil
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = profile_id AND p.user_id = auth.uid())
    -- Manager que lo envió
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = submitted_by AND p.user_id = auth.uid())
    -- Admin del tenant del evento
    OR EXISTS (
      SELECT 1 FROM events e WHERE e.id = event_id AND has_tenant_access(e.tenant_id)
    )
    -- Superadmin
    OR is_superadmin()
  );

-- Actualizar: admin del tenant o superadmin
CREATE POLICY registrations_update ON registrations 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM events e WHERE e.id = event_id AND can_edit_tenant(e.tenant_id)
    )
    OR is_superadmin()
  );

-- Eliminar: superadmin o admin del tenant
CREATE POLICY registrations_delete ON registrations 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM events e WHERE e.id = event_id AND has_tenant_access(e.tenant_id)
    )
    OR is_superadmin()
  );

-- --------------- TEAM_MEMBERS ---------------
CREATE POLICY team_members_all ON team_members 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = manager_id AND p.user_id = auth.uid())
    OR is_superadmin()
  );

-- --------------- SUPERADMINS ---------------
CREATE POLICY superadmins_select ON superadmins 
  FOR SELECT USING (user_id = auth.uid() OR is_superadmin());

CREATE POLICY superadmins_insert ON superadmins 
  FOR INSERT WITH CHECK (is_superadmin());

CREATE POLICY superadmins_update ON superadmins 
  FOR UPDATE USING (is_superadmin());

CREATE POLICY superadmins_delete ON superadmins 
  FOR DELETE USING (is_superadmin());

-- --------------- TENANT_ADMINS ---------------
CREATE POLICY tenant_admins_select ON tenant_admins 
  FOR SELECT USING (
    user_id = auth.uid() 
    OR has_tenant_access(tenant_id)
    OR is_superadmin()
  );

CREATE POLICY tenant_admins_insert ON tenant_admins 
  FOR INSERT WITH CHECK (is_superadmin() OR has_tenant_access(tenant_id));

CREATE POLICY tenant_admins_update ON tenant_admins 
  FOR UPDATE USING (is_superadmin() OR has_tenant_access(tenant_id));

CREATE POLICY tenant_admins_delete ON tenant_admins 
  FOR DELETE USING (is_superadmin());

-- --------------- AUDIT_LOGS ---------------
CREATE POLICY audit_logs_insert ON audit_logs 
  FOR INSERT WITH CHECK (true);  -- Cualquiera autenticado puede insertar

CREATE POLICY audit_logs_select ON audit_logs 
  FOR SELECT USING (is_superadmin());

-- --------------- EMAIL_TEMPLATES ---------------
CREATE POLICY email_templates_select ON email_templates 
  FOR SELECT USING (has_tenant_access(tenant_id) OR is_superadmin());

CREATE POLICY email_templates_all ON email_templates 
  FOR ALL USING (is_superadmin() OR has_tenant_access(tenant_id));

-- --------------- EMAIL_LOGS ---------------
CREATE POLICY email_logs_insert ON email_logs 
  FOR INSERT WITH CHECK (true);

CREATE POLICY email_logs_select ON email_logs 
  FOR SELECT USING (is_superadmin() OR has_tenant_access(tenant_id));

-- ============================================================================
-- 6. DATOS SEMILLA (SEED)
-- ============================================================================

-- Tenant de ejemplo: UC Cruzados  
INSERT INTO tenants (nombre, slug, logo_url, color_primario, color_secundario, color_light, color_dark, shield_url, config)
VALUES (
  'Cruzados', 'cruzados',
  'https://res.cloudinary.com/dz0ajaf5r/image/upload/v1749233750/Cruzados_-_Club_Deportivo_Universidad_Cat%C3%B3lica_je2rxj.png',
  '#001f5b', '#ffffff', '#e8e8e8', '#001540',
  'https://res.cloudinary.com/dz0ajaf5r/image/upload/v1749233750/Cruzados_-_Club_Deportivo_Universidad_Cat%C3%B3lica_je2rxj.png',
  '{"arena_nombre": "Estadio San Carlos de Apoquindo", "social_twitter": "@Cruzados"}'::jsonb
);

-- Tenant de ejemplo: Claro Arena
INSERT INTO tenants (nombre, slug, logo_url, color_primario, color_secundario, color_light, color_dark, config)
VALUES (
  'Claro Arena', 'claro-arena',
  NULL,
  '#e30613', '#ffffff', '#f5f5f5', '#1a0000',
  '{"arena_nombre": "Movistar Arena"}'::jsonb
);

-- Evento activo para Cruzados
INSERT INTO events (
  tenant_id, nombre, descripcion, fecha, hora, venue, is_active,
  fecha_limite_acreditacion, qr_enabled, opponent_name, opponent_logo_url, league,
  form_fields
)
SELECT 
  t.id,
  'UC vs Colo-Colo',
  'Clásico Universitario - Fecha 15 Campeonato Nacional',
  '2026-03-15',
  '18:00',
  'Estadio San Carlos de Apoquindo',
  true,
  '2026-03-14 23:59:59-04',
  true,
  'Colo-Colo',
  'https://res.cloudinary.com/dz0ajaf5r/image/upload/v1749233748/Colo-Colo_bhhqhg.png',
  'Campeonato Nacional 2026',
  '[
    {
      "key": "talla_polera",
      "label": "Talla de Polera",
      "type": "select",
      "options": ["S", "M", "L", "XL", "XXL"],
      "required": false,
      "profile_field": "datos_base.talla_polera",
      "section": "extra",
      "order": 1
    },
    {
      "key": "requiere_estacionamiento",
      "label": "¿Requiere Estacionamiento?",
      "type": "select",
      "options": ["Sí", "No"],
      "required": true,
      "section": "extra",
      "order": 2
    },
    {
      "key": "equipo_tecnico",
      "label": "Equipo Técnico (detalle)",
      "type": "textarea",
      "required": false,
      "section": "extra",
      "placeholder": "Ej: 1 cámara, 1 trípode, 1 micrófono",
      "order": 3
    }
  ]'::jsonb
FROM tenants t WHERE t.slug = 'cruzados';

-- Reglas de cupo para el evento de Cruzados
INSERT INTO event_quota_rules (event_id, tipo_medio, max_per_organization, max_global)
SELECT e.id, 'TV', 5, 30
FROM events e JOIN tenants t ON e.tenant_id = t.id WHERE t.slug = 'cruzados'
UNION ALL
SELECT e.id, 'Radio', 3, 20
FROM events e JOIN tenants t ON e.tenant_id = t.id WHERE t.slug = 'cruzados'
UNION ALL
SELECT e.id, 'Prensa Escrita', 2, 15
FROM events e JOIN tenants t ON e.tenant_id = t.id WHERE t.slug = 'cruzados'
UNION ALL
SELECT e.id, 'Sitio Web', 2, 10
FROM events e JOIN tenants t ON e.tenant_id = t.id WHERE t.slug = 'cruzados'
UNION ALL
SELECT e.id, 'Fotógrafo', 3, 20
FROM events e JOIN tenants t ON e.tenant_id = t.id WHERE t.slug = 'cruzados'
UNION ALL
SELECT e.id, 'Agencia', 4, 15
FROM events e JOIN tenants t ON e.tenant_id = t.id WHERE t.slug = 'cruzados';

-- Evento para Claro Arena
INSERT INTO events (
  tenant_id, nombre, descripcion, fecha, hora, venue, is_active,
  fecha_limite_acreditacion, qr_enabled,
  form_fields
)
SELECT 
  t.id,
  'Concierto Dua Lipa',
  'Radical Optimism Tour - Santiago 2026',
  '2026-04-20',
  '20:00',
  'Movistar Arena',
  true,
  '2026-04-19 23:59:59-04',
  true,
  '[
    {
      "key": "talla_polera",
      "label": "Talla de Polera",
      "type": "select",
      "options": ["S", "M", "L", "XL", "XXL"],
      "required": true,
      "profile_field": "datos_base.talla_polera",
      "section": "extra",
      "order": 1
    },
    {
      "key": "seguro_accidentes",
      "label": "Número de Seguro de Accidentes",
      "type": "text",
      "required": true,
      "profile_field": "datos_base.seguro_accidentes",
      "section": "documentos",
      "order": 2
    },
    {
      "key": "foto_prensa",
      "label": "Foto Credencial de Prensa",
      "type": "file",
      "required": true,
      "profile_field": "foto_url",
      "section": "documentos",
      "order": 3
    }
  ]'::jsonb
FROM tenants t WHERE t.slug = 'claro-arena';

-- Reglas de cupo para Claro Arena
INSERT INTO event_quota_rules (event_id, tipo_medio, max_per_organization, max_global)
SELECT e.id, 'TV', 3, 15
FROM events e JOIN tenants t ON e.tenant_id = t.id WHERE t.slug = 'claro-arena'
UNION ALL
SELECT e.id, 'Radio', 2, 10
FROM events e JOIN tenants t ON e.tenant_id = t.id WHERE t.slug = 'claro-arena'
UNION ALL
SELECT e.id, 'Sitio Web', 2, 8
FROM events e JOIN tenants t ON e.tenant_id = t.id WHERE t.slug = 'claro-arena'
UNION ALL
SELECT e.id, 'Fotógrafo', 2, 12
FROM events e JOIN tenants t ON e.tenant_id = t.id WHERE t.slug = 'claro-arena';

-- ============================================================================
-- FIN DEL SCHEMA v2
-- ============================================================================

-- Para crear el primer superadmin, después de registrar un usuario en Supabase Auth:
-- INSERT INTO superadmins (user_id, email, nombre) 
-- VALUES ('<user-uuid>', 'tu@email.com', 'Tu Nombre');
