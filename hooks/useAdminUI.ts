/**
 * Hook para manejo del estado de UI del panel de administración
 * 
 * Centraliza filtros, modales, mensajes y estados de procesamiento.
 * Separado de la lógica de datos para mejor mantenibilidad.
 */

import { useState, useMemo, useCallback } from "react";
import type { Acreditacion, Estado } from "../types/acreditacion";

// ============================================================================
// TIPOS
// ============================================================================

/** Mensaje de feedback para el usuario */
export interface Message {
  type: "success" | "error";
  text: string;
}

/** Estado del modal de confirmación de acción */
export interface ConfirmActionModal {
  isOpen: boolean;
  type: "aprobado" | "rechazado" | null;
  message: string;
}

/** Estado del modal de éxito */
export interface SuccessModal {
  isOpen: boolean;
  message: string;
}

/** Opciones de configuración del hook */
export interface UseAdminUIOptions {
  /** Acreditaciones para filtrar */
  acreditaciones: Acreditacion[];
  /** Callback cuando se selecciona una acreditación */
  onSelectAcreditacion?: (acred: Acreditacion) => void;
  /** Tiempo en ms para auto-limpiar mensajes de éxito */
  successMessageTimeout?: number;
  /** Tiempo en ms para auto-limpiar mensajes de error */
  errorMessageTimeout?: number;
}

/** Resultado del hook */
export interface UseAdminUIReturn {
  // Estado de filtros
  searchTerm: string;
  estadoFilter: string;
  filteredAcreditaciones: Acreditacion[];
  
  // Estado de selección
  selectedAcreditacion: Acreditacion | null;
  isModalOpen: boolean;
  
  // Estado de modales de confirmación
  confirmDeleteModal: boolean;
  confirmActionModal: ConfirmActionModal;
  successModal: SuccessModal;
  
  // Estado de mensajes y procesamiento
  message: Message | null;
  isProcessing: boolean;
  isLoggingOut: boolean;
  
  // Métodos de filtros
  setSearchTerm: (term: string) => void;
  setEstadoFilter: (filter: string) => void;
  clearFilters: () => void;
  
  // Métodos de selección y modal de detalle
  openDetailModal: (acred: Acreditacion) => void;
  closeDetailModal: () => void;
  setSelectedAcreditacion: (acred: Acreditacion | null) => void;
  
  // Métodos de mensajes
  setMessage: (message: Message | null) => void;
  showSuccess: (text: string) => void;
  showError: (text: string) => void;
  clearMessage: () => void;
  
  // Métodos de modal de confirmación de eliminación
  openConfirmDelete: () => void;
  closeConfirmDelete: () => void;
  
  // Métodos de modal de confirmación de acción
  openConfirmAction: (type: "aprobado" | "rechazado", message: string) => void;
  closeConfirmAction: () => void;
  
  // Métodos de modal de éxito
  openSuccessModal: (message: string) => void;
  closeSuccessModal: () => void;
  
  // Métodos de estado de procesamiento
  setProcessing: (processing: boolean) => void;
  setLoggingOut: (loggingOut: boolean) => void;
}

// ============================================================================
// CONSTANTES
// ============================================================================

const INITIAL_CONFIRM_ACTION: ConfirmActionModal = {
  isOpen: false,
  type: null,
  message: "",
};

