/**
 * Servicio de Perfiles — Identidad Única
 * 
 * Core de la arquitectura: el usuario se identifica por RUT.
 * Si ya participó en un evento, sus datos se precargan.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { cleanRut, sanitize, normalizeDocumentByType, type DocumentType } from '@/lib/validation';
import type { Profile, RegistrationFormData, ProfileDatosBase } from '@/types';

// Import + re-export isomorphic autofill (no server deps)
import { buildMergedAutofillData } from './autofill';
export { buildMergedAutofillData };

/**
 * Busca un perfil por RUT. Si existe, retorna datos precargados.
 * Esta es la base del "Formulario Diferencial".
 */
export async function lookupProfileByRut(rut: string): Promise<Profile | null> {
  const supabase = createSupabaseAdminClient();
  const normalizedRut = cleanRut(rut);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('rut', normalizedRut)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

/**
 * Busca un perfil por identidad de documento (tipo + valor normalizado).
 */
export async function lookupProfileByDocument(documentType: DocumentType, documentNumber: string): Promise<Profile | null> {
  const supabase = createSupabaseAdminClient();
  const normalized = normalizeDocumentByType(documentType, documentNumber);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('document_type', documentType)
    .eq('document_normalized', normalized)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0] as Profile;
}

/**
 * Obtener o crear perfil por RUT.
 * Si el RUT ya existe, actualiza los datos no vacíos.
 * Si no existe, crea un perfil nuevo.
 * 
 * GUARD: Si se provee userId, verifica que no exista OTRO perfil ya vinculado
 * a ese userId (previene vincular user_id a perfil equivocado).
 */
