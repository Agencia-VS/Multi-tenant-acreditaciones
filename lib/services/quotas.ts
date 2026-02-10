/**
 * Servicio de Cupos — Motor de Restricciones
 * 
 * Verifica y gestiona las reglas de cupo por tipo de medio y organización.
 * "Si Tipo de Medio = Radial, máximo 5 cupos por Organización"
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { EventQuotaRule, QuotaCheckResult } from '@/types';

/**
 * Verificar si hay cupo disponible para un tipo_medio + organización en un evento.
 * Consulta la tabla event_quota_rules y cuenta registros existentes.
 */
export async function checkQuota(
  eventId: string,
  tipoMedio: string,
  organizacion: string
): Promise<QuotaCheckResult> {
  const supabase = createSupabaseAdminClient();

  // Buscar regla para este tipo_medio
  const { data: rule } = await supabase
    .from('event_quota_rules')
    .select('*')
    .eq('event_id', eventId)
    .eq('tipo_medio', tipoMedio)
    .single();

  // Sin regla = sin límite
  if (!rule) {
    return {
      available: true,
      used_org: 0,
      max_org: 0,
      used_global: 0,
      max_global: 0,
      message: 'Sin restricción de cupo',
    };
  }

  // Contar registros existentes (no rechazados) por organización
  const { count: usedOrg } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('tipo_medio', tipoMedio)
    .eq('organizacion', organizacion)
    .neq('status', 'rechazado');

  // Contar registros globales de este tipo_medio
  const { count: usedGlobal } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('tipo_medio', tipoMedio)
    .neq('status', 'rechazado');

  const orgCount = usedOrg || 0;
  const globalCount = usedGlobal || 0;

  // Verificar límite por organización
  if (rule.max_per_organization > 0 && orgCount >= rule.max_per_organization) {
    return {
      available: false,
      used_org: orgCount,
      max_org: rule.max_per_organization,
      used_global: globalCount,
      max_global: rule.max_global,
      message: `Se alcanzó el límite de ${rule.max_per_organization} cupos de ${tipoMedio} para ${organizacion}`,
    };
  }

  // Verificar límite global
  if (rule.max_global > 0 && globalCount >= rule.max_global) {
    return {
      available: false,
      used_org: orgCount,
      max_org: rule.max_per_organization,
      used_global: globalCount,
      max_global: rule.max_global,
      message: `Se alcanzó el límite global de ${rule.max_global} cupos para ${tipoMedio}`,
    };
  }

  return {
    available: true,
    used_org: orgCount,
    max_org: rule.max_per_organization,
    used_global: globalCount,
    max_global: rule.max_global,
    message: `Cupo disponible: ${orgCount}/${rule.max_per_organization} por organización`,
  };
}

/**
 * Obtener todas las reglas de cupo de un evento con uso actual
 */
export async function getQuotaRulesWithUsage(eventId: string): Promise<
  Array<EventQuotaRule & { used_org_map: Record<string, number>; used_global: number }>
> {
  const supabase = createSupabaseAdminClient();

  // Obtener reglas
  const { data: rules, error } = await supabase
    .from('event_quota_rules')
    .select('*')
    .eq('event_id', eventId);

  if (error) throw new Error(`Error obteniendo reglas: ${error.message}`);
  if (!rules || rules.length === 0) return [];

  // Obtener conteos por tipo_medio y organización
  const { data: registrations } = await supabase
    .from('registrations')
    .select('tipo_medio, organizacion')
    .eq('event_id', eventId)
    .neq('status', 'rechazado');

  // Armar mapa de uso
  const usageMap: Record<string, { orgs: Record<string, number>; global: number }> = {};
  
  registrations?.forEach((r) => {
    const tm = r.tipo_medio || 'unknown';
    if (!usageMap[tm]) usageMap[tm] = { orgs: {}, global: 0 };
    usageMap[tm].global++;
    const org = r.organizacion || 'unknown';
    usageMap[tm].orgs[org] = (usageMap[tm].orgs[org] || 0) + 1;
  });

  return (rules as EventQuotaRule[]).map((rule) => ({
    ...rule,
    used_org_map: usageMap[rule.tipo_medio]?.orgs || {},
    used_global: usageMap[rule.tipo_medio]?.global || 0,
  }));
}

/**
 * CRUD de reglas de cupo
 */
export async function upsertQuotaRule(
  eventId: string,
  tipoMedio: string,
  maxPerOrganization: number,
  maxGlobal: number = 0
): Promise<EventQuotaRule> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('event_quota_rules')
    .upsert(
      {
        event_id: eventId,
        tipo_medio: tipoMedio,
        max_per_organization: maxPerOrganization,
        max_global: maxGlobal,
      },
      { onConflict: 'event_id,tipo_medio' }
    )
    .select()
    .single();

  if (error) throw new Error(`Error guardando regla de cupo: ${error.message}`);
  return data as EventQuotaRule;
}

export async function deleteQuotaRule(ruleId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('event_quota_rules')
    .delete()
    .eq('id', ruleId);

  if (error) throw new Error(`Error eliminando regla: ${error.message}`);
}
