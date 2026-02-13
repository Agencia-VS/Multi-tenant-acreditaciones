/**
 * API: Registration by ID
 * PATCH — Actualizar estado (aprobar/rechazar)
 * GET   — Obtener registro completo
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateRegistrationStatus, getRegistrationFull } from '@/lib/services';
import { sendApprovalEmail, sendRejectionEmail } from '@/lib/services/email';
import { logAuditAction } from '@/lib/services/audit';
import { getCurrentUser } from '@/lib/services/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { RegistrationStatus } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, motivo_rechazo, send_email, datos_extra } = body as {
      status?: RegistrationStatus;
      motivo_rechazo?: string;
      send_email?: boolean;
      datos_extra?: Record<string, unknown>;
    };

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Case 1: Update datos_extra fields (e.g., zona assignment by admin)
    if (datos_extra && !status) {
      const supabase = createSupabaseAdminClient();
      // Merge with existing datos_extra
      const { data: existing } = await supabase
        .from('registrations')
        .select('datos_extra')
        .eq('id', id)
        .single();

      const merged = { ...(existing?.datos_extra || {}), ...datos_extra };
      const { error } = await supabase
        .from('registrations')
        .update({ datos_extra: merged })
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
          .eq('id', fullReg.tenant_id)
          .single();

        if (tenant) {
          if (status === 'aprobado') {
            // Re-fetch para tener el qr_token actualizado
            const updatedReg = await getRegistrationFull(id);
            if (updatedReg) {
              await sendApprovalEmail(updatedReg, tenant);
            }
          } else if (status === 'rechazado') {
            await sendRejectionEmail(fullReg, tenant, motivo_rechazo);
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const registration = await getRegistrationFull(id);
    
    if (!registration) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    return NextResponse.json(registration);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = (await import('@/lib/supabase/server')).createSupabaseAdminClient();
    const { error } = await supabase.from('registrations').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAuditAction(user.id, 'registration.rejected', 'registration', id, { action: 'deleted' });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