export async function getOrCreateProfile(data: RegistrationFormData, userId?: string): Promise<Profile> {
  const supabase = createSupabaseAdminClient();

  const requestedType = (data.document_type || (data.rut ? 'rut' : 'dni_extranjero')) as DocumentType;
  const documentType: DocumentType = requestedType === 'rut' ? 'rut' : 'dni_extranjero';
  const inferredNacionalidad = documentType === 'dni_extranjero' ? 'Extranjera' : 'Chilena';
  const rawDocument = (data.document_number || data.rut || '').trim();
  const normalizedDocument = normalizeDocumentByType(documentType, rawDocument);
  
  // Sanitizar datos de entrada
  data.document_type = documentType;
  data.document_number = sanitize(rawDocument);
  if (documentType === 'rut') {
    data.rut = cleanRut(sanitize(rawDocument));
  }
  if (data.nombre) data.nombre = sanitize(data.nombre);
  if (data.apellido) data.apellido = sanitize(data.apellido);
  if (data.email) data.email = sanitize(data.email);
  if (data.telefono) data.telefono = sanitize(data.telefono);
  if (data.cargo) data.cargo = sanitize(data.cargo);
  if (data.organizacion) data.organizacion = sanitize(data.organizacion);

  // Intentar buscar existente por documento (fallback a RUT legacy)
  let existing = await lookupProfileByDocument(documentType, rawDocument);
  if (!existing && documentType === 'rut' && data.rut) {
    existing = await lookupProfileByRut(data.rut);
  }
  
  if (existing) {
    // Actualizar datos que vengan no vacíos
    const updates: Partial<Profile> = {};
    if (data.nombre && data.nombre !== existing.nombre) updates.nombre = data.nombre;
    if (data.apellido && data.apellido !== existing.apellido) updates.apellido = data.apellido;
    if (data.email && data.email !== existing.email) updates.email = data.email;
    if (data.telefono && data.telefono !== existing.telefono) updates.telefono = data.telefono;
    if (data.cargo) updates.cargo = data.cargo;
    if (data.tipo_medio) updates.tipo_medio = data.tipo_medio;
    if (data.organizacion) updates.medio = data.organizacion;
    (updates as Record<string, unknown>).document_type = documentType;
    (updates as Record<string, unknown>).document_number = data.document_number || rawDocument;
    (updates as Record<string, unknown>).document_normalized = normalizedDocument;
    if (documentType === 'rut') {
      updates.rut = data.rut;
    }
    if (documentType === 'dni_extranjero' && (!existing.nacionalidad || existing.nacionalidad.toLowerCase().startsWith('chil'))) {
      updates.nacionalidad = inferredNacionalidad;
    }
    if (documentType === 'rut' && (!existing.nacionalidad || existing.nacionalidad.toLowerCase().startsWith('extr'))) {
      updates.nacionalidad = inferredNacionalidad;
    }
    
    // Solo vincular user_id si el perfil no tiene uno Y no hay otro perfil con ese userId
    if (userId && !existing.user_id) {
      const alreadyLinked = await getProfileByUserId(userId);
      if (!alreadyLinked) {
        updates.user_id = userId;
      } else {
        console.warn(`[getOrCreateProfile] user_id ${userId} ya está vinculado a perfil ${alreadyLinked.id} (rut: ${alreadyLinked.rut}). No se re-vincula a perfil ${existing.id} (rut: ${existing.rut}).`);
      }
    }
    
    if (Object.keys(updates).length > 0) {
      const { data: updated, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();
      
      if (!error && updated) return updated as Profile;
    }
    
    return existing;
  }
  
  // Crear nuevo perfil
  // GUARD: Solo vincular user_id si no existe otro perfil ya vinculado a ese userId
  // Esto previene el error "duplicate key value violates unique constraint profiles_user_id_key"
  // cuando un responsable registra a otras personas de su equipo y el authUserId de la sesión
  // se pasa a getOrCreateProfile para todos los acreditados (no solo para sí mismo).
  let safeUserId: string | null = null;
  if (userId) {
    const alreadyLinked = await getProfileByUserId(userId);
    if (!alreadyLinked) {
      safeUserId = userId;
    }
  }
  
  const insertPayload: Record<string, unknown> = {
    document_type: documentType,
    document_number: data.document_number || rawDocument,
    document_normalized: normalizedDocument,
    rut: documentType === 'rut' ? data.rut : null,
    nombre: data.nombre,
    apellido: data.apellido,
    email: data.email || null,
    telefono: data.telefono || null,
    cargo: data.cargo || null,
    medio: data.organizacion || null,
    tipo_medio: data.tipo_medio || null,
    nacionalidad: inferredNacionalidad,
    user_id: safeUserId,
  };

  const { data: newProfile, error } = await supabase
    .from('profiles')
    .insert(insertPayload as never)
    .select()
    .single();
  
  if (error) throw new Error(`Error creando perfil: ${error.message}`);
  return newProfile as Profile;
}

/**
 * Vincular un user_id de auth con un perfil existente por RUT.
 * Se usa cuando un usuario se registra y ya tenía perfil creado por un Manager.
 * 
 * GUARD: Si el userId ya está vinculado a otro perfil, no re-vincula.
 */
export async function linkProfileToUser(rut: string, userId: string): Promise<Profile | null> {
  const supabase = createSupabaseAdminClient();

  // Verificar que no exista otro perfil ya vinculado a este userId
  const alreadyLinked = await getProfileByUserId(userId);
  if (alreadyLinked) {
    // Ya hay un perfil vinculado — no tocar
    if (alreadyLinked.rut === rut) return alreadyLinked; // mismo perfil, todo OK
    console.warn(`[linkProfileToUser] userId ${userId} ya vinculado a perfil con rut ${alreadyLinked.rut}. Ignorando intento de vincular a rut ${rut}.`);
    return alreadyLinked;
  }
  
  const { data, error } = await supabase
    .from('profiles')
    .update({ user_id: userId })
    .eq('rut', rut)
    .is('user_id', null)
    .select()
    .single();
  
  if (error) return null;
  return data as Profile;
}

/**
 * Obtener perfil por user_id de auth.
 * Usa .limit(1) en vez de .single() para mayor robustez:
 * si por alguna razón existiesen duplicados, devuelve el más antiguo.
 */
export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0] as Profile;
}

/**
 * Obtener perfil por email (fallback cuando no se encuentra por user_id).
 * Retorna solo perfiles sin user_id vinculado para evitar conflictos.
 * Si hay múltiples, prefiere el más antiguo (creado primero = el "real").
 */
export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .is('user_id', null)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0] as Profile;
}

/**
 * Actualizar datos_base del perfil (datos reutilizables como talla, seguro, etc.)
 * NOTA: Esta función mantiene compatibilidad con el formato plano legacy.
 * Para datos contextualizados por tenant, usar saveTenantProfileData().
 */
export async function updateProfileDatosBase(
  profileId: string, 
  datosBase: Record<string, unknown>
): Promise<Profile> {
  const supabase = createSupabaseAdminClient();
  
  // Merge con datos existentes
  const { data: existing } = await supabase
    .from('profiles')
    .select('datos_base')
    .eq('id', profileId)
    .single();
  
  const merged: ProfileDatosBase = { ...((existing?.datos_base || {}) as ProfileDatosBase), ...datosBase };
  
  const { data, error } = await supabase
    .from('profiles')
    .update({ datos_base: merged as any })
    .eq('id', profileId)
    .select()
    .single();
  
  if (error) throw new Error(`Error actualizando perfil: ${error.message}`);
  return data as Profile;
}

