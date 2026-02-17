/**
 * Servicio de Eventos — CRUD y Configuración
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { Event, EventFull, EventFormData } from '@/types';

/**
 * Obtener el evento activo de un tenant (para landing y formulario)
 */
export async function getActiveEvent(tenantId: string): Promise<EventFull | null> {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('v_event_full')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('fecha', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as EventFull;
}

/**
 * Obtener evento por ID
 */
export async function getEventById(eventId: string): Promise<Event | null> {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error || !data) return null;
  return data as Event;
}

/**
 * Obtener evento con datos de tenant
 */
export async function getEventFull(eventId: string): Promise<EventFull | null> {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('v_event_full')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error || !data) return null;
  return data as EventFull;
}

/**
 * Listar eventos de un tenant
 */
export async function listEventsByTenant(tenantId: string): Promise<Event[]> {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('fecha', { ascending: false });

  if (error) throw new Error(`Error listando eventos: ${error.message}`);
  return (data || []) as Event[];
}

/**
 * Listar todos los eventos (superadmin)
 */
export async function listAllEvents(): Promise<EventFull[]> {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('v_event_full')
    .select('*')
    .order('fecha', { ascending: false });

  if (error) throw new Error(`Error listando eventos: ${error.message}`);
  return (data || []) as EventFull[];
}

/**
 * Crear un nuevo evento
 */
export async function createEvent(data: EventFormData): Promise<Event> {
  const supabase = createSupabaseAdminClient();
  
  const { data: event, error } = await supabase
    .from('events')
    .insert({
      tenant_id: data.tenant_id,
      nombre: data.nombre,
      descripcion: data.descripcion || null,
      fecha: data.fecha || null,
      hora: data.hora || null,
      venue: data.venue || null,
      fecha_limite_acreditacion: data.fecha_limite_acreditacion || null,
      opponent_name: data.opponent_name || null,
      opponent_logo_url: data.opponent_logo_url || null,
      league: data.league || null,
      qr_enabled: data.qr_enabled || false,
      form_fields: (data.form_fields || []) as any,
      config: (data.config || {}) as any,
      event_type: data.event_type || 'simple',
      fecha_inicio: data.fecha_inicio || null,
      fecha_fin: data.fecha_fin || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(`Error creando evento: ${error.message}`);
  return event as Event;
}

/**
 * Actualizar un evento
 */
export async function updateEvent(eventId: string, data: Partial<EventFormData>): Promise<Event> {
  const supabase = createSupabaseAdminClient();

  // Sanitize: remove immutable/computed fields, convert empty strings to null for optional fields
  const sanitized: Record<string, unknown> = {};
  const nullableStrings = ['descripcion', 'fecha', 'hora', 'venue', 'league', 'opponent_name', 'opponent_logo_url', 'fecha_limite_acreditacion', 'fecha_inicio', 'fecha_fin'];

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (['id', 'created_at', 'tenant'].includes(key)) continue;
    sanitized[key] = nullableStrings.includes(key) && (value === '' || value === undefined) ? null : value;
  }

  const { data: event, error } = await supabase
    .from('events')
    .update(sanitized as any)
    .eq('id', eventId)
    .select()
    .single();

  if (error) throw new Error(`Error actualizando evento: ${error.message}`);
  return event as Event;
}

/**
 * Desactivar un evento (soft delete)
 */
export async function deactivateEvent(eventId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  
  const { error } = await supabase
    .from('events')
    .update({ is_active: false })
    .eq('id', eventId);

  if (error) throw new Error(`Error desactivando evento: ${error.message}`);
}

/**
 * Eliminar un evento y todos sus datos relacionados (hard delete)
 * Orden: registrations → quota rules → zone rules → form configs → evento
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // 0. Delete event_days (CASCADE eliminará registration_days)
  const { error: dayErr } = await supabase
    .from('event_days')
    .delete()
    .eq('event_id', eventId);
  if (dayErr) throw new Error(`Error eliminando días: ${dayErr.message}`);

  // 1. Delete registrations
  const { error: regErr } = await supabase
    .from('registrations')
    .delete()
    .eq('event_id', eventId);
  if (regErr) throw new Error(`Error eliminando registros: ${regErr.message}`);

  // 2. Delete quota rules
  const { error: quotaErr } = await supabase
    .from('event_quota_rules')
    .delete()
    .eq('event_id', eventId);
  if (quotaErr) throw new Error(`Error eliminando cupos: ${quotaErr.message}`);

  // 3. Delete zone rules
  const { error: zoneErr } = await supabase
    .from('event_zone_rules')
    .delete()
    .eq('event_id', eventId);
  if (zoneErr) throw new Error(`Error eliminando reglas de zona: ${zoneErr.message}`);

  // 4. Delete form configs (if table exists)
  await (supabase as any)
    .from('form_configs')
    .delete()
    .eq('event_id', eventId)
    .then(() => {}); // Ignore if table doesn't exist

  // 5. Delete the event itself
  const { error: evErr } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);
  if (evErr) throw new Error(`Error eliminando evento: ${evErr.message}`);
}
