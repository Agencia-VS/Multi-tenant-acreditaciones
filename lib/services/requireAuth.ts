/**
 * requireAuth — Helper reutilizable de autenticación y autorización para API routes
 *
 * Uso:
 *   const { user, role } = await requireAuth(request);                          // Solo autenticado
 *   const { user, role } = await requireAuth(request, { role: 'superadmin' });  // Requiere superadmin
 *   const { user, role } = await requireAuth(request, { role: 'admin_tenant', tenantId }); // Admin del tenant
 */

import { NextResponse } from 'next/server';
import { getCurrentUser, isSuperAdmin, getUserTenantRole } from './auth';

export type AuthRole = 'superadmin' | 'admin_tenant' | 'authenticated';

export interface RequireAuthOptions {
  /** Rol mínimo requerido. Default: 'authenticated' */
  role?: AuthRole;
  /** Tenant ID — requerido cuando role = 'admin_tenant' */
  tenantId?: string;
}

export interface AuthResult {
  user: { id: string; email?: string };
  role: AuthRole;
  tenantId?: string;
}

/**
 * Verifica autenticación y opcionalmente autorización por rol.
 *
 * @returns AuthResult si el usuario tiene permisos suficientes
 * @throws NextResponse con status 401 (no autenticado) o 403 (sin permisos)
 */
export async function requireAuth(
  _request: Request,
  options: RequireAuthOptions = {}
): Promise<AuthResult> {
  const { role: requiredRole = 'authenticated', tenantId } = options;

  // 1. Verificar autenticación
  const user = await getCurrentUser();
  if (!user) {
    throw NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // 2. Si solo se requiere autenticación, retornar
  if (requiredRole === 'authenticated') {
    return { user: { id: user.id, email: user.email }, role: 'authenticated' };
  }

  // 3. Verificar si es superadmin (tiene acceso a todo)
  const superadmin = await isSuperAdmin(user.id);

  if (requiredRole === 'superadmin') {
    if (!superadmin) {
      throw NextResponse.json({ error: 'Acceso denegado: se requiere superadmin' }, { status: 403 });
    }
    return { user: { id: user.id, email: user.email }, role: 'superadmin' };
  }

  // 4. role === 'admin_tenant' — superadmin también tiene acceso
  if (superadmin) {
    return { user: { id: user.id, email: user.email }, role: 'superadmin', tenantId };
  }

  // 5. Verificar que es admin del tenant específico
  if (!tenantId) {
    throw NextResponse.json(
      { error: 'Acceso denegado: tenantId requerido para verificar permisos' },
      { status: 403 }
    );
  }

  const tenantRole = await getUserTenantRole(user.id, tenantId);
  if (tenantRole === 'none') {
    throw NextResponse.json({ error: 'Acceso denegado: no es admin de este tenant' }, { status: 403 });
  }

  return { user: { id: user.id, email: user.email }, role: 'admin_tenant', tenantId };
}
