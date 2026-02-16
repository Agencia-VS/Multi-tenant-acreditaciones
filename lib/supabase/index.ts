/**
 * Módulo central de Supabase
 * 
 * Re-exporta todos los clientes y utilidades de Supabase
 * para uso en diferentes contextos (server, client, middleware).
 */

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

export type { Database } from './database.types';
export type { Tables, TablesInsert, TablesUpdate } from './database.types';

export { updateSession } from './middleware';
