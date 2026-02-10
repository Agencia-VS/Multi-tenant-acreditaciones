/**
 * API: Bulk Operations
 * POST — Aprobar/rechazar múltiples registros de un golpe
 */

import { NextRequest, NextResponse } from 'next/server';
import { bulkUpdateStatus, getRegistrationFull } from '@/lib/services';
import { sendBulkApprovalEmails } from '@/lib/services/email';
import { getCurrentUser } from '@/lib/services/auth';
import { logAuditAction } from '@/lib/services/audit';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { RegistrationFull, RegistrationStatus } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { registration_ids, status, send_emails } = body as {
      registration_ids: string[];
      status: RegistrationStatus;
      send_emails?: boolean;
    };

    if (!registration_ids || registration_ids.length === 0) {
      return NextResponse.json({ error: 'registration_ids es requerido' }, { status: 400 });
    }

    if (!['aprobado', 'rechazado'].includes(status)) {
      return NextResponse.json({ error: 'status debe ser aprobado o rechazado' }, { status: 400 });
    }

    // Actualizar estados
    const result = await bulkUpdateStatus(registration_ids, status, user.id);

    // Auditoría
    await logAuditAction(user.id, 'registration.bulk_approved', 'registration', registration_ids[0], {
      count: registration_ids.length,
      status,
      success: result.success,
      errors: result.errors.length,
    });

    // Enviar emails si se solicita
    if (send_emails && status === 'aprobado') {
      const fullRegs: RegistrationFull[] = [];
      for (const id of registration_ids) {
        const reg = await getRegistrationFull(id);
        if (reg) fullRegs.push(reg);
      }

      if (fullRegs.length > 0) {
        const supabase = createSupabaseAdminClient();
        const { data: tenant } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', fullRegs[0].tenant_id)
          .single();

        if (tenant) {
          const emailResult = await sendBulkApprovalEmails(fullRegs, tenant);
          return NextResponse.json({
            ...result,
            emails: emailResult,
          });
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
