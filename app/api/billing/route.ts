/**
 * API: Billing — Plans & Subscription Management
 * GET  — Obtener planes, suscripción del tenant, o resumen de uso
 * POST — Crear checkout session o portal session
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listPlans,
  getTenantSubscription,
  getUsageSummary,
  createCheckoutSession,
  createPortalSession,
  assignPlanToTenant,
  getBillingSummary,
  isStripeConfigured,
} from '@/lib/services/billing';
import { requireAuth } from '@/lib/services/requireAuth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const tenantId = searchParams.get('tenant_id');

    // Planes públicos (para pricing page)
    if (action === 'plans') {
      const plans = await listPlans();
      return NextResponse.json(plans);
    }

    // Suscripción de un tenant (requiere auth)
    if (action === 'subscription' && tenantId) {
      await requireAuth(request, { role: 'admin_tenant', tenantId });
      const sub = await getTenantSubscription(tenantId);
      return NextResponse.json(sub);
    }

    // Resumen de uso (requiere auth admin del tenant)
    if (action === 'usage' && tenantId) {
      await requireAuth(request, { role: 'admin_tenant', tenantId });
      const summary = await getUsageSummary(tenantId);
      return NextResponse.json(summary);
    }

    // Billing summary (superadmin)
    if (action === 'summary') {
      await requireAuth(request, { role: 'superadmin' });
      const summary = await getBillingSummary();
      return NextResponse.json(summary);
    }

    return NextResponse.json({ error: 'Parámetro action requerido' }, { status: 400 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, tenant_id, plan_slug, plan_id, currency, return_url } = body;

    if (!action || !tenant_id) {
      return NextResponse.json({ error: 'action y tenant_id son requeridos' }, { status: 400 });
    }

    // Checkout: crear sesión de Stripe para upgrade
    if (action === 'checkout') {
      await requireAuth(request, { role: 'admin_tenant', tenantId: tenant_id });

      if (!isStripeConfigured()) {
        return NextResponse.json(
          { error: 'Stripe no configurado. Contacta al administrador.' },
          { status: 503 }
        );
      }

      if (!plan_slug) {
        return NextResponse.json({ error: 'plan_slug requerido' }, { status: 400 });
      }

      const session = await createCheckoutSession(tenant_id, plan_slug, currency || 'CLP');
      return NextResponse.json(session);
    }

    // Portal: crear sesión del Stripe Customer Portal
    if (action === 'portal') {
      await requireAuth(request, { role: 'admin_tenant', tenantId: tenant_id });

      if (!isStripeConfigured()) {
        return NextResponse.json(
          { error: 'Stripe no configurado. Contacta al administrador.' },
          { status: 503 }
        );
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const session = await createPortalSession(
        tenant_id,
        return_url || `${appUrl}/admin`
      );
      return NextResponse.json(session);
    }

    // Asignar plan manualmente (superadmin)
    if (action === 'assign') {
      await requireAuth(request, { role: 'superadmin' });

      if (!plan_id) {
        return NextResponse.json({ error: 'plan_id requerido' }, { status: 400 });
      }

      const sub = await assignPlanToTenant(tenant_id, plan_id, { currency });
      return NextResponse.json(sub);
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
