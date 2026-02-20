/**
 * API: Auth Callback
 * Maneja el callback de Supabase Auth (magic links, OAuth, email confirm)
 * Crea perfil parcial (sin RUT) si es un usuario nuevo.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getProfileByUserId } from '@/lib/services/profiles';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  // Detectar el origin real (Codespace, proxy, o directo)
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const host = forwardedHost || request.headers.get('host') || 'localhost:3000';
  const origin = forwardedHost
    ? `${forwardedProto}://${host}`
    : new URL(request.url).origin;

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.warn('[auth/callback] Code exchange error:', error.message);
      // Fallback: verificar si hay sesión existente (código ya consumido por otro handler)
      const { data: { user: fallbackUser } } = await supabase.auth.getUser();
      if (fallbackUser) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      return NextResponse.redirect(`${origin}/auth/acreditado?error=auth`);
    }

    if (data.user) {
      // Crear perfil si no existe (soporta OAuth y email signup)
      try {
        const existing = await getProfileByUserId(data.user.id);
        if (!existing) {
          const meta = data.user.user_metadata || {};
          const adminClient = createSupabaseAdminClient();
          const insertData: Record<string, unknown> = {
            user_id: data.user.id,
            nombre: meta.nombre || meta.full_name?.split(' ')[0] || meta.name?.split(' ')[0] || null,
            apellido: meta.apellido || meta.full_name?.split(' ').slice(1).join(' ') || meta.name?.split(' ').slice(1).join(' ') || null,
            email: data.user.email || null,
            rut: meta.rut || null,
          };
          await adminClient.from('profiles').insert(insertData as never);
        }
      } catch (e) {
        console.error('[auth/callback] Error creando perfil:', e);
      }
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  // Sin código — verificar si hay sesión activa
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/auth/acreditado?error=auth`);
}
