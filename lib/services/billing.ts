/**
 * Servicio de Billing — Planes, Suscripciones, Límites y Stripe
 * 
 * Patrón: Stripe es la fuente de verdad para pagos.
 * Supabase refleja el estado vía webhooks.
 * Los límites se verifican localmente (sin llamar a Stripe en cada request).
 */

import Stripe from 'stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { Plan, Subscription, BillingLimitCheck, UsageSummary, PlanLimits } from '@/types';

// ─── Supabase helper para tablas de billing (no están en database.types.ts) ──
// Las tablas plans, subscriptions, usage_records, invoices y v_billing_summary
// se crearon via migración SQL pero aún no se regeneraron los tipos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function billingClient() {
  return createSupabaseAdminClient() as any;
}

// ─── Stripe Client (lazy init) ──────────────────────────────────────────────

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY no configurada');
    _stripe = new Stripe(key, { apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

// ─── Plan Management ─────────────────────────────────────────────────────────

/**
 * Listar todos los planes activos (para pricing page / UI)
 */
export async function listPlans(): Promise<Plan[]> {
  const sb = billingClient();
  const { data, error } = await sb
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw new Error(`Error listando planes: ${error.message}`);
  return (data || []) as Plan[];
}

/**
 * Obtener plan por slug
 */
export async function getPlanBySlug(slug: string): Promise<Plan | null> {
  const sb = billingClient();
  const { data, error } = await sb
    .from('plans')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data as Plan;
}

/**
 * Obtener plan por ID
 */
export async function getPlanById(planId: string): Promise<Plan | null> {
  const sb = billingClient();
  const { data, error } = await sb
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (error || !data) return null;
  return data as Plan;
}

/**
 * Crear/actualizar plan (SuperAdmin)
 */
export async function upsertPlan(plan: Partial<Plan> & { name: string; slug: string }): Promise<Plan> {
  const sb = billingClient();
  
  const { data, error } = await sb
    .from('plans')
    .upsert({
      ...plan,
      limits: plan.limits || { max_events: 1, max_registrations_per_event: 50, max_admins: 1, max_storage_mb: 100 },
    }, { onConflict: 'slug' })
    .select()
    .single();

  if (error) throw new Error(`Error guardando plan: ${error.message}`);
  return data as Plan;
}

// ─── Subscription Management ─────────────────────────────────────────────────

/**
 * Obtener suscripción de un tenant
 */
export async function getTenantSubscription(tenantId: string): Promise<(Subscription & { plan: Plan }) | null> {
  const sb = billingClient();
  const { data, error } = await sb
    .from('subscriptions')
    .select('*, plan:plans(*)')
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) return null;
  return data as Subscription & { plan: Plan };
}

/**
 * Obtener el plan activo de un tenant (con fallback a Free)
 */
export async function getTenantPlan(tenantId: string): Promise<Plan> {
  const sub = await getTenantSubscription(tenantId);
  if (sub?.plan && ['active', 'trialing'].includes(sub.status)) {
    return sub.plan;
  }
  // Fallback: plan free
  const freePlan = await getPlanBySlug('free');
  if (!freePlan) throw new Error('Plan Free no encontrado — ejecutar migración billing');
  return freePlan;
}

/**
 * Asignar plan a un tenant (manual, SuperAdmin)
 */
export async function assignPlanToTenant(
  tenantId: string,
  planId: string,
  opts?: { currency?: string; stripeCustomerId?: string; stripeSubscriptionId?: string }
): Promise<Subscription> {
  const sb = billingClient();
  
  const { data, error } = await sb
    .from('subscriptions')
    .upsert({
      tenant_id: tenantId,
      plan_id: planId,
      status: 'active',
      currency: opts?.currency || 'CLP',
      stripe_customer_id: opts?.stripeCustomerId || null,
      stripe_subscription_id: opts?.stripeSubscriptionId || null,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'tenant_id' })
    .select()
    .single();

  if (error) throw new Error(`Error asignando plan: ${error.message}`);
  return data as Subscription;
}

/**
 * Auto-assign plan Free al crear un tenant
 */
export async function assignFreePlan(tenantId: string): Promise<Subscription | null> {
  const freePlan = await getPlanBySlug('free');
  if (!freePlan) return null;
  return assignPlanToTenant(tenantId, freePlan.id);
}

// ─── Limit Checking ──────────────────────────────────────────────────────────

/**
 * Verificar si un tenant puede crear más recursos de un tipo.
 * Retorna rápido consultando solo Supabase (no Stripe).
 * 
 * @param tenantId - ID del tenant
 * @param metric - Tipo de recurso: 'events' | 'registrations' | 'admins' | 'storage_mb'
 * @param eventId - Solo para 'registrations': ID del evento para contar registros de ese evento
 */
export async function checkLimit(
  tenantId: string,
  metric: 'events' | 'registrations' | 'admins' | 'storage_mb',
  eventId?: string
): Promise<BillingLimitCheck> {
  const typedSb = createSupabaseAdminClient();

  // 1. Obtener plan y suscripción
  const sub = await getTenantSubscription(tenantId);
  const plan = sub?.plan || await getPlanBySlug('free');
  if (!plan) {
    return { allowed: false, current: 0, limit: 0, metric, plan_name: 'Unknown', message: 'Sin plan configurado' };
  }

  const limits: PlanLimits = plan.limits as PlanLimits;
  
  // 2. Verificar si la suscripción está activa (solo si es plan de pago)
  if (!plan.is_free && sub && !['active', 'trialing'].includes(sub.status)) {
    return {
      allowed: false,
      current: 0,
      limit: 0,
      metric,
      plan_name: plan.name,
      message: `Suscripción ${sub.status === 'past_due' ? 'con pago pendiente' : 'inactiva'}. Actualiza tu método de pago.`,
      subscription_status: sub.status,
    };
  }

  // 3. Obtener uso actual según métrica
  let current = 0;
  let limit = 0;

  switch (metric) {
    case 'events': {
      const { count } = await typedSb
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      current = count || 0;
      limit = limits.max_events ?? 1;
      break;
    }
    case 'registrations': {
      if (!eventId) {
        return { allowed: false, current: 0, limit: 0, metric, plan_name: plan.name, message: 'event_id requerido para verificar registrations' };
      }
      const { count } = await typedSb
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId);
      current = count || 0;
      limit = limits.max_registrations_per_event ?? 50;
      break;
    }
    case 'admins': {
      const { count } = await typedSb
        .from('tenant_admins')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      current = count || 0;
      limit = limits.max_admins ?? 1;
      break;
    }
    case 'storage_mb': {
      // TODO: Implementar conteo real de storage
      current = 0;
      limit = limits.max_storage_mb ?? 100;
      break;
    }
  }

  // -1 = ilimitado
  if (limit === -1) {
    return { allowed: true, current, limit: -1, metric, plan_name: plan.name, message: 'Sin límite' };
  }

  const allowed = current < limit;
  const pct = limit > 0 ? Math.round((current / limit) * 100) : 0;

  return {
    allowed,
    current,
    limit,
    metric,
    plan_name: plan.name,
    percentage: pct,
    message: allowed
      ? (pct >= 80 ? `Estás al ${pct}% del límite de ${metric} de tu plan ${plan.name}` : 'OK')
      : `Has alcanzado el límite de ${metric} de tu plan ${plan.name} (${current}/${limit}). Actualiza a un plan superior.`,
    subscription_status: sub?.status,
  };
}

