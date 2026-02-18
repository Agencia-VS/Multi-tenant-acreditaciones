/**
 * API: Auth Callback
 * Maneja el callback de Supabase Auth (magic links, OAuth, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrCreateProfile } from '@/lib/services/profiles';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user) {
      // Crear o vincular perfil con datos del user_metadata (guardados en signUp)
      const meta = data.user.user_metadata || {};
      if (meta.rut) {
        try {
          await getOrCreateProfile(
            {
              rut: meta.rut,
              nombre: meta.nombre || '',
              apellido: meta.apellido || '',
              email: data.user.email || '',
              cargo: '',
              organizacion: '',
              tipo_medio: '',
              datos_extra: {},
            },
            data.user.id
          );
        } catch (e) {
          console.error('[auth/callback] Error creando perfil:', e);
        }
      }
    }

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/acreditado?error=auth_callback_error`);
}
