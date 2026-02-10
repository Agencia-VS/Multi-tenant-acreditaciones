/**
 * API: Auth Callback
 * Maneja el callback de Supabase Auth (magic links, OAuth, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { linkProfileToUser } from '@/lib/services/profiles';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user) {
      // Si el usuario tiene RUT en metadata, vincular con perfil existente
      const rut = data.user.user_metadata?.rut;
      if (rut) {
        await linkProfileToUser(rut, data.user.id);
      }
    }

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/acreditado?error=auth_callback_error`);
}