// ─── Usage Tracking ──────────────────────────────────────────────────────────

/**
 * Registrar/actualizar uso actual de una métrica
 */
export async function recordUsage(
  tenantId: string,
  metric: 'events' | 'registrations' | 'admins' | 'storage_mb',
  value: number
): Promise<void> {
  const sb = billingClient();
  
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const { error } = await sb
    .from('usage_records')
    .upsert({
      tenant_id: tenantId,
      metric,
      current_value: value,
      period_start: periodStart.toISOString(),
      period_end: new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1).toISOString(),
    }, { onConflict: 'tenant_id,metric,period_start' });

  if (error) console.error(`Error registrando uso: ${error.message}`);
}

/**
 * Obtener resumen de uso del tenant
 */
export async function getUsageSummary(tenantId: string): Promise<UsageSummary> {
  const typedSb = createSupabaseAdminClient();
  const plan = await getTenantPlan(tenantId);
  const limits = plan.limits as PlanLimits;

  // Contar uso real en paralelo
  const [eventsCount, adminsCount] = await Promise.all([
    typedSb.from('events').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    typedSb.from('tenant_admins').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ]);

  const metrics = {
    events: {
      current: eventsCount.count || 0,
      limit: limits.max_events ?? 1,
      label: 'Eventos',
    },
    registrations_per_event: {
      current: 0, // Se calcula por evento
      limit: limits.max_registrations_per_event ?? 50,
      label: 'Acreditados / evento',
    },
    admins: {
      current: adminsCount.count || 0,
      limit: limits.max_admins ?? 1,
      label: 'Administradores',
    },
    storage_mb: {
      current: 0, // TODO
      limit: limits.max_storage_mb ?? 100,
      label: 'Almacenamiento (MB)',
    },
  };

  return {
    plan,
    metrics,
    is_free: plan.is_free,
  };
}

