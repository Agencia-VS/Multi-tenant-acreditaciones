/**
 * Servicio de Perfiles — Identidad Única
 * 
 * Core de la arquitectura: el usuario se identifica por RUT.
 * Si ya participó en un evento, sus datos se precargan.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { Profile, RegistrationFormData } from '@/types';

/**
 * Busca un perfil por RUT. Si existe, retorna datos precargados.
 * Esta es la base del "Formulario Diferencial".
 */
export async function lookupProfileByRut(rut: string): Promise<Profile | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('rut', rut)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

/**
 * Obtener o crear perfil por RUT.
 * Si el RUT ya existe, actualiza los datos no vacíos.
 * Si no existe, crea un perfil nuevo.
 */
export async function getOrCreateProfile(data: RegistrationFormData, userId?: string): Promise<Profile> {
  const supabase = createSupabaseAdminClient();
  
  // Intentar buscar existente
  const existing = await lookupProfileByRut(data.rut);
  
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
    if (userId && !existing.user_id) updates.user_id = userId;
    
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
  const { data: newProfile, error } = await supabase
    .from('profiles')
    .insert({
      rut: data.rut,
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email || null,
      telefono: data.telefono || null,
      cargo: data.cargo || null,
      medio: data.organizacion || null,
      tipo_medio: data.tipo_medio || null,
      user_id: userId || null,
    })
    .select()
    .single();
  
  if (error) throw new Error(`Error creando perfil: ${error.message}`);
  return newProfile as Profile;
}

/**
 * Vincular un user_id de auth con un perfil existente por RUT.
 * Se usa cuando un usuario se registra y ya tenía perfil creado por un Manager.
 */
export async function linkProfileToUser(rut: string, userId: string): Promise<Profile | null> {
  const supabase = createSupabaseAdminClient();
  
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
 * Obtener perfil por user_id de auth
 */
export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

/**
 * Actualizar datos_base del perfil (datos reutilizables como talla, seguro, etc.)
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
  
  const merged = { ...(existing?.datos_base || {}), ...datosBase };
  
  const { data, error } = await supabase
    .from('profiles')
    .update({ datos_base: merged })
    .eq('id', profileId)
    .select()
    .single();
  
  if (error) throw new Error(`Error actualizando perfil: ${error.message}`);
  return data as Profile;
}
