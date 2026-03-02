/**
 * API: Provider Request
 * POST — Acreditado solicita acceso a un tenant (requiere código de invitación válido)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createProviderRequest, validateInviteCode, getProfileByUserId, getTenantById } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';
import { providerRequestSchema, safeParse } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const body = await request.json();
    const parsed = safeParse(providerRequestSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { tenant_id: tenantId, code, organizacion, mensaje } = parsed.data;

    // Obtener el tenant para validar el código
    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 });
    }

    // Validar código de invitación
    const validation = await validateInviteCode(tenant.slug, code);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Código de invitación inválido' }, { status: 403 });
    }

    // Obtener perfil del usuario
    const profile = await getProfileByUserId(user.id);
    if (!profile) {
      return NextResponse.json(
        { error: 'Debes completar tu perfil antes de solicitar acceso' },
        { status: 400 }
      );
    }

    // Crear solicitud
    const provider = await createProviderRequest({
      tenantId,
      profileId: profile.id,
      organizacion,
      mensaje,
    });

    return NextResponse.json(provider, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
