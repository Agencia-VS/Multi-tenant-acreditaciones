/**
 * Hook para manejo de datos del panel de administración
 * 
 * Centraliza la carga de acreditaciones y zonas desde Supabase.
 * Mantiene el estado de loading y provee métodos de refetch.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Acreditacion, Zona, Estado } from "../types/acreditacion";

// ============================================================================
// TIPOS
// ============================================================================

/** Opciones de configuración del hook */
export interface UseAdminDataOptions {
  /** ID del tenant para filtrar datos */
  tenantId?: string;
  /** ID del evento para filtrar datos */
  eventoId?: number;
  /** Si debe cargar datos automáticamente al montar */
  autoFetch?: boolean;
  /** Callback cuando hay error */
  onError?: (error: string) => void;
}

/** Resultado del hook */
export interface UseAdminDataReturn {
  // Estado
  acreditaciones: Acreditacion[];
  zonas: Zona[];
  isLoading: boolean;
  error: string | null;
  
  // Métodos
  fetchAcreditaciones: () => Promise<void>;
  fetchZonas: () => Promise<void>;
  refetchAll: () => Promise<void>;
  
  // Utilidades
  getAcreditacionById: (id: number) => Acreditacion | undefined;
  getZonaById: (id: number) => Zona | undefined;
}

// ============================================================================
// CONSTANTES
// ============================================================================

/** Campos a seleccionar de la tabla acreditados */
const ACREDITACIONES_SELECT = `
  id,
  nombre,
  apellido,
  rut,
  email,
  cargo,
  tipo_credencial,
  area,
  empresa,
  zona_id,
  status,
  motivo_rechazo,
  responsable_nombre,
  responsable_email,
  responsable_telefono,
  updated_at
`;

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook para cargar y manejar datos del panel de administración.
 * 
 * @param options - Opciones de configuración
 * @returns Estado y métodos para datos de admin
 * 
 * @example
 * ```tsx
 * const { acreditaciones, zonas, isLoading, fetchAcreditaciones } = useAdminData({
 *   tenantId: tenant.id,
 *   eventoId: 1,
 *   onError: (err) => setMessage({ type: 'error', text: err }),
 * });
 * ```
 */
export function useAdminData(
  options: UseAdminDataOptions = {}
): UseAdminDataReturn {
  const {
    tenantId,
    eventoId = 1,
    autoFetch = true,
    onError,
  } = options;

  // ---- Estado ----
  const [acreditaciones, setAcreditaciones] = useState<Acreditacion[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Métodos de fetching ----

  /**
   * Carga las acreditaciones desde Supabase.
   * Filtra por tenant_id y evento_id si están configurados.
   */
  const fetchAcreditaciones = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("mt_acreditados")
        .select(ACREDITACIONES_SELECT)
        .order("updated_at", { ascending: false });

      // Aplicar filtros si están disponibles
      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }
      if (eventoId) {
        query = query.eq("evento_id", eventoId);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw new Error(queryError.message);
      }

      // Transformar datos al formato esperado
      const transformedData: Acreditacion[] = (data || []).map((row) => {
        // Separar apellido en primer_apellido y segundo_apellido
        const apellidoParts = (row.apellido || "").trim().split(/\s+/);
        const primer_apellido = apellidoParts[0] || "";
        const segundo_apellido = apellidoParts.slice(1).join(" ") || undefined;

        return {
          id: row.id,
          nombre: row.nombre || "",
          primer_apellido,
          segundo_apellido,
          rut: row.rut || "",
          email: row.email || "",
          cargo: row.cargo || "",
          tipo_credencial: row.tipo_credencial || "",
          numero_credencial: "", // No está en la tabla actual
          area: row.area || "",
          empresa: row.empresa || "",
          zona_id: row.zona_id ?? undefined,
          status: (row.status as Estado) || "pendiente",
          motivo_rechazo: row.motivo_rechazo ?? undefined,
          responsable_nombre: row.responsable_nombre ?? undefined,
          responsable_email: row.responsable_email ?? undefined,
          responsable_telefono: row.responsable_telefono ?? undefined,
          created_at: row.updated_at || new Date().toISOString(),
        };
      });

      setAcreditaciones(transformedData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al cargar acreditaciones";
      setError(errorMessage);
      onError?.(errorMessage);
      console.error("Error fetching acreditaciones:", err);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, eventoId, onError]);

  /**
   * Carga las zonas desde Supabase.
   */
  const fetchZonas = useCallback(async () => {
    try {
      let query = supabase
        .from("mt_zonas_acreditacion")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      // Aplicar filtros si están disponibles
      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }
      if (eventoId) {
        query = query.eq("evento_id", eventoId);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw new Error(queryError.message);
      }

      setZonas(data || []);
    } catch (err) {
      console.error("Error fetching zonas:", err);
      // No seteamos error principal para zonas, solo log
    }
  }, [tenantId, eventoId]);

  /**
   * Recarga todos los datos.
   */
  const refetchAll = useCallback(async () => {
    await Promise.all([fetchAcreditaciones(), fetchZonas()]);
  }, [fetchAcreditaciones, fetchZonas]);

  // ---- Utilidades ----

  /**
   * Obtiene una acreditación por ID.
   */
  const getAcreditacionById = useCallback(
    (id: number): Acreditacion | undefined => {
      return acreditaciones.find((a) => a.id === id);
    },
    [acreditaciones]
  );

  /**
   * Obtiene una zona por ID.
   */
  const getZonaById = useCallback(
    (id: number): Zona | undefined => {
      return zonas.find((z) => z.id === id);
    },
    [zonas]
  );

  // ---- Efectos ----

  /**
   * Carga inicial de datos si autoFetch está habilitado.
   */
  useEffect(() => {
    if (autoFetch) {
      refetchAll();
    }
  }, [autoFetch, refetchAll]);

  // ---- Return ----

  return {
    // Estado
    acreditaciones,
    zonas,
    isLoading,
    error,
    
    // Métodos
    fetchAcreditaciones,
    fetchZonas,
    refetchAll,
    
    // Utilidades
    getAcreditacionById,
    getZonaById,
  };
}

export default useAdminData;
