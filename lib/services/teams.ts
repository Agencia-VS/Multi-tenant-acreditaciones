/**
 * Servicio de Equipos (Teams) — Gestión de Equipos del Manager
 * 
 * Un Manager puede crear y gestionar una lista de "Sujetos" bajo su cuenta
 * para acreditarlos masivamente.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { TeamMember, Profile } from '@/types';

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
