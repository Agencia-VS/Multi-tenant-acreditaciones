'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  AuthAcreditadoContextType,
  AuthUser,
  PerfilAcreditado,
  PerfilAcreditadoInput,
  RegisterCredentials,
  VincularPerfilResponse,
} from '../../types';

// ============================================================================
// CONTEXTO
// ============================================================================

const AuthAcreditadoContext = createContext<AuthAcreditadoContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface AuthAcreditadoProviderProps {
  children: ReactNode;
}

export function AuthAcreditadoProvider({ children }: AuthAcreditadoProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [perfil, setPerfil] = useState<PerfilAcreditado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar perfil del usuario
  const loadPerfil = useCallback(async () => {
    if (!user) {
      setPerfil(null);
      return;
    }

    try {
      const { data, error: queryError } = await supabase
        .from('mt_perfiles_acreditados')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (queryError && queryError.code !== 'PGRST116') {
        console.error('Error loading perfil:', queryError);
      }

      setPerfil(data as PerfilAcreditado | null);
    } catch (err) {
      console.error('Error loading perfil:', err);
    }
  }, [user]);

  // Inicializar sesión
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            email_confirmed_at: session.user.email_confirmed_at || null,
            created_at: session.user.created_at,
          });
        }
      } catch (err) {
        console.error('Error initializing session:', err);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            email_confirmed_at: session.user.email_confirmed_at || null,
            created_at: session.user.created_at,
          });
        } else {
          setUser(null);
          setPerfil(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Cargar perfil cuando cambia el usuario
  useEffect(() => {
    if (user && !loading) {
      loadPerfil();
    }
  }, [user, loading, loadPerfil]);

  // Login con password
  const loginWithPassword = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Login con Magic Link
  const loginWithMagicLink = async (email: string) => {
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        throw authError;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al enviar magic link';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Registro
  const register = async (credentials: RegisterCredentials) => {
    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            rut: credentials.rut,
            nombre: credentials.nombre,
            apellido: credentials.apellido,
          },
        },
      });

      if (authError) {
        throw authError;
      }

      // Si se proporcionó RUT, crear o vincular perfil
      if (credentials.rut && authData.user) {
        await supabase.rpc('get_or_create_perfil', {
          p_user_id: authData.user.id,
          p_rut: credentials.rut,
          p_nombre: credentials.nombre || '',
          p_apellido: credentials.apellido || '',
          p_email: credentials.email,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al registrarse';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setPerfil(null);
    } catch (err) {
      console.error('Error logging out:', err);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar perfil
  const updatePerfil = async (data: Partial<PerfilAcreditadoInput>) => {
    if (!user || !perfil) {
      throw new Error('No hay usuario autenticado');
    }

    try {
      const { error: updateError } = await supabase
        .from('mt_perfiles_acreditados')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', perfil.id);

      if (updateError) {
        throw updateError;
      }

      // Recargar perfil
      await loadPerfil();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar perfil';
      setError(message);
      throw err;
    }
  };

  // Vincular perfil por RUT
  const vincularPorRut = async (rut: string): Promise<VincularPerfilResponse> => {
    if (!user) {
      return { success: false, message: 'No hay usuario autenticado', perfil_id: null };
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('vincular_perfil_por_rut', {
        p_user_id: user.id,
        p_rut: rut,
      });

      if (rpcError) {
        throw rpcError;
      }

      const result = data?.[0] || { success: false, message: 'Error desconocido', perfil_id: null };

      if (result.success) {
        await loadPerfil();
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al vincular perfil';
      return { success: false, message, perfil_id: null };
    }
  };

  // Limpiar error
  const clearError = () => setError(null);

  const value: AuthAcreditadoContextType = {
    user,
    perfil,
    loading,
    error,
    isAuthenticated: !!user,
    loginWithPassword,
    loginWithMagicLink,
    register,
    logout,
    loadPerfil,
    updatePerfil,
    vincularPorRut,
    clearError,
  };

  return (
    <AuthAcreditadoContext.Provider value={value}>
      {children}
    </AuthAcreditadoContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useAuthAcreditado(): AuthAcreditadoContextType {
  const context = useContext(AuthAcreditadoContext);
  
  if (context === undefined) {
    throw new Error('useAuthAcreditado must be used within an AuthAcreditadoProvider');
  }
  
  return context;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { AuthAcreditadoContext };
