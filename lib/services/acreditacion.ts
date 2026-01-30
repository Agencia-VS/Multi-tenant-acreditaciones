/**
 * Servicios de acreditación
 * 
 * Funciones reutilizables para validación, transformación y
 * operaciones de acreditaciones. Sin dependencias directas de Supabase.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FormDataAcreditacion,
  AcreditadoFormulario,
  Acreditacion,
  Acreditado,
  Estado,
} from "../../types/acreditacion";
import {
  VALIDATION_PATTERNS,
  VALIDATION_MESSAGES,
  FIELD_LENGTHS,
} from "../../constants/acreditacion";

// ============================================================================
// TIPOS INTERNOS
// ============================================================================

/** Resultado de validación de formulario */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Resultado de validación de un solo campo/entidad */
export interface SingleValidationResult {
  valid: boolean;
  error?: string;
}

/** Datos preparados para inserción en BD */
export interface AcreditadoInsertData {
  tenant_id: string;
  evento_id: number;
  nombre: string;
  apellido: string;
  rut: string | null;
  email: string | null;
  cargo: string | null;
  tipo_credencial: string | null;
  empresa: string;
  area: string;
  status: Estado;
  motivo_rechazo: null;
  zona_id: number | null;
  responsable_nombre: string;
  responsable_email: string;
  responsable_telefono: string | null;
  updated_at: string;
}

