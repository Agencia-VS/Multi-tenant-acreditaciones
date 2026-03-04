/**
 * API: Toggle Provider Module
 * POST — Activar / desactivar módulo de proveedores para un tenant (superadmin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { toggleProviderMode, logAuditAction } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';
import { providerToggleSchema, safeParse } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request, { role: 'superadmin' });

    const body = await request.json();
    const parsed = safeParse(providerToggleSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { tenant_id: tenantId, enabled } = parsed.data;

    const result = await toggleProviderMode(tenantId, enabled);

    await logAuditAction(user.id, `provider.module_${enabled ? 'enabled' : 'disabled'}`, 'tenants', tenantId, {
      provider_mode: result.provider_mode,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
