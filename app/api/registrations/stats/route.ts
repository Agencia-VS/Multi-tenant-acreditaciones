/**
 * GET /api/registrations/stats?event_id=xxx
 * Devuelve stats exactas del evento usando COUNT server-side (head: true).
 * No transfiere datos, no tiene límite de paginación.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getRegistrationStats } from '@/lib/services';
import { getEventTenantId } from '@/lib/services/events';
import { requireAuth } from '@/lib/services/requireAuth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    if (!eventId) {
      return NextResponse.json({ error: 'event_id es requerido' }, { status: 400 });
    }

    // Auth: requiere admin del tenant del evento
    const tenantId = await getEventTenantId(eventId);
    if (!tenantId) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }
    await requireAuth(request, { role: 'admin_tenant', tenantId });

    const stats = await getRegistrationStats(eventId);
    return NextResponse.json(stats);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
