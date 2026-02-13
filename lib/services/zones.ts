/**
 * Servicio de Zonas — Auto-Asignación de Zonas por Cargo/Tipo Medio
 * 
 * Gestiona las reglas de auto-asignación de zona por evento.
 * Soporta dos tipos de regla:
 *   - match_field='cargo'      → "Si cargo = Periodista, asignar zona = Prensa"
 *   - match_field='tipo_medio' → "Si tipo_medio = Operaciones, asignar zona = Staff"
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { ZoneAssignmentRule, ZoneMatchField } from '@/types';

/**
 * Resolver la zona para un registro basado en reglas de auto-asignación.
 * Orden de prioridad:
 * 1. Match por cargo  (match_field='cargo')
 * 2. Match por tipo_medio (match_field='tipo_medio')
 * Si no hay regla, retorna null (admin asigna manual desde dropdown).
 */
export async function resolveZone(
  eventId: string,
  cargo?: string,
  tipoMedio?: string
): Promise<string | null> {
  const supabase = createSupabaseAdminClient();

  // 1. Try match by cargo first
  if (cargo) {
    const { data: rule } = await supabase
      .from('event_zone_rules')
      .select('zona')
      .eq('event_id', eventId)
      .eq('match_field', 'cargo')
      .eq('cargo', cargo)
      .single();
    if (rule?.zona) return rule.zona;
  }

  // 2. Then try match by tipo_medio
  if (tipoMedio) {
    const { data: rule } = await supabase
      .from('event_zone_rules')
      .select('zona')
      .eq('event_id', eventId)
      .eq('match_field', 'tipo_medio')
      .eq('cargo', tipoMedio)
      .single();
    if (rule?.zona) return rule.zona;
  }

  return null;
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
    .order('match_field')
    .order('cargo');

  if (error) throw new Error(`Error obteniendo reglas de zona: ${error.message}`);
  return (data || []) as ZoneAssignmentRule[];
}

/**
 * Upsert de regla de zona (match_field + valor → zona)
 */
export async function upsertZoneRule(
  eventId: string,
  cargo: string,
  zona: string,
  matchField: ZoneMatchField = 'cargo'
): Promise<ZoneAssignmentRule> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('event_zone_rules')
    .upsert(
      { event_id: eventId, match_field: matchField, cargo, zona },
      { onConflict: 'event_id,match_field,cargo' }
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
