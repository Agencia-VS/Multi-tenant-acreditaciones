/**
 * API: Providers
 * GET — Listar proveedores de un tenant (admin) + stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { listProvidersByTenant, getProviderStats } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';
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
