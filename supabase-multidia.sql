-- ============================================================================
-- M8: Eventos Multidía — Migración SQL
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- ─── 1. Tipo de evento en tabla events ────────────────────────────────────

-- Crear enum para tipos de evento
DO $$ BEGIN
  CREATE TYPE event_type AS ENUM ('simple', 'deportivo', 'multidia');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Agregar columna event_type a events (default 'simple' para backwards compat)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'simple';

-- Agregar fecha_inicio y fecha_fin para multidía
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS fecha_inicio date,
  ADD COLUMN IF NOT EXISTS fecha_fin date;

-- ─── 2. Tabla event_days — Jornadas de un evento multidía ─────────────────

CREATE TABLE IF NOT EXISTS event_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  fecha       date NOT NULL,
  label       text NOT NULL,            -- "Día 1 — Clasificación"
  orden       int NOT NULL DEFAULT 1,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Índices para consulta rápida
CREATE INDEX IF NOT EXISTS idx_event_days_event ON event_days(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_day_fecha ON event_days(event_id, fecha);

-- ─── 3. Tabla registration_days — Check-in por día ────────────────────────

CREATE TABLE IF NOT EXISTS registration_days (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id   uuid NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  event_day_id      uuid NOT NULL REFERENCES event_days(id) ON DELETE CASCADE,
  checked_in        boolean NOT NULL DEFAULT false,
  checked_in_at     timestamptz,
  checked_in_by     text,
  created_at        timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reg_days_registration ON registration_days(registration_id);
CREATE INDEX IF NOT EXISTS idx_reg_days_event_day ON registration_days(event_day_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_reg_day ON registration_days(registration_id, event_day_id);

-- ─── 4. RLS (Row Level Security) ─────────────────────────────────────────

ALTER TABLE event_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_days ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (service_role las salta, anon/authenticated las usan)
CREATE POLICY "event_days_select_all" ON event_days FOR SELECT USING (true);
CREATE POLICY "event_days_insert_auth" ON event_days FOR INSERT WITH CHECK (true);
CREATE POLICY "event_days_update_auth" ON event_days FOR UPDATE USING (true);
CREATE POLICY "event_days_delete_auth" ON event_days FOR DELETE USING (true);

CREATE POLICY "reg_days_select_all" ON registration_days FOR SELECT USING (true);
CREATE POLICY "reg_days_insert_auth" ON registration_days FOR INSERT WITH CHECK (true);
CREATE POLICY "reg_days_update_auth" ON registration_days FOR UPDATE USING (true);
CREATE POLICY "reg_days_delete_auth" ON registration_days FOR DELETE USING (true);

-- ─── 5. Función: check-in por día ────────────────────────────────────────

CREATE OR REPLACE FUNCTION validate_qr_checkin_day(
  p_qr_token text,
  p_scanner_user_id text DEFAULT NULL,
  p_event_day_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg record;
  v_day record;
  v_reg_day record;
  v_event record;
BEGIN
  -- 1. Buscar el registro por QR token
  SELECT r.*, p.nombre, p.apellido, p.rut, p.foto_url
  INTO v_reg
  FROM registrations r
  JOIN profiles p ON p.id = r.profile_id
  WHERE r.qr_token = p_qr_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'status', 'not_found',
      'message', 'QR no encontrado'
    );
  END IF;

  -- 2. Verificar que esté aprobado
  IF v_reg.status != 'aprobado' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'status', v_reg.status,
      'message', 'Acreditación no aprobada (' || v_reg.status || ')',
      'nombre', v_reg.nombre || ' ' || v_reg.apellido,
      'rut', v_reg.rut
    );
  END IF;

  -- 3. Obtener tipo de evento
  SELECT event_type INTO v_event FROM events WHERE id = v_reg.event_id;

  -- 4. Si es multidía y se pasa day_id, hacer check-in por día
  IF v_event.event_type = 'multidia' AND p_event_day_id IS NOT NULL THEN
    -- Buscar el registration_day
    SELECT * INTO v_reg_day
    FROM registration_days
    WHERE registration_id = v_reg.id AND event_day_id = p_event_day_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'valid', false,
        'status', 'not_enrolled_day',
        'message', 'No inscrito para esta jornada',
        'nombre', v_reg.nombre || ' ' || v_reg.apellido,
        'rut', v_reg.rut
      );
    END IF;

    IF v_reg_day.checked_in THEN
      RETURN jsonb_build_object(
        'valid', false,
        'status', 'already_checked_in',
        'message', 'Ya registró ingreso para esta jornada',
        'nombre', v_reg.nombre || ' ' || v_reg.apellido,
        'rut', v_reg.rut,
        'foto_url', v_reg.foto_url,
        'registration_id', v_reg.id
      );
    END IF;

    -- Marcar check-in del día
    UPDATE registration_days
    SET checked_in = true,
        checked_in_at = now(),
        checked_in_by = p_scanner_user_id
    WHERE id = v_reg_day.id;

    RETURN jsonb_build_object(
      'valid', true,
      'status', 'checked_in',
      'message', 'Ingreso registrado',
      'registration_id', v_reg.id,
      'nombre', v_reg.nombre || ' ' || v_reg.apellido,
      'rut', v_reg.rut,
      'foto_url', v_reg.foto_url,
      'organizacion', v_reg.organizacion,
      'cargo', v_reg.cargo,
      'tipo_medio', v_reg.tipo_medio,
      'event_day_id', p_event_day_id
    );
  END IF;

  -- 5. Check-in normal (simple/deportivo o multidía sin day_id)
  IF v_reg.checked_in THEN
    RETURN jsonb_build_object(
      'valid', false,
      'status', 'already_checked_in',
      'message', 'Ya registró ingreso',
      'nombre', v_reg.nombre || ' ' || v_reg.apellido,
      'rut', v_reg.rut,
      'foto_url', v_reg.foto_url,
      'registration_id', v_reg.id
    );
  END IF;

  UPDATE registrations
  SET checked_in = true,
      checked_in_at = now(),
      checked_in_by = p_scanner_user_id
  WHERE id = v_reg.id;

  RETURN jsonb_build_object(
    'valid', true,
    'status', 'checked_in',
    'message', 'Ingreso registrado',
    'registration_id', v_reg.id,
    'nombre', v_reg.nombre || ' ' || v_reg.apellido,
    'rut', v_reg.rut,
    'foto_url', v_reg.foto_url,
    'organizacion', v_reg.organizacion,
    'cargo', v_reg.cargo,
    'tipo_medio', v_reg.tipo_medio
  );
END;
$$;

-- ─── 6. Función helper: obtener el día actual de un evento ────────────────

CREATE OR REPLACE FUNCTION get_current_event_day(p_event_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM event_days
  WHERE event_id = p_event_id
    AND fecha = CURRENT_DATE
    AND is_active = true
  LIMIT 1;
$$;

-- ─── 7. Actualizar vista v_event_full para incluir event_type ─────────────

-- Primero verificar si la vista existe y recrearla
DROP VIEW IF EXISTS v_event_full CASCADE;

CREATE VIEW v_event_full AS
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

-- ─── 8. Auto-crear registration_days al insertar en multidía ──────────────

CREATE OR REPLACE FUNCTION auto_create_registration_days()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_type text;
BEGIN
  SELECT event_type INTO v_event_type FROM events WHERE id = NEW.event_id;
  
  IF v_event_type = 'multidia' THEN
    INSERT INTO registration_days (registration_id, event_day_id)
    SELECT NEW.id, ed.id
    FROM event_days ed
    WHERE ed.event_id = NEW.event_id AND ed.is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_registration_days ON registrations;
CREATE TRIGGER trg_auto_registration_days
  AFTER INSERT ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_registration_days();

-- ============================================================================
-- FIN DE MIGRACIÓN M8
-- ============================================================================
