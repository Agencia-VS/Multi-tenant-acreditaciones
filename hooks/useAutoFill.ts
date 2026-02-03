/**
 * Hook para auto-completar formulario de acreditación con datos del perfil
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { PerfilAcreditado, DatosPrellenos, AutoFillState } from '../types';

interface UseAutoFillReturn extends AutoFillState {
  refreshPerfil: () => Promise<void>;
  clearAutoFill: () => void;
}

/**
 * Hook que detecta si hay un usuario autenticado y carga sus datos de perfil
 * para pre-llenar el formulario de acreditación
 */
export function useAutoFill(): UseAutoFillReturn {
  const [state, setState] = useState<AutoFillState>({
    isLoggedIn: false,
    hasPerfil: false,
    datos: null,
    loading: true,
  });

  const loadPerfilData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));

    try {
      // Verificar sesión
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setState({
          isLoggedIn: false,
          hasPerfil: false,
          datos: null,
          loading: false,
        });
        return;
      }

      // Usuario está logueado
      const userId = session.user.id;

      // Buscar perfil del usuario
      const { data: perfil, error } = await supabase
        .from('mt_perfiles_acreditados')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !perfil) {
        // Usuario logueado pero sin perfil
        setState({
          isLoggedIn: true,
          hasPerfil: false,
          datos: {
            nombre: '',
            apellido: '',
            rut: '',
            email: session.user.email || '',
            empresa: '',
            cargo: '',
            telefono: '',
            nacionalidad: 'Chile',
          },
          loading: false,
        });
        return;
      }

      // Usuario logueado con perfil
      const perfilData = perfil as PerfilAcreditado;
      setState({
        isLoggedIn: true,
        hasPerfil: true,
        datos: {
          nombre: perfilData.nombre || '',
          apellido: perfilData.apellido || '',
          rut: perfilData.rut || '',
          email: perfilData.email || session.user.email || '',
          empresa: perfilData.empresa || '',
          cargo: perfilData.cargo || '',
          telefono: perfilData.telefono || '',
          nacionalidad: perfilData.nacionalidad || 'Chile',
        },
        loading: false,
      });
    } catch (err) {
      console.error('Error loading auto-fill data:', err);
      setState({
        isLoggedIn: false,
        hasPerfil: false,
        datos: null,
        loading: false,
      });
    }
  }, []);

  useEffect(() => {
    loadPerfilData();

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadPerfilData();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadPerfilData]);

  const clearAutoFill = () => {
    setState(prev => ({
      ...prev,
      datos: null,
    }));
  };

  return {
    ...state,
    refreshPerfil: loadPerfilData,
    clearAutoFill,
  };
}

export default useAutoFill;
