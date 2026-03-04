/**
 * API: Provider Invite Code
 * POST — Generar o regenerar código de invitación (admin del tenant)
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateInviteCode_forTenant, logAuditAction } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';
import { uuidSchema, safeParse } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = body.tenant_id;

    // Validar UUID
    const parsed = safeParse(uuidSchema, tenantId);
    if (!parsed.success) {
      return NextResponse.json({ error: 'tenant_id inválido' }, { status: 400 });
    }

    // Requiere admin del tenant
    const { user } = await requireAuth(request, {
      role: 'admin_tenant',
      tenantId: parsed.data,
    });

    const code = await generateInviteCode_forTenant(parsed.data);

    await logAuditAction(user.id, 'provider.invite_code_generated', 'tenants', parsed.data, {
      note: 'Código de invitación regenerado',
    });

    return NextResponse.json({ code });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
