/**
 * Tipos para el Panel SuperAdmin
 * 
 * Define interfaces para la gestión de tenants,
 * eventos, administradores y estadísticas globales.
 * 
 * NOTA: Algunos tipos base (Tenant, Evento, AdminTenant) ya existen
 * en acreditacion.ts. Aquí definimos extensiones y tipos específicos
 * para las vistas del SuperAdmin.
 */

// Re-exportar tipos base de acreditacion para conveniencia
export type { Tenant, Evento, AdminTenant, RolAdmin } from './acreditacion';

// ============================================================================
// TIPOS BASE EXTENDIDOS
// ============================================================================

/**
 * Roles de administrador (alias)
 */
export type AdminRole = 'admin' | 'editor' | 'lector';

/**
 * Estados de acreditación
 */
export type AcreditadoStatus = 'pendiente' | 'aprobado' | 'rechazado';

// ============================================================================
// TENANT
// ============================================================================

/**
 * Tenant básico para listados y selects
 */
export interface TenantBasic {
  id: string;
  slug: string;
  nombre: string;
  color_primario: string | null;
  shield_url?: string | null;
}

/**
 * Tenant completo con todos los campos para SuperAdmin
 */
export interface TenantFull extends TenantBasic {
  logo_url: string | null;
  color_secundario: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
  created_at: string;
}

/**
 * Tenant con conteos para listados
 */
export interface TenantWithCounts extends TenantFull {
  _count?: {
    eventos: number;
    admins: number;
  };
}

/**
 * Datos del formulario de tenant
 */
export interface TenantFormData {
  nombre: string;
  slug: string;
  logo_url: string;
  shield_url: string;
  color_primario: string;
  color_secundario: string;
  instagram_url: string;
  twitter_url: string;
  youtube_url: string;
  website_url: string;
}

// ============================================================================
// EVENTO
// ============================================================================

/**
 * Evento básico
 */
export interface EventoBasic {
  id: string;
  tenant_id: string;
  nombre_evento: string | null;
  fecha: string;
}

/**
 * Evento completo para SuperAdmin
 */
export interface EventoFull extends EventoBasic {
  opponent_tenant_id: string | null;
  is_active: boolean;
  created_at: string;
}

/**
 * Evento con datos de tenants
 */
export interface EventoWithTenants extends EventoFull {
  tenant?: TenantBasic;
  opponent_tenant?: TenantBasic | null;
  _count?: {
    acreditados: number;
  };
}

/**
 * Datos del formulario de evento
 */
export interface EventoFormData {
  tenant_id: string;
  opponent_tenant_id: string;
  nombre_evento: string;
  fecha: string;
  is_active: boolean;
}

// ============================================================================
// ADMIN TENANT
// ============================================================================

/**
 * Relación admin-tenant básica (columnas de la tabla mt_admin_tenants)
 */
export interface AdminTenantBasic {
  id: string;
  user_id: string;
  tenant_id: string;
  rol: AdminRole;
  email: string | null;
  nombre: string | null;
}

/**
 * Admin-tenant con datos enriquecidos
 */
export interface AdminTenantWithDetails extends AdminTenantBasic {
  tenant?: TenantBasic;
}

/**
 * Datos del formulario de invitación
 */
export interface AdminInviteFormData {
  email: string;
  tenant_id: string;
  rol: AdminRole;
}

// ============================================================================
// ACREDITADO (VISTA SUPERADMIN)
// ============================================================================

/**
 * Acreditado para vista global del SuperAdmin
 */
export interface AcreditadoGlobal {
  id: string;
  tenant_id: string;
  evento_id: string;
  nombre: string;
  apellido: string;
  email: string;
  medio: string | null;
  tipo: string;
  status: AcreditadoStatus;
  created_at: string;
  tenant?: TenantBasic;
  evento?: EventoBasic;
}

// ============================================================================
// ESTADÍSTICAS
// ============================================================================

/**
 * Estadísticas del dashboard SuperAdmin
 */
export interface SuperAdminStats {
  totalTenants: number;
  totalEventos: number;
  totalAcreditados: number;
  pendientes: number;
}

/**
 * Estadísticas de acreditados filtrados
 */
export interface AcreditadoStats {
  total: number;
  pendientes: number;
  aprobados: number;
  rechazados: number;
}

// ============================================================================
// FILTROS
// ============================================================================

/**
 * Filtros para lista de acreditados
 */
export interface AcreditadoFilters {
  tenant_id: string;
  evento_id: string;
  status: string;
  search: string;
}

// ============================================================================
// MENSAJES UI
// ============================================================================

/**
 * Mensaje de feedback para el usuario
 */
export interface UIMessage {
  type: 'success' | 'error';
  text: string;
}

// ============================================================================
// NAVEGACIÓN
// ============================================================================

/**
 * Item de navegación del sidebar
 */
export interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}
