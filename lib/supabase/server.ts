/**
 * Cliente Supabase para Server Components y Route Handlers
 * 
 * Usa cookies para manejar la sesión en el servidor.
 * Compatible con Next.js 14+ App Router.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

/**
 * Crea un cliente Supabase para uso en Server Components.
 * Lee las cookies de forma segura usando next/headers.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // El método setAll fue llamado desde un Server Component.
            // Esto se puede ignorar si tienes middleware que refresca la sesión.
          }
        },
      },
    }
  );
}

/**
 * Crea un cliente Supabase con Service Role para operaciones admin.
 * ⚠️ Solo usar en el servidor, nunca exponer al cliente.
 */
export function createSupabaseAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Obtiene la sesión actual del usuario.
 * Retorna null si no hay sesión activa.
 */
export async function getSession() {
  const supabase = await createSupabaseServerClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  
  return session;
}

/**
 * Obtiene el usuario actual.
 * Usa getUser() para verificar el JWT contra Supabase Auth.
 */
export async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  
  return user;
}
