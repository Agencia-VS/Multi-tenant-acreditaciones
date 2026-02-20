'use client';

/**
 * AdminPlanTab — Tab de Plan y Uso para Admin Tenant
 * Muestra: plan actual, barras de uso, historial de facturas, acceso a Stripe Portal
 */
import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from './AdminContext';
import { LoadingSpinner, useToast } from '@/components/shared/ui';
import type { UsageSummary, Plan, Invoice } from '@/types';

function UsageBar({ label, current, limit }: { label: string; current: number; limit: number }) {
  const isUnlimited = limit === -1;
  const pct = isUnlimited ? 0 : limit > 0 ? Math.min(Math.round((current / limit) * 100), 100) : 0;
  const isWarning = pct >= 80 && pct < 100;
  const isDanger = pct >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-label">{label}</span>
        <span className={`font-semibold ${isDanger ? 'text-danger' : isWarning ? 'text-warn-dark' : 'text-heading'}`}>
          {current} / {isUnlimited ? '∞' : limit}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2.5 bg-subtle rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isDanger ? 'bg-danger' : isWarning ? 'bg-yellow-500' : 'bg-brand'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {isUnlimited && (
        <div className="h-2.5 bg-success-light rounded-full">
          <div className="h-full w-full rounded-full bg-success/30" />
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan, isCurrent, onUpgrade }: { plan: Plan; isCurrent: boolean; onUpgrade: (slug: string) => void }) {
  const features: string[] = Array.isArray(plan.features) ? plan.features : [];
  const price = plan.price_monthly_clp;

  return (
    <div className={`relative p-5 rounded-xl border-2 transition ${
      isCurrent ? 'border-brand bg-accent-light' : 'border-edge bg-surface hover:border-brand/50'
    }`}>
      {isCurrent && (
        <div className="absolute -top-3 left-4 px-3 py-0.5 bg-brand text-white text-xs font-semibold rounded-full">
          Plan actual
        </div>
      )}
      <h3 className="text-lg font-bold text-heading mt-1">{plan.name}</h3>
      <p className="text-sm text-muted mt-1">{plan.description}</p>
      
      <div className="mt-4">
        {plan.is_free ? (
          <div className="text-2xl font-bold text-heading">Gratis</div>
        ) : (
          <div>
            <span className="text-2xl font-bold text-heading">${price.toLocaleString('es-CL')}</span>
            <span className="text-sm text-muted"> CLP/mes</span>
          </div>
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-body">
            <i className="fas fa-check text-success mt-0.5 text-xs" />
            {f}
          </li>
        ))}
      </ul>

      {!isCurrent && !plan.is_free && (
        <button
          onClick={() => onUpgrade(plan.slug)}
          className="mt-4 w-full py-2.5 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand/90 transition"
        >
          <i className="fas fa-arrow-up mr-2" />
          Upgrade a {plan.name}
        </button>
      )}
    </div>
  );
}

export default function AdminPlanTab() {
  const { tenant } = useAdmin();
  const { showSuccess, showError } = useToast();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tenant) return;
    try {
      const [usageRes, plansRes] = await Promise.all([
        fetch(`/api/billing?action=usage&tenant_id=${tenant.id}`),
        fetch('/api/billing?action=plans'),
      ]);
      if (usageRes.ok) setUsage(await usageRes.json());
      if (plansRes.ok) setPlans(await plansRes.json());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpgrade = async (planSlug: string) => {
    if (!tenant) return;
    setCheckoutLoading(planSlug);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkout',
          tenant_id: tenant.id,
          plan_slug: planSlug,
          currency: 'CLP',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Redirigir a Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al iniciar checkout');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    if (!tenant) return;
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'portal',
          tenant_id: tenant.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al abrir portal de facturación');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!usage) return <p className="text-muted text-center py-8">No se pudo cargar la información del plan</p>;

  const { plan, metrics, is_free } = usage;

  return (
    <div className="space-y-8">
      {/* ═══ Plan Actual + Uso ═══ */}
      <div className="bg-surface rounded-xl border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-heading flex items-center gap-2">
              <i className="fas fa-crown text-yellow-500" />
              Plan {plan.name}
            </h2>
            <p className="text-sm text-muted mt-1">{plan.description}</p>
          </div>
          {!is_free && (
            <button
              onClick={handlePortal}
              className="px-4 py-2 bg-subtle text-body rounded-lg text-sm hover:bg-edge transition flex items-center gap-2"
            >
              <i className="fas fa-external-link-alt" />
              Gestionar facturación
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <UsageBar
            label={metrics.events.label}
            current={metrics.events.current}
            limit={metrics.events.limit}
          />
          <UsageBar
            label={metrics.admins.label}
            current={metrics.admins.current}
            limit={metrics.admins.limit}
          />
          <UsageBar
            label={metrics.registrations_per_event.label}
            current={metrics.registrations_per_event.current}
            limit={metrics.registrations_per_event.limit}
          />
          <UsageBar
            label={metrics.storage_mb.label}
            current={metrics.storage_mb.current}
            limit={metrics.storage_mb.limit}
          />
        </div>
      </div>

      {/* ═══ Planes Disponibles ═══ */}
      <div>
        <h3 className="text-lg font-bold text-heading mb-4">
          <i className="fas fa-th-large mr-2 text-muted" />
          Planes disponibles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              isCurrent={p.id === plan.id}
              onUpgrade={handleUpgrade}
            />
          ))}
        </div>
      </div>

      {/* ═══ Info de Contacto para Enterprise ═══ */}
      <div className="bg-canvas rounded-xl border border-dashed border-edge p-6 text-center">
        <i className="fas fa-headset text-3xl text-muted mb-3" />
        <h4 className="font-semibold text-heading">¿Necesitas un plan personalizado?</h4>
        <p className="text-sm text-muted mt-1">
          Contacta a nuestro equipo para un plan a medida con soporte dedicado.
        </p>
        <a
          href="mailto:contacto@accredia.cl"
          className="inline-block mt-3 px-5 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand/90 transition"
        >
          <i className="fas fa-envelope mr-2" />
          Contactar ventas
        </a>
      </div>
    </div>
  );
}
