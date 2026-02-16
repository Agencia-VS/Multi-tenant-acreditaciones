/**
 * API: Events
 * GET    — Listar eventos (por tenant o todos)
 * POST   — Crear evento (admin)
 * PATCH  — Actualizar evento existente
 * DELETE — Desactivar evento
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEvent, updateEvent, deactivateEvent, deleteEvent, listEventsByTenant, listAllEvents, getActiveEvent } from '@/lib/services';
import { logAuditAction, getCurrentUser } from '@/lib/services';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');
    const tenantSlug = searchParams.get('tenant_slug');
    const activeOnly = searchParams.get('active') === 'true';

    // Si se pide el evento activo de un tenant (para landing)
    if (tenantSlug && activeOnly) {
      const { getTenantBySlug } = await import('@/lib/services/tenants');
      const tenant = await getTenantBySlug(tenantSlug);
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });
      }
      const event = await getActiveEvent(tenant.id);
      return NextResponse.json(event);
    }

    if (tenantId) {
      const events = await listEventsByTenant(tenantId);
      return NextResponse.json(events);
    }

    const events = await listAllEvents();
    return NextResponse.json(events);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const event = await createEvent(body);

    await logAuditAction(user.id, 'event.created', 'event', event.id, {
      nombre: event.nombre,
      tenant_id: event.tenant_id,
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');
    if (!eventId) {
      return NextResponse.json({ error: 'ID de evento es requerido' }, { status: 400 });
    }

    const body = await request.json();
    const event = await updateEvent(eventId, body);

    await logAuditAction(user.id, 'event.updated', 'event', event.id, {
      nombre: event.nombre,
    });

    return NextResponse.json(event);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');
    if (!eventId) {
      return NextResponse.json({ error: 'ID de evento es requerido' }, { status: 400 });
    }

    const hardDelete = searchParams.get('action') === 'delete';

    if (hardDelete) {
      await deleteEvent(eventId);
      await logAuditAction(user.id, 'event.updated', 'event', eventId, { action: 'deleted' });
    } else {
      await deactivateEvent(eventId);
      await logAuditAction(user.id, 'event.updated', 'event', eventId, { action: 'deactivated' });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
