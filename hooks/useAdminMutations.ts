/**
 * Hook para operaciones de mutación en el panel de administración
 * 
 * Centraliza las operaciones de actualización y eliminación de acreditaciones.
 * Reutiliza los servicios de acreditación y email existentes.
 * Maneja optimistic updates, rollback y envío de emails.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import type { Acreditacion, Estado, Zona } from "../types/acreditacion";

// Importar servicios reutilizables
import {
  updateAcreditacionStatus,
  assignZonaToAcreditacion,
  deleteAcreditacion as deleteAcreditacionService,
} from "../lib/services/acreditacion";
import { sendStatusEmail } from "../lib/services/email";

// ============================================================================
// TIPOS
// ============================================================================

/** Opciones de configuración del hook */
export interface UseAdminMutationsOptions {
  /** Zonas disponibles para lookup */
  zonas: Zona[];
  /** Callback cuando hay éxito */
  onSuccess?: (message: string) => void;
  /** Callback cuando hay error */
  onError?: (message: string) => void;
  /** Callback para actualizar acreditaciones localmente */
  onUpdateLocal?: (updater: (prev: Acreditacion[]) => Acreditacion[]) => void;
  /** Callback para actualizar la acreditación seleccionada */
  onUpdateSelected?: (acred: Acreditacion | null) => void;
  /** Callback para cerrar modal */
  onCloseModal?: () => void;
  /** Slug del tenant para redirección */
  tenantSlug?: string;
}

/** Resultado del hook */
export interface UseAdminMutationsReturn {
  // Operaciones de estado
  updateEstado: (acred: Acreditacion, newEstado: Estado) => Promise<boolean>;
  updateEstadoWithConfirm: (acred: Acreditacion, newEstado: Estado) => Promise<boolean>;
  
  // Operaciones de zona
  assignZona: (acred: Acreditacion, zonaId: number | null) => Promise<boolean>;
  
  // Operaciones de eliminación
  deleteAcreditacion: (acred: Acreditacion) => Promise<boolean>;
  
  // Logout
  handleLogout: () => Promise<void>;
}

// ============================================================================
// CONSTANTES
// ============================================================================

/** Mapeo de áreas a nombres legibles */
const AREA_NAMES: Record<string, string> = {
  prensa_escrita: "Prensa Escrita",
  prensa_digital: "Prensa Digital",
  prensa_radio: "Prensa Radio",
  prensa_tv: "Prensa TV",
  fotografo: "Fotógrafo",
  camarografo: "Camarógrafo",
  otro: "Otro",
};

/** Tiempo para limpiar mensajes de éxito (ms) */
const MESSAGE_CLEAR_TIMEOUT = 3000;

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook para manejar operaciones de mutación en el panel de administración.
 * 
 * Reutiliza los servicios de `lib/services/acreditacion.ts` y `lib/services/email.ts`
 * para operaciones de BD y envío de emails respectivamente.
 * 
 * @param options - Opciones de configuración
 * @returns Métodos para mutaciones
 * 
 * @example
 * ```tsx
 * const { updateEstado, assignZona, deleteAcreditacion, handleLogout } = useAdminMutations({
 *   zonas,
 *   onSuccess: (msg) => showSuccess(msg),
 *   onError: (msg) => showError(msg),
 *   onUpdateLocal: setAcreditaciones,
 *   tenantSlug: tenant.slug,
 * });
 * ```
 */
