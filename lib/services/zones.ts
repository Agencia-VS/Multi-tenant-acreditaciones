/**
 * Servicio de Zonas — Auto-Asignación de Zonas por Cargo
 * 
 * Gestiona las reglas cargo → zona por evento.
 * "Si cargo = Periodista, asignar zona = Prensa"
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { ZoneAssignmentRule } from '@/types';

/**
 * Resolver la zona para un registro basado en reglas de auto-asignación.
 * Si no hay regla para el cargo dado, retorna null (admin asigna manual).
 */
export async function resolveZone(
  eventId: string,
  cargo: string
): Promise<string | null> {
  if (!cargo) return null;

  const supabase = createSupabaseAdminClient();

  const { data: rule } = await supabase
    .from('event_zone_rules')
    .select('zona')
    .eq('event_id', eventId)
    .eq('cargo', cargo)
    .single();

  return rule?.zona ?? null;
}

/**
 * Obtener todas las reglas de zona de un evento
 */
export async function getZoneRules(eventId: string): Promise<ZoneAssignmentRule[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('event_zone_rules')
    .select('*')
    .eq('event_id', eventId)
    .order('cargo');

  if (error) throw new Error(`Error obteniendo reglas de zona: ${error.message}`);
  return (data || []) as ZoneAssignmentRule[];
}

/**
 * Upsert de regla de zona (cargo → zona para un evento)
 */
export async function upsertZoneRule(
  eventId: string,
  cargo: string,
  zona: string
): Promise<ZoneAssignmentRule> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('event_zone_rules')
    .upsert(
      { event_id: eventId, cargo, zona },
      { onConflict: 'event_id,cargo' }
    )
    .select()
    .single();

  if (error) throw new Error(`Error guardando regla de zona: ${error.message}`);
  return data as ZoneAssignmentRule;
}

/**
 * Eliminar regla de zona
 */
export async function deleteZoneRule(ruleId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from('event_zone_rules')
    .delete()
    .eq('id', ruleId);

  if (error) throw new Error(`Error eliminando regla de zona: ${error.message}`);
}