const INITIAL_SUCCESS_MODAL: SuccessModal = {
  isOpen: false,
  message: "",
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook para manejar el estado de UI del panel de administración.
 * 
 * @param options - Opciones de configuración
 * @returns Estado y métodos para UI de admin
 * 
 * @example
 * ```tsx
 * const {
 *   searchTerm,
 *   setSearchTerm,
 *   filteredAcreditaciones,
 *   openDetailModal,
 *   showSuccess,
 * } = useAdminUI({
 *   acreditaciones,
 *   onSelectAcreditacion: (acred) => console.log('Selected:', acred),
 * });
 * ```
 */
export function useAdminUI(options: UseAdminUIOptions): UseAdminUIReturn {
  const {
    acreditaciones,
    onSelectAcreditacion,
  } = options;

  // ---- Estado de filtros ----
  const [searchTerm, setSearchTermState] = useState<string>("");
  const [estadoFilter, setEstadoFilterState] = useState<string>("");

  // ---- Estado de selección ----
  const [selectedAcreditacion, setSelectedAcreditacion] = useState<Acreditacion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // ---- Estado de modales de confirmación ----
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<boolean>(false);
  const [confirmActionModal, setConfirmActionModal] = useState<ConfirmActionModal>(INITIAL_CONFIRM_ACTION);
  const [successModal, setSuccessModal] = useState<SuccessModal>(INITIAL_SUCCESS_MODAL);

  // ---- Estado de mensajes y procesamiento ----
  const [message, setMessageState] = useState<Message | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  // ---- Valores calculados ----

  /**
   * Acreditaciones filtradas por término de búsqueda y estado.
   */
  const filteredAcreditaciones = useMemo(() => {
    let filtered = acreditaciones;

    // Filtrar por término de búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        (a) =>
          a.nombre.toLowerCase().includes(term) ||
          a.primer_apellido.toLowerCase().includes(term) ||
          (a.segundo_apellido && a.segundo_apellido.toLowerCase().includes(term)) ||
          a.email.toLowerCase().includes(term) ||
          a.rut.includes(term) ||
          a.empresa.toLowerCase().includes(term)
      );
    }

    // Filtrar por estado
    if (estadoFilter) {
      filtered = filtered.filter((a) => a.status === estadoFilter);
    }

    return filtered;
  }, [acreditaciones, searchTerm, estadoFilter]);

  // ---- Métodos de filtros ----

  const setSearchTerm = useCallback((term: string) => {
    setSearchTermState(term);
  }, []);

  const setEstadoFilter = useCallback((filter: string) => {
    setEstadoFilterState(filter);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTermState("");
    setEstadoFilterState("");
  }, []);

  // ---- Métodos de selección y modal de detalle ----

  const openDetailModal = useCallback(
    (acred: Acreditacion) => {
      setSelectedAcreditacion(acred);
      setIsModalOpen(true);
      onSelectAcreditacion?.(acred);
    },
    [onSelectAcreditacion]
  );

  const closeDetailModal = useCallback(() => {
    setIsModalOpen(false);
    // Mantener selectedAcreditacion por si se necesita referencia
  }, []);

  // ---- Métodos de mensajes ----

  const setMessage = useCallback((msg: Message | null) => {
    setMessageState(msg);
  }, []);

  const showSuccess = useCallback((text: string) => {
    setMessageState({ type: "success", text });
  }, []);

  const showError = useCallback((text: string) => {
    setMessageState({ type: "error", text });
  }, []);

  const clearMessage = useCallback(() => {
    setMessageState(null);
  }, []);

  // ---- Métodos de modal de confirmación de eliminación ----

  const openConfirmDelete = useCallback(() => {
    setConfirmDeleteModal(true);
  }, []);

  const closeConfirmDelete = useCallback(() => {
    setConfirmDeleteModal(false);
  }, []);

  // ---- Métodos de modal de confirmación de acción ----

  const openConfirmAction = useCallback(
    (type: "aprobado" | "rechazado", actionMessage: string) => {
      setConfirmActionModal({
        isOpen: true,
        type,
        message: actionMessage,
      });
    },
    []
  );

  const closeConfirmAction = useCallback(() => {
    setConfirmActionModal(INITIAL_CONFIRM_ACTION);
  }, []);

  // ---- Métodos de modal de éxito ----

  const openSuccessModal = useCallback((successMessage: string) => {
    setSuccessModal({
      isOpen: true,
      message: successMessage,
    });
  }, []);

  const closeSuccessModal = useCallback(() => {
    setSuccessModal(INITIAL_SUCCESS_MODAL);
  }, []);

  // ---- Métodos de estado de procesamiento ----

  const setProcessing = useCallback((processing: boolean) => {
    setIsProcessing(processing);
  }, []);

  const setLoggingOut = useCallback((loggingOut: boolean) => {
    setIsLoggingOut(loggingOut);
  }, []);

  // ---- Return ----

  return {
    // Estado de filtros
    searchTerm,
    estadoFilter,
    filteredAcreditaciones,
    
    // Estado de selección
    selectedAcreditacion,
    isModalOpen,
    
    // Estado de modales de confirmación
    confirmDeleteModal,
    confirmActionModal,
    successModal,
    
    // Estado de mensajes y procesamiento
    message,
    isProcessing,
    isLoggingOut,
    
    // Métodos de filtros
    setSearchTerm,
    setEstadoFilter,
    clearFilters,
    
    // Métodos de selección y modal de detalle
    openDetailModal,
    closeDetailModal,
    setSelectedAcreditacion,
    
    // Métodos de mensajes
    setMessage,
    showSuccess,
    showError,
    clearMessage,
    
    // Métodos de modal de confirmación de eliminación
    openConfirmDelete,
    closeConfirmDelete,
    
    // Métodos de modal de confirmación de acción
    openConfirmAction,
    closeConfirmAction,
    
    // Métodos de modal de éxito
    openSuccessModal,
    closeSuccessModal,
    
    // Métodos de estado de procesamiento
    setProcessing,
    setLoggingOut,
  };
}

export default useAdminUI;
