/**
 * Servicio de Tenants — Gestión de Clientes/Organizaciones
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { Tenant, TenantFormData, TenantWithStats, TenantAdmin } from '@/types';

/**
 * Obtener tenant por slug (para landing pages, formularios, etc.)
 */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('activo', true)
    .single();

  if (error || !data) return null;
  return data as Tenant;
}

/**
 * Listar todos los tenants (para super admin)
 */
export async function listTenants(): Promise<TenantWithStats[]> {
  const supabase = createSupabaseAdminClient();
  
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('*')
    .order('nombre');

  if (error) throw new Error(`Error listando tenants: ${error.message}`);

  // Obtener conteos para cada tenant
  const result: TenantWithStats[] = [];
  
  for (const tenant of tenants || []) {
    const [events, admins] = await Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
      supabase.from('tenant_admins').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
    ]);

    // Contar registros de todos los eventos del tenant
    const { data: eventIds } = await supabase
      .from('events')
      .select('id')
      .eq('tenant_id', tenant.id);

    let totalRegistrations = 0;
    if (eventIds && eventIds.length > 0) {
      const { count } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .in('event_id', eventIds.map((e) => e.id));
      totalRegistrations = count || 0;
    }

    result.push({
      ...(tenant as Tenant),
      total_events: events.count || 0,
      total_registrations: totalRegistrations,
      total_admins: admins.count || 0,
    });
  }

  return result;
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
      config: data.config || {},
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
 * Crear admin para un tenant
 */
export async function createTenantAdmin(
  tenantId: string,
  email: string,
  nombre: string,
  password: string
): Promise<TenantAdmin> {
  const supabase = createSupabaseAdminClient();

  // Crear usuario en Supabase Auth
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, role: 'admin_tenant' },
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
  return admin as TenantAdmin;
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
