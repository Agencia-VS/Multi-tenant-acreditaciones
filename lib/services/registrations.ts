/**
 * Servicio de Registros (Inscripciones/Tickets)
 * 
 * Maneja la creación, aprobación, rechazo y consulta de acreditaciones.
 * Integra con el motor de cupos y el sistema de QR.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { 
  Registration, RegistrationFull, RegistrationFormData, 
  RegistrationStatus, RegistrationFilters 
} from '@/types';
import { getOrCreateProfile, updateProfileDatosBase, saveTenantProfileData } from './profiles';
import { resolveZone } from './zones';

/**
 * Crear una nueva inscripción.
 * 1. Busca/crea el perfil por RUT (Identidad Única)
 * 2. Resuelve auto-zona (cargo→zona / tipo_medio→zona)
 * 3. Verifica cupos + duplicado + inserta (ATÓMICO via SQL function)
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

  // 2. Resolver auto-zona antes del insert atómico
  const datosExtra = { ...(formData.datos_extra || {}) };
  if (!datosExtra.zona) {
    try {
      const autoZona = await resolveZone(eventId, formData.cargo, formData.tipo_medio);
      if (autoZona) datosExtra.zona = autoZona;
    } catch { /* no bloquear */ }
  }

  // 3. Verificar cupos + duplicado + insertar — TODO ATÓMICO
  //    La función SQL usa FOR UPDATE en la regla de cupo para
  //    serializar inserciones concurrentes del mismo tipo_medio.
  const { data: regId, error: rpcError } = await supabase.rpc(
    'check_and_create_registration',
    {
      p_event_id: eventId,
      p_profile_id: profile.id,
      p_organizacion: formData.organizacion || undefined,
      p_tipo_medio: formData.tipo_medio || undefined,
      p_cargo: formData.cargo || undefined,
      p_submitted_by: submittedByProfileId || undefined,
      p_datos_extra: datosExtra as unknown as import('@/lib/supabase/database.types').Json,
    }
  );

  if (rpcError) {
    // Supabase envuelve la excepción del RAISE en rpcError.message
    throw new Error(rpcError.message);
  }

  // Fetch del registro completo (incluye defaults: created_at, status, etc.)
  const { data: registration, error: fetchError } = await supabase
    .from('registrations')
    .select()
    .eq('id', regId)
    .single();

  if (fetchError || !registration) {
    throw new Error('Error obteniendo el registro creado');
  }

  // 4. Guardar datos reutilizables en el perfil (tenant-namespaced + legacy flat)
  if (formData.datos_extra && Object.keys(formData.datos_extra).length > 0) {
    try {
      // Determinar el tenant_id del evento para guardar namespaced
      const { data: eventData } = await supabase
        .from('events')
        .select('tenant_id, form_fields')
        .eq('id', eventId)
        .single();

      if (eventData?.tenant_id) {
        // Filtrar metadatos internos (responsable_*) — solo datos de formulario
        const cleanData: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(formData.datos_extra)) {
          if (!key.startsWith('responsable_') && !key.startsWith('_')) {
            cleanData[key] = val;
          }
        }

        const formKeys = ((eventData.form_fields || []) as unknown as Array<{ key: string }>).map(f => f.key);
        await saveTenantProfileData(profile.id, eventData.tenant_id, cleanData, formKeys);
      } else {
        // Fallback: guardar en flat (legacy)
        await updateProfileDatosBase(profile.id, formData.datos_extra);
      }
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
 * Usa batch update con .in() para eficiencia
 */
export async function bulkUpdateStatus(
  registrationIds: string[],
  status: RegistrationStatus,
  processedByUserId: string
): Promise<{ success: number; errors: string[] }> {
  const supabase = createSupabaseAdminClient();

  // Batch update en 1 sola query
  const { error, count } = await supabase
    .from('registrations')
    .update({
      status,
      processed_by: processedByUserId,
      processed_at: new Date().toISOString(),
    })
    .in('id', registrationIds);

  if (error) {
    return { success: 0, errors: [`Batch update failed: ${error.message}`] };
  }

  // Si se aprueba, generar QR tokens para eventos que lo tengan habilitado
  if (status === 'aprobado') {
    for (const id of registrationIds) {
      try {
        const { data: reg } = await supabase
          .from('registrations')
          .select('event_id')
          .eq('id', id)
          .single();
        if (reg) {
          const { data: event } = await supabase
            .from('events')
            .select('qr_enabled')
            .eq('id', reg.event_id)
            .single();
          if (event?.qr_enabled) {
            await supabase.rpc('generate_qr_token', { p_registration_id: id });
          }
        }
      } catch { /* no bloquear */ }
    }
  }

  return { success: count || registrationIds.length, errors: [] };
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
 * Usa COUNT con head:true para eficiencia (no trae datos)
 */
export async function getRegistrationStats(eventId: string) {
  const supabase = createSupabaseAdminClient();
  
  // Contar por status en paralelo usando head:true (solo counts, sin data)
  const [total, pendientes, aprobados, rechazados, revision, checkedIn] = await Promise.all([
    supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'pendiente'),
    supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'aprobado'),
    supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'rechazado'),
    supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'revision'),
    supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('event_id', eventId).eq('checked_in', true),
  ]);

  return {
    total: total.count || 0,
    pendientes: pendientes.count || 0,
    aprobados: aprobados.count || 0,
    rechazados: rechazados.count || 0,
    revision: revision.count || 0,
    checked_in: checkedIn.count || 0,
  };
}
