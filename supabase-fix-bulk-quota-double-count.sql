-- =============================================================
-- Fix: bulk_check_and_create_registrations quota double-count
-- Fecha: 2026-02-27
--
-- Problema:
-- La función sumaba conteos de DB + conteos acumulados del mismo lote.
-- En una transacción, los INSERT previos del lote ya son visibles en DB,
-- por lo que el acumulado adicional provoca doble conteo y rechazos falsos.
--
-- Síntoma típico:
-- max_per_organization = 2, lote de 2 filas válidas => falla la segunda
-- con "Se alcanzó el límite..." aun sin registros previos.
-- =============================================================

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
  -- Lock quota rules for this event (prevents race with concurrent requests)
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

    -- 1) Duplicado por profile/event
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

    -- 2) Cupos (si hay tipo_medio)
    IF v_tipo_medio IS NOT NULL THEN
      SELECT * INTO v_rule
      FROM event_quota_rules
      WHERE event_id = p_event_id
        AND tipo_medio = v_tipo_medio;

      IF FOUND THEN
        -- 2a) Límite por organización
        IF v_rule.max_per_organization > 0 AND v_organizacion IS NOT NULL THEN
          -- IMPORTANTE: este COUNT ya incluye filas insertadas previamente
          -- en esta misma transacción/lote.
          SELECT COUNT(*) INTO v_count_org
          FROM registrations
          WHERE event_id    = p_event_id
            AND tipo_medio   = v_tipo_medio
            AND organizacion = v_organizacion
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

        -- 2b) Límite global por tipo_medio
        IF COALESCE(v_rule.max_global, 0) > 0 THEN
          -- IMPORTANTE: este COUNT ya incluye filas insertadas previamente
          -- en esta misma transacción/lote.
          SELECT COUNT(*) INTO v_count_global
          FROM registrations
          WHERE event_id   = p_event_id
            AND tipo_medio = v_tipo_medio
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
