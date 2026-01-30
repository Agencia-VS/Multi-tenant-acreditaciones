/**
 * Índice de manejadores de errores
 * 
 * @example
 * ```ts
 * import { handleSupabaseError, handleApiError, handleValidationError } from "../lib/errors";
 * ```
 */

export {
  handleSupabaseError,
  handleApiError,
  handleValidationError,
  combineErrors,
  isRetryableError,
  logError,
  type ErrorResult,
  type SupabaseError,
  type ApiError,
} from "./handler";
