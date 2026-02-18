/**
 * API: Registration by ID
 * PATCH — Actualizar estado (aprobar/rechazar)
 * GET   — Obtener registro completo
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateRegistrationStatus, getRegistrationFull } from '@/lib/services';
import { sendApprovalEmail, sendRejectionEmail } from '@/lib/services/email';
import { logAuditAction } from '@/lib/services/audit';
import { requireAuth } from '@/lib/services/requireAuth';
import { registrationPatchSchema, safeParse } from '@/lib/schemas';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { Tenant } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = safeParse(registrationPatchSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { status, motivo_rechazo, send_email, datos_extra } = parsed.data;

    // Auth: requiere admin de tenant o superadmin
    const { user } = await requireAuth(request);

    // Case 1: Update datos_extra fields (e.g., zona assignment by admin)
    if (datos_extra && !status) {
      const supabase = createSupabaseAdminClient();
      // Merge with existing datos_extra
      const { data: existing } = await supabase
        .from('registrations')
        .select('datos_extra')
        .eq('id', id)
        .single();

      const merged = { ...((existing?.datos_extra || {}) as Record<string, unknown>), ...datos_extra };
      const { error } = await supabase
        .from('registrations')
        .update({ datos_extra: merged as any })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await logAuditAction(user.id, 'registration.updated', 'registration', id, { datos_extra });
      return NextResponse.json({ success: true, datos_extra: merged });
    }

    // Case 2: Status change (approve/reject)
    if (!status) {
      return NextResponse.json({ error: 'status o datos_extra requerido' }, { status: 400 });
    }

    const registration = await updateRegistrationStatus(
      id,
      status,
      user.id,
      motivo_rechazo
    );

    // Enviar email si se solicita
    if (send_email !== false) {
      const fullReg = await getRegistrationFull(id);
      if (fullReg && fullReg.profile_email) {
        const supabase = createSupabaseAdminClient();
        const { data: tenant } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', fullReg.tenant_id!)
          .single();

        if (tenant) {
          if (status === 'aprobado') {
            // Re-fetch para tener el qr_token actualizado
            const updatedReg = await getRegistrationFull(id);
            if (updatedReg) {
              await sendApprovalEmail(updatedReg, tenant as Tenant);
            }
          } else if (status === 'rechazado') {
            await sendRejectionEmail(fullReg, tenant as Tenant, motivo_rechazo);
          }
        }
      }
    }

    // Auditoría
    await logAuditAction(
      user.id,
      status === 'aprobado' ? 'registration.approved' : 'registration.rejected',
      'registration',
      id,
      { status, motivo_rechazo }
    );

    return NextResponse.json(registration);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth: requiere usuario autenticado (admin o superadmin)
    await requireAuth(request);

    const { id } = await params;
    const registration = await getRegistrationFull(id);
    
    if (!registration) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    return NextResponse.json(registration);
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
    const { id } = await params;
    // Auth: requiere admin de tenant o superadmin
    const { user } = await requireAuth(request);

    const supabase = (await import('@/lib/supabase/server')).createSupabaseAdminClient();
    const { error } = await supabase.from('registrations').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAuditAction(user.id, 'registration.rejected', 'registration', id, { action: 'deleted' });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
