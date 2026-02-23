-- =============================================================
-- Bulk Registration RPC — Optimized batch accreditation
-- =============================================================
-- Replaces N individual check_and_create_registration() calls
-- with a single RPC that processes the entire batch in one
-- transaction. Same checks (duplicate, quota per org, quota
-- global) but ~50x faster for large batches.
--
-- Input:  JSONB array of registrations to create
-- Output: JSONB array of results per row (ok/error)
--
-- Each element in p_rows must have:
--   profile_id   UUID   (required)
--   organizacion TEXT   (optional)
--   tipo_medio   TEXT   (optional)
--   cargo        TEXT   (optional)
--   datos_extra  JSONB  (optional)
--   row_index    INT    (original row position for result mapping)
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
  v_inserted_count_by_tipo   JSONB := '{}'::jsonb;  -- running total per tipo_medio
  v_inserted_count_by_org    JSONB := '{}'::jsonb;  -- running total per tipo_medio+org
BEGIN
  -- Lock all quota rules for this event upfront (prevents race conditions
  -- with concurrent requests while we process the batch)
  PERFORM 1 FROM event_quota_rules
  WHERE event_id = p_event_id
  FOR UPDATE;

  -- Process each row sequentially within this single transaction
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_profile_id   := (v_row->>'profile_id')::UUID;
    v_organizacion := v_row->>'organizacion';
    v_tipo_medio   := v_row->>'tipo_medio';
    v_cargo        := v_row->>'cargo';
    v_datos_extra  := COALESCE(v_row->'datos_extra', 'null'::jsonb);
    v_row_index    := COALESCE((v_row->>'row_index')::INT, 0);

    -- ── 1. Check duplicate (existing in DB + already inserted in this batch) ──
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

    -- ── 2. Check quotas (only if tipo_medio is provided) ──
    IF v_tipo_medio IS NOT NULL THEN
      SELECT * INTO v_rule
      FROM event_quota_rules
      WHERE event_id = p_event_id
        AND tipo_medio = v_tipo_medio;

      IF FOUND THEN
        -- 2a. Per-organization limit
        IF v_rule.max_per_organization > 0 AND v_organizacion IS NOT NULL THEN
          -- Count existing in DB
          SELECT COUNT(*) INTO v_count_org
          FROM registrations
          WHERE event_id    = p_event_id
            AND tipo_medio   = v_tipo_medio
            AND organizacion = v_organizacion
            AND status      != 'rechazado';

          -- Add running count from this batch (tipo_medio + org combo)
          v_count_org := v_count_org + COALESCE(
            (v_inserted_count_by_org->(v_tipo_medio || '::' || v_organizacion))::INT, 0
          );

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

        -- 2b. Global limit per tipo_medio
        IF COALESCE(v_rule.max_global, 0) > 0 THEN
          SELECT COUNT(*) INTO v_count_global
          FROM registrations
          WHERE event_id  = p_event_id
            AND tipo_medio = v_tipo_medio
            AND status     != 'rechazado';

          -- Add running count from this batch
          v_count_global := v_count_global + COALESCE(
            (v_inserted_count_by_tipo->v_tipo_medio)::INT, 0
          );

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

    -- ── 3. Insert registration ──
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

      -- Update running counters
      IF v_tipo_medio IS NOT NULL THEN
        v_inserted_count_by_tipo := jsonb_set(
          v_inserted_count_by_tipo,
          ARRAY[v_tipo_medio],
          to_jsonb(COALESCE((v_inserted_count_by_tipo->v_tipo_medio)::INT, 0) + 1)
        );

        IF v_organizacion IS NOT NULL THEN
          v_inserted_count_by_org := jsonb_set(
            v_inserted_count_by_org,
            ARRAY[v_tipo_medio || '::' || v_organizacion],
            to_jsonb(COALESCE((v_inserted_count_by_org->(v_tipo_medio || '::' || v_organizacion))::INT, 0) + 1)
          );
        END IF;
      END IF;

      v_results := v_results || jsonb_build_object(
        'row_index', v_row_index,
        'ok', true,
        'reg_id', v_reg_id
      );

    EXCEPTION WHEN unique_violation THEN
      -- Safety net: unique index caught a duplicate we missed
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

-- ── Permissions ──
GRANT EXECUTE ON FUNCTION bulk_check_and_create_registrations TO service_role;

-- ── Security: fix search_path ──
ALTER FUNCTION bulk_check_and_create_registrations SET search_path = public;