/** Datos raw de la BD antes de mapear */
export interface RawAcreditacionDB {
  id: number;
  nombre: string;
  apellido?: string | null;
  rut?: string | null;
  email?: string | null;
  cargo?: string | null;
  tipo_credencial?: string | null;
  numero_credencial?: string | null;
  area?: string | null;
  empresa?: string | null;
  zona_id?: number | null;
  status: string;
  motivo_rechazo?: string | null;
  responsable_nombre?: string | null;
  responsable_email?: string | null;
  responsable_telefono?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Resultado de operación de actualización de estado */
export interface UpdateStatusResult {
  success: boolean;
  error?: string;
  data?: Acreditado;
}

// ============================================================================
// VALIDACIONES
// ============================================================================

/**
 * Valida el dígito verificador de un RUT chileno.
 * @param rut - RUT sin puntos ni guión, incluyendo dígito verificador
 * @returns true si el RUT es válido
 */
export function validateRutCheckDigit(rut: string): boolean {
  // Limpiar el RUT
  const cleanRut = rut.replace(/\./g, "").replace("-", "").toUpperCase();
  
  if (cleanRut.length < 2) return false;
  
  const body = cleanRut.slice(0, -1);
  const checkDigit = cleanRut.slice(-1);
  
  // Calcular dígito verificador
  let sum = 0;
  let multiplier = 2;
  
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const remainder = sum % 11;
  const calculatedDigit = 11 - remainder;
  
  let expectedDigit: string;
  if (calculatedDigit === 11) {
    expectedDigit = "0";
  } else if (calculatedDigit === 10) {
    expectedDigit = "K";
  } else {
    expectedDigit = calculatedDigit.toString();
  }
  
  return checkDigit === expectedDigit;
}

/**
 * Valida un acreditado individual del formulario.
 * @param acreditado - Datos del acreditado a validar
 * @param index - Índice del acreditado (para mensajes de error)
 * @returns Resultado de validación con error si no es válido
 */
export function validateAcreditado(
  acreditado: AcreditadoFormulario,
  index?: number
): SingleValidationResult {
  const prefix = index !== undefined ? `Acreditado ${index + 1}: ` : "";

  // Validar nombre
  if (!acreditado.nombre?.trim()) {
    return { valid: false, error: `${prefix}${VALIDATION_MESSAGES.NOMBRE.required}` };
  }
  if (acreditado.nombre.trim().length < FIELD_LENGTHS.NOMBRE.min) {
    return { valid: false, error: `${prefix}${VALIDATION_MESSAGES.NOMBRE.minLength}` };
  }

  // Validar primer apellido
  if (!acreditado.primer_apellido?.trim()) {
    return { valid: false, error: `${prefix}${VALIDATION_MESSAGES.APELLIDO.required}` };
  }
  if (acreditado.primer_apellido.trim().length < FIELD_LENGTHS.APELLIDO.min) {
    return { valid: false, error: `${prefix}${VALIDATION_MESSAGES.APELLIDO.minLength}` };
  }

  // Validar email
  if (!acreditado.email?.trim()) {
    return { valid: false, error: `${prefix}${VALIDATION_MESSAGES.EMAIL.required}` };
  }
  if (!VALIDATION_PATTERNS.EMAIL.test(acreditado.email.trim())) {
    return { valid: false, error: `${prefix}${VALIDATION_MESSAGES.EMAIL.invalid}` };
  }

  // Validar cargo
  if (!acreditado.cargo?.trim()) {
    return { valid: false, error: `${prefix}${VALIDATION_MESSAGES.CARGO.required}` };
  }

  // Validar tipo de credencial
  if (!acreditado.tipo_credencial?.trim()) {
    return { valid: false, error: `${prefix}${VALIDATION_MESSAGES.CREDENCIAL.required}` };
  }

  return { valid: true };
}

/**
 * Valida el formulario completo de acreditación.
 * @param formData - Datos del formulario a validar
 * @returns Resultado con lista de errores si los hay
 */
export function validateForm(formData: FormDataAcreditacion): ValidationResult {
  const errors: string[] = [];

  // ---- Validar datos del responsable ----
  
  if (!formData.responsable_nombre?.trim()) {
    errors.push(VALIDATION_MESSAGES.NOMBRE.required + " (responsable)");
  }

  if (!formData.responsable_primer_apellido?.trim()) {
    errors.push(VALIDATION_MESSAGES.APELLIDO.required + " (responsable)");
  }

  if (!formData.responsable_rut?.trim()) {
    errors.push(VALIDATION_MESSAGES.RUT.required + " (responsable)");
  } else if (!VALIDATION_PATTERNS.RUT.test(formData.responsable_rut.trim())) {
    errors.push(VALIDATION_MESSAGES.RUT.invalid + " (responsable)");
  } else if (!validateRutCheckDigit(formData.responsable_rut.trim())) {
    errors.push(VALIDATION_MESSAGES.RUT.checkDigit + " (responsable)");
  }

  if (!formData.responsable_email?.trim()) {
    errors.push(VALIDATION_MESSAGES.EMAIL.required + " (responsable)");
  } else if (!VALIDATION_PATTERNS.EMAIL.test(formData.responsable_email.trim())) {
    errors.push(VALIDATION_MESSAGES.EMAIL.invalid + " (responsable)");
  }

  // ---- Validar empresa ----
  
  if (!formData.empresa?.trim()) {
    errors.push(VALIDATION_MESSAGES.EMPRESA.required);
  } else if (formData.empresa === "Otros" && !formData.empresa_personalizada?.trim()) {
    errors.push(VALIDATION_MESSAGES.EMPRESA.customRequired);
  }

  // ---- Validar área ----
  
  if (!formData.area?.trim()) {
    errors.push(VALIDATION_MESSAGES.AREA.required);
  }

  // ---- Validar acreditados ----
  
  if (!formData.acreditados?.length) {
    errors.push("Debe haber al menos un acreditado");
  } else {
    formData.acreditados.forEach((acreditado, index) => {
      const result = validateAcreditado(acreditado, index);
      if (!result.valid && result.error) {
        errors.push(result.error);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// TRANSFORMACIONES
// ============================================================================

/**
 * Obtiene el nombre de empresa para mostrar.
 * Si la empresa es "Otros", devuelve el nombre personalizado.
 * @param empresa - Nombre de empresa seleccionado
 * @param empresaPersonalizada - Nombre personalizado (si empresa es "Otros")
 * @returns Nombre de empresa a mostrar/guardar
 */
export function getEmpresaDisplay(
  empresa: string,
  empresaPersonalizada?: string
): string {
  if (empresa === "Otros" && empresaPersonalizada?.trim()) {
    return `Otros: ${empresaPersonalizada.trim()}`;
  }
  return empresa;
}

/**
 * Separa el apellido completo en primer y segundo apellido.
 * @param apellido - Apellido completo (puede tener 1 o más partes)
 * @returns Objeto con primer_apellido y segundo_apellido
 */
export function splitApellido(apellido: string | null | undefined): {
  primer_apellido: string;
  segundo_apellido: string;
} {
  if (!apellido?.trim()) {
    return { primer_apellido: "", segundo_apellido: "" };
  }
  
  const parts = apellido.trim().split(/\s+/);
  return {
    primer_apellido: parts[0] || "",
    segundo_apellido: parts.slice(1).join(" ") || "",
  };
}

/**
 * Mapea datos raw de la BD al formato de Acreditacion para la UI.
 * @param rawData - Array de registros raw de la BD
 * @returns Array de Acreditacion formateados para UI
 */
export function mapearAcreditacionesDB(
  rawData: RawAcreditacionDB[]
): Acreditacion[] {
  return rawData.map((row) => {
    const { primer_apellido, segundo_apellido } = splitApellido(row.apellido);
    
    // Extraer apellidos del responsable si viene concatenado
    const responsableApellidos = splitApellido(null); // TODO: Si se guarda concatenado
    
    return {
      id: row.id,
      nombre: row.nombre || "",
      primer_apellido,
      segundo_apellido: segundo_apellido || undefined,
      rut: row.rut || "",
      email: row.email || "",
      cargo: row.cargo || "",
      tipo_credencial: row.tipo_credencial || "",
      numero_credencial: row.numero_credencial || "",
      area: row.area || "",
      empresa: row.empresa || "",
      zona_id: row.zona_id ?? undefined,
      status: (row.status as Estado) || "pendiente",
      motivo_rechazo: row.motivo_rechazo ?? undefined,
      responsable_nombre: row.responsable_nombre ?? undefined,
      responsable_primer_apellido: responsableApellidos.primer_apellido || undefined,
      responsable_segundo_apellido: responsableApellidos.segundo_apellido || undefined,
      responsable_email: row.responsable_email ?? undefined,
      responsable_telefono: row.responsable_telefono ?? undefined,
      created_at: row.created_at || row.updated_at || new Date().toISOString(),
    };
  });
}

/**
 * Prepara los datos del formulario para inserción en la BD.
 * @param formData - Datos del formulario de acreditación
 * @param tenantId - ID del tenant
 * @param eventoId - ID del evento
 * @returns Array de registros listos para insertar
 */
export function prepareAcreditacionForDB(
  formData: FormDataAcreditacion,
  tenantId: string,
  eventoId: number
): AcreditadoInsertData[] {
  const empresa = getEmpresaDisplay(formData.empresa, formData.empresa_personalizada);
  const now = new Date().toISOString();

  return formData.acreditados.map((acreditado) => ({
    tenant_id: tenantId,
    evento_id: eventoId,
    nombre: acreditado.nombre.trim(),
    apellido: `${acreditado.primer_apellido.trim()} ${acreditado.segundo_apellido?.trim() || ""}`.trim(),
    rut: acreditado.rut?.trim() || null,
    email: acreditado.email?.trim() || null,
    cargo: acreditado.cargo?.trim() || null,
    tipo_credencial: acreditado.tipo_credencial?.trim() || null,
    empresa,
    area: formData.area.trim(),
    status: "pendiente" as Estado,
    motivo_rechazo: null,
    zona_id: null,
    responsable_nombre: `${formData.responsable_nombre.trim()} ${formData.responsable_primer_apellido.trim()} ${formData.responsable_segundo_apellido?.trim() || ""}`.trim(),
    responsable_email: formData.responsable_email.trim(),
    responsable_telefono: formData.responsable_telefono?.trim() || null,
    updated_at: now,
  }));
}

// ============================================================================
// OPERACIONES DE BASE DE DATOS
// ============================================================================

/**
 * Actualiza el estado de una acreditación.
 * @param supabase - Cliente de Supabase
 * @param id - ID del acreditado
 * @param status - Nuevo estado
 * @param motivoRechazo - Motivo del rechazo (solo si status es "rechazado")
 * @returns Resultado de la operación
 */
export async function updateAcreditacionStatus(
  supabase: SupabaseClient,
  id: number,
  status: Estado,
  motivoRechazo?: string
): Promise<UpdateStatusResult> {
  try {
    // Validar que si es rechazo, tenga motivo
    if (status === "rechazado" && !motivoRechazo?.trim()) {
      return {
        success: false,
        error: "El motivo de rechazo es requerido",
      };
    }

    const updateData: {
      status: Estado;
      motivo_rechazo?: string | null;
      updated_at: string;
    } = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Solo incluir motivo_rechazo si es rechazo
    if (status === "rechazado") {
      updateData.motivo_rechazo = motivoRechazo?.trim() || null;
    } else {
      // Limpiar motivo si se cambia a otro estado
      updateData.motivo_rechazo = null;
    }

    const { data, error } = await supabase
      .from("mt_acreditados")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data as Acreditado,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/**
 * Asigna una zona a una acreditación.
 * @param supabase - Cliente de Supabase
 * @param id - ID del acreditado
 * @param zonaId - ID de la zona a asignar (null para quitar zona)
 * @returns Resultado de la operación
 */
export async function assignZonaToAcreditacion(
  supabase: SupabaseClient,
  id: number,
  zonaId: number | null
): Promise<UpdateStatusResult> {
  try {
    const { data, error } = await supabase
      .from("mt_acreditados")
      .update({
        zona_id: zonaId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data as Acreditado,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/**
 * Elimina una acreditación.
 * @param supabase - Cliente de Supabase
 * @param id - ID del acreditado a eliminar
 * @returns Resultado de la operación
 */
export async function deleteAcreditacion(
  supabase: SupabaseClient,
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("mt_acreditados")
      .delete()
      .eq("id", id);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Genera un resumen de estadísticas de acreditaciones.
 * @param acreditaciones - Lista de acreditaciones
 * @returns Objeto con conteos por estado
 */
export function getAcreditacionesStats(
  acreditaciones: Acreditacion[]
): Record<Estado | "total", number> {
  return {
    total: acreditaciones.length,
    pendiente: acreditaciones.filter((a) => a.status === "pendiente").length,
    aprobado: acreditaciones.filter((a) => a.status === "aprobado").length,
    rechazado: acreditaciones.filter((a) => a.status === "rechazado").length,
  };
}

/**
 * Filtra acreditaciones por término de búsqueda.
 * @param acreditaciones - Lista de acreditaciones
 * @param searchTerm - Término de búsqueda
 * @returns Lista filtrada
 */
export function filterAcreditaciones(
  acreditaciones: Acreditacion[],
  searchTerm: string,
  estadoFilter?: Estado | "todos"
): Acreditacion[] {
  let filtered = acreditaciones;

  // Filtrar por estado
  if (estadoFilter && estadoFilter !== "todos") {
    filtered = filtered.filter((a) => a.status === estadoFilter);
  }

  // Filtrar por término de búsqueda
  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase().trim();
    filtered = filtered.filter(
      (a) =>
        a.nombre.toLowerCase().includes(term) ||
        a.primer_apellido.toLowerCase().includes(term) ||
        a.segundo_apellido?.toLowerCase().includes(term) ||
        a.email.toLowerCase().includes(term) ||
        a.empresa.toLowerCase().includes(term) ||
        a.rut.toLowerCase().includes(term)
    );
  }

  return filtered;
}
