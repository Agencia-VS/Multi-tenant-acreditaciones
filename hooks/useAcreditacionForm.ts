/**
 * Hook para manejo del formulario de acreditación
 * 
 * Custom hook que encapsula toda la lógica del formulario de acreditación
 * sin dependencias de Supabase. Pura lógica de estado y transformaciones.
 */

import { useState, useMemo, useCallback } from "react";
import type {
  FormDataAcreditacion,
  AcreditadoFormulario,
  Area,
} from "../types/acreditacion";
import {
  DEFAULT_ACREDITADO,
  DEFAULT_FORM_DATA,
  MAX_ACREDITADOS_DEFAULT,
  MIN_ACREDITADOS,
} from "../constants/acreditacion";

// ============================================================================
// TIPOS
// ============================================================================

/** Opciones de configuración del hook */
export interface UseAcreditacionFormOptions {
  /** Áreas disponibles con sus cupos */
  areas?: Area[];
  /** Número máximo de acreditados si no hay área seleccionada */
  maxAcreditadosDefault?: number;
  /** Datos iniciales del formulario */
  initialData?: Partial<FormDataAcreditacion>;
}

/** Resultado del hook */
export interface UseAcreditacionFormReturn {
  /** Estado actual del formulario */
  formData: FormDataAcreditacion;
  /** Lista de acreditados (alias para formData.acreditados) */
  acreditados: AcreditadoFormulario[];
  /** Paso actual del formulario (calculado) */
  currentStep: number;
  /** Área seleccionada con su info de cupos */
  selectedArea: Area | undefined;
  /** Cupos disponibles para agregar más acreditados */
  cuposDisponibles: number;
  /** Si se puede agregar más acreditados */
  canAddAcreditado: boolean;
  /** Si se puede remover acreditados */
  canRemoveAcreditado: boolean;
  /** Nombre de empresa para mostrar */
  empresaDisplay: string;
  
  // Métodos para responsable
  setField: (field: keyof FormDataAcreditacion, value: string) => void;
  
  // Métodos para empresa y área
  setEmpresa: (value: string) => void;
  setEmpresaPersonalizada: (value: string) => void;
  setArea: (value: string) => void;
  
  // Métodos para acreditados
  addAcreditado: () => void;
  removeAcreditado: (index: number) => void;
  updateAcreditado: (index: number, field: keyof AcreditadoFormulario, value: string) => void;
  
