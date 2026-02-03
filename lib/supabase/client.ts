/**
 * Cliente Supabase para Client Components
 * 
 * Usa el browser para manejar cookies automáticamente.
 * Solo para uso en componentes con "use client".
 */

import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Verifica que las variables de entorno estén configuradas
 */
function validateEnvVars(): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const missing: string[] = [];
    if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    
    throw new Error(
      `⚠️ Faltan variables de entorno de Supabase:\n\n` +
      `Variables faltantes: ${missing.join(', ')}\n\n` +
      `Para configurarlas:\n` +
      `1. Copia el archivo 'env-example' a '.env.local'\n` +
      `2. Completa las variables con tus credenciales de Supabase\n` +
      `3. Reinicia el servidor de desarrollo\n\n` +
      `Obtén tus credenciales en: https://supabase.com/dashboard/project/_/settings/api`
    );
  }
}

/**
 * Crea un cliente Supabase singleton para el navegador.
 * Maneja automáticamente el refresh de tokens y la persistencia de sesión.
 */
export function createSupabaseBrowserClient() {
  validateEnvVars();
  return createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}

// Singleton para evitar múltiples instancias
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Obtiene el cliente Supabase del navegador (singleton).
 * Reutiliza la misma instancia para toda la aplicación.
 */
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createSupabaseBrowserClient();
  }
  return browserClient;
}
