/**
 * Servicio de Tenants — Gestión de Clientes/Organizaciones
 */

import { randomBytes } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { Tenant, TenantFormData, TenantWithStats, TenantAdmin } from '@/types';
import { cache } from 'react';

/**
 * Obtener tenant por slug (para landing pages, formularios, etc.)
 * Envuelto en React.cache() para deduplicar queries dentro del mismo request SSR.
 */
export const getTenantBySlug = cache(async (slug: string): Promise<Tenant | null> => {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('activo', true)
    .single();

  if (error || !data) return null;
  return data as Tenant;
});

/**
 * Obtener tenant por ID (para APIs internas como export)
 */
export async function getTenantById(id: string): Promise<Tenant | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as Tenant;
}

/**
 * Listar todos los tenants (para super admin)
 * Usa la vista v_tenant_stats para obtener conteos en 1 sola query
 */
export async function listTenants(): Promise<TenantWithStats[]> {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('v_tenant_stats')
    .select('*')
    .order('nombre');

  if (error) throw new Error(`Error listando tenants: ${error.message}`);

  return (data || []).map((t) => ({
    ...(t as unknown as Tenant),
    total_events: Number(t.total_events) || 0,
    total_registrations: Number(t.total_registrations) || 0,
    total_admins: Number(t.total_admins) || 0,
  })) as TenantWithStats[];
}

/**
 * Crear un nuevo tenant
 */
export async function createTenant(data: TenantFormData): Promise<Tenant> {
  const supabase = createSupabaseAdminClient();
  
  const { data: tenant, error } = await supabase
    .from('tenants')
    .insert({
      nombre: data.nombre,
      slug: data.slug,
      logo_url: data.logo_url || null,
      color_primario: data.color_primario || '#1a1a2e',
      color_secundario: data.color_secundario || '#e94560',
      color_light: data.color_light || '#f5f5f5',
      color_dark: data.color_dark || '#0f0f1a',
      shield_url: data.shield_url || null,
      background_url: data.background_url || null,
      config: (data.config || {}) as any,
    })
    .select()
    .single();

  if (error) throw new Error(`Error creando tenant: ${error.message}`);
  return tenant as Tenant;
}

/**
 * Actualizar un tenant
 */
export async function updateTenant(tenantId: string, data: Partial<TenantFormData>): Promise<Tenant> {
  const supabase = createSupabaseAdminClient();

  // Sanitize: exclude immutable fields, convert empty strings to null for URLs
  const { slug, ...rest } = data as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  const urlFields = ['logo_url', 'shield_url', 'background_url', 'opponent_logo_url'];

  for (const [key, value] of Object.entries(rest)) {
    if (key === 'id' || key === 'created_at' || key === 'stats') continue;
    sanitized[key] = urlFields.includes(key) && value === '' ? null : value;
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .update(sanitized)
    .eq('id', tenantId)
    .select()
    .single();

  if (error) throw new Error(`Error actualizando tenant: ${error.message}`);
  return tenant as Tenant;
}

/**
 * Crear admin para un tenant.
 * Si no se proporciona password, se genera una contraseña temporal
 * y se marca al usuario para que cambie la contraseña en su primer inicio de sesión.
 */
export async function createTenantAdmin(
  tenantId: string,
  email: string,
  nombre: string,
  password?: string
): Promise<TenantAdmin & { tempPassword?: string }> {
  const supabase = createSupabaseAdminClient();

  // Auto-generar contraseña temporal si no se recibe
  const isTemp = !password;
  const finalPassword = password || randomBytes(12).toString('base64url');

  // Crear usuario en Supabase Auth
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: finalPassword,
    email_confirm: true,
    user_metadata: {
      nombre,
      role: 'admin_tenant',
      ...(isTemp ? { must_change_password: true } : {}),
    },
  });

  if (authError) throw new Error(`Error creando usuario: ${authError.message}`);

  // Crear registro en tenant_admins
  const { data: admin, error } = await supabase
    .from('tenant_admins')
    .insert({
      user_id: authUser.user.id,
      tenant_id: tenantId,
      rol: 'admin',
      nombre,
      email,
    })
    .select()
    .single();

  if (error) throw new Error(`Error asignando admin: ${error.message}`);

  return {
    ...(admin as TenantAdmin),
    ...(isTemp ? { tempPassword: finalPassword } : {}),
  };
}

/**
 * Listar admins de un tenant
 */
export async function listTenantAdmins(tenantId: string): Promise<TenantAdmin[]> {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('tenant_admins')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at');

  if (error) throw new Error(`Error listando admins: ${error.message}`);
  return (data || []) as TenantAdmin[];
}

/**
 * Listar todos los tenants activos (para landing pública)
 */
export async function listActiveTenants(): Promise<Tenant[]> {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('activo', true)
    .order('nombre');

  if (error) throw new Error(`Error listando tenants: ${error.message}`);
  return (data || []) as Tenant[];
}

/**
 * Eliminar un tenant y todos sus datos asociados.
 * 
 * Las tablas hijas se eliminan por CASCADE en SQL (events, registrations,
 * registration_days, event_quota_rules, event_zone_rules, event_days,
 * tenant_admins, email_templates, email_zone_content).
 * 
 * Adicionalmente se limpia:
 * - Auth users de los tenant_admins
 * - Archivos en storage bucket 'assets' bajo la carpeta del tenant
 */
export async function deleteTenant(tenantId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // 1. Obtener tenant para saber slug (para storage cleanup)
  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .single();

  if (!tenant) throw new Error('Tenant no encontrado');

  // 2. Obtener auth user_ids de los admins antes de que se eliminen por cascade
  const { data: admins } = await supabase
    .from('tenant_admins')
    .select('user_id')
    .eq('tenant_id', tenantId);

  // 3. Eliminar tenant (SQL CASCADE limpia: events, registrations, etc.)
  const { error: deleteError } = await supabase
    .from('tenants')
    .delete()
    .eq('id', tenantId);

  if (deleteError) throw new Error(`Error eliminando tenant: ${deleteError.message}`);

  // 4. Eliminar auth users de los admins (post-cascade, no bloquean)
  if (admins?.length) {
    for (const admin of admins) {
      try {
        await supabase.auth.admin.deleteUser(admin.user_id);
      } catch {
        // No bloquear si falla eliminar un auth user
      }
    }
  }

  // 5. Limpiar archivos en storage (logos, escudos, backgrounds)
  try {
    const { data: files } = await supabase.storage
      .from('assets')
      .list(`tenants/${tenant.slug}`);

    if (files?.length) {
      const filePaths = files.map(f => `tenants/${tenant.slug}/${f.name}`);
      await supabase.storage.from('assets').remove(filePaths);
    }
  } catch {
    // No bloquear si falla la limpieza de storage
  }
}
