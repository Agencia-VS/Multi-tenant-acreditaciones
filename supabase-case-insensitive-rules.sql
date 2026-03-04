-- =============================================================
-- Fix: Normalized quota & zone rule matching (case + spaces)
-- Fecha: 2026-03-04
--
-- Problema:
-- Las comparaciones de tipo_medio y organizacion son exactas.
-- "VS" != "vs", "UC" != "uc", "Todo o Nada" != "todoonada".
-- Esto causa que cupos no se apliquen cuando el usuario escribe
-- su empresa con diferente capitalización o espaciado.
--
-- Solución:
-- Función normalize_match() que aplica normalize_match() + elimina espacios.
-- Ambos lados de cada comparación usan normalize_match().
-- =============================================================

-- ─── 0. Función de normalización ──────────────────────────
CREATE OR REPLACE FUNCTION normalize_match(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT replace(lower(trim(coalesce($1, ''))), ' ', '');
$$;

-- ─── 1. check_and_create_registration ─────────────────────
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
    SELECT * INTO v_rule
    FROM event_quota_rules
    WHERE event_id = p_event_id
      AND normalize_match(tipo_medio) = normalize_match(p_tipo_medio)
    FOR UPDATE;

    IF FOUND THEN
      -- 2a. Límite por organización (normalizado: case + espacios)
      IF v_rule.max_per_organization > 0 AND p_organizacion IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count_org
        FROM registrations
        WHERE event_id   = p_event_id
          AND normalize_match(tipo_medio)   = normalize_match(p_tipo_medio)
          AND normalize_match(organizacion) = normalize_match(p_organizacion)
          AND status      != 'rechazado';

        IF v_count_org >= v_rule.max_per_organization THEN
          RAISE EXCEPTION 'Se alcanzó el límite de % cupos de % para %',
            v_rule.max_per_organization, p_tipo_medio, p_organizacion;
        END IF;
      END IF;

      -- 2b. Límite global (case-insensitive)
      IF COALESCE(v_rule.max_global, 0) > 0 THEN
        SELECT COUNT(*) INTO v_count_global
        FROM registrations
        WHERE event_id  = p_event_id
          AND normalize_match(tipo_medio) = normalize_match(p_tipo_medio)
          AND status     != 'rechazado';

        IF v_count_global >= v_rule.max_global THEN
          RAISE EXCEPTION 'Se alcanzó el límite global de % cupos para %',
            v_rule.max_global, p_tipo_medio;
        END IF;
      END IF;
    END IF;
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

GRANT EXECUTE ON FUNCTION check_and_create_registration TO service_role;

-- ─── 2. bulk_check_and_create_registrations ───────────────
CREATE OR REPLACE FUNCTION bulk_check_and_create_registrations(
  p_event_id     UUID,
  p_submitted_by UUID    DEFAULT NULL,
  p_rows         JSONB   DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_row           JSONB;
  v_profile_id    UUID;
  v_organizacion  TEXT;
  v_tipo_medio    TEXT;
  v_cargo         TEXT;
  v_datos_extra   JSONB;
  v_row_index     INT;
  v_rule          RECORD;
  v_count_org     INT;
  v_count_global  INT;
  v_reg_id        UUID;
  v_results       JSONB := '[]'::jsonb;
BEGIN
  -- Lock quota rules for this event
  PERFORM 1 FROM event_quota_rules
  WHERE event_id = p_event_id
  FOR UPDATE;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_profile_id   := (v_row->>'profile_id')::UUID;
    v_organizacion := v_row->>'organizacion';
    v_tipo_medio   := v_row->>'tipo_medio';
    v_cargo        := v_row->>'cargo';
    v_datos_extra  := COALESCE(v_row->'datos_extra', 'null'::jsonb);
    v_row_index    := COALESCE((v_row->>'row_index')::INT, 0);

    -- 1) Duplicado
    IF EXISTS (
      SELECT 1 FROM registrations
      WHERE event_id = p_event_id AND profile_id = v_profile_id
    ) THEN
      v_results := v_results || jsonb_build_object(
        'row_index', v_row_index,
        'ok', false,
        'error', 'Esta persona ya está registrada en este evento'
      );
      CONTINUE;
    END IF;

    -- 2) Cupos (case-insensitive)
    IF v_tipo_medio IS NOT NULL THEN
      SELECT * INTO v_rule
      FROM event_quota_rules
      WHERE event_id = p_event_id
        AND normalize_match(tipo_medio) = normalize_match(v_tipo_medio);

      IF FOUND THEN
        -- 2a) Límite por organización
        IF v_rule.max_per_organization > 0 AND v_organizacion IS NOT NULL THEN
          SELECT COUNT(*) INTO v_count_org
          FROM registrations
          WHERE event_id    = p_event_id
            AND normalize_match(tipo_medio)   = normalize_match(v_tipo_medio)
            AND normalize_match(organizacion) = normalize_match(v_organizacion)
            AND status      != 'rechazado';

          IF v_count_org >= v_rule.max_per_organization THEN
            v_results := v_results || jsonb_build_object(
              'row_index', v_row_index,
              'ok', false,
              'error', format('Se alcanzó el límite de %s cupos de %s para %s',
                v_rule.max_per_organization, v_tipo_medio, v_organizacion)
            );
            CONTINUE;
          END IF;
        END IF;

        -- 2b) Límite global
        IF COALESCE(v_rule.max_global, 0) > 0 THEN
          SELECT COUNT(*) INTO v_count_global
          FROM registrations
          WHERE event_id   = p_event_id
            AND normalize_match(tipo_medio) = normalize_match(v_tipo_medio)
            AND status    != 'rechazado';

          IF v_count_global >= v_rule.max_global THEN
            v_results := v_results || jsonb_build_object(
              'row_index', v_row_index,
              'ok', false,
              'error', format('Se alcanzó el límite global de %s cupos para %s',
                v_rule.max_global, v_tipo_medio)
            );
            CONTINUE;
          END IF;
        END IF;
      END IF;
    END IF;

    -- 3) Insert
    BEGIN
      INSERT INTO registrations (
        event_id, profile_id, organizacion, tipo_medio,
        cargo, submitted_by, datos_extra, status
      ) VALUES (
        p_event_id, v_profile_id, v_organizacion, v_tipo_medio,
        v_cargo, p_submitted_by,
        CASE WHEN v_datos_extra = 'null'::jsonb THEN NULL ELSE v_datos_extra END,
        'pendiente'
      )
      RETURNING id INTO v_reg_id;

      v_results := v_results || jsonb_build_object(
        'row_index', v_row_index,
        'ok', true,
        'reg_id', v_reg_id
      );

    EXCEPTION WHEN unique_violation THEN
      v_results := v_results || jsonb_build_object(
        'row_index', v_row_index,
        'ok', false,
        'error', 'Esta persona ya está registrada en este evento'
      );
    END;
  END LOOP;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION bulk_check_and_create_registrations TO service_role;
ALTER FUNCTION bulk_check_and_create_registrations SET search_path = public;

-- =============================================================
-- Verificación:
-- SELECT normalize_match('Todo o Nada');  -- → 'todoonada'
-- SELECT normalize_match('VS');           -- → 'vs'
-- SELECT normalize_match(' UC ');         -- → 'uc'
-- =============================================================
