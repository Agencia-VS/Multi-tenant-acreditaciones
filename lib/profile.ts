/**
 * Profile completeness utilities
 * 
 * Defines which fields are required for a profile to be considered "complete"
 * and provides helpers for gating access to features like team management.
 * 
 * Two levels:
 *   - isProfileComplete()    → gate de equipos (nombre, apellido, medio)
 *   - isReadyToAccredit()    → gate de acreditación (lo anterior + RUT)
 * 
 * Nota: tipo_medio y cargo NO son requeridos en perfil — se piden
 * por tenant en el formulario de acreditación (pasos 2/3).
 */

/** Campos requeridos para que el perfil se considere completo (gate equipo) */
export const REQUIRED_PROFILE_FIELDS = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'apellido', label: 'Apellido' },
  { key: 'medio', label: 'Medio / Empresa' },
] as const;

/** Campos requeridos para poder acreditarse (gate acreditación = perfil + RUT) */
export const ACCREDITATION_REQUIRED_FIELDS = [
  ...REQUIRED_PROFILE_FIELDS,
  { key: 'rut', label: 'RUT' },
] as const;

export type RequiredProfileField = (typeof REQUIRED_PROFILE_FIELDS)[number]['key'];

/**
 * Verifica si un perfil tiene todos los campos requeridos completos.
 * @returns `true` si el perfil tiene nombre, apellido, medio y tipo_medio.
 */
/**
 * Verifica si un perfil tiene todos los campos requeridos completos.
 * Acepta cualquier objeto con los campos del profile.
 * @returns `true` si el perfil tiene nombre, apellido y medio.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isProfileComplete(profile: any): boolean {
  if (!profile) return false;
  return REQUIRED_PROFILE_FIELDS.every(({ key }) => {
    const val = profile[key];
    return val !== null && val !== undefined && val !== '';
  });
}

/**
 * Retorna la lista de campos requeridos que faltan en el perfil.
 * Útil para mostrar al usuario qué debe completar.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMissingProfileFields(profile: any): Array<{ key: string; label: string }> {
  if (!profile) return [...REQUIRED_PROFILE_FIELDS];
  return REQUIRED_PROFILE_FIELDS.filter(({ key }) => {
    const val = profile[key];
    return val === null || val === undefined || val === '';
  });
}

/**
 * Verifica si un perfil tiene todo lo necesario para acreditarse.
 * Requiere: nombre, apellido, medio + RUT.
 * @returns `true` si el perfil está listo para enviar una acreditación.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isReadyToAccredit(profile: any): boolean {
  if (!profile) return false;
  return ACCREDITATION_REQUIRED_FIELDS.every(({ key }) => {
    const val = profile[key];
    return val !== null && val !== undefined && val !== '';
  });
}

/**
 * Retorna los campos de acreditación que faltan (perfil + RUT).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMissingAccreditationFields(profile: any): Array<{ key: string; label: string }> {
  if (!profile) return [...ACCREDITATION_REQUIRED_FIELDS];
  return ACCREDITATION_REQUIRED_FIELDS.filter(({ key }) => {
    const val = profile[key];
    return val === null || val === undefined || val === '';
  });
}
