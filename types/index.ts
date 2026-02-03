/**
 * Barrel export para todos los tipos del sistema
 */

// Tipos de acreditación (formularios, estados, etc.)
export * from './acreditacion';

// Tipos de base de datos (Supabase)
export * from './database';

// Tipos del panel SuperAdmin (extensiones y vistas)
// Nota: Re-exporta Tenant, Evento, AdminTenant desde acreditacion
export {
  // Tipos básicos
  type AdminRole,
  type AcreditadoStatus,
  // Tenant extendido
  type TenantBasic,
  type TenantFull,
  type TenantWithCounts,
  type TenantFormData,
  // Evento extendido
  type EventoBasic,
  type EventoFull,
  type EventoWithTenants,
  type EventoFormData,
  // Admin extendido
  type AdminTenantBasic,
  type AdminTenantWithDetails,
  type AdminInviteFormData,
  // Acreditados vista global
  type AcreditadoGlobal,
  // Estadísticas
  type SuperAdminStats,
  type AcreditadoStats,
  // Filtros
  type AcreditadoFilters,
  // UI
  type UIMessage,
  type NavItem,
} from './superadmin';

// Tipos de autenticación para acreditados
export * from './auth-acreditado';
