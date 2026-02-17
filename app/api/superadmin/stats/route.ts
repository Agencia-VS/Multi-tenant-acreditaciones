/**
 * API: SuperAdmin Stats
 * GET  — Obtener estadísticas globales del dashboard
 * POST — Acciones admin (crear superadmin, etc.)
 */

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getCurrentUser, isSuperAdmin } from '@/lib/services/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isSuperAdmin(user.id))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();

    const [tenants, events, registrations] = await Promise.all([
      supabase.from('tenants').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('registrations').select('status'),
    ]);

    const regs = registrations.data || [];
    const stats = {
      total_tenants: tenants.count || 0,
      total_events: events.count || 0,
      total_registrations: regs.length,
      pendientes: regs.filter((r) => r.status === 'pendiente').length,
      aprobados: regs.filter((r) => r.status === 'aprobado').length,
      rechazados: regs.filter((r) => r.status === 'rechazado').length,
    };

    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isSuperAdmin(user.id))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();

    if (body.action === 'create-superadmin') {
      const { email, nombre, password } = body;
      if (!email || !nombre || !password) {
        return NextResponse.json(
          { error: 'email, nombre y password son requeridos' },
          { status: 400 }
        );
      }

      const supabase = createSupabaseAdminClient();

      // Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombre, role: 'superadmin' },
      });

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      // Insertar en tabla superadmins
      const { error: insertError } = await supabase
        .from('superadmins')
        .insert({ user_id: authData.user.id, email, nombre });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, user_id: authData.user.id }, { status: 201 });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
