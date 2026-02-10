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
      form_fields: data.form_fields || [],
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
  const nullableStrings = ['descripcion', 'fecha', 'hora', 'venue', 'league', 'opponent_name', 'opponent_logo_url', 'fecha_limite_acreditacion'];

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (['id', 'created_at', 'tenant'].includes(key)) continue;
    sanitized[key] = nullableStrings.includes(key) && (value === '' || value === undefined) ? null : value;
  }

  const { data: event, error } = await supabase
    .from('events')
    .update(sanitized)
    .eq('id', eventId)
    .select()
    .single();

  if (error) throw new Error(`Error actualizando evento: ${error.message}`);
  return event as Event;
}

/**
 * Desactivar un evento
 */
export async function deactivateEvent(eventId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  
  const { error } = await supabase
    .from('events')
    .update({ is_active: false })
    .eq('id', eventId);

  if (error) throw new Error(`Error desactivando evento: ${error.message}`);
}
