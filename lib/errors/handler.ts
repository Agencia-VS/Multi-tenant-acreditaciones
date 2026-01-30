/**
 * Manejador de errores centralizado
 * 
 * Proporciona funciones consistentes para manejar errores de
 * Supabase, APIs y validación en toda la aplicación.
 */

// ============================================================================
// TIPOS
// ============================================================================

/** Resultado de error procesado */
export interface ErrorResult {
  message: string;
  code: string;
}

/** Error de Supabase */
export interface SupabaseError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
}

/** Error de API con response */
export interface ApiError {
  message?: string;
  status?: number;
  statusText?: string;
  error?: string;
}

// ============================================================================
// CONSTANTES
// ============================================================================

/** Códigos de error conocidos de Supabase/PostgreSQL */
const SUPABASE_ERROR_CODES: Record<string, string> = {
  // Errores de autenticación
  "invalid_credentials": "Credenciales inválidas",
  "email_not_confirmed": "Email no confirmado",
  "user_not_found": "Usuario no encontrado",
  "invalid_grant": "Token inválido o expirado",
  
  // Errores de base de datos
  "23505": "El registro ya existe (duplicado)",
  "23503": "Referencia inválida a otro registro",
  "23502": "Campo requerido faltante",
  "42501": "Sin permisos para esta operación",
  "42P01": "Tabla no encontrada",
  "42703": "Columna no encontrada",
  
  // Errores de RLS
  "PGRST301": "Sin resultados encontrados",
  "PGRST116": "Múltiples filas retornadas cuando se esperaba una",
  
  // Rate limiting
  "429": "Demasiadas solicitudes, intente más tarde",
};

/** Mensajes de error genéricos */
const GENERIC_MESSAGES = {
  network: "Error de conexión. Verifique su conexión a internet.",
  server: "Error del servidor. Intente nuevamente más tarde.",
  unknown: "Ocurrió un error inesperado.",
  timeout: "La operación tardó demasiado. Intente nuevamente.",
  unauthorized: "Sesión expirada. Inicie sesión nuevamente.",
  forbidden: "No tiene permisos para realizar esta acción.",
  notFound: "El recurso solicitado no fue encontrado.",
  validation: "Datos inválidos. Verifique la información ingresada.",
};

// ============================================================================
// FUNCIONES
// ============================================================================

/**
 * Maneja errores de Supabase y retorna un mensaje amigable.
 * 
 * @param error - Error de Supabase
 * @returns Resultado con mensaje y código de error
 * 
 * @example
 * ```ts
 * const { data, error } = await supabase.from('tabla').select();
 * if (error) {
 *   const { message, code } = handleSupabaseError(error);
 *   console.error(`[${code}] ${message}`);
 * }
 * ```
 */
export function handleSupabaseError(error: SupabaseError | null | undefined): ErrorResult {
  if (!error) {
    return { message: GENERIC_MESSAGES.unknown, code: "UNKNOWN" };
  }

  const code = error.code || "UNKNOWN";
  
  // Buscar mensaje conocido por código
  if (code && SUPABASE_ERROR_CODES[code]) {
    return {
      message: SUPABASE_ERROR_CODES[code],
      code,
    };
  }

  // Analizar mensaje para determinar tipo de error
  const message = error.message?.toLowerCase() || "";
  
  if (message.includes("network") || message.includes("fetch")) {
    return { message: GENERIC_MESSAGES.network, code: "NETWORK_ERROR" };
  }
  
  if (message.includes("timeout")) {
    return { message: GENERIC_MESSAGES.timeout, code: "TIMEOUT" };
  }
  
  if (message.includes("jwt") || message.includes("token") || message.includes("auth")) {
    return { message: GENERIC_MESSAGES.unauthorized, code: "AUTH_ERROR" };
  }
  
  if (message.includes("permission") || message.includes("policy")) {
    return { message: GENERIC_MESSAGES.forbidden, code: "FORBIDDEN" };
  }
  
  if (message.includes("not found") || message.includes("no rows")) {
    return { message: GENERIC_MESSAGES.notFound, code: "NOT_FOUND" };
  }

  // Retornar mensaje original si no se puede clasificar
  return {
    message: error.message || GENERIC_MESSAGES.unknown,
    code,
  };
}

/**
 * Maneja errores de respuesta de API (fetch).
 * 
 * @param error - Error o Response de fetch
 * @returns Resultado con mensaje y código de error
 * 
 * @example
 * ```ts
 * try {
 *   const response = await fetch('/api/endpoint');
 *   if (!response.ok) {
 *     const { message, code } = handleApiError(response);
 *     throw new Error(message);
 *   }
 * } catch (error) {
 *   const { message, code } = handleApiError(error);
 *   console.error(`[${code}] ${message}`);
 * }
 * ```
 */
