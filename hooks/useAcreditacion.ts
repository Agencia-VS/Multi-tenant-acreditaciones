"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Área de acreditación genérica — viene de mt_areas_prensa para el tenant/evento.
 * cupos = 0 significa sin restricción de cupos.
 */
export interface Area {
  codigo: string;
  nombre: string;
  cupos: number;
}

/**
 * Cupo por tipo de medio — restricción por empresa.
 * cupo_por_empresa = 0 significa sin restricción.
 */
export interface TipoMedioCupo {
  tipo_medio: string;
  cupo_por_empresa: number;
  descripcion?: string | null;
}

interface Acreditado {
  nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  rut: string;
  email: string;
  cargo: string;
  tipo_credencial: string;
  numero_credencial: string;
  datos_custom?: Record<string, string>;
}

interface FormData {
  responsable_nombre: string;
  responsable_primer_apellido: string;
  responsable_segundo_apellido?: string;
  responsable_rut: string;
  responsable_email: string;
  responsable_telefono?: string;
  empresa: string;
  area: string;
  tipo_medio?: string;
  acreditados: Acreditado[];
  form_config_id?: string;
}

interface UseAcreditacionOptions {
  /** Slug del tenant actual */
  tenantSlug: string;
  /** ID del evento (opcional — el API detecta el activo) */
  eventoId?: number;
}

/**
 * Hook para gestionar áreas y envío de acreditaciones de un tenant.
 * Carga las áreas desde la BD del tenant/evento y envía el slug al API.
 */
export function useAcreditacion(options?: UseAcreditacionOptions) {
  const tenantSlug = options?.tenantSlug || '';
  const eventoIdProp = options?.eventoId;

  const [areas, setAreas] = useState<Area[]>([]);
  const [tiposMedio, setTiposMedio] = useState<TipoMedioCupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cuposError, setCuposError] = useState<{
    show: boolean;
    empresa: string;
    area: string;
    maximo: number;
    existentes: number;
    solicitados: number;
  } | null>(null);

  /**
   * Carga las áreas de acreditación desde el API.
   * Si el tenant no tiene áreas configuradas, retorna array vacío.
   */
  const fetchAreas = useCallback(async () => {
    if (!tenantSlug) {
      setAreas([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ tenant: tenantSlug });
      if (eventoIdProp) params.set('evento_id', String(eventoIdProp));

      const res = await fetch(`/api/acreditaciones/areas?${params}`);

      if (!res.ok) {
        console.warn('Error fetching areas, tenant may not have areas configured');
        setAreas([]);
        return;
      }

      const json = await res.json();
      const fetchedAreas: Area[] = (json.data || []).map((a: { nombre: string; codigo?: string; cupo_maximo: number }) => ({
        codigo: a.codigo || a.nombre,
        nombre: a.nombre,
        cupos: a.cupo_maximo ?? 0,
      }));

      setAreas(fetchedAreas);

      // Cargar cupos por tipo de medio si existen
      const fetchedTiposMedio: TipoMedioCupo[] = (json.tipo_medio_cupos || []).map(
        (t: { tipo_medio: string; cupo_por_empresa: number; descripcion?: string | null }) => ({
          tipo_medio: t.tipo_medio,
          cupo_por_empresa: t.cupo_por_empresa ?? 0,
          descripcion: t.descripcion || null,
        })
      );
      setTiposMedio(fetchedTiposMedio);
    } catch (err) {
      console.warn('Error fetching areas:', err);
      setAreas([]);
      setTiposMedio([]);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, eventoIdProp]);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  const submitAcreditacion = async (formData: FormData): Promise<{ success: boolean; cuposError?: boolean }> => {
    try {
      setLoading(true);
      setError(null);

      if (!tenantSlug) throw new Error('No se pudo identificar el tenant');
      if (!formData.responsable_nombre?.trim()) throw new Error('El nombre del responsable es requerido');
      if (!formData.responsable_email?.trim()) throw new Error('El email del responsable es requerido');
      if (!formData.responsable_rut?.trim()) throw new Error('El RUT del responsable es requerido');
      if (!formData.empresa?.trim()) throw new Error('La empresa es requerida');
      if (!formData.acreditados?.length) throw new Error('Debe haber al menos un acreditado');

      const payload = {
        responsable_nombre: formData.responsable_nombre.trim(),
        responsable_primer_apellido: formData.responsable_primer_apellido.trim(),
        responsable_segundo_apellido: formData.responsable_segundo_apellido?.trim() || '',
        responsable_rut: formData.responsable_rut.trim(),
        responsable_email: formData.responsable_email.trim(),
        responsable_telefono: formData.responsable_telefono?.trim() || '',
        empresa: formData.empresa.trim(),
        area: formData.area?.trim() || '',
        tipo_medio: formData.tipo_medio?.trim() || '',
        acreditados: formData.acreditados.map(a => ({
          nombre: a.nombre?.trim() || '',
          primer_apellido: a.primer_apellido?.trim() || '',
          segundo_apellido: a.segundo_apellido?.trim() || '',
          rut: a.rut?.trim() || '',
          email: a.email?.trim() || '',
          cargo: a.cargo?.trim() || '',
          tipo_credencial: a.tipo_credencial?.trim() || '',
          numero_credencial: a.numero_credencial?.trim() || '',
          datos_custom: a.datos_custom,
        })),
        form_config_id: formData.form_config_id,
      };

      const response = await fetch(`/api/acreditaciones/prensa?tenant=${encodeURIComponent(tenantSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `Error del servidor: ${response.status}`;

        try {
          const responseText = await response.text();
          if (responseText.trim()) {
            try {
              const errorData = JSON.parse(responseText);
              errorMessage = errorData.error || errorMessage;
            } catch {
              errorMessage = responseText;
            }
          }
        } catch {
          // ignore
        }

        // Check cupos error (area or tipo_medio)
        if (errorMessage.includes('No hay cupos disponibles')) {
          // Match area-based cupo error
          const cuposMatch = errorMessage.match(
            /No hay cupos disponibles para (.+?) en el área (.+?)\. Máximo: (\d+), Acreditados existentes: (\d+), Solicitados: (\d+)/
          );
          if (cuposMatch) {
            const [, empresa, area, maximo, existentes, solicitados] = cuposMatch;
            setCuposError({
              show: true,
              empresa,
              area,
              maximo: parseInt(maximo),
              existentes: parseInt(existentes),
              solicitados: parseInt(solicitados),
            });
            return { success: false, cuposError: true };
          }

          // Match tipo_medio-based cupo error
          const tipoMedioMatch = errorMessage.match(
            /No hay cupos disponibles para (.+?) en tipo "(.+?)"\. Máximo: (\d+), Acreditados existentes: (\d+), Solicitados: (\d+)/
          );
          if (tipoMedioMatch) {
            const [, empresa, tipoMedio, maximo, existentes, solicitados] = tipoMedioMatch;
            setCuposError({
              show: true,
              empresa,
              area: `Tipo: ${tipoMedio}`,
              maximo: parseInt(maximo),
              existentes: parseInt(existentes),
              solicitados: parseInt(solicitados),
            });
            return { success: false, cuposError: true };
          }
        }

        throw new Error(errorMessage);
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al enviar';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const closeCuposError = () => {
    setCuposError(null);
  };

  return {
    areas,
    tiposMedio,
    loading,
    error,
    cuposError,
    closeCuposError,
    submitAcreditacion,
    refetchAreas: fetchAreas,
  };
}
