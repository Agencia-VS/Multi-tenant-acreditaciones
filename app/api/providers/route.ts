/**
 * API: Providers
 * GET  — Listar proveedores de un tenant (admin) + stats
 * PATCH — Actualizar config de proveedores del tenant (admin): description
 */

import { NextRequest, NextResponse } from 'next/server';
import { listProvidersByTenant, getProviderStats, logAuditAction } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { ProviderStatus } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');
    const statusFilter = searchParams.get('status') as ProviderStatus | null;
    const statsOnly = searchParams.get('stats') === 'true';

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id es requerido' }, { status: 400 });
    }

    // Requiere admin del tenant
    await requireAuth(request, { role: 'admin_tenant', tenantId });

    if (statsOnly) {
      const stats = await getProviderStats(tenantId);
      return NextResponse.json(stats);
    }

    const providers = await listProvidersByTenant(tenantId, statusFilter || undefined);
    return NextResponse.json(providers);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/providers — Update provider config for a tenant (admin)
 * Body: { tenant_id: string, provider_description?: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = body.tenant_id;
    if (!tenantId || typeof tenantId !== 'string') {
      return NextResponse.json({ error: 'tenant_id es requerido' }, { status: 400 });
    }

    const { user } = await requireAuth(request, { role: 'admin_tenant', tenantId });

    const supabase = createSupabaseAdminClient();

    // Read current config
    const { data: tenant, error: readErr } = await supabase
      .from('tenants')
      .select('config')
      .eq('id', tenantId)
      .single();

    if (readErr || !tenant) {
      return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });
    }

    const currentConfig = (tenant.config && typeof tenant.config === 'object' ? tenant.config : {}) as Record<string, unknown>;

    // Only allow updating provider_description
    const newConfig = {
      ...currentConfig,
      provider_description: typeof body.provider_description === 'string'
        ? (body.provider_description || undefined)
        : currentConfig.provider_description,
    };

    const { error: updateErr } = await supabase
      .from('tenants')
      .update({ config: newConfig })
      .eq('id', tenantId);

    if (updateErr) {
      return NextResponse.json({ error: 'Error actualizando configuración' }, { status: 500 });
    }

    await logAuditAction(user.id, 'provider.config_updated', 'tenants', tenantId, {
      provider_description: body.provider_description,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
