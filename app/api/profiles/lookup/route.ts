/**
 * API: Profile — Perfil del usuario autenticado
 * GET  — Obtiene el perfil del usuario logueado (seguro, sin exposición pública)
 * POST — Crea o vincula un perfil durante el registro
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProfileByUserId, getOrCreateProfile } from '@/lib/services';
import { getCurrentUser } from '@/lib/services';

/**
 * GET — Retorna el perfil del usuario autenticado.
 * NUNCA expone datos de otros usuarios por RUT.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const profile = await getProfileByUserId(user.id);

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
