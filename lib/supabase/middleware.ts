/**
 * Cliente Supabase para Middleware
 * 
 * Maneja la renovación de sesión en cada request.
 * Actualiza las cookies automáticamente.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Actualiza la sesión de Supabase en el middleware.
 * Refresca el token si está por expirar.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: No usar getSession() aquí
  // getUser() valida el token contra Supabase Auth.
  // Si el refresh token expiró, getUser() devuelve error y user null —
  // no bloqueamos; los guards de cada layout redirigen al login.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Si el token es inválido, limpiamos las cookies de auth para que
  // el siguiente request no siga intentando refrescar un token muerto.
  if (error) {
    // Borrar cookies de Supabase para evitar loops de "Refresh Token Not Found"
    const cookieNames = request.cookies
      .getAll()
      .map((c) => c.name)
      .filter((n) => n.startsWith('sb-'));
    for (const name of cookieNames) {
      supabaseResponse.cookies.delete(name);
    }
  }

  return { supabaseResponse, user, supabase };
}
