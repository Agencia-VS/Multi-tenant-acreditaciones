/**
 * Servicio de Proveedores Autorizados
 * CRUD + lógica de negocio para tenant_providers
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { TenantProvider, TenantProviderFull, ProviderStatus, Profile } from '@/types';

// ─── Queries ─────────────────────────────────────────────────

/** Obtener proveedor por ID */
export async function getProviderById(providerId: string): Promise<TenantProvider | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('tenant_providers')
    .select('*')
    .eq('id', providerId)
    .single();

  if (error || !data) return null;
  return data as TenantProvider;
}

/** Obtener proveedor por tenant + profile */
export async function getProviderByTenantAndProfile(
  tenantId: string,
  profileId: string,
): Promise<TenantProvider | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('tenant_providers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('profile_id', profileId)
    .single();

  if (error || !data) return null;
  return data as TenantProvider;
}

/** Listar proveedores de un tenant (con perfil expandido) */
export async function listProvidersByTenant(
  tenantId: string,
  statusFilter?: ProviderStatus,
): Promise<TenantProviderFull[]> {
  const supabase = createSupabaseAdminClient();

  // Fetch providers
  let query = supabase
    .from('tenant_providers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data: providers, error } = await query;
  if (error) throw new Error(`Error listando proveedores: ${error.message}`);
  if (!providers || providers.length === 0) return [];

  // Fetch profiles for all providers in one query
  const profileIds = [...new Set(providers.map(p => p.profile_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('id', profileIds);

  const profileMap = new Map((profiles || []).map(p => [p.id, p as Profile]));

  return providers.map(provider => ({
    ...provider,
    profile: profileMap.get(provider.profile_id),
  })) as TenantProviderFull[];
}

/** Listar accesos (proveedores) de un perfil */
export async function listProvidersByProfile(profileId: string): Promise<TenantProvider[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('tenant_providers')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Error listando accesos: ${error.message}`);
  return (data || []) as TenantProvider[];
}

/** Contar proveedores por status para un tenant */
export async function getProviderStats(tenantId: string): Promise<Record<ProviderStatus | 'total', number>> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('tenant_providers')
    .select('status')
    .eq('tenant_id', tenantId);

  if (error) throw new Error(`Error obteniendo stats: ${error.message}`);

  const stats: Record<string, number> = { total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 };
  for (const row of data || []) {
    stats.total++;
    stats[row.status] = (stats[row.status] || 0) + 1;
  }
  return stats as Record<ProviderStatus | 'total', number>;
}

// ─── Mutations ───────────────────────────────────────────────

/** Crear solicitud de acceso (acreditado → tenant) */
export async function createProviderRequest(data: {
  tenantId: string;
  profileId: string;
  organizacion?: string;
  mensaje?: string;
}): Promise<TenantProvider> {
  const supabase = createSupabaseAdminClient();

  // Check if already exists
  const existing = await getProviderByTenantAndProfile(data.tenantId, data.profileId);
  if (existing) {
    // If previously rejected, allow re-request
    if (existing.status === 'rejected') {
      const { data: updated, error } = await supabase
        .from('tenant_providers')
        .update({
          status: 'pending',
          mensaje: data.mensaje || existing.mensaje,
          organizacion: data.organizacion || existing.organizacion,
          motivo_rechazo: null,
          rejected_at: null,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw new Error(`Error re-solicitando acceso: ${error.message}`);
      return updated as TenantProvider;
    }

    throw new Error(
      existing.status === 'pending'
        ? 'Ya tienes una solicitud pendiente para esta organización'
        : existing.status === 'approved'
          ? 'Ya tienes acceso a esta organización'
          : 'Tu acceso está suspendido. Contacta al administrador'
    );
  }

  const { data: provider, error } = await supabase
    .from('tenant_providers')
    .insert({
      tenant_id: data.tenantId,
      profile_id: data.profileId,
      organizacion: data.organizacion || null,
      mensaje: data.mensaje || null,
      status: 'pending',
      allowed_zones: [],
    })
    .select()
    .single();

  if (error) throw new Error(`Error creando solicitud: ${error.message}`);
  return provider as TenantProvider;
}

/** Aprobar proveedor con zonas asignadas (admin) */
export async function approveProvider(
  providerId: string,
  data: {
    allowedZones: string[];
    notas?: string;
    approvedBy: string;
  },
): Promise<TenantProvider> {
  if (!data.allowedZones || data.allowedZones.length === 0) {
    throw new Error('Debes asignar al menos una zona al proveedor');
  }

  const supabase = createSupabaseAdminClient();
  const { data: provider, error } = await supabase
    .from('tenant_providers')
    .update({
      status: 'approved',
      allowed_zones: data.allowedZones,
      notas: data.notas || null,
      approved_by: data.approvedBy,
      approved_at: new Date().toISOString(),
      motivo_rechazo: null,
      rejected_at: null,
    })
    .eq('id', providerId)
    .select()
    .single();

  if (error) throw new Error(`Error aprobando proveedor: ${error.message}`);
  return provider as TenantProvider;
}

/** Rechazar proveedor (admin) */
export async function rejectProvider(
  providerId: string,
  motivo?: string,
): Promise<TenantProvider> {
  const supabase = createSupabaseAdminClient();
  const { data: provider, error } = await supabase
    .from('tenant_providers')
    .update({
      status: 'rejected',
      motivo_rechazo: motivo || null,
      rejected_at: new Date().toISOString(),
    })
    .eq('id', providerId)
    .select()
    .single();

  if (error) throw new Error(`Error rechazando proveedor: ${error.message}`);
  return provider as TenantProvider;
}

/** Suspender proveedor (admin) */
export async function suspendProvider(providerId: string): Promise<TenantProvider> {
  const supabase = createSupabaseAdminClient();
  const { data: provider, error } = await supabase
    .from('tenant_providers')
    .update({ status: 'suspended' })
    .eq('id', providerId)
    .select()
    .single();

  if (error) throw new Error(`Error suspendiendo proveedor: ${error.message}`);
  return provider as TenantProvider;
}

/** Actualizar zonas de un proveedor aprobado (admin) */
export async function updateProviderZones(
  providerId: string,
  allowedZones: string[],
): Promise<TenantProvider> {
  if (!allowedZones || allowedZones.length === 0) {
    throw new Error('Debes asignar al menos una zona');
  }

  const supabase = createSupabaseAdminClient();
  const { data: provider, error } = await supabase
    .from('tenant_providers')
    .update({ allowed_zones: allowedZones })
    .eq('id', providerId)
    .select()
    .single();

  if (error) throw new Error(`Error actualizando zonas: ${error.message}`);
  return provider as TenantProvider;
}

/** Eliminar proveedor (superadmin) */
export async function deleteProvider(providerId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('tenant_providers')
    .delete()
    .eq('id', providerId);

  if (error) throw new Error(`Error eliminando proveedor: ${error.message}`);
}

// ─── Invite Code ─────────────────────────────────────────────

/** Generar código de invitación aleatorio (8 caracteres alfanuméricos) */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/** Generar o regenerar código de invitación para un tenant */
export async function generateInviteCode_forTenant(tenantId: string): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const code = generateInviteCode();

  // Read current config, merge new code
  const { data: tenant, error: readErr } = await supabase
    .from('tenants')
    .select('config')
    .eq('id', tenantId)
    .single();

  if (readErr || !tenant) throw new Error('Tenant no encontrado');

  const currentConfig = (tenant.config && typeof tenant.config === 'object' ? tenant.config : {}) as Record<string, unknown>;
  const newConfig = { ...currentConfig, provider_invite_code: code };

  const { error } = await supabase
    .from('tenants')
    .update({ config: newConfig })
    .eq('id', tenantId);

  if (error) throw new Error(`Error generando código: ${error.message}`);
  return code;
}

/** Validar código de invitación contra el tenant */
export async function validateInviteCode(tenantSlug: string, code: string): Promise<{
  valid: boolean;
  tenantId?: string;
  tenantNombre?: string;
  tenantLogo?: string | null;
  tenantDescription?: string;
}> {
  const supabase = createSupabaseAdminClient();
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, nombre, slug, logo_url, config')
    .eq('slug', tenantSlug)
    .eq('activo', true)
    .single();

  if (error || !tenant) {
    return { valid: false };
  }

  const config = (tenant.config && typeof tenant.config === 'object' ? tenant.config : {}) as Record<string, unknown>;

  if (config.provider_mode !== 'approved_only') {
    return { valid: false };
  }

  if (!config.provider_invite_code || config.provider_invite_code !== code) {
    return { valid: false };
  }

  return {
    valid: true,
    tenantId: tenant.id,
    tenantNombre: tenant.nombre,
    tenantLogo: tenant.logo_url,
    tenantDescription: (config.provider_description as string) || undefined,
  };
}

// ─── Toggle Module ───────────────────────────────────────────

/** Activar/desactivar módulo de proveedores para un tenant (superadmin) */
export async function toggleProviderMode(
  tenantId: string,
  enabled: boolean,
): Promise<{ provider_mode: string; provider_invite_code?: string }> {
  const supabase = createSupabaseAdminClient();

  const { data: tenant, error: readErr } = await supabase
    .from('tenants')
    .select('config')
    .eq('id', tenantId)
    .single();

  if (readErr || !tenant) throw new Error('Tenant no encontrado');

  const currentConfig = (tenant.config && typeof tenant.config === 'object' ? tenant.config : {}) as Record<string, unknown>;

  if (enabled) {
    // Validate tenant has zonas configured
    const zonas = currentConfig.zonas;
    if (!Array.isArray(zonas) || zonas.length === 0) {
      throw new Error('El tenant debe tener zonas configuradas antes de activar el módulo de proveedores');
    }

    // Generate invite code if not present
    const inviteCode = (currentConfig.provider_invite_code as string) || generateInviteCode();

    const newConfig = {
      ...currentConfig,
      provider_mode: 'approved_only',
      provider_invite_code: inviteCode,
    };

    const { error } = await supabase
      .from('tenants')
      .update({ config: newConfig })
      .eq('id', tenantId);

    if (error) throw new Error(`Error activando módulo: ${error.message}`);
    return { provider_mode: 'approved_only', provider_invite_code: inviteCode };
  } else {
    // Disable — set to open but keep the rest of config
    const newConfig = {
      ...currentConfig,
      provider_mode: 'open',
    };

    const { error } = await supabase
      .from('tenants')
      .update({ config: newConfig })
      .eq('id', tenantId);

    if (error) throw new Error(`Error desactivando módulo: ${error.message}`);
    return { provider_mode: 'open' };
  }
}
