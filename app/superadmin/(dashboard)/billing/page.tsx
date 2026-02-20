'use client';

/**
 * SuperAdmin — Billing & Planes
 * Vista completa: gestión de planes, estado de suscripciones, asignación manual
 */
import { useState, useEffect, useCallback } from 'react';
import { useToast, PageHeader, Modal, LoadingSpinner, FormActions, ButtonSpinner } from '@/components/shared/ui';
import type { Plan, PlanLimits } from '@/types';

interface BillingSummaryRow {
  tenant_id: string;
  tenant_nombre: string;
  tenant_slug: string;
  tenant_activo: boolean;
  plan_name: string | null;
  plan_slug: string | null;
  plan_limits: PlanLimits | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  currency: string | null;
  subscription_created_at: string | null;
  current_events: number;
  current_admins: number;
  last_payment_at: string | null;
  last_payment_amount: number | null;
}

const defaultLimits: PlanLimits = {
  max_events: 1,
  max_registrations_per_event: 50,
  max_admins: 1,
  max_storage_mb: 100,
};

const emptyPlan = {
  name: '',
  slug: '',
  description: '',
  price_monthly_clp: 0,
  price_monthly_brl: 0,
  price_monthly_usd: 0,
  stripe_price_id_clp: '',
  stripe_price_id_brl: '',
  stripe_price_id_usd: '',
  limits: { ...defaultLimits },
  is_free: false,
  sort_order: 0,
  features: [] as string[],
};

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-success-light', text: 'text-success-dark', label: 'Activo' },
    trialing: { bg: 'bg-info-light', text: 'text-info-dark', label: 'Trial' },
    past_due: { bg: 'bg-warn-light', text: 'text-warn-dark', label: 'Pago pendiente' },
    canceled: { bg: 'bg-subtle', text: 'text-muted', label: 'Cancelado' },
    unpaid: { bg: 'bg-danger-light', text: 'text-danger', label: 'Sin pago' },
    incomplete: { bg: 'bg-warn-light', text: 'text-warn-dark', label: 'Incompleto' },
  };
  const s = map[status || ''] || { bg: 'bg-subtle', text: 'text-muted', label: status || 'Sin plan' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [summary, setSummary] = useState<BillingSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'tenants' | 'plans'>('tenants');
  
  // Plan form
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [featureInput, setFeatureInput] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Assign plan
  const [assigningTenant, setAssigningTenant] = useState<BillingSummaryRow | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const { showSuccess, showError } = useToast();

  const loadData = useCallback(async () => {
    try {
      const [plansRes, summaryRes] = await Promise.all([
        fetch('/api/billing?action=plans'),
        fetch('/api/billing?action=summary'),
      ]);
      if (plansRes.ok) setPlans(await plansRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } catch {
      showError('Error cargando datos de billing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      price_monthly_clp: plan.price_monthly_clp,
      price_monthly_brl: plan.price_monthly_brl,
      price_monthly_usd: plan.price_monthly_usd,
      stripe_price_id_clp: plan.stripe_price_id_clp || '',
      stripe_price_id_brl: plan.stripe_price_id_brl || '',
      stripe_price_id_usd: plan.stripe_price_id_usd || '',
      limits: plan.limits || { ...defaultLimits },
      is_free: plan.is_free,
      sort_order: plan.sort_order,
      features: Array.isArray(plan.features) ? plan.features : [],
    });
    setShowPlanForm(true);
  };

  const handleNewPlan = () => {
    setEditingPlan(null);
    setPlanForm(emptyPlan);
    setShowPlanForm(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/billing/plans', {
        method: editingPlan ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...planForm,
          id: editingPlan?.id,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error guardando plan');
      }
      showSuccess(editingPlan ? 'Plan actualizado' : 'Plan creado');
      setShowPlanForm(false);
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignPlan = async () => {
    if (!assigningTenant || !selectedPlanId) return;
    setAssignLoading(true);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          tenant_id: assigningTenant.tenant_id,
          plan_id: selectedPlanId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error');
      }
      showSuccess(`Plan asignado a ${assigningTenant.tenant_nombre}`);
      setAssigningTenant(null);
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error asignando plan');
    } finally {
      setAssignLoading(false);
    }
  };

  const addFeature = () => {
    if (featureInput.trim()) {
      setPlanForm(prev => ({ ...prev, features: [...prev.features, featureInput.trim()] }));
      setFeatureInput('');
    }
  };

  const removeFeature = (idx: number) => {
    setPlanForm(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== idx) }));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle="Gestión de planes, suscripciones y facturación"
      />

      {/* Toggle vista */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveView('tenants')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeView === 'tenants' ? 'bg-brand text-white' : 'bg-subtle text-body hover:bg-edge'
          }`}
        >
          <i className="fas fa-building mr-2" />
          Suscripciones ({summary.length})
        </button>
        <button
          onClick={() => setActiveView('plans')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeView === 'plans' ? 'bg-brand text-white' : 'bg-subtle text-body hover:bg-edge'
          }`}
        >
          <i className="fas fa-tags mr-2" />
          Planes ({plans.length})
        </button>
      </div>

      {/* ═══ Vista: Suscripciones por Tenant ═══ */}
      {activeView === 'tenants' && (
        <div className="bg-surface rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-canvas text-label text-left">
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Eventos</th>
                <th className="px-4 py-3 font-medium">Admins</th>
                <th className="px-4 py-3 font-medium">Último pago</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.tenant_id} className="border-t border-edge hover:bg-canvas/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-heading">{row.tenant_nombre}</div>
                    <div className="text-xs text-muted">/{row.tenant_slug}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-heading">
                    {row.plan_name || <span className="text-muted">Sin plan</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.subscription_status} />
                  </td>
                  <td className="px-4 py-3 text-body">
                    {row.current_events}
                    {row.plan_limits && row.plan_limits.max_events !== -1 && (
                      <span className="text-muted">/{row.plan_limits.max_events}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-body">
                    {row.current_admins}
                    {row.plan_limits && row.plan_limits.max_admins !== -1 && (
                      <span className="text-muted">/{row.plan_limits.max_admins}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-body text-xs">
                    {row.last_payment_at
                      ? new Date(row.last_payment_at).toLocaleDateString('es-CL')
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setAssigningTenant(row);
                        setSelectedPlanId(plans.find(p => p.name === row.plan_name)?.id || '');
                      }}
                      className="px-3 py-1.5 bg-accent-light text-brand rounded-lg text-xs hover:bg-info-light transition"
                    >
                      <i className="fas fa-exchange-alt mr-1" />
                      Cambiar plan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ Vista: Gestión de Planes ═══ */}
      {activeView === 'plans' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={handleNewPlan}
              className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand/90 transition"
            >
              <i className="fas fa-plus mr-2" />
              Nuevo Plan
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const limits = plan.limits as PlanLimits;
              const features: string[] = Array.isArray(plan.features) ? plan.features : [];
              return (
                <div key={plan.id} className="bg-surface rounded-xl border p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-heading">{plan.name}</h3>
                    <button
                      onClick={() => handleEditPlan(plan)}
                      className="px-2 py-1 bg-subtle text-muted rounded hover:bg-edge transition text-xs"
                    >
                      <i className="fas fa-edit" />
                    </button>
                  </div>
                  <p className="text-sm text-muted">{plan.description}</p>
                  
                  <div className="mt-3">
                    {plan.is_free ? (
                      <span className="text-xl font-bold text-heading">Gratis</span>
                    ) : (
                      <span className="text-xl font-bold text-heading">
                        ${plan.price_monthly_clp.toLocaleString('es-CL')} <span className="text-sm font-normal text-muted">CLP/mes</span>
                      </span>
                    )}
                  </div>

                  <div className="mt-3 text-xs text-muted space-y-1">
                    <p>Eventos: {limits.max_events === -1 ? '∞' : limits.max_events}</p>
                    <p>Acreditados/evento: {limits.max_registrations_per_event === -1 ? '∞' : limits.max_registrations_per_event}</p>
                    <p>Admins: {limits.max_admins === -1 ? '∞' : limits.max_admins}</p>
                    <p>Storage: {limits.max_storage_mb === -1 ? '∞' : limits.max_storage_mb} MB</p>
                  </div>

                  {features.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {features.map((f, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-body">
                          <i className="fas fa-check text-success text-[10px]" /> {f}
                        </li>
                      ))}
                    </ul>
                  )}

                  {plan.stripe_price_id_clp && (
                    <p className="mt-2 text-[10px] text-muted truncate" title={plan.stripe_price_id_clp}>
                      Stripe: {plan.stripe_price_id_clp}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Modal: Editar/Crear Plan ═══ */}
      <Modal
        open={showPlanForm}
        onClose={() => setShowPlanForm(false)}
        title={editingPlan ? `Editar plan: ${editingPlan.name}` : 'Nuevo Plan'}
      >
        <form onSubmit={handleSavePlan} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-label mb-1">Nombre</label>
              <input
                type="text"
                required
                value={planForm.name}
                onChange={(e) => setPlanForm(prev => ({
                  ...prev,
                  name: e.target.value,
                  slug: !editingPlan ? e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') : prev.slug,
                }))}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-label mb-1">Slug</label>
              <input
                type="text"
                required
                value={planForm.slug}
                disabled={!!editingPlan}
                onChange={(e) => setPlanForm(prev => ({ ...prev, slug: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading disabled:bg-subtle"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-label mb-1">Descripción</label>
            <input
              type="text"
              value={planForm.description}
              onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-label mb-1">CLP/mes</label>
              <input
                type="number"
                value={planForm.price_monthly_clp}
                onChange={(e) => setPlanForm(prev => ({ ...prev, price_monthly_clp: +e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-label mb-1">BRL/mes</label>
              <input
                type="number"
                value={planForm.price_monthly_brl}
                onChange={(e) => setPlanForm(prev => ({ ...prev, price_monthly_brl: +e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-label mb-1">USD/mes</label>
              <input
                type="number"
                value={planForm.price_monthly_usd}
                onChange={(e) => setPlanForm(prev => ({ ...prev, price_monthly_usd: +e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-label mb-1">Stripe Price ID (CLP)</label>
              <input
                type="text"
                value={planForm.stripe_price_id_clp}
                onChange={(e) => setPlanForm(prev => ({ ...prev, stripe_price_id_clp: e.target.value }))}
                placeholder="price_xxx"
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-label mb-1">Stripe Price ID (BRL)</label>
              <input
                type="text"
                value={planForm.stripe_price_id_brl}
                onChange={(e) => setPlanForm(prev => ({ ...prev, stripe_price_id_brl: e.target.value }))}
                placeholder="price_xxx"
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-label mb-1">Stripe Price ID (USD)</label>
              <input
                type="text"
                value={planForm.stripe_price_id_usd}
                onChange={(e) => setPlanForm(prev => ({ ...prev, stripe_price_id_usd: e.target.value }))}
                placeholder="price_xxx"
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading text-sm"
              />
            </div>
          </div>

          <div className="p-4 bg-canvas rounded-xl">
            <h4 className="text-sm font-semibold text-label mb-3">Límites del plan</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'max_events' as const, label: 'Máx eventos', hint: '-1 = ilimitado' },
                { key: 'max_registrations_per_event' as const, label: 'Máx acreditados/evento', hint: '-1 = ilimitado' },
                { key: 'max_admins' as const, label: 'Máx admins', hint: '-1 = ilimitado' },
                { key: 'max_storage_mb' as const, label: 'Máx storage (MB)', hint: '-1 = ilimitado' },
              ].map(({ key, label, hint }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-label mb-0.5">{label}</label>
                  <input
                    type="number"
                    value={planForm.limits[key]}
                    onChange={(e) => setPlanForm(prev => ({
                      ...prev,
                      limits: { ...prev.limits, [key]: +e.target.value }
                    }))}
                    className="w-full px-3 py-2 rounded-lg border border-field-border text-heading text-sm"
                  />
                  <p className="text-[10px] text-muted mt-0.5">{hint}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-label mb-1">Features (para UI)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                placeholder="Ej: QR Check-in"
                className="flex-1 px-3 py-2 rounded-lg border border-field-border text-heading text-sm"
              />
              <button type="button" onClick={addFeature} className="px-3 py-2 bg-brand text-white rounded-lg text-sm">
                <i className="fas fa-plus" />
              </button>
            </div>
            {planForm.features.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {planForm.features.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-subtle rounded-full text-xs text-body">
                    {f}
                    <button type="button" onClick={() => removeFeature(i)} className="text-muted hover:text-danger">
                      <i className="fas fa-times text-[10px]" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={planForm.is_free}
              onChange={(e) => setPlanForm(prev => ({ ...prev, is_free: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-label">Plan gratuito (no requiere pago)</span>
          </label>

          <FormActions
            saving={saving}
            onCancel={() => setShowPlanForm(false)}
            submitLabel={editingPlan ? 'Actualizar Plan' : 'Crear Plan'}
          />
        </form>
      </Modal>

      {/* ═══ Modal: Asignar Plan a Tenant ═══ */}
      <Modal
        open={!!assigningTenant}
        onClose={() => setAssigningTenant(null)}
        title={`Cambiar plan: ${assigningTenant?.tenant_nombre}`}
      >
        {assigningTenant && (
          <div className="space-y-4">
            <p className="text-sm text-body">
              Plan actual: <strong>{assigningTenant.plan_name || 'Ninguno'}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-label mb-1">Nuevo plan</label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              >
                <option value="">Seleccionar plan...</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.is_free ? 'Gratis' : `$${p.price_monthly_clp.toLocaleString('es-CL')} CLP/mes`}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAssigningTenant(null)}
                className="flex-1 px-4 py-2.5 bg-subtle text-body rounded-lg text-sm font-medium hover:bg-edge transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedPlanId || assignLoading}
                onClick={handleAssignPlan}
                className="flex-1 px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand/90 disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                {assignLoading ? <><ButtonSpinner /> Asignando...</> : (
                  <><i className="fas fa-check mr-1" /> Asignar plan</>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
