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

    // Primero obtener los registration_ids del evento
    const { data: regs } = await supabase
      .from('registrations')
      .select('id')
      .eq('event_id', eventId);

    if (!regs || regs.length === 0) {
      return NextResponse.json([]);
    }

    // Luego obtener los registration_days para esas registrations
    const { data, error } = await supabase
      .from('registration_days')
      .select('registration_id, event_day_id')
      .in('registration_id', regs.map(r => r.id));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
