/**
 * Hook para cargar la configuración de formulario dinámico de un tenant
 * 
 * Carga el FormConfig desde la API, con fallback a la configuración por defecto
 * del sistema si el tenant no tiene una personalizada.
 */

import { useState, useEffect, useCallback } from 'react';
import type { FormConfigRecord, FormFieldDefinition, DynamicFormValues, DynamicFormErrors, FieldValidation } from '../types/form-config';
import { buildDefaultFormConfig, DEFAULT_SECTIONS, DEFAULT_RESPONSABLE_FIELDS, DEFAULT_SOLICITUD_FIELDS, DEFAULT_ACREDITADO_FIELDS, DEFAULT_FORM_CONFIG } from '../constants/form-defaults';
import { VALIDATION_PATTERNS } from '../constants/acreditacion';

// ============================================================================
// TIPOS
// ============================================================================

interface UseFormConfigOptions {
  /** Slug del tenant */
  tenantSlug: string;
  /** Slug del formulario (default: "prensa") */
  formSlug?: string;
  /** ID del evento específico (opcional) */
  eventoId?: number;
}

interface UseFormConfigReturn {
  /** Config completa del formulario */
  formConfig: FormConfigRecord | null;
  /** Si está cargando */
  loading: boolean;
  /** Error si hubo */
  error: string | null;
  /** Si se está usando la config del sistema (fallback) */
  isDefault: boolean;
  /** Campos filtrados por scope */
  responsableFields: FormFieldDefinition[];
  solicitudFields: FormFieldDefinition[];
  acreditadoFields: FormFieldDefinition[];
  /** Función para recargar */
  reload: () => void;
}

// ============================================================================
// HELPER: Construir FormConfigRecord desde defaults
// ============================================================================

