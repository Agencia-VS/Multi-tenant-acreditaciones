/**
 * Profile completeness utilities
 * 
 * Defines which fields are required for a profile to be considered "complete"
 * and provides helpers for gating access to features like team management.
 * 
 * Two levels:
 *   - isProfileComplete()    → gate de equipos (identidad + datos base)
 *   - isReadyToAccredit()    → gate de acreditación (mismos campos requeridos)
 * 
 * Nota: tipo_medio y cargo NO son requeridos en perfil — se piden
 * por tenant en el formulario de acreditación (pasos 2/3).
 */

/** Campos requeridos para que el perfil se considere completo (gate equipo) */
export const REQUIRED_PROFILE_FIELDS = [
  { key: 'document_type', label: 'Tipo documento' },
  { key: 'document_number', label: 'Documento' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'apellido', label: 'Apellido' },
  { key: 'medio', label: 'Medio / Empresa' },
] as const;

/** Campos requeridos para poder acreditarse */
export const ACCREDITATION_REQUIRED_FIELDS = [
  ...REQUIRED_PROFILE_FIELDS,
] as const;

export type RequiredProfileField = (typeof REQUIRED_PROFILE_FIELDS)[number]['key'];

/**
 * Verifica si un perfil tiene todos los campos requeridos completos.
 * @returns `true` si el perfil tiene nombre, apellido, medio y tipo_medio.
 */
/**
 * Verifica si un perfil tiene todos los campos requeridos completos.
 * Acepta cualquier objeto con los campos del profile.
 * @returns `true` si el perfil tiene documento, nombre, apellido y medio.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isProfileComplete(profile: any): boolean {
  if (!profile) return false;
  return REQUIRED_PROFILE_FIELDS.every(({ key }) => {
    const val = key === 'document_number'
      ? (profile.document_number ?? profile.rut)
      : profile[key];
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
    const val = key === 'document_number'
      ? (profile.document_number ?? profile.rut)
      : profile[key];
    return val === null || val === undefined || val === '';
  });
}

/**
 * Verifica si un perfil tiene todo lo necesario para acreditarse.
 * @returns `true` si el perfil está listo para enviar una acreditación.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isReadyToAccredit(profile: any): boolean {
  if (!profile) return false;
  return ACCREDITATION_REQUIRED_FIELDS.every(({ key }) => {
    const val = key === 'document_number'
      ? (profile.document_number ?? profile.rut)
      : profile[key];
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
    const val = key === 'document_number'
      ? (profile.document_number ?? profile.rut)
      : profile[key];
    return val === null || val === undefined || val === '';
  });
}
