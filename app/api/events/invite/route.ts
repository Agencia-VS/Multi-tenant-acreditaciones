/**
 * API: Validar Token de Invitación
 * GET /api/events/invite?token=xxx — público, valida token y retorna datos del evento
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateInviteToken } from '@/lib/services/invitations';
import { getEventById } from '@/lib/services/events';
import { getTenantById } from '@/lib/services/tenants';

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
    }

    const result = await validateInviteToken(token);

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, reason: result.reason },
        { status: 403 }
      );
    }

    // Obtener info del evento para redirigir
    const event = await getEventById(result.eventId!);
    if (!event) {
      return NextResponse.json({ valid: false, reason: 'Evento no encontrado' }, { status: 404 });
    }

    const tenant = await getTenantById(event.tenant_id);

    return NextResponse.json({
      valid: true,
      event: {
        id: event.id,
        nombre: event.nombre,
        fecha: event.fecha,
        venue: event.venue,
      },
      tenant: tenant ? {
        slug: tenant.slug,
        nombre: tenant.nombre,
      } : null,
      invitation: {
        id: result.invitation!.id,
        email: result.invitation!.email,
        nombre: result.invitation!.nombre,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