// ─── Tenant-Context Profile Data ───────────────────────────────────────────

/**
 * Guarda datos del perfil contextualizados por tenant.
 * 
 * Estructura en datos_base:
 * {
 *   // Legacy flat keys (backwards compatible)
 *   talla_polera: "M",
 *   // Tenant-namespaced data
 *   _tenant: {
 *     "uuid-tenant-uc": { talla_polera: "M", zona: "mixta", _form_keys: [...], _updated_at: "..." },
 *     "uuid-tenant-cc": { grupo_sanguineo: "A+", _form_keys: [...], _updated_at: "..." }
 *   }
 * }
 */
export async function saveTenantProfileData(
  profileId: string,
  tenantId: string,
  data: Record<string, unknown>,
  formKeys: string[]
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // Leer datos_base actuales
  const { data: existing } = await supabase
    .from('profiles')
    .select('datos_base')
    .eq('id', profileId)
    .single();

  const datosBase = (existing?.datos_base || {}) as ProfileDatosBase;
  const tenantMap = datosBase._tenant || {};
  const currentTenantData = tenantMap[tenantId] || {};

  // Merge datos nuevos con existentes del tenant (sin perder datos previos)
  const mergedTenantData = {
    ...currentTenantData,
    ...data,
    _form_keys: formKeys,
    _updated_at: new Date().toISOString(),
  };

  // También guardar en flat (legacy compat) para que buildDynamicData funcione con código antiguo
  const flatMerge = { ...datosBase };
  for (const [key, val] of Object.entries(data)) {
    if (!key.startsWith('_')) flatMerge[key] = val;
  }

  // Actualizar _tenant namespace
  flatMerge._tenant = {
    ...tenantMap,
    [tenantId]: mergedTenantData,
  };

  const { error } = await supabase
    .from('profiles')
    .update({ datos_base: flatMerge as any })
    .eq('id', profileId);

  if (error) throw new Error(`Error guardando datos de tenant: ${error.message}`);
}

/**
 * Obtiene los datos guardados del perfil para un tenant específico.
 */
export async function getTenantProfileData(
  profileId: string,
  tenantId: string
): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from('profiles')
    .select('datos_base')
    .eq('id', profileId)
    .single();

  if (!data?.datos_base) return null;

  const datosBase = (data.datos_base || {}) as ProfileDatosBase;
  const tenantMap = datosBase._tenant || {};

  return tenantMap[tenantId] || null;
}

// buildMergedAutofillData lives in ./autofill.ts (isomorphic, no server deps)

/**
 * Calcula los campos faltantes de un perfil para un contexto tenant/evento.
 * Compara lo que el formulario requiere contra los datos que ya tiene el perfil.
 * 
 * Retorna: { missingFields, formChanged, newKeys, removedKeys }
 */
export function computeTenantProfileStatus(
  profile: Profile,
  tenantId: string,
  formFields: import('@/types').FormFieldDefinition[]
): {
  missingFields: import('@/types').FormFieldDefinition[];
  totalRequired: number;
  filledRequired: number;
  formChanged: boolean;
  newKeys: string[];
  removedKeys: string[];
} {
  const mergedData = buildMergedAutofillData(profile, tenantId, formFields);
  
  // Solo contar campos requeridos para el % de completitud
  const requiredFields = formFields.filter(f => f.required);
  const totalRequired = requiredFields.length;
  
  const missingFields = requiredFields.filter(f => {
    const val = mergedData[f.key];
    return !val || val.trim() === '';
  });
  
  const filledRequired = totalRequired - missingFields.length;

  // Detectar cambios en el formulario vs lo que se guardó
  const datosBase = profile.datos_base || {};
  const tenantMap = (datosBase._tenant || {}) as Record<string, Record<string, unknown>>;
  const tenantData = tenantMap[tenantId] || {};
  const savedFormKeys = (tenantData._form_keys || []) as string[];
  
  const currentFormKeys = formFields.map(f => f.key);
  
  // Si nunca guardó datos, no hay "cambio"
  const hasData = savedFormKeys.length > 0;
  const newKeys = hasData ? currentFormKeys.filter(k => !savedFormKeys.includes(k)) : [];
  const removedKeys = hasData ? savedFormKeys.filter(k => !currentFormKeys.includes(k) && !k.startsWith('_')) : [];
  const formChanged = newKeys.length > 0 || removedKeys.length > 0;

  return {
    missingFields,
    totalRequired,
    filledRequired,
    formChanged,
    newKeys,
    removedKeys,
  };
}


