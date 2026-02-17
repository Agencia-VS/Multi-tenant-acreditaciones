-- =============================================================
-- M6.4 — Función transaccional para cupos (race condition fix)
-- =============================================================
-- Problema: checkQuota() + duplicate check + INSERT son 3 queries
-- separadas. Dos requests concurrentes pueden pasar el check
-- antes de que ninguna inserte, excediendo el cupo.
--
-- Solución: una función PL/pgSQL que hace lock + check + insert
-- en una sola transacción atómica.
-- =============================================================

-- 1. Índice único para prevenir duplicados a nivel de DB
--    (safety net para el check dentro de la función)
CREATE UNIQUE INDEX IF NOT EXISTS uq_registration_event_profile
ON registrations (event_id, profile_id);

-- 2. Función transaccional
CREATE OR REPLACE FUNCTION check_and_create_registration(
  p_event_id     UUID,
  p_profile_id   UUID,
  p_organizacion TEXT    DEFAULT NULL,
  p_tipo_medio   TEXT    DEFAULT NULL,
  p_cargo        TEXT    DEFAULT NULL,
  p_submitted_by UUID    DEFAULT NULL,
  p_datos_extra  JSONB   DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_rule         RECORD;
  v_count_org    INT;
  v_count_global INT;
  v_reg_id       UUID;
BEGIN
  -- ── 1. Verificar duplicado ──────────────────────────────
  IF EXISTS (
    SELECT 1 FROM registrations
    WHERE event_id = p_event_id AND profile_id = p_profile_id
  ) THEN
    RAISE EXCEPTION 'Esta persona ya está registrada en este evento';
  END IF;

  -- ── 2. Verificar cupos (solo si hay tipo_medio) ────────
  IF p_tipo_medio IS NOT NULL THEN
    -- FOR UPDATE bloquea la fila de la regla, serializando
    -- inserciones concurrentes del mismo event+tipo_medio
    SELECT * INTO v_rule
    FROM event_quota_rules
    WHERE event_id = p_event_id
      AND tipo_medio = p_tipo_medio
    FOR UPDATE;

    IF FOUND THEN
      -- 2a. Límite por organización
      IF v_rule.max_per_organization > 0 AND p_organizacion IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count_org
        FROM registrations
        WHERE event_id   = p_event_id
          AND tipo_medio  = p_tipo_medio
          AND organizacion = p_organizacion
          AND status      != 'rechazado';

        IF v_count_org >= v_rule.max_per_organization THEN
          RAISE EXCEPTION 'Se alcanzó el límite de % cupos de % para %',
            v_rule.max_per_organization, p_tipo_medio, p_organizacion;
        END IF;
      END IF;

      -- 2b. Límite global
      IF COALESCE(v_rule.max_global, 0) > 0 THEN
        SELECT COUNT(*) INTO v_count_global
        FROM registrations
        WHERE event_id  = p_event_id
          AND tipo_medio = p_tipo_medio
          AND status     != 'rechazado';

        IF v_count_global >= v_rule.max_global THEN
          RAISE EXCEPTION 'Se alcanzó el límite global de % cupos para %',
            v_rule.max_global, p_tipo_medio;
        END IF;
      END IF;
    END IF;
    -- Si no hay regla (NOT FOUND) → sin límite, continuar
  END IF;

  -- ── 3. Insertar registro ───────────────────────────────
  INSERT INTO registrations (
    event_id, profile_id, organizacion, tipo_medio,
    cargo, submitted_by, datos_extra, status
  ) VALUES (
    p_event_id, p_profile_id, p_organizacion, p_tipo_medio,
    p_cargo, p_submitted_by, p_datos_extra, 'pendiente'
  )
  RETURNING id INTO v_reg_id;

  RETURN v_reg_id;
END;
$$;

-- ── Permisos ──────────────────────────────────────────────
-- Permitir al service_role ejecutar la función
GRANT EXECUTE ON FUNCTION check_and_create_registration TO service_role;
