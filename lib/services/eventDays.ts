/**
 * Servicio de Event Days — CRUD de Jornadas de Evento Multidía
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { EventDay, EventDayFormData } from '@/types';

/**
 * Listar días de un evento (ordenados)
 */
export async function listEventDays(eventId: string): Promise<EventDay[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('event_days')
    .select('*')
    .eq('event_id', eventId)
    .order('orden')
    .order('fecha');

  if (error) throw new Error(`Error listando días del evento: ${error.message}`);
  return (data || []) as EventDay[];
}

/**
 * Obtener día actual de un evento (para check-in automático)
 */
export async function getCurrentEventDay(eventId: string): Promise<EventDay | null> {
  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const { data, error } = await supabase
    .from('event_days')
    .select('*')
    .eq('event_id', eventId)
    .eq('fecha', today)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as EventDay;
}

/**
 * Crear un día de evento
 */
export async function createEventDay(
  eventId: string,
  data: EventDayFormData
): Promise<EventDay> {
  const supabase = createSupabaseAdminClient();

  const { data: day, error } = await supabase
    .from('event_days')
    .insert({
      event_id: eventId,
      fecha: data.fecha,
      label: data.label,
      orden: data.orden || 1,
    })
    .select()
    .single();

  if (error) throw new Error(`Error creando día del evento: ${error.message}`);
  return day as EventDay;
}

/**
 * Crear múltiples días de evento (bulk — para el formulario SA)
 */
export async function createEventDaysBulk(
  eventId: string,
  days: EventDayFormData[]
): Promise<EventDay[]> {
  const supabase = createSupabaseAdminClient();

  const rows = days.map((d, i) => ({
    event_id: eventId,
    fecha: d.fecha,
    label: d.label,
    orden: d.orden ?? i + 1,
  }));

  const { data, error } = await supabase
    .from('event_days')
    .insert(rows)
    .select();

  if (error) throw new Error(`Error creando días del evento: ${error.message}`);
  return (data || []) as EventDay[];
}

/**
 * Actualizar un día de evento
 */
export async function updateEventDay(
  dayId: string,
  data: Partial<EventDayFormData> & { is_active?: boolean }
): Promise<EventDay> {
  const supabase = createSupabaseAdminClient();

  const update: Record<string, unknown> = {};
  if (data.fecha !== undefined) update.fecha = data.fecha;
  if (data.label !== undefined) update.label = data.label;
  if (data.orden !== undefined) update.orden = data.orden;
  if (data.is_active !== undefined) update.is_active = data.is_active;

  const { data: day, error } = await supabase
    .from('event_days')
    .update(update)
    .eq('id', dayId)
    .select()
    .single();

  if (error) throw new Error(`Error actualizando día del evento: ${error.message}`);
  return day as EventDay;
}

/**
 * Eliminar un día de evento
 */
export async function deleteEventDay(dayId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from('event_days')
    .delete()
    .eq('id', dayId);

  if (error) throw new Error(`Error eliminando día del evento: ${error.message}`);
}

/**
 * Sincronizar días del evento (reemplaza todos los días existentes)
 * Útil para el formulario SA donde se edita la lista completa
 */
export async function syncEventDays(
  eventId: string,
  days: EventDayFormData[]
): Promise<EventDay[]> {
  const supabase = createSupabaseAdminClient();

  // 1. Eliminar días existentes (CASCADE eliminará registration_days)
  const { error: delError } = await supabase
    .from('event_days')
    .delete()
    .eq('event_id', eventId);

  if (delError) throw new Error(`Error sincronizando días: ${delError.message}`);

  // 2. Insertar nuevos días
  if (days.length === 0) return [];
  return createEventDaysBulk(eventId, days);
}

/**
 * Obtener los registration_days de un registro (para ver check-in por día)
 */
export async function getRegistrationDays(registrationId: string) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('registration_days')
    .select('*, event_days!inner(fecha, label, orden)')
    .eq('registration_id', registrationId)
    .order('event_days(orden)');

  if (error) throw new Error(`Error obteniendo días del registro: ${error.message}`);
  return data || [];
}

/**
 * Obtener resumen de check-in por día para un evento
 */
export async function getEventDayCheckinStats(eventId: string) {
  const supabase = createSupabaseAdminClient();

  const days = await listEventDays(eventId);
  
  const stats = await Promise.all(
    days.map(async (day) => {
      const { count: total } = await supabase
        .from('registration_days')
        .select('*', { count: 'exact', head: true })
        .eq('event_day_id', day.id);

      const { count: checkedIn } = await supabase
        .from('registration_days')
        .select('*', { count: 'exact', head: true })
        .eq('event_day_id', day.id)
        .eq('checked_in', true);

      return {
        day,
        total: total || 0,
        checked_in: checkedIn || 0,
      };
    })
  );

  return stats;
}
