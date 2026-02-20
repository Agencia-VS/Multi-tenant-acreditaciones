/**
 * API: Event Days — CRUD de jornadas para eventos multidía
 * GET  — Listar días del evento
 * PUT  — Sincronizar todos los días (reemplaza)
 * POST — Crear un día
 * DELETE — Eliminar un día
 */

import { NextRequest, NextResponse } from 'next/server';
import { listEventDays, syncEventDays, createEventDay, deleteEventDay, getEventTenantId } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';
import { eventDaySchema, eventDaysSyncSchema, safeParse } from '@/lib/schemas';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const days = await listEventDays(eventId);
    return NextResponse.json(days);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const tenantId = await getEventTenantId(eventId);
    if (!tenantId) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }
    await requireAuth(request, { role: 'admin_tenant', tenantId });

    const body = await request.json();
    const parsed = safeParse(eventDaysSyncSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await syncEventDays(eventId, parsed.data.days);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const tenantId = await getEventTenantId(eventId);
    if (!tenantId) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }
    await requireAuth(request, { role: 'admin_tenant', tenantId });

    const body = await request.json();
    const parsed = safeParse(eventDaySchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const day = await createEventDay(eventId, parsed.data);
    return NextResponse.json(day, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const tenantId = await getEventTenantId(eventId);
    if (!tenantId) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }
    await requireAuth(request, { role: 'admin_tenant', tenantId });

    const { searchParams } = new URL(request.url);
    const dayId = searchParams.get('day_id');
    
    // If day_id is actually the event_id (route param), we need the real day_id from query
    if (!dayId) {
      return NextResponse.json({ error: 'day_id es requerido' }, { status: 400 });
    }

    await deleteEventDay(dayId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
