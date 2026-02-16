'use client';

/**
 * Hook: useTenantProfile — Profile data contextualizado por tenant
 *
 * Carga el perfil del usuario con datos específicos del tenant,
 * calcula campos faltantes, y proporciona autofill inteligente.
 *
 * Uso:
 *   const { mergedData, missingFields, status, saveTenantData } = useTenantProfile(tenantId, eventId);
 */

import { useState, useCallback, useRef } from 'react';
import type { Profile, FormFieldDefinition, TenantProfileStatus } from '@/types';
import { buildMergedAutofillData } from '@/lib/services/autofill';

interface TenantProfileState {
  profile: Partial<Profile> | null;
  mergedData: Record<string, string>;
  tenantData: Record<string, unknown>;
  formFields: FormFieldDefinition[];
  status: {
    totalRequired: number;
    filledRequired: number;
    missingFields: FormFieldDefinition[];
    completionPct: number;
    formChanged: boolean;
    newKeys: string[];
    removedKeys: string[];
    hasData: boolean;
  } | null;
  loading: boolean;
  error: string | null;
}

const initialState: TenantProfileState = {
  profile: null,
  mergedData: {},
  tenantData: {},
  formFields: [],
  status: null,
  loading: false,
  error: null,
};

export function useTenantProfile() {
  const [state, setState] = useState<TenantProfileState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Carga el perfil del usuario y sus datos contextualizados para un tenant.
   */
  const loadTenantProfile = useCallback(async (tenantId: string, eventId?: string) => {
    // Cancelar request anterior si existe
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const params = new URLSearchParams({ tenant_id: tenantId });
      if (eventId) params.set('event_id', eventId);

      const res = await fetch(`/api/profiles/tenant-data?${params}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      setState({
        profile: data.profile,
        mergedData: data.mergedData || {},
        tenantData: data.tenantData || {},
        formFields: data.formFields || [],
        status: data.status || null,
        loading: false,
        error: null,
      });

      return data;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null;
      const msg = err instanceof Error ? err.message : 'Error cargando perfil';
      setState(prev => ({ ...prev, loading: false, error: msg }));
      return null;
    }
  }, []);

  /**
   * Guarda datos del usuario para un tenant específico.
   * Se llama después de enviar el formulario exitosamente.
   */
  const saveTenantData = useCallback(async (
    tenantId: string,
    data: Record<string, unknown>,
    formKeys: string[]
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/profiles/tenant-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, data, form_keys: formKeys }),
      });

      if (!res.ok) {
        console.warn('[useTenantProfile] Error saving tenant data:', res.status);
        return false;
      }

      return true;
    } catch {
      console.warn('[useTenantProfile] Error saving tenant data');
      return false;
    }
  }, []);

  /**
   * Obtiene los campos faltantes de los form fields dados, usando los datos mergeados.
   * Útil cuando se tiene formFields distintos a los cargados inicialmente.
   */
  const getMissingFieldsFor = useCallback((
    formFields: FormFieldDefinition[],
    mergedData?: Record<string, string>
  ): FormFieldDefinition[] => {
    const data = mergedData || state.mergedData;
    return formFields.filter(f => {
      if (!f.required) return false;
      const val = data[f.key];
      return !val || val.trim() === '';
    });
  }, [state.mergedData]);

  /**
   * Construye dynamicData para un acreditado basándose en datos de perfil.
   * Delega a la función isomórfica de lib/services/profiles.
   */
  const buildDynamicDataForProfile = useCallback((
    profileDatosBase: Record<string, unknown> | undefined | null,
    tenantId: string,
    formFields: FormFieldDefinition[]
  ): Record<string, string> => {
    if (!profileDatosBase) return {};
    return buildMergedAutofillData(profileDatosBase, tenantId, formFields);
  }, []);

  return {
    ...state,
    loadTenantProfile,
    saveTenantData,
    getMissingFieldsFor,
    buildDynamicDataForProfile,
  };
}

/**
 * Hook: useTenantStatuses — Estado de completitud para todos los tenants activos
 * Usado en el dashboard del acreditado.
 */
export function useTenantStatuses() {
  const [tenants, setTenants] = useState<TenantProfileStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<{ id: string; nombre: string; apellido: string; rut: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profiles/tenant-status');
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setTenants(data.tenants || []);
      setProfile(data.profile || null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  return { tenants, profile, loading, load };
}
