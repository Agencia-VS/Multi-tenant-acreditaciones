/**
 * Servicio de Equipos (Teams) — Gestión de Equipos del Manager
 * 
 * Un Manager puede crear y gestionar una lista de "Sujetos" bajo su cuenta
 * para acreditarlos masivamente.
 * 
 * NOTA (M12): team_members es un directorio GLOBAL de frecuentes.
 * Para evitar cruce de datos entre tenants, usar getTeamMembersForEvent()
 * que enriquece cada miembro con datos del contexto del evento.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { TeamMember, Profile, RegistrationExtras } from '@/types';

/**
 * Obtener equipo del manager (con datos del perfil de cada miembro)
 */
export async function getTeamMembers(managerProfileId: string): Promise<TeamMember[]> {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      *,
      member_profile:profiles!team_members_member_profile_id_fkey(*)
    `)
    .eq('manager_id', managerProfileId)
    .order('created_at');

  if (error) throw new Error(`Error obteniendo equipo: ${error.message}`);
  
  return (data || []).map((tm) => ({
    ...tm,
    member_profile: tm.member_profile as Profile,
  })) as TeamMember[];
}

/**
 * Agregar miembro al equipo
 * Si la persona ya tiene perfil (por RUT), la vincula. Si no, crea el perfil.
 */
export async function addTeamMember(
  managerProfileId: string,
  memberData: {
    rut: string;
    nombre: string;
    apellido: string;
    email?: string;
    telefono?: string;
    cargo?: string;
    medio?: string;
    tipo_medio?: string;
  },
  alias?: string
): Promise<TeamMember> {
  const supabase = createSupabaseAdminClient();

  // GUARD: Verificar que el miembro no sea el mismo manager (por RUT)
  const { data: managerProfile } = await supabase
    .from('profiles')
    .select('rut, email')
    .eq('id', managerProfileId)
    .single();

  if (managerProfile?.rut === memberData.rut) {
    throw new Error('No puedes agregarte a ti mismo como miembro de equipo');
  }

  // GUARD: Advertir si el email del miembro coincide con el del manager
  // (causa confusión en perfiles — cada persona debe tener su propio email)
  if (memberData.email && managerProfile?.email
      && memberData.email.toLowerCase() === managerProfile.email.toLowerCase()) {
    console.warn(`[addTeamMember] Email del miembro (${memberData.email}) coincide con el del manager (${managerProfile.email}). Esto puede causar confusión de perfiles.`);
  }

  // Buscar o crear perfil del miembro
  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('rut', memberData.rut)
    .single();

  if (!profile) {
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        rut: memberData.rut,
        nombre: memberData.nombre,
        apellido: memberData.apellido,
        email: memberData.email || null,
        telefono: memberData.telefono || null,
        cargo: memberData.cargo || null,
        medio: memberData.medio || null,
        tipo_medio: memberData.tipo_medio || null,
      })
      .select()
      .single();

    if (createError) throw new Error(`Error creando perfil: ${createError.message}`);
    profile = newProfile;
  }

  // Vincular como miembro del equipo
  const { data: teamMember, error } = await supabase
    .from('team_members')
    .insert({
      manager_id: managerProfileId,
      member_profile_id: profile.id,
      alias: alias || `${memberData.nombre} ${memberData.apellido}`,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Esta persona ya está en tu equipo');
    }
    throw new Error(`Error agregando al equipo: ${error.message}`);
  }

  return { ...teamMember, member_profile: profile as Profile } as TeamMember;
}

/**
 * Eliminar miembro del equipo
 */
export async function removeTeamMember(
  managerProfileId: string,
  teamMemberId: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', teamMemberId)
    .eq('manager_id', managerProfileId);

  if (error) throw new Error(`Error eliminando del equipo: ${error.message}`);
}

/**
 * Actualizar alias/notas de un miembro del equipo
 */
export async function updateTeamMember(
  teamMemberId: string,
  updates: { alias?: string; notas?: string }
): Promise<TeamMember> {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('team_members')
    .update(updates)
    .eq('id', teamMemberId)
    .select()
    .single();

  if (error) throw new Error(`Error actualizando miembro: ${error.message}`);
  return data as TeamMember;
}

/**
 * Obtener equipo enriquecido con datos del contexto de un evento.
 * 
 * Resuelve el problema de cruce de datos entre tenants (M12):
 * - Los campos profesionales (cargo, medio, tipo_medio) se sobreescriben
 *   con datos del tenant/evento específico si existen.
 * - Prioridad: registration del evento > datos_base._tenant[tenantId] > perfil global
 */
export async function getTeamMembersForEvent(
  managerProfileId: string,
  eventId: string
): Promise<TeamMember[]> {
  const supabase = createSupabaseAdminClient();

  // 1. Obtener tenant_id del evento
  const { data: event } = await supabase
    .from('events')
    .select('tenant_id')
    .eq('id', eventId)
    .single();

  if (!event) throw new Error('Evento no encontrado');
  const tenantId = event.tenant_id;

  // 2. Obtener equipo base (global)
  const members = await getTeamMembers(managerProfileId);
  if (members.length === 0) return members;

  // 3. Buscar registrations existentes en este evento para los miembros
  const memberProfileIds = members
    .filter(m => m.member_profile?.id)
    .map(m => m.member_profile!.id);

  const { data: registrations } = await supabase
    .from('registrations')
    .select('profile_id, datos_extra')
    .eq('event_id', eventId)
    .in('profile_id', memberProfileIds);

  const regMap = new Map<string, RegistrationExtras>(
    (registrations || []).map(r => [r.profile_id, (r.datos_extra ?? {}) as RegistrationExtras])
  );

  // 4. Enriquecer cada miembro con datos del contexto del evento
  return members.map(m => {
    if (!m.member_profile) return m;

    const enrichedProfile = { ...m.member_profile };
    const profileId = m.member_profile.id;

    // Fuente A: datos_base._tenant[tenantId] (datos guardados por el sistema de autofill)
    const datosBase = m.member_profile.datos_base ?? {};
    const tenantMap = (datosBase._tenant || {}) as Record<string, Record<string, unknown>>;
    const tenantData = tenantId ? tenantMap[tenantId] : null;

    if (tenantData) {
      if (tenantData.cargo) enrichedProfile.cargo = String(tenantData.cargo);
      if (tenantData.medio) enrichedProfile.medio = String(tenantData.medio);
      if (tenantData.tipo_medio) enrichedProfile.tipo_medio = String(tenantData.tipo_medio);
    }

    // Fuente B: registration existente en este evento (máxima prioridad)
    const eventReg = regMap.get(profileId);
    if (eventReg) {
      if (eventReg.cargo) enrichedProfile.cargo = String(eventReg.cargo);
      if (eventReg.medio || eventReg.organizacion) {
        enrichedProfile.medio = String(eventReg.medio || eventReg.organizacion);
      }
      if (eventReg.tipo_medio) enrichedProfile.tipo_medio = String(eventReg.tipo_medio);
    }

    return { ...m, member_profile: enrichedProfile };
  });
}
