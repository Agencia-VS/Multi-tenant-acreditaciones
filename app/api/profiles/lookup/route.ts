/**
 * API: Profile — Perfil del usuario autenticado
 * GET  — Obtiene el perfil del usuario logueado (seguro, sin exposición pública)
 * POST — Crea o vincula un perfil durante el registro
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProfileByUserId, getProfileByEmail, getOrCreateProfile } from '@/lib/services';
import { getCurrentUser } from '@/lib/services';
import { profileCreateSchema, profileSignupSchema, profileUpdateSchema, safeParse } from '@/lib/schemas';
import { cleanRut, normalizeDocumentByType, sanitize } from '@/lib/validation';
import type { Profile } from '@/types';

async function createMinimalProfileForUser(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): Promise<Profile> {
  const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
  const supabase = createSupabaseAdminClient();

  const meta = user.user_metadata || {};
  const fullName = typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : '';
  const firstName = typeof meta.nombre === 'string' ? meta.nombre : (fullName ? fullName.split(' ')[0] : null);
  const lastName = typeof meta.apellido === 'string' ? meta.apellido : (fullName ? fullName.split(' ').slice(1).join(' ') : null);

  const tempDocumentNumber = `TEMP-${user.id}`;

  const insertData: Record<string, unknown> = {
    user_id: user.id,
    nombre: firstName || null,
    apellido: lastName || null,
    email: user.email || null,
    document_type: 'dni_extranjero',
    document_number: tempDocumentNumber,
    document_normalized: normalizeDocumentByType('dni_extranjero', tempDocumentNumber),
    rut: null,
  };

  const { data: createdProfile, error } = await supabase
    .from('profiles')
    .insert(insertData as never)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return createdProfile as unknown as Profile;
}

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
      // Garantiza perfil para cualquier usuario autenticado
      try {
        profile = await createMinimalProfileForUser(user as { id: string; email?: string | null; user_metadata?: Record<string, unknown> });
        console.info(`[profiles/lookup] Perfil mínimo creado automáticamente para user_id ${user.id}`);
      } catch (createError) {
        // Condición de carrera: si otro proceso lo creó, volver a consultar
        profile = await getProfileByUserId(user.id);
        if (!profile) {
          console.error('[profiles/lookup] Error autocreando perfil mínimo:', createError);
          return NextResponse.json({ found: false, profile: null });
        }
      }
    }

    if (!profile) {
      return NextResponse.json({ found: false, profile: null });
    }

    return NextResponse.json({
      found: true,
      profile: {
        id: profile.id,
        document_type: (profile as unknown as Record<string, unknown>).document_type || null,
        document_number: (profile as unknown as Record<string, unknown>).document_number || null,
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
 * POST — Crea o vincula un perfil al usuario autenticado.
 * Usado durante el registro para crear el perfil con RUT.
 * Seguridad: user_id se toma de la sesión, no del body.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    
    // Try full schema first (with RUT), fallback to signup schema (email only)
    const fullParsed = safeParse(profileCreateSchema, body);
    if (fullParsed.success) {
      // Full profile creation (with RUT) — used by accreditation form & bulk
      const { rut, nombre, apellido, email } = fullParsed.data;
      const profile = await getOrCreateProfile(
        {
          rut,
          nombre,
          apellido,
          email: email || user.email || '',
          cargo: '',
          organizacion: '',
          tipo_medio: '',
          datos_extra: {},
        },
        user.id
      );
      return NextResponse.json({ success: true, profile });
    }

    // Lite signup — create minimal profile (no RUT required)
    const liteParsed = safeParse(profileSignupSchema, body);
    if (liteParsed.success || Object.keys(body).length === 0) {
      // Check if profile already exists
      let profile = await getProfileByUserId(user.id);
      if (!profile && user.email) {
        profile = await getProfileByEmail(user.email);
      }
      if (profile) {
        return NextResponse.json({ success: true, profile });
      }

      // Create minimal profile — nombre/apellido/rut nullable after P0 migration
      const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
      const supabase = createSupabaseAdminClient();
      const tempDocumentNumber = `TEMP-${user.id}`;
      const insertData: Record<string, unknown> = {
        user_id: user.id,
        nombre: body.nombre || null,
        apellido: body.apellido || null,
        email: body.email || user.email || null,
        document_type: 'dni_extranjero',
        document_number: tempDocumentNumber,
        document_normalized: normalizeDocumentByType('dni_extranjero', tempDocumentNumber),
        rut: null,
      };
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert(insertData as never)
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, profile: newProfile });
    }

    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
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
    const parsed = safeParse(profileUpdateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const updates = { ...parsed.data } as Record<string, unknown>;

    const existingRecord = profile as unknown as Record<string, unknown>;
    const incomingDocType = typeof updates.document_type === 'string' ? updates.document_type : undefined;
    const incomingDocNumber = typeof updates.document_number === 'string' ? sanitize(updates.document_number) : undefined;
    const incomingRut = typeof updates.rut === 'string' ? sanitize(updates.rut) : undefined;

    const resolvedDocType = (incomingDocType || (typeof existingRecord.document_type === 'string' ? existingRecord.document_type : 'rut')) === 'dni_extranjero'
      ? 'dni_extranjero'
      : 'rut';
    const resolvedDocNumber = incomingDocNumber || incomingRut;

    if (resolvedDocNumber) {
      updates.document_type = resolvedDocType;
      updates.document_number = resolvedDocNumber;
      updates.document_normalized = normalizeDocumentByType(resolvedDocType, resolvedDocNumber);
      updates.rut = resolvedDocType === 'rut' ? cleanRut(resolvedDocNumber) : null;
    }

    // Limpieza defensiva: no aceptar document_type sin documento
    if (incomingDocType && !resolvedDocNumber) {
      return NextResponse.json({ error: 'document_number es requerido cuando se informa document_type' }, { status: 400 });
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
