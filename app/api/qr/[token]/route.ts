/**
 * API: QR Info (read-only) — Verificación pública de QR
 * GET /api/qr/[token] — Retorna datos del acreditado sin hacer check-in
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length < 10) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Buscar registration por qr_token (join con profile y event)
    const { data: reg, error } = await supabase
      .from('registrations')
      .select(`
        id,
        status,
        qr_token,
        checked_in,
        checked_in_at,
        organizacion,
        cargo,
        datos_extra,
        created_at,
        profiles!inner (
          nombre,
          apellido,
          rut,
          foto_url
        ),
        events!inner (
          nombre,
          fecha,
          venue,
          qr_enabled,
          tenants!inner (
            nombre,
            slug,
            logo_url,
            color_primario,
            color_secundario
          )
        )
      `)
      .eq('qr_token', token)
      .single();

    if (error || !reg) {
      return NextResponse.json(
        { valid: false, status: 'not_found', message: 'QR no encontrado' },
        { status: 404 }
      );
    }

    // Cast relations
    const profile = reg.profiles as unknown as { nombre: string; apellido: string; rut: string; foto_url: string | null };
    const event = reg.events as unknown as {
      nombre: string; fecha: string; venue: string; qr_enabled: boolean;
      tenants: { nombre: string; slug: string; logo_url: string | null; color_primario: string; color_secundario: string };
    };

    if (reg.status !== 'aprobado') {
      return NextResponse.json({
        valid: false,
        status: reg.status,
        message: reg.status === 'pendiente' ? 'Acreditación pendiente de aprobación' : 'Acreditación no aprobada',
      });
    }

    const extras = (reg.datos_extra || {}) as Record<string, unknown>;

    return NextResponse.json({
      valid: true,
      status: reg.checked_in ? 'checked_in' : 'approved',
      message: reg.checked_in ? 'Acreditado — Ya ingresó' : 'Acreditación válida',
      nombre: `${profile.nombre} ${profile.apellido}`.trim(),
      rut: profile.rut,
      foto_url: profile.foto_url,
      organizacion: reg.organizacion,
      cargo: reg.cargo,
      tipo_medio: extras.tipo_medio || null,
      zona: extras.zona || null,
      checked_in: reg.checked_in,
      checked_in_at: reg.checked_in_at,
      event: {
        nombre: event.nombre,
        fecha: event.fecha,
        venue: event.venue,
      },
      tenant: {
        nombre: event.tenants.nombre,
        slug: event.tenants.slug,
        logo_url: event.tenants.logo_url,
        color_primario: event.tenants.color_primario,
        color_secundario: event.tenants.color_secundario,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
