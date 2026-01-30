/**
 * Índice de servicios
 * 
 * Centraliza los exports de todos los servicios para imports más limpios.
 * 
 * @example
 * ```ts
 * // Antes
 * import { validateForm } from "../lib/services/acreditacion";
 * import { sendApprovalEmail } from "../lib/services/email";
 * 
 * // Después
 * import { validateForm, sendApprovalEmail } from "../lib/services";
 * ```
 */

// ============================================================================
// SERVICIO DE ACREDITACIÓN
// ============================================================================

export {
  // Validaciones
  validateRutCheckDigit,
  validateAcreditado,
  validateForm,
  
  // Transformaciones
  getEmpresaDisplay,
  splitApellido,
  mapearAcreditacionesDB,
  prepareAcreditacionForDB,
  
  // Operaciones de BD
  updateAcreditacionStatus,
  assignZonaToAcreditacion,
  deleteAcreditacion,
  
  // Utilidades
  getAcreditacionesStats,
  filterAcreditaciones,
  
  // Tipos
  type ValidationResult,
  type SingleValidationResult,
  type AcreditadoInsertData,
  type RawAcreditacionDB,
  type UpdateStatusResult,
} from "./acreditacion";

// ============================================================================
// SERVICIO DE EMAIL
// ============================================================================

export {
  // Helpers
  prepareEmailData,
  
  // Servicios principales
  sendApprovalEmail,
  sendRejectionEmail,
  sendStatusEmail,
  sendBulkStatusEmails,
  
  // Tipos
  type EmailAcreditadoData,
  type EmailPayload,
  type EmailResult,
  type EmailLoggingOptions,
} from "./email";
