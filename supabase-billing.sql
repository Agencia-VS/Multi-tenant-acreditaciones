-- ============================================================================
-- M16 — Sistema de Billing
-- Migración: plans, subscriptions, usage_records, invoices
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- ─── 1. Tabla de Planes ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,                       -- "Free", "Pro", "Enterprise"
  slug        TEXT NOT NULL UNIQUE,                -- "free", "pro", "enterprise"
  description TEXT,
  
  -- Precios por moneda (centavos/unidades mínimas)
  price_monthly_clp   INTEGER NOT NULL DEFAULT 0,  -- Pesos chilenos
  price_monthly_brl   INTEGER NOT NULL DEFAULT 0,  -- Centavos de real
  price_monthly_usd   INTEGER NOT NULL DEFAULT 0,  -- Centavos de dólar

  -- IDs de Stripe Price por moneda
  stripe_price_id_clp TEXT,
  stripe_price_id_brl TEXT,
  stripe_price_id_usd TEXT,
  
  -- Límites del plan (JSONB para flexibilidad)
  limits      JSONB NOT NULL DEFAULT '{
    "max_events": 1,
    "max_registrations_per_event": 50,
    "max_admins": 1,
    "max_storage_mb": 100
  }'::jsonb,
  
  -- Metadata
  is_active   BOOLEAN NOT NULL DEFAULT true,
  is_free     BOOLEAN NOT NULL DEFAULT false,      -- Plan gratuito (no requiere pago)
  sort_order  INTEGER NOT NULL DEFAULT 0,
  features    JSONB DEFAULT '[]'::jsonb,           -- Lista de features para UI: ["QR Check-in", "Emails", ...]
  
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_plans_updated_at();

-- ─── 2. Tabla de Suscripciones ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id                 UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  
  -- Stripe references
  stripe_customer_id      TEXT,                     -- cus_xxx
  stripe_subscription_id  TEXT UNIQUE,              -- sub_xxx
  
  -- Estado de la suscripción
  status      TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'incomplete', 'unpaid')),
  
  -- Período de facturación
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  canceled_at             TIMESTAMPTZ,
  
  -- Moneda activa
  currency    TEXT NOT NULL DEFAULT 'CLP'
    CHECK (currency IN ('CLP', 'BRL', 'USD')),
  
  -- Metadata flexible
  metadata    JSONB DEFAULT '{}'::jsonb,
  
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Un tenant solo puede tener una suscripción activa
  CONSTRAINT subscriptions_tenant_unique UNIQUE (tenant_id)
);

-- Index para búsqueda por stripe_customer_id (webhooks)
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer 
  ON subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON subscriptions(status);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_subscriptions_updated_at();