// ─── Stripe Checkout ─────────────────────────────────────────────────────────

/**
 * Crear sesión de Stripe Checkout para upgrade de plan
 */
export async function createCheckoutSession(
  tenantId: string,
  planSlug: string,
  currency: 'CLP' | 'BRL' | 'USD' = 'CLP'
): Promise<{ url: string }> {
  const stripe = getStripe();
  const plan = await getPlanBySlug(planSlug);
  if (!plan) throw new Error('Plan no encontrado');
  if (plan.is_free) throw new Error('No se puede comprar el plan Free');

  // Determinar precio según moneda
  const priceIdKey = `stripe_price_id_${currency.toLowerCase()}` as keyof Plan;
  const stripePriceId = plan[priceIdKey] as string;
  if (!stripePriceId) throw new Error(`Precio en ${currency} no configurado para plan ${plan.name}`);

  // Obtener o crear Stripe Customer
  const sub = await getTenantSubscription(tenantId);
  let customerId = sub?.stripe_customer_id;

  if (!customerId) {
    const typedSb = createSupabaseAdminClient();
    const { data: tenant } = await typedSb
      .from('tenants')
      .select('nombre, slug')
      .eq('id', tenantId)
      .single();

    const customer = await stripe.customers.create({
      name: tenant?.nombre || 'Tenant',
      metadata: { tenant_id: tenantId, slug: tenant?.slug || '' },
    });
    customerId = customer.id;

    // Guardar customer_id en suscripción
    await billingClient()
      .from('subscriptions')
      .update({ stripe_customer_id: customerId })
      .eq('tenant_id', tenantId);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: `${appUrl}/api/billing/callback?session_id={CHECKOUT_SESSION_ID}&status=success`,
    cancel_url: `${appUrl}/api/billing/callback?session_id={CHECKOUT_SESSION_ID}&status=cancel`,
    metadata: { tenant_id: tenantId, plan_slug: planSlug },
    subscription_data: {
      metadata: { tenant_id: tenantId, plan_slug: planSlug },
    },
    // Multi-moneda
    ...(currency === 'BRL' ? { payment_method_types: ['card', 'boleto'] } : {}),
  });

  if (!session.url) throw new Error('No se pudo crear sesión de checkout');
  return { url: session.url };
}

/**
 * Crear sesión de Stripe Customer Portal (autoservicio)
 */
export async function createPortalSession(tenantId: string, returnUrl: string): Promise<{ url: string }> {
  const stripe = getStripe();
  const sub = await getTenantSubscription(tenantId);
  
  if (!sub?.stripe_customer_id) {
    throw new Error('No hay cliente de Stripe asociado a este tenant');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: returnUrl,
  });

  return { url: session.url };
}

