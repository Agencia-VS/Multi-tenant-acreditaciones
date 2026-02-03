/**
 * Componente de Verificación de Auth para Server Components
 * 
 * Verifica la autenticación en el servidor y redirige si es necesario.
 * Se usa en layouts de rutas protegidas.
 */

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../lib/supabase/server';

// ============================================================================
// TIPOS
// ============================================================================

export interface AuthCheckResult {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
  } | null;
  isSuperAdmin: boolean;
  tenantRole: 'admin' | 'editor' | 'lector' | null;
}

interface AuthGuardProps {
  children: React.ReactNode;
  /** Ruta de redirección si no está autenticado */
  loginPath?: string;
  /** Si requiere ser superadmin */
  requireSuperAdmin?: boolean;
  /** Slug del tenant para verificar acceso */
  tenantSlug?: string;
  /** Rol mínimo requerido en el tenant */
  requiredRole?: 'admin' | 'editor' | 'lector';
}

// ============================================================================
// FUNCIONES DE VERIFICACIÓN (SERVER-SIDE)
// ============================================================================

/**
 * Verifica si el usuario actual es superadmin
 */
export async function checkIsSuperAdmin(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('mt_superadmins')
    .select('id')
    .eq('user_id', userId)
    .single();

  return !error && !!data;
}

/**
 * Obtiene el rol del usuario en un tenant específico
 */
export async function getTenantRole(
  userId: string, 
  tenantSlug: string
): Promise<'admin' | 'editor' | 'lector' | null> {
  const supabase = await createSupabaseServerClient();

  // Primero obtener el tenant_id
  const { data: tenant, error: tenantError } = await supabase
    .from('mt_tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .single();

  if (tenantError || !tenant) {
    return null;
  }

  // Luego verificar el rol
  const { data: adminTenant, error: adminError } = await supabase
    .from('mt_admin_tenants')
    .select('rol')
    .eq('user_id', userId)
    .eq('tenant_id', tenant.id)
    .single();

  if (adminError || !adminTenant) {
    return null;
  }

  return adminTenant.rol as 'admin' | 'editor' | 'lector';
}

/**
 * Verifica la autenticación completa del usuario
 */
export async function checkAuth(tenantSlug?: string): Promise<AuthCheckResult> {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      isAuthenticated: false,
      user: null,
      isSuperAdmin: false,
      tenantRole: null,
    };
  }

  const isSuperAdmin = await checkIsSuperAdmin(user.id);
  
  let tenantRole: 'admin' | 'editor' | 'lector' | null = null;
  if (tenantSlug) {
    // Si es superadmin, tiene rol admin en todos los tenants
    if (isSuperAdmin) {
      tenantRole = 'admin';
    } else {
      tenantRole = await getTenantRole(user.id, tenantSlug);
    }
  }

  return {
    isAuthenticated: true,
    user: {
      id: user.id,
      email: user.email || '',
    },
    isSuperAdmin,
    tenantRole,
  };
}

// ============================================================================
// COMPONENTES SERVER
// ============================================================================

/**
 * Componente de guardia de autenticación para Server Components.
 * Redirige automáticamente si no cumple los requisitos.
 * 
 * @example
 * ```tsx
 * // En un layout de admin
 * export default async function AdminLayout({ children }) {
 *   return (
 *     <AuthGuard 
 *       tenantSlug="cruzados" 
 *       loginPath="/cruzados/admin/login"
 *     >
 *       {children}
 *     </AuthGuard>
 *   );
 * }
 * ```
 */
export async function AuthGuard({
  children,
  loginPath = '/auth/login',
  requireSuperAdmin = false,
  tenantSlug,
  requiredRole = 'lector',
}: AuthGuardProps) {
  const auth = await checkAuth(tenantSlug);

  // No autenticado
  if (!auth.isAuthenticated) {
    redirect(loginPath);
  }

  // Requiere superadmin pero no lo es
  if (requireSuperAdmin && !auth.isSuperAdmin) {
    redirect('/auth/access-denied');
  }

  // Requiere acceso a tenant pero no tiene rol
  if (tenantSlug && !auth.isSuperAdmin && !auth.tenantRole) {
    redirect('/auth/access-denied');
  }

  // Verificar rol mínimo (solo si no es superadmin)
  if (tenantSlug && !auth.isSuperAdmin && auth.tenantRole) {
    const roleHierarchy = { lector: 1, editor: 2, admin: 3 };
    const userRoleLevel = roleHierarchy[auth.tenantRole];
    const requiredRoleLevel = roleHierarchy[requiredRole];

    if (userRoleLevel < requiredRoleLevel) {
      redirect('/auth/access-denied');
    }
  }

  return <>{children}</>;
}

/**
 * Componente de guardia específico para SuperAdmin
 */
export async function SuperAdminGuard({ 
  children,
  loginPath = '/superadmin/login',
}: { 
  children: React.ReactNode;
  loginPath?: string;
}) {
  return (
    <AuthGuard requireSuperAdmin loginPath={loginPath}>
      {children}
    </AuthGuard>
  );
}

/**
 * Componente de guardia específico para Admin de Tenant
 */
export async function TenantAdminGuard({
  children,
  tenantSlug,
  requiredRole = 'lector',
}: {
  children: React.ReactNode;
  tenantSlug: string;
  requiredRole?: 'admin' | 'editor' | 'lector';
}) {
  return (
    <AuthGuard
      tenantSlug={tenantSlug}
      requiredRole={requiredRole}
      loginPath={`/${tenantSlug}/admin/login`}
    >
      {children}
    </AuthGuard>
  );
}
