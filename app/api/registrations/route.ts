/**
 * API: Registrations (Inscripciones)
 * POST — Crear nueva inscripción
 * GET  — Listar inscripciones (admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRegistration, listRegistrations, getEventById } from '@/lib/services';
import { getCurrentUser, isSuperAdmin } from '@/lib/services/auth';
import { requireAuth } from '@/lib/services/requireAuth';
import { getProfileByUserId } from '@/lib/services/profiles';
import { logAuditAction } from '@/lib/services/audit';
import { isDeadlinePast } from '@/lib/dates';
import type { RegistrationFormData } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_id, submitted_by: submittedByFromBody, ...formData } = body as RegistrationFormData & { event_id: string; submitted_by?: string };

    if (!event_id) {
      return NextResponse.json({ error: 'event_id es requerido' }, { status: 400 });
    }
    if (!formData.rut || !formData.nombre || !formData.apellido) {
      return NextResponse.json({ error: 'RUT, nombre y apellido son requeridos' }, { status: 400 });
    }

    // Verificar deadline del evento (backend)
    const event = await getEventById(event_id);
    if (event && isDeadlinePast(event.fecha_limite_acreditacion)) {
      return NextResponse.json(
        { error: 'El plazo para solicitar acreditación ha cerrado' },
        { status: 403 }
      );
    }

    // ─── Identidad Unificada: resolver usuario autenticado ───
    // Solo vincular perfil si el usuario es un acreditado real (no superadmin ni tenant_admin).
    let authUserId: string | undefined;
    let submitterProfileId: string | undefined = submittedByFromBody || undefined;

    try {
      const user = await getCurrentUser();
      if (user) {
        authUserId = user.id;
        // Solo buscar perfil acreditado si NO es superadmin
        // (superadmins/admins pueden crear registros sin vincularse como acreditado)
        if (!submitterProfileId) {
          const isAdmin = await isSuperAdmin(user.id);
          if (!isAdmin) {
            const profile = await getProfileByUserId(user.id);
            if (profile) submitterProfileId = profile.id;
          }
        }
      }
    } catch {
      // No bloquear si no hay sesión — admins pueden crear sin sesión de acreditado
    }

    const result = await createRegistration(
      event_id,
      formData,
      submitterProfileId,
      authUserId,
      event ? { tenant_id: (event as Record<string, unknown>).tenant_id as string, form_fields: event.form_fields } : undefined
    );

    // Auditoría
    await logAuditAction(authUserId || null, 'registration.created', 'registration', result.registration.id, {
      event_id,
      rut: formData.rut,
      organizacion: formData.organizacion,
      submitted_by_profile: submitterProfileId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    const status = message.includes('límite') || message.includes('ya está registrada') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Auth: requiere admin_tenant o superadmin
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id') || undefined;
    await requireAuth(request, { role: 'admin_tenant', tenantId });

    const filters = {
      event_id: searchParams.get('event_id') || undefined,
      tenant_id: tenantId,
      status: (searchParams.get('status') as 'pendiente' | 'aprobado' | 'rechazado' | 'revision') || undefined,
      tipo_medio: searchParams.get('tipo_medio') || undefined,
      organizacion: searchParams.get('organizacion') || undefined,
      search: searchParams.get('search') || undefined,
      limit: Number(searchParams.get('limit')) || 50,
      offset: Number(searchParams.get('offset')) || 0,
    };

    const result = await listRegistrations(filters);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