// ─── Webhook Processing ─────────────────────────────────────────────────────

/**
 * Procesar webhook de Stripe.
 * Idempotente: usa stripe_event_id para evitar duplicados.
 */
export async function processStripeWebhook(event: Stripe.Event): Promise<void> {
  const sb = billingClient();

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscription = event.data.object as any; // Stripe.Subscription — cast to any for period fields
      const tenantId = subscription.metadata?.tenant_id;
      const planSlug = subscription.metadata?.plan_slug;
      
      if (!tenantId) {
        console.error('[Billing Webhook] subscription sin tenant_id en metadata');
        return;
      }

      const plan = planSlug ? await getPlanBySlug(planSlug) : null;

      const periodStart = subscription.current_period_start || subscription.start_date;
      const periodEnd = subscription.current_period_end || subscription.cancel_at;

      await sb
        .from('subscriptions')
        .upsert({
          tenant_id: tenantId,
          plan_id: plan?.id || undefined,
          stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
          stripe_subscription_id: subscription.id,
          status: mapStripeStatus(subscription.status),
          current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        } as Record<string, unknown>, { onConflict: 'tenant_id' });

      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata?.tenant_id;
      if (!tenantId) return;

      // Downgrade a plan Free
      const freePlan = await getPlanBySlug('free');
      if (freePlan) {
        await sb
          .from('subscriptions')
          .update({
            plan_id: freePlan.id,
            status: 'canceled',
            stripe_subscription_id: null,
            canceled_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId);
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = invoice.parent?.subscription_details?.metadata?.tenant_id
        || (invoice.metadata?.tenant_id);

      if (!tenantId) {
        // Intentar resolver por customer_id
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer as { id: string } | null)?.id;
        const { data: sub } = await sb
          .from('subscriptions')
          .select('tenant_id')
          .eq('stripe_customer_id', customerId)
          .single();
        
        if (!sub) {
          console.error('[Billing Webhook] invoice.paid sin tenant_id resolvible');
          return;
        }
        
        await upsertInvoice(sb, sub.tenant_id, invoice, event.id);
        return;
      }

      await upsertInvoice(sb, tenantId, invoice, event.id);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      // Marcar suscripción como past_due
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer as { id: string } | null)?.id;
      const { data: sub } = await sb
        .from('subscriptions')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (sub) {
        await sb
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('id', sub.id);
      }
      break;
    }

    default:
      // Ignorar eventos no manejados
      break;
  }
}

// ─── Helpers Internos ────────────────────────────────────────────────────────

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  const map: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    trialing: 'trialing',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    unpaid: 'unpaid',
    paused: 'past_due',
  };
  return map[status] || 'active';
}

async function upsertInvoice(
  sb: ReturnType<typeof billingClient>,
  tenantId: string,
  invoice: Stripe.Invoice,
  eventId: string
): Promise<void> {
  await sb
    .from('invoices')
    .upsert({
      tenant_id: tenantId,
      stripe_invoice_id: invoice.id,
      stripe_event_id: eventId,
      amount: invoice.amount_paid || 0,
      currency: (invoice.currency || 'clp').toUpperCase(),
      status: invoice.status === 'paid' ? 'paid' : 'open',
      period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
      period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
      paid_at: invoice.status === 'paid' ? new Date().toISOString() : null,
      hosted_invoice_url: invoice.hosted_invoice_url || null,
      invoice_pdf_url: invoice.invoice_pdf || null,
    } as Record<string, unknown>, { onConflict: 'stripe_invoice_id' });
}

// ─── Billing Summary (SuperAdmin) ────────────────────────────────────────────

/**
 * Obtener resumen de billing de todos los tenants
 */
export async function getBillingSummary(): Promise<unknown[]> {
  const sb = billingClient();
  const { data, error } = await sb
    .from('v_billing_summary')
    .select('*');

  if (error) throw new Error(`Error obteniendo billing summary: ${error.message}`);
  return data || [];
}
