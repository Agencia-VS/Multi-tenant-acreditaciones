-- =============================================================
-- Módulo de Proveedores Autorizados (tenant_providers)
-- Rama: reservada
-- Fecha: 2026-03-02
--
-- ADITIVO PURO — No modifica tablas existentes.
-- Crea solo:
--   1. Tabla tenant_providers
--   2. Índices
--   3. RLS policies
--   4. Trigger updated_at
-- =============================================================

-- ─── 1. Tabla ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_providers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Status del proveedor
  status          varchar NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),

  -- Zonas autorizadas (matchean con tenant.config.zonas / event.config.zonas)
  allowed_zones   text[] NOT NULL DEFAULT '{}',

  -- Datos de la solicitud
  organizacion    varchar,           -- nombre de org al momento de solicitar
  mensaje         text,              -- mensaje del solicitante al admin

  -- Datos de gestión (admin)
  notas           text,              -- notas internas del admin
  approved_by     uuid REFERENCES auth.users(id),
  approved_at     timestamptz,
  rejected_at     timestamptz,
  motivo_rechazo  text,

  -- Timestamps
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  -- Un perfil solo puede ser proveedor una vez por tenant
  UNIQUE(tenant_id, profile_id)
);

COMMENT ON TABLE public.tenant_providers IS
  'Proveedores autorizados por tenant. Un proveedor aprobado puede acreditar personas en las zonas asignadas (allowed_zones). Activado por superadmin via tenant.config.provider_mode = approved_only.';

-- ─── 2. Índices ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tenant_providers_tenant_status
  ON public.tenant_providers(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_tenant_providers_profile
  ON public.tenant_providers(profile_id);

-- ─── 3. RLS ──────────────────────────────────────────────────

ALTER TABLE public.tenant_providers ENABLE ROW LEVEL SECURITY;

-- SELECT: el propio usuario (via su profile), admins del tenant, superadmins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenant_providers' AND policyname = 'providers_select'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "providers_select" ON public.tenant_providers
        FOR SELECT USING (
          profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          OR has_tenant_access(tenant_id)
          OR is_superadmin()
        )
    $policy$;
  END IF;
END $$;

-- INSERT: usuario autenticado puede solicitar acceso (solo status=pending, solo su propio profile)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenant_providers' AND policyname = 'providers_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "providers_insert" ON public.tenant_providers
        FOR INSERT WITH CHECK (
          profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          AND status = 'pending'
        )
    $policy$;
  END IF;
END $$;

-- UPDATE: admins del tenant o superadmin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenant_providers' AND policyname = 'providers_update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "providers_update" ON public.tenant_providers
        FOR UPDATE USING (
          can_edit_tenant(tenant_id)
          OR is_superadmin()
        )
    $policy$;
  END IF;
END $$;

-- DELETE: solo superadmin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenant_providers' AND policyname = 'providers_delete'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "providers_delete" ON public.tenant_providers
        FOR DELETE USING (
          is_superadmin()
        )
    $policy$;
  END IF;
END $$;

-- ─── 4. Trigger updated_at ──────────────────────────────────

-- Reutiliza la función moddatetime si existe, si no crea una simple
DO $$ BEGIN
  -- Verifica si ya existe un trigger igual
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_tenant_providers'
  ) THEN
    -- Crear función genérica si no existe
    CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;

    CREATE TRIGGER set_updated_at_tenant_providers
      BEFORE UPDATE ON public.tenant_providers
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_updated_at();
  END IF;
END $$;

-- ─── Verificación ────────────────────────────────────────────
-- Ejecutar después de la migración para confirmar:
-- SELECT count(*) FROM information_schema.tables WHERE table_name = 'tenant_providers';
-- SELECT count(*) FROM pg_policies WHERE tablename = 'tenant_providers';