-- ─── 3. Tabla de Registros de Uso ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usage_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Qué se mide
  metric        TEXT NOT NULL 
    CHECK (metric IN ('events', 'registrations', 'admins', 'storage_mb')),
  
  -- Valor actual (snapshot)
  current_value INTEGER NOT NULL DEFAULT 0,
  
  -- Período (para histórico)
  period_start  TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  period_end    TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Un solo registro por tenant/metric/período
  CONSTRAINT usage_records_unique UNIQUE (tenant_id, metric, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_records_tenant_metric
  ON usage_records(tenant_id, metric);

-- ─── 4. Tabla de Facturas (reflejo de Stripe) ──────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Stripe references
  stripe_invoice_id   TEXT UNIQUE,                  -- in_xxx
  stripe_event_id     TEXT UNIQUE,                  -- Para idempotencia de webhooks
  
  -- Datos de factura
  amount              INTEGER NOT NULL DEFAULT 0,   -- En unidades mínimas de la moneda
  currency            TEXT NOT NULL DEFAULT 'CLP',
  status              TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  
  -- Período facturado
  period_start        TIMESTAMPTZ,
  period_end          TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  
  -- URL para ver/descargar en Stripe
  hosted_invoice_url  TEXT,
  invoice_pdf_url     TEXT,
  
  -- Metadata
  metadata            JSONB DEFAULT '{}'::jsonb,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant
  ON invoices(tenant_id);

CREATE INDEX IF NOT EXISTS idx_invoices_stripe_id
  ON invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

-- ─── 5. RLS Policies ────────────────────────────────────────────────────────

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Plans: lectura pública (para pricing page), escritura solo service_role
CREATE POLICY plans_select_all ON plans
  FOR SELECT USING (true);

-- Subscriptions: solo el admin del tenant puede ver su propia suscripción
CREATE POLICY subscriptions_select_own ON subscriptions
  FOR SELECT USING (
    tenant_id IN (
      SELECT ta.tenant_id FROM tenant_admins ta WHERE ta.user_id = auth.uid()
    )
  );

-- Subscriptions: service_role para insert/update (webhooks)
CREATE POLICY subscriptions_service_all ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- Usage records: admin del tenant ve su propio uso
CREATE POLICY usage_records_select_own ON usage_records
  FOR SELECT USING (
    tenant_id IN (
      SELECT ta.tenant_id FROM tenant_admins ta WHERE ta.user_id = auth.uid()
    )
  );

CREATE POLICY usage_records_service_all ON usage_records
  FOR ALL USING (auth.role() = 'service_role');

-- Invoices: admin del tenant ve sus propias facturas
CREATE POLICY invoices_select_own ON invoices
  FOR SELECT USING (
    tenant_id IN (
      SELECT ta.tenant_id FROM tenant_admins ta WHERE ta.user_id = auth.uid()
    )
  );

CREATE POLICY invoices_service_all ON invoices
  FOR ALL USING (auth.role() = 'service_role');

-- ─── 6. Seed: Plan Free por defecto ─────────────────────────────────────────

INSERT INTO plans (name, slug, description, price_monthly_clp, price_monthly_brl, price_monthly_usd, limits, is_free, sort_order, features)
VALUES 
  ('Free', 'free', 'Plan gratuito para comenzar', 0, 0, 0, 
   '{"max_events": 2, "max_registrations_per_event": 50, "max_admins": 1, "max_storage_mb": 100}'::jsonb,
   true, 0,
   '["1 evento activo", "50 acreditados/evento", "1 administrador", "Emails de notificación"]'::jsonb),
   
  ('Pro', 'pro', 'Para organizaciones profesionales', 29990, 14990, 2990,
   '{"max_events": 10, "max_registrations_per_event": 500, "max_admins": 5, "max_storage_mb": 1000}'::jsonb,
   false, 1,
   '["10 eventos", "500 acreditados/evento", "5 administradores", "QR Check-in", "Emails personalizados", "Exportación Excel"]'::jsonb),
   
  ('Enterprise', 'enterprise', 'Sin límites, soporte dedicado', 99990, 49990, 9990,
   '{"max_events": -1, "max_registrations_per_event": -1, "max_admins": -1, "max_storage_mb": -1}'::jsonb,
   false, 2,
   '["Eventos ilimitados", "Acreditados ilimitados", "Admins ilimitados", "Soporte prioritario", "Dominio personalizado", "White-label"]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- ─── 7. Auto-assign: Plan Free a tenants existentes ─────────────────────────

-- Crear suscripción Free para todos los tenants que no tengan suscripción
INSERT INTO subscriptions (tenant_id, plan_id, status, currency)
SELECT t.id, p.id, 'active', 'CLP'
FROM tenants t
CROSS JOIN plans p
WHERE p.slug = 'free'
  AND NOT EXISTS (
    SELECT 1 FROM subscriptions s WHERE s.tenant_id = t.id
  );

-- ─── 8. Función helper: obtener límites del plan de un tenant ────────────────

CREATE OR REPLACE FUNCTION get_tenant_plan_limits(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits JSONB;
BEGIN
  SELECT p.limits INTO v_limits
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.tenant_id = p_tenant_id
    AND s.status IN ('active', 'trialing')
  LIMIT 1;
  
  -- Si no tiene suscripción, devolver límites del plan free
  IF v_limits IS NULL THEN
    SELECT p.limits INTO v_limits
    FROM plans p WHERE p.slug = 'free';
  END IF;
  
  RETURN COALESCE(v_limits, '{"max_events": 1, "max_registrations_per_event": 50, "max_admins": 1, "max_storage_mb": 100}'::jsonb);
END;
$$;

-- ─── 9. Vista para SuperAdmin: resumen de billing ────────────────────────────

CREATE OR REPLACE VIEW v_billing_summary AS
SELECT 
  t.id AS tenant_id,
  t.nombre AS tenant_nombre,
  t.slug AS tenant_slug,
  t.activo AS tenant_activo,
  p.name AS plan_name,
  p.slug AS plan_slug,
  p.limits AS plan_limits,
  s.status AS subscription_status,
  s.stripe_customer_id,
  s.stripe_subscription_id,
  s.current_period_end,
  s.currency,
  s.created_at AS subscription_created_at,
  -- Contadores de uso actual
  (SELECT COUNT(*) FROM events e WHERE e.tenant_id = t.id)::INTEGER AS current_events,
  (SELECT COUNT(*) FROM tenant_admins ta WHERE ta.tenant_id = t.id)::INTEGER AS current_admins,
  -- Último pago
  (SELECT i.paid_at FROM invoices i WHERE i.tenant_id = t.id AND i.status = 'paid' ORDER BY i.paid_at DESC LIMIT 1) AS last_payment_at,
  (SELECT i.amount FROM invoices i WHERE i.tenant_id = t.id AND i.status = 'paid' ORDER BY i.paid_at DESC LIMIT 1) AS last_payment_amount
FROM tenants t
LEFT JOIN subscriptions s ON s.tenant_id = t.id
LEFT JOIN plans p ON p.id = s.plan_id
ORDER BY t.nombre;

-- Permisos
GRANT SELECT ON plans TO anon, authenticated;
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT ON usage_records TO authenticated;
GRANT SELECT ON invoices TO authenticated;
GRANT SELECT ON v_billing_summary TO authenticated;

-- ============================================================================
-- FIN M16 — Billing Migration
-- ============================================================================
