/**
 * Componentes de Protección de Rutas
 * 
 * Componentes reutilizables para proteger rutas basadas en roles.
 * Se usan en conjunto con el middleware para doble verificación.
 */

"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserRole, type TenantRole } from "../../hooks/useUserRole";
import LoadingSpinner from "../common/LoadingSpinner";

// ============================================================================
// TIPOS
// ============================================================================

export interface ProtectedRouteProps {
  children: ReactNode;
  /** Rol mínimo requerido (admin > editor > lector) */
  requiredRole?: TenantRole;
  /** Si solo superadmins pueden acceder */
  superAdminOnly?: boolean;
  /** Slug del tenant para verificar acceso */
  tenantSlug?: string;
  /** Mensaje personalizado de loading */
  loadingMessage?: string;
  /** Ruta de redirección si no hay acceso */
  redirectTo?: string;
  /** Callback cuando se detecta acceso denegado */
  onAccessDenied?: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Jerarquía de roles (mayor número = mayor permiso) */
const ROLE_HIERARCHY: Record<TenantRole, number> = {
  lector: 1,
  editor: 2,
  admin: 3,
};

/**
 * Verifica si un rol tiene suficientes permisos
 */
function hasMinimumRole(userRole: TenantRole | null, requiredRole: TenantRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// ============================================================================
// COMPONENTES
// ============================================================================

/**
 * Componente de protección de ruta genérico.
 * Verifica autenticación y roles antes de renderizar el contenido.
 * 
 * @example
 * ```tsx
 * // Proteger con rol mínimo de editor
 * <ProtectedRoute tenantSlug="cruzados" requiredRole="editor">
 *   <DashboardContent />
 * </ProtectedRoute>
 * 
 * // Solo superadmins
 * <ProtectedRoute superAdminOnly>
 *   <SuperAdminPanel />
 * </ProtectedRoute>
 * ```
 */
export function ProtectedRoute({
  children,
  requiredRole = "lector",
  superAdminOnly = false,
  tenantSlug,
  loadingMessage = "Verificando acceso...",
  redirectTo,
  onAccessDenied,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isSuperAdmin, tenantRole, isLoading, hasTenantAccess } = useUserRole({
    tenantSlug,
    checkSuperAdmin: true,
  });

  useEffect(() => {
    if (isLoading) return;

    // No autenticado
    if (!user) {
      const loginPath = tenantSlug 
        ? `/${tenantSlug}/admin/login`
        : "/superadmin/login";
      router.push(redirectTo || loginPath);
      return;
    }

    // Verificar superadmin si es requerido
    if (superAdminOnly && !isSuperAdmin) {
      onAccessDenied?.();
      router.push(redirectTo || "/auth/access-denied");
      return;
    }

    // Verificar acceso al tenant
    if (tenantSlug && !hasTenantAccess) {
      onAccessDenied?.();
      router.push(redirectTo || "/auth/access-denied");
      return;
    }

    // Verificar rol mínimo (los superadmins siempre pasan)
    if (!isSuperAdmin && !hasMinimumRole(tenantRole, requiredRole)) {
      onAccessDenied?.();
      router.push(redirectTo || "/auth/access-denied");
      return;
    }
  }, [
    isLoading, 
    user, 
    isSuperAdmin, 
    tenantRole, 
    hasTenantAccess,
    superAdminOnly, 
    requiredRole, 
    tenantSlug, 
    redirectTo, 
    router,
    onAccessDenied,
  ]);

  // Mostrar loading mientras verifica
  if (isLoading) {
    return <LoadingSpinner message={loadingMessage} />;
  }

  // No mostrar nada si no hay acceso (se redirigirá)
  if (!user) {
    return <LoadingSpinner message="Redirigiendo..." />;
  }

  if (superAdminOnly && !isSuperAdmin) {
    return <LoadingSpinner message="Redirigiendo..." />;
  }

  if (tenantSlug && !hasTenantAccess) {
    return <LoadingSpinner message="Redirigiendo..." />;
  }

  if (!isSuperAdmin && !hasMinimumRole(tenantRole, requiredRole)) {
    return <LoadingSpinner message="Redirigiendo..." />;
  }

  // Renderizar contenido protegido
  return <>{children}</>;
}

/**
 * Componente simplificado para rutas de admin de tenant.
 * 
 * @example
 * ```tsx
 * <TenantAdminRoute tenantSlug="cruzados">
 *   <AdminDashboard />
 * </TenantAdminRoute>
 * ```
 */
export function TenantAdminRoute({
  children,
  tenantSlug,
  requiredRole = "lector",
}: {
  children: ReactNode;
  tenantSlug: string;
  requiredRole?: TenantRole;
}) {
  return (
    <ProtectedRoute
      tenantSlug={tenantSlug}
      requiredRole={requiredRole}
      loadingMessage="Verificando permisos..."
    >
      {children}
    </ProtectedRoute>
  );
}

/**
 * Componente simplificado para rutas de superadmin.
 * 
 * @example
 * ```tsx
 * <SuperAdminRoute>
 *   <TenantsManagement />
 * </SuperAdminRoute>
 * ```
 */
export function SuperAdminRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute
      superAdminOnly
      loadingMessage="Verificando credenciales de administrador..."
    >
      {children}
    </ProtectedRoute>
  );
}

/**
 * Hook para verificar permisos de forma imperativa (útil en callbacks).
 * 
 * @example
 * ```tsx
 * const { canEdit, canDelete, canApprove } = usePermissions('cruzados');
 * 
 * if (canApprove) {
 *   // Mostrar botón de aprobar
 * }
 * ```
 */
export function usePermissions(tenantSlug?: string) {
  const { isSuperAdmin, tenantRole, hasTenantAccess } = useUserRole({
    tenantSlug,
  });

  return {
    /** Si puede ver contenido (lector+) */
    canView: hasTenantAccess,
    /** Si puede editar (editor+) */
    canEdit: isSuperAdmin || hasMinimumRole(tenantRole, "editor"),
    /** Si puede administrar (admin+) */
    canAdmin: isSuperAdmin || hasMinimumRole(tenantRole, "admin"),
    /** Si puede eliminar (admin+) */
    canDelete: isSuperAdmin || hasMinimumRole(tenantRole, "admin"),
    /** Si puede aprobar/rechazar (editor+) */
    canApprove: isSuperAdmin || hasMinimumRole(tenantRole, "editor"),
    /** Si es superadmin de la plataforma */
    isSuperAdmin,
    /** Rol actual en el tenant */
    tenantRole,
  };
}
