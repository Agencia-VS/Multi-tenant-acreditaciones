/**
 * Profile completeness utilities
 * 
 * Defines which fields are required for a profile to be considered "complete"
 * and provides helpers for gating access to features like team management.
 */

/** Campos requeridos para que el perfil se considere completo */
export const REQUIRED_PROFILE_FIELDS = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'apellido', label: 'Apellido' },
  { key: 'medio', label: 'Medio / Empresa' },
  { key: 'tipo_medio', label: 'Tipo de Medio' },
] as const;

export type RequiredProfileField = (typeof REQUIRED_PROFILE_FIELDS)[number]['key'];

/**
 * Verifica si un perfil tiene todos los campos requeridos completos.
 * @returns `true` si el perfil tiene nombre, apellido, medio y tipo_medio.
 */
/**
 * Verifica si un perfil tiene todos los campos requeridos completos.
 * Acepta cualquier objeto con los campos del profile.
 * @returns `true` si el perfil tiene nombre, apellido, medio y tipo_medio.
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
