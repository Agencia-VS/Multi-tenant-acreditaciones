/**
 * Servicio de Registros (Inscripciones/Tickets)
 * 
 * Maneja la creación, aprobación, rechazo y consulta de acreditaciones.
 * Integra con el motor de cupos y el sistema de QR.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { 
  Registration, RegistrationFull, RegistrationFormData, 
  RegistrationStatus, QuotaCheckResult, RegistrationFilters 
} from '@/types';
import { getOrCreateProfile, updateProfileDatosBase } from './profiles';
import { checkQuota } from './quotas';

/**
 * Crear una nueva inscripción.
 * 1. Busca/crea el perfil por RUT (Identidad Única)
 * 2. Verifica cupos disponibles
 * 3. Crea el registro de inscripción
 * 4. Guarda datos extra en el perfil si tienen profile_field mapping
 *
 * @param eventId - ID del evento
 * @param formData - Datos del formulario
 * @param submittedByProfileId - profile_id de quien envía (manager o self)
 * @param authUserId - user_id de auth del usuario autenticado (para vincular perfil)
 */
export async function createRegistration(
  eventId: string,
  formData: RegistrationFormData,
  submittedByProfileId?: string,
  authUserId?: string
): Promise<{ registration: Registration; profile_id: string }> {
  const supabase = createSupabaseAdminClient();

  // 1. Buscar o crear perfil — pasa userId para vincular cuenta si corresponde
  const profile = await getOrCreateProfile(formData, authUserId);

  // 2. Verificar cupos
  if (formData.tipo_medio && formData.organizacion) {
    const quota = await checkQuota(eventId, formData.tipo_medio, formData.organizacion);
    if (!quota.available) {
      throw new Error(quota.message);
    }
  }

  // 3. Verificar que no existe registro duplicado
  const { data: existing } = await supabase
    .from('registrations')
    .select('id')
    .eq('event_id', eventId)
    .eq('profile_id', profile.id)
    .single();

  if (existing) {
    throw new Error('Esta persona ya está registrada en este evento');
  }

  // 4. Crear registro
  const { data: registration, error } = await supabase
    .from('registrations')
    .insert({
      event_id: eventId,
      profile_id: profile.id,
      organizacion: formData.organizacion || null,
      tipo_medio: formData.tipo_medio || null,
      cargo: formData.cargo || null,
      submitted_by: submittedByProfileId || null,
      datos_extra: formData.datos_extra || {},
      status: 'pendiente',
    })
    .select()
    .single();

  if (error) throw new Error(`Error creando inscripción: ${error.message}`);

  // 5. Guardar datos reutilizables en el perfil (datos_base)
  if (formData.datos_extra && Object.keys(formData.datos_extra).length > 0) {
    try {
      await updateProfileDatosBase(profile.id, formData.datos_extra);
    } catch {
      // No bloquear si falla el update del perfil
      console.warn('No se pudieron guardar datos extra en el perfil');
    }
  }

  return { registration: registration as Registration, profile_id: profile.id };
}

/**
 * Crear múltiples inscripciones (Manager/Bulk)
 */
