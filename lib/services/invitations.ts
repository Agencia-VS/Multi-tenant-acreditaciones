/**
 * Servicio de Invitaciones a Eventos
 *
 * Gestiona invitaciones para eventos con visibility = 'invite_only'.
 * Cada invitación tiene un token UUID que permite acceso directo al formulario.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { EventInvitation } from '@/types';

// ─── Queries ───────────────────────────────────────────────────────────────

/**
 * Listar invitaciones de un evento
 */
export async function listInvitations(eventId: string): Promise<EventInvitation[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('event_invitations')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Error listando invitaciones: ${error.message}`);
  return (data || []) as EventInvitation[];
}

/**
 * Obtener una invitación por token
 */
export async function getInvitationByToken(token: string): Promise<EventInvitation | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('event_invitations')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !data) return null;
  return data as EventInvitation;
}

/**
 * Validar un token de invitación:
 * - Existe
 * - Status es 'pending' o 'sent' (no expirado ni ya aceptado)
 * - El evento asociado es invite_only y está activo
 */
export async function validateInviteToken(token: string): Promise<{
  valid: boolean;
  invitation?: EventInvitation;
  eventId?: string;
  reason?: string;
}> {
  const invitation = await getInvitationByToken(token);
  if (!invitation) {
    return { valid: false, reason: 'Invitación no encontrada' };
  }

  if (invitation.status === 'expired') {
    return { valid: false, reason: 'Esta invitación ha expirado' };
  }

  if (invitation.status === 'accepted') {
    return { valid: false, reason: 'Esta invitación ya fue utilizada' };
  }

  // Verificar que el evento existe y es invite_only
  const supabase = createSupabaseAdminClient();
  const { data: event } = await supabase
    .from('events')
    .select('id, is_active, visibility')
    .eq('id', invitation.event_id)
    .single();

  if (!event) {
    return { valid: false, reason: 'Evento no encontrado' };
  }

  if (!event.is_active) {
    return { valid: false, reason: 'Este evento ya no está activo' };
  }

  return {
    valid: true,
    invitation,
    eventId: event.id,
  };
}

// ─── Mutations ─────────────────────────────────────────────────────────────

/**
 * Crear una o varias invitaciones para un evento
 */
export async function createInvitations(
  eventId: string,
  invitees: { email: string; nombre?: string }[]
): Promise<EventInvitation[]> {
  if (invitees.length === 0) return [];

  const supabase = createSupabaseAdminClient();

  const rows = invitees.map(inv => ({
    event_id: eventId,
    email: inv.email.toLowerCase().trim(),
    nombre: inv.nombre || null,
  }));

  const { data, error } = await supabase
    .from('event_invitations')
    .upsert(rows, { onConflict: 'event_id,email', ignoreDuplicates: false })
    .select();

  if (error) throw new Error(`Error creando invitaciones: ${error.message}`);
  return (data || []) as EventInvitation[];
}

/**
 * Marcar invitación como enviada
 */
export async function markInvitationSent(invitationId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('event_invitations')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', invitationId);

  if (error) throw new Error(`Error actualizando invitación: ${error.message}`);
}

/**
 * Marcar invitación como aceptada (cuando el invitado completa acreditación)
 */
export async function acceptInvitation(token: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('event_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('token', token);

  if (error) throw new Error(`Error aceptando invitación: ${error.message}`);
}

/**
 * Eliminar una invitación
 */
export async function deleteInvitation(invitationId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('event_invitations')
    .delete()
    .eq('id', invitationId);

  if (error) throw new Error(`Error eliminando invitación: ${error.message}`);
}

/**
 * Expirar todas las invitaciones pendientes de un evento
 */
export async function expireEventInvitations(eventId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('event_invitations')
    .update({ status: 'expired' })
    .eq('event_id', eventId)
    .in('status', ['pending', 'sent']);

  if (error) throw new Error(`Error expirando invitaciones: ${error.message}`);
}