export function useAdminMutations(
  options: UseAdminMutationsOptions
): UseAdminMutationsReturn {
  const {
    zonas,
    onSuccess,
    onError,
    onUpdateLocal,
    onUpdateSelected,
    onCloseModal,
    tenantSlug,
  } = options;

  const router = useRouter();

  // ---- Helpers ----

  /**
   * Obtiene el nombre de la zona por ID
   */
  const getZonaNombre = useCallback(
    (zonaId: number | undefined): string => {
      if (!zonaId) return "Por confirmar";
      const zona = zonas.find((z) => z.id === zonaId);
      return zona?.nombre || "Por confirmar";
    },
    [zonas]
  );

  /**
   * Obtiene el nombre legible del área
   */
  const getAreaNombre = useCallback((area: string): string => {
    return AREA_NAMES[area] || area;
  }, []);

  /**
   * Envía email de notificación según el estado usando el servicio de email.
   * Solo envía para estados "aprobado" o "rechazado".
   */
  const sendNotificationEmail = useCallback(
    async (acred: Acreditacion, newEstado: Estado): Promise<void> => {
      // Solo enviar email para aprobación o rechazo
      if (newEstado !== "aprobado" && newEstado !== "rechazado") {
        return;
      }

      const zonaNombre = getZonaNombre(acred.zona_id);
      const areaNombre = getAreaNombre(acred.area);

      // Usar el servicio de email centralizado
      const result = await sendStatusEmail(
        acred,
        newEstado as "aprobado" | "rechazado",
        zonaNombre,
        areaNombre,
        { enableLogging: true, logPrefix: "[AdminMutations]" }
      );

      if (!result.success) {
        console.error(`Error enviando email de ${newEstado}:`, result.error);
        // No lanzamos error - el cambio de estado ya se realizó
      }
    },
    [getZonaNombre, getAreaNombre]
  );

  /**
   * Programa la limpieza del mensaje después de un timeout
   */
  const scheduleClearMessage = useCallback(() => {
    setTimeout(() => {
      onSuccess?.("");
    }, MESSAGE_CLEAR_TIMEOUT);
  }, [onSuccess]);

  // ---- Operaciones de estado ----

  /**
   * Actualiza el estado de una acreditación sin cerrar modal.
   * Usa el servicio de acreditación para la operación de BD.
   * Envía email de notificación si corresponde.
   * 
   * @returns true si la operación fue exitosa, false si falló
   */
  const updateEstado = useCallback(
    async (acred: Acreditacion, newEstado: Estado): Promise<boolean> => {
      // Usar servicio de BD
      const result = await updateAcreditacionStatus(supabase, acred.id, newEstado);

      if (!result.success) {
        onError?.(result.error || "Error al actualizar estado");
        return false;
      }

      // Enviar email de notificación (async, no bloqueante)
      sendNotificationEmail(acred, newEstado).catch(console.error);

      // Actualizar estado local
      onUpdateLocal?.((prev) =>
        prev.map((a) => (a.id === acred.id ? { ...a, status: newEstado } : a))
      );

      // Actualizar seleccionada si existe
      onUpdateSelected?.({ ...acred, status: newEstado });

      const successMessage = `Acreditación cambiada a ${newEstado} exitosamente`;
      onSuccess?.(successMessage);
      scheduleClearMessage();

      return true;
    },
    [onUpdateLocal, onUpdateSelected, onSuccess, onError, sendNotificationEmail, scheduleClearMessage]
  );

  /**
   * Actualiza el estado de una acreditación con cierre de modal.
   * Usado cuando se confirma desde el modal de detalle.
   * 
   * @returns true si la operación fue exitosa, false si falló
   */
  const updateEstadoWithConfirm = useCallback(
    async (acred: Acreditacion, newEstado: Estado): Promise<boolean> => {
      // Usar servicio de BD
      const result = await updateAcreditacionStatus(supabase, acred.id, newEstado);

      if (!result.success) {
        onError?.(result.error || "Error al actualizar estado");
        return false;
      }

      // Enviar email de notificación (async, no bloqueante)
      sendNotificationEmail(acred, newEstado).catch(console.error);

      // Actualizar estado local
      onUpdateLocal?.((prev) =>
        prev.map((a) => (a.id === acred.id ? { ...a, status: newEstado } : a))
      );

      const successMessage = `Acreditación cambiada a ${newEstado} exitosamente`;
      onSuccess?.(successMessage);
      onCloseModal?.();

      return true;
    },
    [onUpdateLocal, onSuccess, onError, onCloseModal, sendNotificationEmail]
  );

  // ---- Operaciones de zona ----

  /**
   * Asigna o remueve una zona de una acreditación.
   * Implementa optimistic update con rollback en caso de error.
   * Usa el servicio de acreditación para la operación de BD.
   * 
   * @returns true si la operación fue exitosa, false si falló
   */
  const assignZona = useCallback(
    async (acred: Acreditacion, zonaId: number | null): Promise<boolean> => {
      const previousZonaId = acred.zona_id;

      // Optimistic update para la seleccionada
      onUpdateSelected?.({ ...acred, zona_id: zonaId ?? undefined });

      // Usar servicio de BD
      const result = await assignZonaToAcreditacion(supabase, acred.id, zonaId);

      if (!result.success) {
        // Rollback en caso de error
        onUpdateSelected?.({ ...acred, zona_id: previousZonaId });
        onError?.(result.error || "Error al asignar zona");
        return false;
      }

      // Actualizar estado local
      onUpdateLocal?.((prev) =>
        prev.map((a) =>
          a.id === acred.id ? { ...a, zona_id: zonaId ?? undefined } : a
        )
      );

      const successMessage = zonaId
        ? "Zona asignada correctamente"
        : "Zona removida correctamente";
      onSuccess?.(successMessage);
      scheduleClearMessage();

      return true;
    },
    [onUpdateLocal, onUpdateSelected, onSuccess, onError, scheduleClearMessage]
  );

  // ---- Operaciones de eliminación ----

  /**
   * Elimina una acreditación permanentemente.
   * Usa el servicio de acreditación para la operación de BD.
   * 
   * @returns true si la operación fue exitosa, false si falló
   */
  const deleteAcreditacion = useCallback(
    async (acred: Acreditacion): Promise<boolean> => {
      // Usar servicio de BD
      const result = await deleteAcreditacionService(supabase, acred.id);

      if (!result.success) {
        onError?.(result.error || "Error al eliminar");
        return false;
      }

      // Actualizar estado local
      onUpdateLocal?.((prev) => prev.filter((a) => a.id !== acred.id));

      const successMessage = "Acreditación eliminada exitosamente";
      onSuccess?.(successMessage);
      onCloseModal?.();

      return true;
    },
    [onUpdateLocal, onSuccess, onError, onCloseModal]
  );

  // ---- Logout ----

  /**
   * Cierra sesión y redirige al login.
   */
  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      if (tenantSlug) {
        router.push(`/${tenantSlug}/admin/login`);
      }
    } catch (err) {
      console.error("Error during logout:", err);
      onError?.("Error al cerrar sesión");
    }
  }, [router, tenantSlug, onError]);

  // ---- Return ----

  return {
    updateEstado,
    updateEstadoWithConfirm,
    assignZona,
    deleteAcreditacion,
    handleLogout,
  };
}

export default useAdminMutations;

