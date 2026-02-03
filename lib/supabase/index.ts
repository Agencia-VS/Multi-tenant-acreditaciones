/**
 * Módulo central de Supabase
 * 
 * Re-exporta todos los clientes y utilidades de Supabase
 * para uso en diferentes contextos (server, client, middleware).
 */

import { createClient } from '@supabase/supabase-js';

// Cliente básico para compatibilidad con código existente
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Re-exportar clientes SSR
export { 
  createSupabaseServerClient, 
  createSupabaseAdminClient,
  getSession,
  getUser 
} from './server';

export { 
  createSupabaseBrowserClient, 
  getSupabaseBrowserClient 
} from './client';

export { updateSession } from './middleware';