export function handleApiError(error: ApiError | Response | Error | unknown): ErrorResult {
  // Error es null/undefined
  if (!error) {
    return { message: GENERIC_MESSAGES.unknown, code: "UNKNOWN" };
  }

  // Es un Response de fetch
  if (error instanceof Response) {
    const status = error.status;
    const code = `HTTP_${status}`;
    
    switch (status) {
      case 400:
        return { message: GENERIC_MESSAGES.validation, code };
      case 401:
        return { message: GENERIC_MESSAGES.unauthorized, code };
      case 403:
        return { message: GENERIC_MESSAGES.forbidden, code };
      case 404:
        return { message: GENERIC_MESSAGES.notFound, code };
      case 429:
        return { message: SUPABASE_ERROR_CODES["429"], code };
      case 500:
      case 502:
      case 503:
        return { message: GENERIC_MESSAGES.server, code };
      default:
        return { message: error.statusText || GENERIC_MESSAGES.unknown, code };
    }
  }

  // Es un Error estándar
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes("network") || message.includes("failed to fetch")) {
      return { message: GENERIC_MESSAGES.network, code: "NETWORK_ERROR" };
    }
    
    if (message.includes("abort") || message.includes("timeout")) {
      return { message: GENERIC_MESSAGES.timeout, code: "TIMEOUT" };
    }
    
    return { message: error.message, code: "ERROR" };
  }

  // Es un objeto con propiedades de error
  if (typeof error === "object" && error !== null) {
    const apiError = error as ApiError;
    
    if (apiError.status) {
      return handleApiError(new Response(null, { 
        status: apiError.status, 
        statusText: apiError.statusText 
      }));
    }
    
    if (apiError.message) {
      return { message: apiError.message, code: "API_ERROR" };
    }
    
    if (apiError.error) {
      return { message: apiError.error, code: "API_ERROR" };
    }
  }

  // Fallback para tipos desconocidos
  return { message: GENERIC_MESSAGES.unknown, code: "UNKNOWN" };
}

/**
 * Procesa errores de validación y retorna mensajes formateados.
 * 
 * @param errors - Array de errores o string único
 * @returns Array de mensajes de error limpios
 * 
 * @example
 * ```ts
 * const validationResult = validateForm(formData);
 * if (!validationResult.valid) {
 *   const messages = handleValidationError(validationResult.errors);
 *   messages.forEach(msg => console.log(`• ${msg}`));
 * }
 * ```
 */
export function handleValidationError(
  errors: string[] | string | null | undefined
): string[] {
  if (!errors) {
    return [];
  }

  // Convertir string a array
  const errorArray = Array.isArray(errors) ? errors : [errors];

  // Limpiar y formatear errores
  return errorArray
    .filter((error): error is string => typeof error === "string" && error.trim() !== "")
    .map((error) => {
      // Capitalizar primera letra
      const trimmed = error.trim();
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    });
}

/**
 * Combina múltiples errores en un solo mensaje.
 * 
 * @param errors - Array de errores
 * @param separator - Separador entre errores (default: ", ")
 * @returns String combinado de errores
 * 
 * @example
 * ```ts
 * const errors = handleValidationError(validationResult.errors);
 * const combined = combineErrors(errors, "\n• ");
 * alert(`Errores encontrados:\n• ${combined}`);
 * ```
 */
export function combineErrors(errors: string[], separator: string = ", "): string {
  return errors.join(separator);
}

/**
 * Determina si un error es recuperable (puede reintentarse).
 * 
 * @param error - Error a evaluar
 * @returns true si el error es temporal y puede reintentarse
 * 
 * @example
 * ```ts
 * const { code } = handleApiError(error);
 * if (isRetryableError({ code })) {
 *   await delay(1000);
 *   // Reintentar operación
 * }
 * ```
 */
export function isRetryableError(error: { code?: string; status?: number }): boolean {
  const retryableCodes = [
    "NETWORK_ERROR",
    "TIMEOUT",
    "HTTP_429",
    "HTTP_500",
    "HTTP_502",
    "HTTP_503",
  ];
  
  if (error.code && retryableCodes.includes(error.code)) {
    return true;
  }
  
  if (error.status && [429, 500, 502, 503].includes(error.status)) {
    return true;
  }
  
  return false;
}

/**
 * Loguea un error de forma consistente.
 * 
 * @param context - Contexto donde ocurrió el error
 * @param error - Error procesado
 * @param originalError - Error original (opcional, para debugging)
 */
export function logError(
  context: string,
  error: ErrorResult,
  originalError?: unknown
): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${context}] [${error.code}] ${error.message}`);
  
  if (originalError && process.env.NODE_ENV === "development") {
    console.error("Original error:", originalError);
  }
}
