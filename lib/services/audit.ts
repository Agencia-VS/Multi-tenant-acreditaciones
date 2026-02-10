/**
 * Servicio de Auditoría — Registro de acciones
 * Quién aprobó, rechazó o editó cada solicitud
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { AuditAction, AuditLog } from '@/types';

/**
 * Registrar una acción de auditoría
 */
export async function logAuditAction(
  userId: string | null,
  action: AuditAction | string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: metadata || {},
    });
  } catch {
    // No bloquear el flujo principal por error de auditoría
    console.error('Error registrando auditoría');
  }
}

/**
 * Obtener logs de auditoría (superadmin)
 */
export async function getAuditLogs(filters?: {
  entity_type?: string;
  entity_id?: string;
  action?: string;
  limit?: number;
}): Promise<AuditLog[]> {
  const supabase = createSupabaseAdminClient();
  
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.entity_type) query = query.eq('entity_type', filters.entity_type);
  if (filters?.entity_id) query = query.eq('entity_id', filters.entity_id);
  if (filters?.action) query = query.eq('action', filters.action);
  
  query = query.limit(filters?.limit || 100);

  const { data, error } = await query;
  if (error) throw new Error(`Error obteniendo logs: ${error.message}`);
  return (data || []) as AuditLog[];
}
