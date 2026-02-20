/**
 * API: QR Validation — Escaneo en puerta
 * POST — Validar un QR token y hacer check-in
 * 
 * Implementa la lógica de check-in a nivel de aplicación
 * para evitar dependencia de funciones SQL con problemas de tipos.
 */

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

    // 1. Buscar registro por qr_token con profile y event data
    const { data: reg, error: regError } = await supabase
      .from('registrations')
      .select(`
        id, status, checked_in, checked_in_at, event_id,
        organizacion, cargo, tipo_medio,
        profiles!registrations_profile_id_fkey (nombre, apellido, rut, foto_url),
        events!registrations_event_id_fkey (nombre, event_type, qr_enabled)
      `)
      .eq('qr_token', qr_token)
      .single();

    if (regError || !reg) {
      return NextResponse.json({
        valid: false,
        status: 'not_found',
        message: 'QR no encontrado',
      });
    }

    const profile = reg.profiles as unknown as { nombre: string; apellido: string; rut: string; foto_url: string | null };
    const event = reg.events as unknown as { nombre: string; event_type: string; qr_enabled: boolean };
    const nombre = `${profile.nombre} ${profile.apellido}`.trim();

    // 2. Verificar que esté aprobado
    if (reg.status !== 'aprobado') {
      return NextResponse.json({
        valid: false,
        status: reg.status,
        message: `Acreditación no aprobada (${reg.status})`,
        nombre,
        rut: profile.rut,
      });
    }

    // 3. Check-in multidía (por jornada)
    if (event.event_type === 'multidia' && event_day_id) {
      const { data: regDay, error: dayError } = await supabase
        .from('registration_days')
        .select('id, checked_in, checked_in_at')
        .eq('registration_id', reg.id)
        .eq('event_day_id', event_day_id)
        .single();

      if (dayError || !regDay) {
        return NextResponse.json({
          valid: false,
          status: 'not_enrolled_day',
          message: 'No inscrito para esta jornada',
          nombre,
          rut: profile.rut,
        });
      }

      if (regDay.checked_in) {
        return NextResponse.json({
          valid: false,
          status: 'already_checked_in',
          message: 'Ya registró ingreso para esta jornada',
          nombre,
          rut: profile.rut,
          foto_url: profile.foto_url,
          registration_id: reg.id,
        });
      }

      // Hacer check-in del día
      await supabase
        .from('registration_days')
        .update({
          checked_in: true,
          checked_in_at: new Date().toISOString(),
          checked_in_by: user?.id || null,
        })
        .eq('id', regDay.id);

      const result = {
        valid: true,
        status: 'checked_in',
        message: 'Ingreso registrado',
        registration_id: reg.id,
        nombre,
        rut: profile.rut,
        foto_url: profile.foto_url,
        organizacion: reg.organizacion,
        cargo: reg.cargo,
        tipo_medio: reg.tipo_medio,
        event_nombre: event.nombre,
        event_day_id,
      };

      await logAuditAction(
        user?.id || null,
        'registration.checked_in',
        'registration',
        result.registration_id,
        { qr_status: result.status, nombre: result.nombre, day_id: event_day_id }
      );

      return NextResponse.json(result);
    }

    // 4. Check-in simple
    if (reg.checked_in) {
      return NextResponse.json({
        valid: false,
        status: 'already_checked_in',
        message: 'Ya registró ingreso',
        nombre,
        rut: profile.rut,
        foto_url: profile.foto_url,
        registration_id: reg.id,
      });
    }

    // Hacer check-in
    await supabase
      .from('registrations')
      .update({
        checked_in: true,
        checked_in_at: new Date().toISOString(),
        checked_in_by: user?.id || null,
      })
      .eq('id', reg.id);

    const result = {
      valid: true,
      status: 'checked_in',
      message: 'Ingreso registrado',
      registration_id: reg.id,
      nombre,
      rut: profile.rut,
      foto_url: profile.foto_url,
      organizacion: reg.organizacion,
      cargo: reg.cargo,
      tipo_medio: reg.tipo_medio,
      event_nombre: event.nombre,
    };

    await logAuditAction(
      user?.id || null,
      'registration.checked_in',
      'registration',
      result.registration_id,
      { qr_status: result.status, nombre: result.nombre }
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