export async function createBulkRegistrations(
  eventId: string,
  registrations: RegistrationFormData[],
  managerProfileId: string
): Promise<{ success: number; errors: Array<{ rut: string; error: string }> }> {
  const results = { success: 0, errors: [] as Array<{ rut: string; error: string }> };

  for (const formData of registrations) {
    try {
      await createRegistration(eventId, formData, managerProfileId);
      results.success++;
    } catch (error) {
      results.errors.push({
        rut: formData.rut,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  return results;
}

/**
 * Listar registros con filtros (para admin dashboard)
 * Usa la vista v_registration_full para datos completos
 */
export async function listRegistrations(
  filters: RegistrationFilters & { limit?: number; offset?: number }
): Promise<{ data: RegistrationFull[]; count: number }> {
  const supabase = createSupabaseAdminClient();
  
  let query = supabase
    .from('v_registration_full')
    .select('*', { count: 'exact' });

  if (filters.event_id) query = query.eq('event_id', filters.event_id);
  if (filters.tenant_id) query = query.eq('tenant_id', filters.tenant_id);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.tipo_medio) query = query.eq('tipo_medio', filters.tipo_medio);
  if (filters.organizacion) query = query.ilike('organizacion', `%${filters.organizacion}%`);
  if (filters.search) {
    query = query.or(
      `profile_nombre.ilike.%${filters.search}%,profile_apellido.ilike.%${filters.search}%,rut.ilike.%${filters.search}%,organizacion.ilike.%${filters.search}%`
    );
  }

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  
  query = query.order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(`Error listando registros: ${error.message}`);
  return { data: (data || []) as RegistrationFull[], count: count || 0 };
}

/**
 * Actualizar estado de un registro (aprobar/rechazar)
 * Si se aprueba y el evento tiene QR, genera el token
 */
export async function updateRegistrationStatus(
  registrationId: string,
  status: RegistrationStatus,
  processedByUserId: string,
  motivoRechazo?: string
): Promise<Registration> {
  const supabase = createSupabaseAdminClient();

  const updates: Record<string, unknown> = {
    status,
    processed_by: processedByUserId,
    processed_at: new Date().toISOString(),
  };

  if (status === 'rechazado' && motivoRechazo) {
    updates.motivo_rechazo = motivoRechazo;
  }

  const { data, error } = await supabase
    .from('registrations')
    .update(updates)
    .eq('id', registrationId)
    .select()
    .single();

  if (error) throw new Error(`Error actualizando registro: ${error.message}`);

  // Si se aprueba, verificar si el evento tiene QR habilitado y generar token
  if (status === 'aprobado') {
    const { data: event } = await supabase
      .from('events')
      .select('qr_enabled')
      .eq('id', data.event_id)
      .single();

    if (event?.qr_enabled) {
      await supabase.rpc('generate_qr_token', { p_registration_id: registrationId });
    }
  }

  // Devolver registro actualizado
  const { data: updated } = await supabase
    .from('registrations')
    .select('*')
    .eq('id', registrationId)
    .single();

  return (updated || data) as Registration;
}

/**
 * Aprobar múltiples registros de un golpe (Bulk Approve)
 */
export async function bulkUpdateStatus(
  registrationIds: string[],
  status: RegistrationStatus,
  processedByUserId: string
): Promise<{ success: number; errors: string[] }> {
  const results = { success: 0, errors: [] as string[] };

  for (const id of registrationIds) {
    try {
      await updateRegistrationStatus(id, status, processedByUserId);
      results.success++;
    } catch (error) {
      results.errors.push(
        `${id}: ${error instanceof Error ? error.message : 'Error'}`
      );
    }
  }

  return results;
}

/**
 * Obtener un registro con datos completos
 */
export async function getRegistrationFull(registrationId: string): Promise<RegistrationFull | null> {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('v_registration_full')
    .select('*')
    .eq('id', registrationId)
    .single();

  if (error || !data) return null;
  return data as RegistrationFull;
}

/**
 * Obtener registros de un perfil (para el dashboard del acreditado)
 */
export async function getRegistrationsByProfile(profileId: string): Promise<RegistrationFull[]> {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('v_registration_full')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Error obteniendo registros: ${error.message}`);
  return (data || []) as RegistrationFull[];
}

/**
 * Obtener estadísticas de registros para un evento
 */
export async function getRegistrationStats(eventId: string) {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('registrations')
    .select('status')
    .eq('event_id', eventId);

  if (error) throw new Error(`Error obteniendo stats: ${error.message}`);

  const stats = {
    total: data?.length || 0,
    pendientes: 0,
    aprobados: 0,
    rechazados: 0,
    revision: 0,
    checked_in: 0,
  };

  data?.forEach((r) => {
    if (r.status === 'pendiente') stats.pendientes++;
    if (r.status === 'aprobado') stats.aprobados++;
    if (r.status === 'rechazado') stats.rechazados++;
    if (r.status === 'revision') stats.revision++;
  });

  // Contar check-ins
  const { count } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('checked_in', true);

  stats.checked_in = count || 0;

  return stats;
}
