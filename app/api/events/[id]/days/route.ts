/**
 * API: Event Days — CRUD de jornadas para eventos multidía
 * GET  — Listar días del evento
 * PUT  — Sincronizar todos los días (reemplaza)
 * POST — Crear un día
 * DELETE — Eliminar un día
 */

import { NextRequest, NextResponse } from 'next/server';
import { listEventDays, syncEventDays, createEventDay, deleteEventDay } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';

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
    await requireAuth(request, { role: 'admin_tenant' });

    const { id: eventId } = await params;
    const body = await request.json();
    const { days } = body;

    if (!Array.isArray(days)) {
      return NextResponse.json({ error: 'days debe ser un array' }, { status: 400 });
    }

    const result = await syncEventDays(eventId, days);
    return NextResponse.json(result);
  } catch (error) {
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
    await requireAuth(request, { role: 'admin_tenant' });

    const { id: eventId } = await params;
    const body = await request.json();
    const { fecha, label, orden } = body;

    if (!fecha || !label) {
      return NextResponse.json({ error: 'fecha y label son requeridos' }, { status: 400 });
    }

    const day = await createEventDay(eventId, { fecha, label, orden });
    return NextResponse.json(day, { status: 201 });
  } catch (error) {
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
    await requireAuth(request, { role: 'admin_tenant' });

    const { searchParams } = new URL(request.url);
    const dayId = searchParams.get('day_id');
    
    // If day_id is actually the event_id (route param), we need the real day_id from query
    if (!dayId) {
      return NextResponse.json({ error: 'day_id es requerido' }, { status: 400 });
    }

    await deleteEventDay(dayId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
