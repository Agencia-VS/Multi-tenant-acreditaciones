/**
 * Utilidades isomórficas de autofill (server + client).
 * NO importa nada de next/headers ni supabase/server.
 */
import type { Profile, FormFieldDefinition } from '@/types';

/**
 * Construye datos de autofill mergeados para un formulario específico.
 * Cascade: tenant-specific → flat datos_base → profile fixed fields
 *
 * Esta función es isomórfica — funciona en server y client.
 *
 * Desde server: pasar profile completo (accede a profile.rut, profile.nombre, etc.)
 * Desde client: pasar solo datosBase via overload (sin campos fijos del profile)
 */
export function buildMergedAutofillData(
  profileOrDatosBase: Profile | Record<string, unknown>,
  tenantId: string,
  formFields: FormFieldDefinition[]
): Record<string, string> {
  // Detectar si es Profile completo o solo datosBase
  const isFullProfile = 'rut' in profileOrDatosBase && 'nombre' in profileOrDatosBase && 'datos_base' in profileOrDatosBase;
  const datosBase = isFullProfile
    ? (profileOrDatosBase as Profile).datos_base || {}
    : profileOrDatosBase as Record<string, unknown>;

  const tenantMap = (datosBase._tenant || {}) as Record<string, Record<string, unknown>>;
  const tenantData = tenantMap[tenantId] || {};

  // Mapeo de profile fixed fields (solo disponible con Profile completo)
  const profileFieldMap: Record<string, unknown> = isFullProfile ? {
    rut: (profileOrDatosBase as Profile).rut,
    nombre: (profileOrDatosBase as Profile).nombre,
    apellido: (profileOrDatosBase as Profile).apellido,
    email: (profileOrDatosBase as Profile).email,
    telefono: (profileOrDatosBase as Profile).telefono,
    nacionalidad: (profileOrDatosBase as Profile).nacionalidad,
    cargo: (profileOrDatosBase as Profile).cargo,
    medio: (profileOrDatosBase as Profile).medio,
    tipo_medio: (profileOrDatosBase as Profile).tipo_medio,
  } : {};

  const result: Record<string, string> = {};

  for (const field of formFields) {
    let val: unknown;

    // 1. Tenant-specific data (highest priority)
    val = tenantData[field.key];

    // 2. Flat datos_base (legacy)
    if (val === undefined || val === null || val === '') {
      val = datosBase[field.key];
    }

    // 3. Profile field mapping (e.g. "datos_base.talla_polera" → datosBase.talla_polera)
    if ((val === undefined || val === null || val === '') && field.profile_field) {
      const pfKey = field.profile_field.replace(/^datos_base\./, '');
      // Check tenant data first
      val = tenantData[pfKey];
      // Then flat
      if (val === undefined || val === null || val === '') {
        val = datosBase[pfKey];
      }
      // Then profile fixed fields
      if (val === undefined || val === null || val === '') {
        val = profileFieldMap[pfKey];
      }
    }

    if (val !== undefined && val !== null && val !== '') {
      result[field.key] = String(val);
    }
  }

  return result;
}
