/**
 * Servicios de envío de emails
 * 
 * Centraliza la lógica de envío de correos de aprobación y rechazo.
 * Llama a las APIs internas y maneja errores de forma consistente.
 */

import type { Acreditacion } from "../../types/acreditacion";

// ============================================================================
// TIPOS
// ============================================================================

/** Datos del acreditado necesarios para enviar email */
export interface EmailAcreditadoData {
  nombre: string;
  apellido: string;
  correo: string;
}

/** Datos preparados para el envío de email */
export interface EmailPayload {
  nombre: string;
  apellido: string;
  correo: string;
  zona?: string;
  area?: string;
}

/** Resultado del envío de email */
export interface EmailResult {
  success: boolean;
  error?: string;
  emailId?: string;
}

/** Opciones de logging */
export interface EmailLoggingOptions {
  /** Si debe loguear en consola */
  enableLogging?: boolean;
  /** Prefijo para los logs */
  logPrefix?: string;
}

// ============================================================================
// CONSTANTES
// ============================================================================

/** Endpoints de las APIs de email */
const EMAIL_ENDPOINTS = {
  approval: "/api/send-approval",
  rejection: "/api/send-rejection",
} as const;

/** Configuración por defecto de logging */
const DEFAULT_LOGGING: EmailLoggingOptions = {
  enableLogging: true,
  logPrefix: "[EmailService]",
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Prepara los datos del acreditado para el envío de email.
 * Extrae y formatea los campos necesarios de forma consistente.
 * 
 * @param acreditado - Datos del acreditado (puede ser Acreditacion o datos parciales)
 * @param zona - Nombre de la zona asignada
 * @param area - Nombre del área asignada
 * @returns Payload listo para enviar a la API
 * 
 * @example
 * ```ts
 * const payload = prepareEmailData(acreditacion, "Zona 1", "TV Nacionales");
 * // { nombre: "Juan", apellido: "Pérez González", correo: "juan@mail.com", zona: "Zona 1", area: "TV Nacionales" }
 * ```
 */
export function prepareEmailData(
  acreditado: Acreditacion | EmailAcreditadoData,
  zona?: string,
  area?: string
): EmailPayload {
  // Determinar el apellido según el tipo de datos
  let apellido: string;
  
  if ("primer_apellido" in acreditado) {
    // Es tipo Acreditacion con apellidos separados
    apellido = `${acreditado.primer_apellido} ${acreditado.segundo_apellido || ""}`.trim();
  } else {
    // Es tipo EmailAcreditadoData con apellido ya concatenado
    apellido = acreditado.apellido;
  }

  // Obtener el correo (puede venir como "email" o "correo")
  const correo = "email" in acreditado ? acreditado.email : acreditado.correo;

  return {
    nombre: acreditado.nombre,
    apellido,
    correo,
    ...(zona && { zona }),
    ...(area && { area }),
  };
}

/**
 * Logger interno para el servicio de email.
 */
function logEmail(
  level: "info" | "error" | "warn",
  message: string,
  data?: unknown,
  options: EmailLoggingOptions = DEFAULT_LOGGING
): void {
  if (!options.enableLogging) return;

  const prefix = options.logPrefix || DEFAULT_LOGGING.logPrefix;
  const timestamp = new Date().toISOString();
  const logMessage = `${prefix} [${timestamp}] ${message}`;

  switch (level) {
    case "error":
      console.error(logMessage, data ?? "");
      break;
    case "warn":
      console.warn(logMessage, data ?? "");
      break;
    default:
      console.log(logMessage, data ?? "");
  }
}

/**
 * Realiza la llamada HTTP a la API de email.
 */
async function callEmailApi(
  endpoint: string,
  payload: EmailPayload,
  loggingOptions?: EmailLoggingOptions
): Promise<EmailResult> {
  const options = { ...DEFAULT_LOGGING, ...loggingOptions };

  try {
    logEmail("info", `Enviando email a ${payload.correo}`, { endpoint }, options);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `Error HTTP ${response.status}`;
      
      logEmail("error", `Fallo al enviar email: ${errorMessage}`, { 
        status: response.status, 
        endpoint,
        correo: payload.correo,
      }, options);

      return {
        success: false,
        error: errorMessage,
      };
    }

    const data = await response.json().catch(() => ({}));
    
    logEmail("info", `Email enviado exitosamente a ${payload.correo}`, {
      emailId: data.id,
    }, options);

    return {
      success: true,
      emailId: data.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error de red desconocido";
    
    logEmail("error", `Error de red al enviar email: ${errorMessage}`, {
      endpoint,
      correo: payload.correo,
      error,
    }, options);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================================================
// SERVICIOS PRINCIPALES
// ============================================================================

/**
 * Envía un email de aprobación al acreditado.
 * 
 * @param acreditado - Datos del acreditado
 * @param zona - Nombre de la zona asignada
 * @param area - Nombre del área de prensa
 * @param loggingOptions - Opciones de logging
 * @returns Resultado del envío
 * 
 * @example
 * ```ts
 * const result = await sendApprovalEmail(
 *   selectedAcreditacion,
 *   "Zona 1 - Tribuna Central",
 *   "TV Nacionales"
 * );
 * 
 * if (!result.success) {
 *   console.error("Error enviando email:", result.error);
 * }
 * ```
 */
export async function sendApprovalEmail(
  acreditado: Acreditacion | EmailAcreditadoData,
  zona: string,
  area: string,
  loggingOptions?: EmailLoggingOptions
): Promise<EmailResult> {
  const payload = prepareEmailData(acreditado, zona, area);
  
  // Validar que tenemos correo
  if (!payload.correo) {
    return {
      success: false,
      error: "El acreditado no tiene correo electrónico",
    };
  }

  return callEmailApi(EMAIL_ENDPOINTS.approval, payload, loggingOptions);
}

/**
 * Envía un email de rechazo al acreditado.
 * 
 * @param acreditado - Datos del acreditado
 * @param zona - Nombre de la zona (opcional, para contexto)
 * @param area - Nombre del área de prensa (opcional, para contexto)
 * @param loggingOptions - Opciones de logging
 * @returns Resultado del envío
 * 
 * @example
 * ```ts
 * const result = await sendRejectionEmail(
 *   selectedAcreditacion,
 *   undefined, // zona no es relevante para rechazo
 *   "TV Nacionales"
 * );
 * 
 * if (!result.success) {
 *   console.error("Error enviando email:", result.error);
 * }
 * ```
 */
export async function sendRejectionEmail(
  acreditado: Acreditacion | EmailAcreditadoData,
  zona?: string,
  area?: string,
  loggingOptions?: EmailLoggingOptions
): Promise<EmailResult> {
  const payload = prepareEmailData(acreditado, zona, area);
  
  // Validar que tenemos correo
  if (!payload.correo) {
    return {
      success: false,
      error: "El acreditado no tiene correo electrónico",
    };
  }

  return callEmailApi(EMAIL_ENDPOINTS.rejection, payload, loggingOptions);
}

/**
 * Envía email según el estado de la acreditación.
 * Wrapper conveniente que determina qué tipo de email enviar.
 * 
 * @param acreditado - Datos del acreditado
 * @param estado - Estado de la acreditación ("aprobado" | "rechazado")
 * @param zona - Nombre de la zona
 * @param area - Nombre del área
 * @param loggingOptions - Opciones de logging
 * @returns Resultado del envío
 * 
 * @example
 * ```ts
 * const result = await sendStatusEmail(
 *   acreditacion,
 *   "aprobado",
 *   zonaNombre,
 *   areaNombre
 * );
 * ```
 */
export async function sendStatusEmail(
  acreditado: Acreditacion | EmailAcreditadoData,
  estado: "aprobado" | "rechazado",
  zona?: string,
  area?: string,
  loggingOptions?: EmailLoggingOptions
): Promise<EmailResult> {
  if (estado === "aprobado") {
    if (!zona || !area) {
      return {
        success: false,
        error: "Zona y área son requeridas para emails de aprobación",
      };
    }
    return sendApprovalEmail(acreditado, zona, area, loggingOptions);
  }

  return sendRejectionEmail(acreditado, zona, area, loggingOptions);
}

/**
 * Envía emails masivos a múltiples acreditados.
 * Útil para operaciones de aprobación/rechazo en lote.
 * 
 * @param acreditados - Lista de acreditados
 * @param estado - Estado a notificar
 * @param getZona - Función para obtener el nombre de la zona
 * @param getArea - Función para obtener el nombre del área
 * @returns Resultados de cada envío
 * 
 * @example
 * ```ts
 * const results = await sendBulkStatusEmails(
 *   selectedAcreditados,
 *   "aprobado",
 *   (a) => zonas.find(z => z.id === a.zona_id)?.nombre || "Sin zona",
 *   (a) => AREA_NAMES[a.area] || a.area
 * );
 * 
 * const failed = results.filter(r => !r.success);
 * console.log(`${results.length - failed.length} emails enviados, ${failed.length} fallidos`);
 * ```
 */
export async function sendBulkStatusEmails(
  acreditados: Acreditacion[],
  estado: "aprobado" | "rechazado",
  getZona: (acreditado: Acreditacion) => string,
  getArea: (acreditado: Acreditacion) => string,
  loggingOptions?: EmailLoggingOptions
): Promise<Array<EmailResult & { acreditadoId: number }>> {
  const results: Array<EmailResult & { acreditadoId: number }> = [];

  for (const acreditado of acreditados) {
    const zona = getZona(acreditado);
    const area = getArea(acreditado);
    
    const result = await sendStatusEmail(acreditado, estado, zona, area, loggingOptions);
    
    results.push({
      ...result,
      acreditadoId: acreditado.id,
    });

    // Pequeño delay entre emails para evitar rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}
