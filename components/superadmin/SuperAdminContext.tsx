/**
 * Contexto de SuperAdmin
 * 
 * Maneja el estado de autenticación y datos compartidos
 * para evitar loadings innecesarios entre páginas.
 */

"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

interface User {
  id: string;
  email: string;
}

interface Stats {
  totalTenants: number;
  totalEventos: number;
  totalAcreditados: number;
  eventosActivos: number;
}

interface SuperAdminContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  stats: Stats;
  signOut: () => Promise<void>;
  refreshStats: () => Promise<void>;
}

const SuperAdminContext = createContext<SuperAdminContextType | null>(null);

export function SuperAdminProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalTenants: 0,
    totalEventos: 0,
    totalAcreditados: 0,
    eventosActivos: 0,
  });

  const router = useRouter();
  const pathname = usePathname();
  const supabase = getSupabaseBrowserClient();

  // Verificar autenticación una sola vez
  const checkAuth = useCallback(async () => {
    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser();
      
      if (error || !authUser) {
        setIsAuthenticated(false);
        setUser(null);
        if (pathname !== '/superadmin/login') {
          router.push('/superadmin/login');
        }
        return;
      }

      // Verificar si es superadmin
      const { data: superadmin, error: saError } = await supabase
        .from('mt_superadmins')
        .select('id')
        .eq('user_id', authUser.id)
        .single();

      if (saError || !superadmin) {
        setIsAuthenticated(false);
        setUser(null);
        router.push('/auth/access-denied');
        return;
      }

      setUser({ id: authUser.id, email: authUser.email || '' });
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, router, pathname]);

  // Cargar estadísticas
  const refreshStats = useCallback(async () => {
    try {
      const [tenantsRes, eventosRes, acreditadosRes, eventosActivosRes] = await Promise.all([
        supabase.from('mt_tenants').select('id', { count: 'exact', head: true }),
        supabase.from('mt_eventos').select('id', { count: 'exact', head: true }),
        supabase.from('mt_acreditados').select('id', { count: 'exact', head: true }),
        supabase.from('mt_eventos').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);

      setStats({
        totalTenants: tenantsRes.count || 0,
        totalEventos: eventosRes.count || 0,
        totalAcreditados: acreditadosRes.count || 0,
        eventosActivos: eventosActivosRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [supabase]);

  // Cerrar sesión
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    router.push('/superadmin/login');
  }, [supabase, router]);

  // Verificar auth al montar
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Cargar stats cuando está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      refreshStats();
    }
  }, [isAuthenticated, refreshStats]);

  return (
    <SuperAdminContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        stats,
        signOut,
        refreshStats,
      }}
    >
      {children}
    </SuperAdminContext.Provider>
  );
}

export function useSuperAdmin() {
  const context = useContext(SuperAdminContext);
  if (!context) {
    throw new Error('useSuperAdmin debe usarse dentro de SuperAdminProvider');
  }
  return context;
}
