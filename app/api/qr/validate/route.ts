/**
 * API: QR Validation — Escaneo en puerta
 * POST — Validar un QR token y hacer check-in
 */

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/services/auth';
import { logAuditAction } from '@/lib/services/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qr_token, event_day_id } = body;

    if (!qr_token) {
      return NextResponse.json({ error: 'qr_token es requerido' }, { status: 400 });
    }

    const user = await getCurrentUser();
    const supabase = createSupabaseAdminClient();

    // Usar la función SQL para validar y hacer check-in (soporta multidía)
    const { data, error } = await supabase.rpc('validate_qr_checkin_day', {
      p_qr_token: qr_token,
      p_scanner_user_id: user?.id,
      p_event_day_id: event_day_id || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data as { valid?: boolean; registration_id?: string; status?: string; nombre?: string } | null;

    // Auditoría si fue check-in exitoso
    if (result?.valid && result?.registration_id) {
      await logAuditAction(
        user?.id || null,
        'registration.checked_in',
        'registration',
        result.registration_id,
        { qr_status: result.status, nombre: result.nombre }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
