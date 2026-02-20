/**
 * API: SuperAdmin — Gestión de SuperAdmins
 * GET    — Listar todos los superadmins
 * POST   — Crear nuevo superadmin
 * PATCH  — Actualizar superadmin (nombre)
 * DELETE — Eliminar superadmin
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/services/requireAuth';
import { listSuperAdmins, updateSuperAdmin, deleteSuperAdmin } from '@/lib/services';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, { role: 'superadmin' });
    const admins = await listSuperAdmins();
    return NextResponse.json({ admins });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request, { role: 'superadmin' });

    const body = await request.json();
    const { email, nombre, password } = body;

    if (!email || !nombre || !password) {
      return NextResponse.json(
        { error: 'email, nombre y password son requeridos' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
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
    const { data: admin, error: insertError } = await supabase
      .from('superadmins')
      .insert({ user_id: authData.user.id, email, nombre })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(admin, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAuth(request, { role: 'superadmin' });

    const body = await request.json();
    const { id, nombre } = body;

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    const updated = await updateSuperAdmin(id, { nombre });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireAuth(request, { role: 'superadmin' });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    // Prevent self-deletion
    const supabase = createSupabaseAdminClient();
    const { data: target } = await supabase
      .from('superadmins')
      .select('user_id')
      .eq('id', id)
      .single();

    if (target?.user_id === user.id) {
      return NextResponse.json(
        { error: 'No puedes eliminarte a ti mismo' },
        { status: 400 }
      );
    }

    await deleteSuperAdmin(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
