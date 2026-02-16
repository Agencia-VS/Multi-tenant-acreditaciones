/**
 * Servicio de Auth — Verificación de roles y permisos
 */

import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Obtener el usuario autenticado actual (server-side)
 */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Verificar si el usuario actual es superadmin
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('superadmins')
    .select('id')
    .eq('user_id', userId)
    .single();
  return !!data;
}

/**
 * Verificar si el usuario es admin de un tenant
 */
export async function isTenantAdmin(userId: string, tenantId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('tenant_admins')
    .select('id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .single();
  return !!data;
}

/**
 * Obtener el rol del usuario en un tenant
 * Combina superadmin + tenant_admin check en queries paralelas
 */
export async function getUserTenantRole(userId: string, tenantId: string): Promise<string> {
  const supabase = createSupabaseAdminClient();

  // Verificar superadmin y tenant_admin en paralelo (1 round-trip)
  const [superadminResult, tenantAdminResult] = await Promise.all([
    supabase.from('superadmins').select('id').eq('user_id', userId).single(),
    supabase.from('tenant_admins').select('rol').eq('user_id', userId).eq('tenant_id', tenantId).single(),
  ]);

  if (superadminResult.data) return 'superadmin';
  return tenantAdminResult.data?.rol || 'none';
}

/**
 * Verificar acceso a un tenant (superadmin o admin del tenant)
 */
export async function hasAccessToTenant(userId: string, tenantId: string): Promise<boolean> {
  if (await isSuperAdmin(userId)) return true;
  return isTenantAdmin(userId, tenantId);
}