  // Utilidades
  reset: () => void;
  setFormData: React.Dispatch<React.SetStateAction<FormDataAcreditacion>>;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Crea un nuevo acreditado vacío con valores por defecto.
 */
function createEmptyAcreditado(): AcreditadoFormulario {
  return { ...DEFAULT_ACREDITADO };
}

/**
 * Crea el estado inicial del formulario.
 */
function createInitialFormData(
  initialData?: Partial<FormDataAcreditacion>
): FormDataAcreditacion {
  const baseData: FormDataAcreditacion = {
    responsable_nombre: DEFAULT_FORM_DATA.responsable_nombre,
    responsable_primer_apellido: DEFAULT_FORM_DATA.responsable_primer_apellido,
    responsable_segundo_apellido: DEFAULT_FORM_DATA.responsable_segundo_apellido,
    responsable_rut: DEFAULT_FORM_DATA.responsable_rut,
    responsable_email: DEFAULT_FORM_DATA.responsable_email,
    responsable_telefono: DEFAULT_FORM_DATA.responsable_telefono,
    empresa: DEFAULT_FORM_DATA.empresa,
    empresa_personalizada: DEFAULT_FORM_DATA.empresa_personalizada,
    area: DEFAULT_FORM_DATA.area,
    acreditados: [createEmptyAcreditado()],
  };

  if (initialData) {
    return {
      ...baseData,
      ...initialData,
      acreditados: initialData.acreditados?.length
        ? initialData.acreditados
        : baseData.acreditados,
    };
  }

  return baseData;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook para manejar el formulario de acreditación.
 * 
 * @param options - Opciones de configuración
 * @returns Estado y métodos del formulario
 * 
 * @example
 * ```tsx
 * const { formData, currentStep, setField, addAcreditado } = useAcreditacionForm({
 *   areas: areasFromAPI,
 * });
 * ```
 */
export function useAcreditacionForm(
  options: UseAcreditacionFormOptions = {}
): UseAcreditacionFormReturn {
  const {
    areas = [],
    maxAcreditadosDefault = MAX_ACREDITADOS_DEFAULT,
    initialData,
  } = options;

  // ---- Estado principal ----
  const [formData, setFormData] = useState<FormDataAcreditacion>(() =>
    createInitialFormData(initialData)
  );

  // ---- Valores calculados (memoizados) ----
  
  /**
   * Área seleccionada con su información de cupos.
   */
  const selectedArea = useMemo(() => {
    return areas.find((a) => a.codigo === formData.area);
  }, [areas, formData.area]);

  /**
   * Número máximo de cupos para el área seleccionada.
   */
  const maxCupos = useMemo(() => {
    return selectedArea?.cupos ?? maxAcreditadosDefault;
  }, [selectedArea, maxAcreditadosDefault]);

  /**
   * Cupos disponibles para agregar más acreditados.
   */
  const cuposDisponibles = useMemo(() => {
    return Math.max(0, maxCupos - formData.acreditados.length);
  }, [maxCupos, formData.acreditados.length]);

  /**
   * Si se puede agregar más acreditados.
   */
  const canAddAcreditado = useMemo(() => {
    return formData.acreditados.length < maxCupos;
  }, [formData.acreditados.length, maxCupos]);

  /**
   * Si se puede remover acreditados (mínimo 1).
   */
  const canRemoveAcreditado = useMemo(() => {
    return formData.acreditados.length > MIN_ACREDITADOS;
  }, [formData.acreditados.length]);

  /**
   * Nombre de empresa para mostrar (maneja "Otros").
   */
  const empresaDisplay = useMemo(() => {
    if (formData.empresa === "Otros" && formData.empresa_personalizada?.trim()) {
      return formData.empresa_personalizada.trim();
    }
    return formData.empresa;
  }, [formData.empresa, formData.empresa_personalizada]);

  /**
   * Paso actual del formulario, calculado según el progreso.
   * - Paso 1: Selección de empresa
   * - Paso 2: Selección de área
   * - Paso 3: Datos de acreditados
   */
  const currentStep = useMemo(() => {
    // Si no hay empresa válida, estamos en paso 1
    const empresaValida =
      formData.empresa &&
      (formData.empresa !== "Otros" || formData.empresa_personalizada?.trim());
    
    if (!empresaValida) {
      return 1;
    }

    // Si no hay área seleccionada, estamos en paso 2
    if (!formData.area) {
      return 2;
    }

    // Si hay área, estamos en paso 3
    return 3;
  }, [formData.empresa, formData.empresa_personalizada, formData.area]);

  // ---- Métodos ----

  /**
   * Actualiza un campo del formulario (responsable u otros campos simples).
   */
  const setField = useCallback(
    (field: keyof FormDataAcreditacion, value: string) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  /**
   * Actualiza la empresa seleccionada.
   * Limpia empresa_personalizada si no es "Otros".
   */
  const setEmpresa = useCallback((value: string) => {
    setFormData((prev) => ({
      ...prev,
      empresa: value,
      empresa_personalizada: value === "Otros" ? prev.empresa_personalizada : "",
    }));
  }, []);

  /**
   * Actualiza el nombre de empresa personalizada.
   */
  const setEmpresaPersonalizada = useCallback((value: string) => {
    setFormData((prev) => ({
      ...prev,
      empresa_personalizada: value,
    }));
  }, []);

  /**
   * Actualiza el área seleccionada.
   * Ajusta el número de acreditados según los cupos del área.
   */
  const setArea = useCallback(
    (value: string) => {
      const area = areas.find((a) => a.codigo === value);
      const cupos = area?.cupos ?? maxAcreditadosDefault;

      setFormData((prev) => {
        // Si hay más acreditados que cupos, recortar
        // Si hay menos, mantener los existentes
        const currentAcreditados = prev.acreditados;
        let newAcreditados: AcreditadoFormulario[];

        if (currentAcreditados.length > cupos) {
          // Recortar al número de cupos
          newAcreditados = currentAcreditados.slice(0, cupos);
        } else if (currentAcreditados.length === 0) {
          // Asegurar al menos 1 acreditado
          newAcreditados = [createEmptyAcreditado()];
        } else {
          // Mantener los actuales
          newAcreditados = currentAcreditados;
        }

        return {
          ...prev,
          area: value,
          acreditados: newAcreditados,
        };
      });
    },
    [areas, maxAcreditadosDefault]
  );

  /**
   * Agrega un nuevo acreditado vacío.
   * Respeta el límite de cupos del área.
   */
  const addAcreditado = useCallback(() => {
    setFormData((prev) => {
      const currentMax = selectedArea?.cupos ?? maxAcreditadosDefault;
      
      if (prev.acreditados.length >= currentMax) {
        return prev; // No agregar si ya está al máximo
      }

      return {
        ...prev,
        acreditados: [...prev.acreditados, createEmptyAcreditado()],
      };
    });
  }, [selectedArea, maxAcreditadosDefault]);

  /**
   * Remueve un acreditado por índice.
   * Mantiene al menos 1 acreditado.
   */
  const removeAcreditado = useCallback((index: number) => {
    setFormData((prev) => {
      if (prev.acreditados.length <= MIN_ACREDITADOS) {
        return prev; // No remover si solo queda 1
      }

      return {
        ...prev,
        acreditados: prev.acreditados.filter((_, i) => i !== index),
      };
    });
  }, []);

  /**
   * Actualiza un campo específico de un acreditado.
   */
  const updateAcreditado = useCallback(
    (index: number, field: keyof AcreditadoFormulario, value: string) => {
      setFormData((prev) => {
        const newAcreditados = [...prev.acreditados];
        
        if (index < 0 || index >= newAcreditados.length) {
          return prev; // Índice inválido
        }

        newAcreditados[index] = {
          ...newAcreditados[index],
          [field]: value,
        };

        return {
          ...prev,
          acreditados: newAcreditados,
        };
      });
    },
    []
  );

  /**
   * Resetea el formulario a su estado inicial.
   */
  const reset = useCallback(() => {
    setFormData(createInitialFormData(initialData));
  }, [initialData]);

  // ---- Return ----
  
  return {
    // Estado
    formData,
    acreditados: formData.acreditados,
    currentStep,
    selectedArea,
    cuposDisponibles,
    canAddAcreditado,
    canRemoveAcreditado,
    empresaDisplay,
    
    // Métodos
    setField,
    setEmpresa,
    setEmpresaPersonalizada,
    setArea,
    addAcreditado,
    removeAcreditado,
    updateAcreditado,
    reset,
    setFormData,
  };
}

export default useAcreditacionForm;
