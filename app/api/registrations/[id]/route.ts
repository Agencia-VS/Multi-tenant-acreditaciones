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
    const { status, motivo_rechazo, send_email } = body as {
      status: RegistrationStatus;
      motivo_rechazo?: string;
      send_email?: boolean;
    };

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
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
