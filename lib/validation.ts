/**
 * Utilidades de validación — Accredia
 * RUT chileno, email, teléfono y sanitización
 */

/**
 * Limpia un RUT: quita puntos y espacios, deja solo dígitos + guión + dígito verificador
 */
export function cleanRut(raw: string): string {
  // Quitar puntos y espacios
  let rut = raw.replace(/\./g, '').replace(/\s/g, '').trim();
  // Si no tiene guión, insertar antes del último carácter
  if (rut.length > 1 && !rut.includes('-')) {
    rut = rut.slice(0, -1) + '-' + rut.slice(-1);
  }
  return rut.toUpperCase();
}

/**
 * Formatea un RUT con puntos y guión: 12.345.678-9
 */
export function formatRut(raw: string): string {
  const cleaned = cleanRut(raw);
  const parts = cleaned.split('-');
  if (parts.length !== 2) return raw;

  const body = parts[0];
  const dv = parts[1];
  
  // Agregar puntos de miles
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted}-${dv}`;
}

/**
 * Calcula el dígito verificador de un RUT chileno
 */
function computeDV(rutBody: number): string {
  let sum = 0;
  let multiplier = 2;
  let num = rutBody;

  while (num > 0) {
    sum += (num % 10) * multiplier;
    num = Math.floor(num / 10);
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return remainder.toString();
}

export interface RutValidationResult {
  valid: boolean;
  error?: string;
  formatted?: string;
}

/**
 * Valida un RUT chileno.
 * 
 * MODO ACTUAL: solo formato (dígitos + guión + DV).
 * TODO: Reactivar validación de dígito verificador cuando salga de modo prueba.
 *       Descomentar el bloque de computeDV abajo.
 */
export function validateRut(raw: string): RutValidationResult {
  if (!raw || !raw.trim()) {
    return { valid: false, error: 'RUT es requerido' };
  }

  const cleaned = cleanRut(raw);
  
  // Verificar formato básico: dígitos-dv
  const match = cleaned.match(/^(\d{7,8})-([0-9K])$/);
  if (!match) {
    return { valid: false, error: 'Formato inválido. Ej: 12.345.678-9' };
  }

  // Validación de dígito verificador DESACTIVADA (modo prueba)
  // const body = parseInt(match[1], 10);
  // const dv = match[2];
  // const expectedDV = computeDV(body);
  // if (dv !== expectedDV) {
  //   return { valid: false, error: 'Dígito verificador incorrecto' };
  // }

  return { valid: true, formatted: formatRut(cleaned) };
}

export interface EmailValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida formato de email
 */
export function validateEmail(email: string): EmailValidationResult {
  if (!email || !email.trim()) {
    return { valid: false, error: 'Email es requerido' };
  }

  // RFC 5322 simplified
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: 'Email inválido. Ej: correo@ejemplo.cl' };
  }

  return { valid: true };
}

/**
 * Valida teléfono chileno (opcional, si se proporciona)
 */
export function validatePhone(phone: string): { valid: boolean; error?: string } {
  if (!phone || !phone.trim()) return { valid: true }; // Opcional
  
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.length < 8) {
    return { valid: false, error: 'Teléfono debe tener al menos 8 dígitos' };
  }
  
  return { valid: true };
}

/**
 * Sanitiza un string: trim + normaliza espacios internos
 */
export function sanitize(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
