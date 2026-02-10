'use client';

import { useState, useCallback } from 'react';
import type { Profile, FormFieldDefinition } from '@/types';

/**
 * Hook: Carga el perfil del usuario autenticado.
 * Ya NO expone datos por RUT público — requiere sesión activa.
 */
export function useProfileLookup() {
  const [profile, setProfile] = useState<Partial<Profile> | null>(null);
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(false);

  /**
   * Carga el perfil del usuario autenticado (GET /api/profiles/lookup).
   * El servidor resuelve el user_id desde la cookie de sesión.
   */
  const loadMyProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profiles/lookup');
      const data = await res.json();
      
      if (data.found) {
        setProfile(data.profile);
        setFound(true);
        return data.profile as Partial<Profile>;
      } else {
        setProfile(null);
        setFound(false);
        return null;
      }
    } catch {
      setProfile(null);
      setFound(false);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Determina qué campos faltan del perfil para un evento.
   * Si el perfil ya tiene el dato, se salta.
   */
  const getMissingFields = useCallback(
    (formFields: FormFieldDefinition[]): FormFieldDefinition[] => {
      if (!profile) return formFields;
      
      return formFields.filter((field) => {
        if (!field.profile_field) return true; // sin mapeo, siempre mostrar
        
        const parts = field.profile_field.split('.');
        let value: unknown = profile;
        
        for (const part of parts) {
          if (value && typeof value === 'object') {
            value = (value as Record<string, unknown>)[part];
          } else {
            value = undefined;
            break;
          }
        }
        
        return !value || value === '' || value === null;
      });
    },
    [profile]
  );

  return { profile, loading, found, loadMyProfile, getMissingFields, setProfile, setFound };
}
