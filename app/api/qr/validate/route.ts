/**
 * API: QR Validation — Escaneo en puerta
 * POST — Validar un QR token y hacer check-in
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/services/auth';
import { logAuditAction } from '@/lib/services/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qr_token } = body;

    if (!qr_token) {
      return NextResponse.json({ error: 'qr_token es requerido' }, { status: 400 });
    }

    const user = await getCurrentUser();
    const supabase = createSupabaseAdminClient();

    // Usar la función SQL para validar y hacer check-in
    const { data, error } = await supabase.rpc('validate_qr_checkin', {
      p_qr_token: qr_token,
      p_scanner_user_id: user?.id || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auditoría si fue check-in exitoso
    if (data?.valid && data?.registration_id) {
      await logAuditAction(
        user?.id || null,
        'registration.checked_in',
        'registration',
        data.registration_id,
        { qr_status: data.status, nombre: data.nombre }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
