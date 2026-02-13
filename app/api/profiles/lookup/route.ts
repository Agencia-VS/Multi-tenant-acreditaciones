/**
 * API: Profile — Perfil del usuario autenticado
 * GET  — Obtiene el perfil del usuario logueado (seguro, sin exposición pública)
 * POST — Crea o vincula un perfil durante el registro
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProfileByUserId, getProfileByEmail, getOrCreateProfile } from '@/lib/services';
import { getCurrentUser } from '@/lib/services';

/**
 * GET — Retorna el perfil del usuario autenticado.
 * Busca primero por user_id; si no encuentra, intenta por email
 * (fallback para perfiles creados como "equipo" que aún no tienen user_id vinculado).
 * Si encuentra por email, auto-vincula el user_id para futuras consultas.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    let profile = await getProfileByUserId(user.id);

    // Fallback: buscar por email del auth user y auto-vincular
    if (!profile && user.email) {
      profile = await getProfileByEmail(user.email);
      if (profile) {
        // Auto-vincular user_id al perfil encontrado por email
        const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
        const supabase = createSupabaseAdminClient();
        await supabase
          .from('profiles')
          .update({ user_id: user.id })
          .eq('id', profile.id)
          .is('user_id', null);  // solo si sigue sin user_id
        profile = { ...profile, user_id: user.id };
        console.info(`[profiles/lookup] Auto-vinculado user_id ${user.id} a perfil ${profile.id} por email ${user.email}`);
      }
    }

    if (!profile) {
      return NextResponse.json({ found: false, profile: null });
    }

    return NextResponse.json({
      found: true,
      profile: {
        id: profile.id,
        rut: profile.rut,
        nombre: profile.nombre,
        apellido: profile.apellido,
        email: profile.email,
        telefono: profile.telefono,
        nacionalidad: profile.nacionalidad,
        cargo: profile.cargo,
        medio: profile.medio,
        tipo_medio: profile.tipo_medio,
        foto_url: profile.foto_url,
        datos_base: profile.datos_base,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

/**
 * POST — Crea o vincula un perfil al usuario.
 * Usado durante el registro para crear el perfil con RUT.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rut, nombre, apellido, email, user_id } = body;

    if (!rut || !nombre || !apellido) {
      return NextResponse.json(
        { error: 'rut, nombre y apellido son requeridos' },
        { status: 400 }
      );
    }

    const profile = await getOrCreateProfile(
      {
        rut,
        nombre,
        apellido,
        email: email || '',
        cargo: '',
        organizacion: '',
        tipo_medio: '',
        datos_extra: {},
      },
      user_id
    );

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

/**
 * PATCH — Actualiza el perfil del usuario autenticado.
 * Solo permite editar campos seguros (no rut, no user_id).
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const profile = await getProfileByUserId(user.id);
    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = ['nombre', 'apellido', 'email', 'telefono', 'medio', 'tipo_medio', 'cargo', 'nacionalidad'];
    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
    }

    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
