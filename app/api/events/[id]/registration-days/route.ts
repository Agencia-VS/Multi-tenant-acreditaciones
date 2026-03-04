/**
 * API: Registration Days por evento
 * GET — Devuelve todos los registration_days para las registrations de un evento
 *       Usado por AdminContext para filtrar acreditaciones por jornada (multidía)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getEventTenantId } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;

    // Auth: requiere admin del tenant del evento
    const tenantId = await getEventTenantId(eventId);
    if (!tenantId) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }
    await requireAuth(request, { role: 'admin_tenant', tenantId });

    const supabase = createSupabaseAdminClient();

    // Paginar registration IDs para soportar eventos con >1000 registros
    const REG_PAGE = 1000;
    let allRegIds: string[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: regs } = await supabase
        .from('registrations')
        .select('id')
        .eq('event_id', eventId)
        .range(offset, offset + REG_PAGE - 1);

      if (!regs || regs.length === 0) {
        hasMore = false;
      } else {
        allRegIds = allRegIds.concat(regs.map(r => r.id));
        hasMore = regs.length === REG_PAGE;
        offset += REG_PAGE;
      }
    }

    if (allRegIds.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch registration_days en chunks (IN clause soporta ~32K params en Postgres)
    const CHUNK = 1000;
    let allDays: { registration_id: string; event_day_id: string }[] = [];
    for (let i = 0; i < allRegIds.length; i += CHUNK) {
      const chunk = allRegIds.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('registration_days')
        .select('registration_id, event_day_id')
        .in('registration_id', chunk);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (data) allDays = allDays.concat(data);
    }

    return NextResponse.json(allDays);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
