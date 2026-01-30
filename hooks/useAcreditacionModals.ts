/**
 * Hook para manejo de modales del formulario de acreditación
 * 
 * Centraliza el estado y control de todos los modales utilizados
 * en el proceso de acreditación. Evita duplicación en componentes.
 */

import { useState, useCallback } from "react";

// ============================================================================
// TIPOS
// ============================================================================

/** Estado del modal de éxito */
export interface SuccessModalState {
  show: boolean;
  acreditadosCount: number;
}

/** Estado de error de envío */
export interface SubmissionError {
  type: "error";
  message: string;
}

/** Estado completo de los modales */
export interface ModalsState {
  /** Modal de disclaimer/términos y condiciones */
  showDisclaimer: boolean;
  /** Modal de confirmación antes de enviar */
  showConfirmation: boolean;
  /** Modal de éxito con contador de acreditados */
  successModal: SuccessModalState;
  /** Error de envío */
  submissionError: SubmissionError | null;
}

/** Resultado del hook */
export interface UseAcreditacionModalsReturn {
  // Estado
  showDisclaimer: boolean;
  showConfirmation: boolean;
  showSuccess: boolean;
  successCount: number;
  submissionError: SubmissionError | null;
  hasError: boolean;
  
  // Métodos para Disclaimer
  openDisclaimer: () => void;
  closeDisclaimer: () => void;
  
  // Métodos para Confirmación
  openConfirmation: () => void;
  closeConfirmation: () => void;
  
  // Métodos para Success
  openSuccess: (count: number) => void;
  closeSuccess: () => void;
  
  // Métodos para Error
  setError: (message: string) => void;
  clearError: () => void;
  
  // Utilidades
  closeAllModals: () => void;
  resetModals: () => void;
}

/** Opciones de configuración del hook */
export interface UseAcreditacionModalsOptions {
  /** Si mostrar disclaimer al inicio */
  showDisclaimerOnMount?: boolean;
  /** Callback cuando se cierra el modal de éxito */
  onSuccessClose?: () => void;
  /** Callback cuando se acepta el disclaimer */
  onDisclaimerAccept?: () => void;
}

// ============================================================================
// ESTADO INICIAL
// ============================================================================

const INITIAL_SUCCESS_MODAL: SuccessModalState = {
  show: false,
  acreditadosCount: 0,
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook para manejar los modales del formulario de acreditación.
 * 
 * @param options - Opciones de configuración
 * @returns Estado y métodos para control de modales
 * 
 * @example
 * ```tsx
 * const {
 *   showDisclaimer,
 *   openConfirmation,
 *   closeSuccess,
 *   setError,
 * } = useAcreditacionModals({
 *   showDisclaimerOnMount: true,
 *   onSuccessClose: () => resetForm(),
 * });
 * ```
 */
export function useAcreditacionModals(
  options: UseAcreditacionModalsOptions = {}
): UseAcreditacionModalsReturn {
  const {
    showDisclaimerOnMount = true,
    onSuccessClose,
    onDisclaimerAccept,
  } = options;

  // ---- Estado ----
  
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(showDisclaimerOnMount);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const [successModal, setSuccessModal] = useState<SuccessModalState>(INITIAL_SUCCESS_MODAL);
  const [submissionError, setSubmissionError] = useState<SubmissionError | null>(null);

  // ---- Métodos para Disclaimer ----

  /**
   * Abre el modal de disclaimer.
   */
  const openDisclaimer = useCallback(() => {
    setShowDisclaimer(true);
  }, []);

  /**
   * Cierra el modal de disclaimer.
   * Ejecuta callback si está configurado.
   */
  const closeDisclaimer = useCallback(() => {
    setShowDisclaimer(false);
    onDisclaimerAccept?.();
  }, [onDisclaimerAccept]);

  // ---- Métodos para Confirmación ----

  /**
   * Abre el modal de confirmación.
   */
  const openConfirmation = useCallback(() => {
    setShowConfirmation(true);
  }, []);

  /**
   * Cierra el modal de confirmación.
   */
  const closeConfirmation = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  // ---- Métodos para Success ----

  /**
   * Abre el modal de éxito con el contador de acreditados.
   * @param count - Número de acreditados procesados
   */
  const openSuccess = useCallback((count: number) => {
    setSuccessModal({
      show: true,
      acreditadosCount: count,
    });
    // Limpiar error si había uno
    setSubmissionError(null);
  }, []);

  /**
   * Cierra el modal de éxito.
   * Ejecuta callback si está configurado.
   */
  const closeSuccess = useCallback(() => {
    setSuccessModal(INITIAL_SUCCESS_MODAL);
    onSuccessClose?.();
  }, [onSuccessClose]);

  // ---- Métodos para Error ----

  /**
   * Establece un mensaje de error.
   * @param message - Mensaje de error a mostrar
   */
  const setError = useCallback((message: string) => {
    setSubmissionError({
      type: "error",
      message,
    });
  }, []);

  /**
   * Limpia el error actual.
   */
  const clearError = useCallback(() => {
    setSubmissionError(null);
  }, []);

  // ---- Utilidades ----

  /**
   * Cierra todos los modales abiertos.
   */
  const closeAllModals = useCallback(() => {
    setShowDisclaimer(false);
    setShowConfirmation(false);
    setSuccessModal(INITIAL_SUCCESS_MODAL);
  }, []);

  /**
   * Resetea todos los modales a su estado inicial.
   * Incluye el disclaimer si estaba configurado para mostrarse al inicio.
   */
  const resetModals = useCallback(() => {
    setShowDisclaimer(showDisclaimerOnMount);
    setShowConfirmation(false);
    setSuccessModal(INITIAL_SUCCESS_MODAL);
    setSubmissionError(null);
  }, [showDisclaimerOnMount]);

  // ---- Return ----

  return {
    // Estado
    showDisclaimer,
    showConfirmation,
    showSuccess: successModal.show,
    successCount: successModal.acreditadosCount,
    submissionError,
    hasError: submissionError !== null,
    
    // Métodos para Disclaimer
    openDisclaimer,
    closeDisclaimer,
    
    // Métodos para Confirmación
    openConfirmation,
    closeConfirmation,
    
    // Métodos para Success
    openSuccess,
    closeSuccess,
    
    // Métodos para Error
    setError,
    clearError,
    
    // Utilidades
    closeAllModals,
    resetModals,
  };
}

export default useAcreditacionModals;