function buildFallbackConfig(tenantSlug: string): FormConfigRecord {
  const input = buildDefaultFormConfig('fallback-' + tenantSlug);
  return {
    id: 'default',
    tenant_id: input.tenant_id,
    evento_id: null,
    nombre: input.nombre,
    slug: input.slug,
    tipo: input.tipo || 'individual',
    secciones: DEFAULT_SECTIONS,
    campos: [
      ...DEFAULT_RESPONSABLE_FIELDS,
      ...DEFAULT_SOLICITUD_FIELDS,
      ...DEFAULT_ACREDITADO_FIELDS,
    ],
    config: DEFAULT_FORM_CONFIG,
    activo: true,
    orden: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ============================================================================
// HOOK
// ============================================================================

export function useFormConfig(options: UseFormConfigOptions): UseFormConfigReturn {
  const { tenantSlug, formSlug = 'prensa', eventoId } = options;

  const [formConfig, setFormConfig] = useState<FormConfigRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ tenant: tenantSlug, form: formSlug });
      if (eventoId) params.set('evento_id', String(eventoId));

      const res = await fetch(`/api/form-configs?${params}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Error al cargar configuración');
      }

      if (json.data) {
        setFormConfig(json.data);
        setIsDefault(false);
      } else {
        // Sin config en BD — usar defaults del sistema
        setFormConfig(buildFallbackConfig(tenantSlug));
        setIsDefault(true);
      }
    } catch (err) {
      console.warn('Error cargando form config, usando defaults:', err);
      setFormConfig(buildFallbackConfig(tenantSlug));
      setIsDefault(true);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, formSlug, eventoId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Campos filtrados por scope
  const campos = formConfig?.campos || [];
  const responsableFields = campos
    .filter(c => c.scope === 'responsable')
    .sort((a, b) => a.order - b.order);
  const solicitudFields = campos
    .filter(c => c.scope === 'solicitud')
    .sort((a, b) => a.order - b.order);
  const acreditadoFields = campos
    .filter(c => c.scope === 'acreditado')
    .sort((a, b) => a.order - b.order);

  return {
    formConfig,
    loading,
    error,
    isDefault,
    responsableFields,
    solicitudFields,
    acreditadoFields,
    reload: loadConfig,
  };
}

// ============================================================================
// HELPERS DE VALIDACIÓN PARA FORMULARIO DINÁMICO
// ============================================================================

/**
 * Valida un valor según la definición del campo
 */
export function validateFieldValue(field: FormFieldDefinition, value: string): string | null {
  // Campo requerido vacío
  if (field.required && (!value || value.trim() === '')) {
    return `${field.label} es requerido`;
  }

  // Si no hay valor y no es requerido, OK
  if (!value || value.trim() === '') return null;

  const v = field.validation;
  if (!v) return null;

  // Validaciones built-in
  if (v.builtIn === 'rut_chileno') {
    if (!VALIDATION_PATTERNS.RUT.test(value)) {
      return 'Formato de RUT inválido (ej: 18274356-7)';
    }
  }
  if (v.builtIn === 'email') {
    if (!VALIDATION_PATTERNS.EMAIL.test(value)) {
      return 'Formato de email inválido';
    }
  }
  if (v.builtIn === 'telefono_cl') {
    if (!VALIDATION_PATTERNS.TELEFONO.test(value)) {
      return 'Formato de teléfono inválido (ej: +56 9 1234 5678)';
    }
  }

  // Longitudes
  if (v.minLength && value.length < v.minLength) {
    return `${field.label} debe tener al menos ${v.minLength} caracteres`;
  }
  if (v.maxLength && value.length > v.maxLength) {
    return `${field.label} no puede exceder ${v.maxLength} caracteres`;
  }

  // Pattern custom
  if (v.pattern) {
    const regex = new RegExp(v.pattern);
    if (!regex.test(value)) {
      return v.patternMessage || `${field.label} tiene un formato inválido`;
    }
  }

  return null;
}

/**
 * Valida todos los campos del formulario dinámico
 */
export function validateDynamicForm(
  fields: FormFieldDefinition[],
  values: DynamicFormValues,
  visibleFields: Set<string>
): { valid: boolean; errors: DynamicFormErrors } {
  const errors: DynamicFormErrors = {
    responsable: {},
    solicitud: {},
    acreditados: values.acreditados.map(() => ({})),
  };
  let valid = true;

  for (const field of fields) {
    // Saltar campos ocultos por condiciones
    if (!visibleFields.has(field.key)) continue;

    if (field.scope === 'responsable') {
      const val = values.responsable[field.key] || '';
      const err = validateFieldValue(field, val);
      if (err) {
        errors.responsable[field.key] = err;
        valid = false;
      }
    } else if (field.scope === 'solicitud') {
      const val = values.solicitud[field.key] || '';
      const err = validateFieldValue(field, val);
      if (err) {
        errors.solicitud[field.key] = err;
        valid = false;
      }
    } else if (field.scope === 'acreditado') {
      values.acreditados.forEach((acreditado, idx) => {
        const val = acreditado[field.key] || '';
        const err = validateFieldValue(field, val);
        if (err) {
          if (!errors.acreditados[idx]) errors.acreditados[idx] = {};
          errors.acreditados[idx][field.key] = err;
          valid = false;
        }
      });
    }
  }

  return { valid, errors };
}

/**
 * Determina qué campos son visibles según las condiciones
 */
export function getVisibleFields(
  fields: FormFieldDefinition[],
  values: DynamicFormValues
): Set<string> {
  const visible = new Set<string>();

  for (const field of fields) {
    if (!field.condition) {
      visible.add(field.key);
      continue;
    }

    const { dependsOn, operator, value: condValue } = field.condition;

    // Buscar el valor del campo del que depende en cualquier scope
    let dependsValue = '';
    if (values.responsable[dependsOn] !== undefined) {
      dependsValue = values.responsable[dependsOn];
    } else if (values.solicitud[dependsOn] !== undefined) {
      dependsValue = values.solicitud[dependsOn];
    }

    let isVisible = false;
    switch (operator) {
      case 'equals':
        isVisible = dependsValue === condValue;
        break;
      case 'notEquals':
        isVisible = dependsValue !== condValue;
        break;
      case 'contains':
        isVisible = dependsValue.includes(condValue || '');
        break;
      case 'notEmpty':
        isVisible = dependsValue.trim() !== '';
        break;
    }

    if (isVisible) {
      visible.add(field.key);
    }
  }

  return visible;
}

/**
 * Crea valores iniciales vacíos a partir de la definición de campos
 */
export function createInitialValues(fields: FormFieldDefinition[], numAcreditados = 1): DynamicFormValues {
  const responsable: Record<string, string> = {};
  const solicitud: Record<string, string> = {};
  const acreditadoTemplate: Record<string, string> = {};

  for (const field of fields) {
    const defaultVal = field.defaultValue || '';
    if (field.scope === 'responsable') {
      responsable[field.key] = defaultVal;
    } else if (field.scope === 'solicitud') {
      solicitud[field.key] = defaultVal;
    } else if (field.scope === 'acreditado') {
      acreditadoTemplate[field.key] = defaultVal;
    }
  }

  const acreditados = Array.from({ length: numAcreditados }, () => ({ ...acreditadoTemplate }));

  return { responsable, solicitud, acreditados };
}

export default useFormConfig;
