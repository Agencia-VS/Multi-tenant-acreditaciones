/**
 * Hook para verificar el rol del usuario actual
 * 
 * Proporciona información sobre:
 * - Si el usuario está autenticado
 * - Si es superadmin
 * - Su rol en un tenant específico
 */

"use client";

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '../lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

// ============================================================================
// TIPOS
// ============================================================================

export type TenantRole = 'admin' | 'editor' | 'lector';

export interface UserRoleInfo {
  /** Usuario de Supabase Auth */
  user: User | null;
  /** Sesión actual */
  session: Session | null;
  /** Si el usuario es superadmin de la plataforma */
  isSuperAdmin: boolean;
  /** Rol del usuario en el tenant actual */
  tenantRole: TenantRole | null;
  /** Si el usuario tiene algún acceso al tenant actual */
  hasTenantAccess: boolean;
  /** Si está cargando la información */
  isLoading: boolean;
  /** Error si lo hay */
  error: string | null;
  /** Refresca la información del usuario */
  refresh: () => Promise<void>;
  /** Cierra la sesión */
  signOut: () => Promise<void>;
}

export interface UseUserRoleOptions {
  /** Slug del tenant para verificar acceso (opcional) */
  tenantSlug?: string;
  /** Si debe verificar superadmin */
  checkSuperAdmin?: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook para obtener información del rol del usuario actual.
 * 
 * @param options - Opciones de configuración
 * @returns Información del rol y estado del usuario
 * 
 * @example
 * ```tsx
 * // En un componente de admin
 * const { user, isSuperAdmin, tenantRole, isLoading } = useUserRole({ 
 *   tenantSlug: 'cruzados' 
 * });
 * 
 * if (isLoading) return <Loading />;
 * if (!user) return <Redirect to="/login" />;
 * if (tenantRole !== 'admin') return <AccessDenied />;
 * ```
 */
export function useUserRole(options: UseUserRoleOptions = {}): UserRoleInfo {
  const { tenantSlug, checkSuperAdmin = true } = options;

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [tenantRole, setTenantRole] = useState<TenantRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();

  /**
   * Verifica si el usuario es superadmin
   */
  const checkIsSuperAdmin = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('mt_superadmins')
        .select('id')
        .eq('user_id', userId)
        .single();

      return !error && !!data;
    } catch {
      return false;
    }
  }, [supabase]);

  /**
   * Obtiene el rol del usuario en un tenant específico
   */
  const getTenantRole = useCallback(async (userId: string, slug: string): Promise<TenantRole | null> => {
    try {
      // Primero obtener el tenant_id
      const { data: tenant, error: tenantError } = await supabase
        .from('mt_tenants')
        .select('id')
        .eq('slug', slug)
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

      return adminTenant.rol as TenantRole;
    } catch {
      return null;
    }
  }, [supabase]);

  /**
   * Carga toda la información del usuario
   */
  const loadUserInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Obtener sesión actual
      const { data: { session: currentSession }, error: sessionError } = 
        await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (!currentSession?.user) {
        setIsSuperAdmin(false);
        setTenantRole(null);
        setIsLoading(false);
        return;
      }

      const userId = currentSession.user.id;

      // Verificar superadmin si se requiere
      if (checkSuperAdmin) {
        const superAdminStatus = await checkIsSuperAdmin(userId);
        setIsSuperAdmin(superAdminStatus);

        // Si es superadmin, tiene acceso admin a todos los tenants
        if (superAdminStatus && tenantSlug) {
          setTenantRole('admin');
          setIsLoading(false);
          return;
        }
      }

      // Verificar rol en tenant específico
      if (tenantSlug) {
        const role = await getTenantRole(userId, tenantSlug);
        setTenantRole(role);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar información del usuario');
    } finally {
      setIsLoading(false);
    }
  }, [supabase, checkSuperAdmin, tenantSlug, checkIsSuperAdmin, getTenantRole]);

  /**
   * Cierra la sesión del usuario
   */
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setIsSuperAdmin(false);
      setTenantRole(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cerrar sesión');
    }
  }, [supabase]);

  // Cargar información al montar y cuando cambian las dependencias
  useEffect(() => {
    loadUserInfo();
  }, [loadUserInfo]);

  // Escuchar cambios de autenticación
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, newSession: Session | null) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (event === 'SIGNED_OUT') {
          setIsSuperAdmin(false);
          setTenantRole(null);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Recargar información cuando hay login o refresh
          loadUserInfo();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, loadUserInfo]);

  return {
    user,
    session,
    isSuperAdmin,
    tenantRole,
    hasTenantAccess: isSuperAdmin || tenantRole !== null,
    isLoading,
    error,
    refresh: loadUserInfo,
    signOut,
  };
}

/**
 * Hook simplificado para verificar solo si el usuario está autenticado
 */
export function useAuth() {
  const { user, session, isLoading, error, signOut, refresh } = useUserRole({
    checkSuperAdmin: false,
  });

  return {
    user,
    session,
    isAuthenticated: !!user,
    isLoading,
    error,
    signOut,
    refresh,
  };
}
