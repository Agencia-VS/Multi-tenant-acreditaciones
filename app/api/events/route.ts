/**
 * API: Events
 * GET    — Listar eventos (por tenant o todos)
 * POST   — Crear evento (admin)
 * PATCH  — Actualizar evento existente
 * DELETE — Desactivar evento
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createEvent, updateEvent, deactivateEvent, deleteEvent, listEventsByTenant, listAllEvents, getActiveEvent } from '@/lib/services';
import { logAuditAction } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';
import { eventCreateSchema, eventUpdateSchema, safeParse } from '@/lib/schemas';

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

    // listAllEvents requiere superadmin
    await requireAuth(request, { role: 'superadmin' });
    const events = await listAllEvents();
    return NextResponse.json(events);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth: requiere al menos autenticado (admin verifica ownership vía tenant_id en body)
    const { user } = await requireAuth(request);

    const body = await request.json();
    const parsed = safeParse(eventCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const event = await createEvent(parsed.data);

    await logAuditAction(user.id, 'event.created', 'event', event.id, {
      nombre: event.nombre,
      tenant_id: event.tenant_id,
    });

    // Invalidar caché de páginas del tenant
    revalidatePath(`/acreditado`);

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Auth: requiere al menos autenticado
    const { user } = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');
    if (!eventId) {
      return NextResponse.json({ error: 'ID de evento es requerido' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = safeParse(eventUpdateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const event = await updateEvent(eventId, parsed.data);

    await logAuditAction(user.id, 'event.updated', 'event', event.id, {
      nombre: event.nombre,
    });

    revalidatePath(`/acreditado`);

    return NextResponse.json(event);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Auth: requiere al menos autenticado
    const { user } = await requireAuth(request);

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

    revalidatePath(`/acreditado`);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
