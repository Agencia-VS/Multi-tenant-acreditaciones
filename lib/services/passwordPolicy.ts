/**
 * Password Policy — Políticas de contraseña
 * - Validación de fuerza mínima
 * - Detección de cambio forzado (must_change_password en user_metadata)
 */

import type { User } from '@supabase/supabase-js';

/** Reglas de validación de contraseña */
export const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 128,
} as const;

/**
 * Verifica si un usuario debe cambiar su contraseña en el primer login.
 * Típicamente se marca al crear admins con contraseña temporal.
 */
export function shouldForcePasswordChange(user: User | null): boolean {
  if (!user) return false;
  return user.user_metadata?.must_change_password === true;
}

/**
 * Valida que una contraseña cumple con los requisitos mínimos.
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'La contraseña es requerida' };
  }
  if (password.length < PASSWORD_RULES.minLength) {
    return { valid: false, error: `La contraseña debe tener al menos ${PASSWORD_RULES.minLength} caracteres` };
  }
  if (password.length > PASSWORD_RULES.maxLength) {
    return { valid: false, error: `La contraseña no puede exceder ${PASSWORD_RULES.maxLength} caracteres` };
  }
  return { valid: true };
}

/**
 * Genera la URL de redirección para forzar cambio de contraseña.
 * Redirige al callback con type=force-change y el destino final en next.
 */
export function getForceChangeRedirectUrl(origin: string, nextPath: string): string {
  return `${origin}/auth/callback?type=force-change&next=${encodeURIComponent(nextPath)}`;
}
