/**
 * GET /api/profiles/tenant-status
 *
 * Retorna el estado de completitud del perfil del usuario para TODOS los
 * tenants activos que tienen al menos un evento activo con form_fields.
 *
 * Respuesta: TenantProfileStatus[] — un item por tenant con:
 * - Info del tenant (nombre, slug, shield, color)
 * - Info del evento activo
 * - Campos faltantes, % completitud, cambios detectados
 */

import { NextResponse } from 'next/server';
import {
  getCurrentUser,
  getProfileByUserId,
  computeTenantProfileStatus,
  buildMergedAutofillData,
} from '@/lib/services';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { FormFieldDefinition, TenantProfileStatus } from '@/types';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const profile = await getProfileByUserId(user.id);
    if (!profile) {
      return NextResponse.json({ tenants: [], profile: null });
    }

    const supabase = createSupabaseAdminClient();

    // Obtener todos los tenants activos con sus eventos activos
    const { data: events } = await supabase
      .from('v_event_full')
      .select('id, nombre, fecha, form_fields, tenant_id, tenant_nombre, tenant_slug, tenant_logo_url, tenant_color_primario, tenant_shield_url, tenant_config')
      .eq('is_active', true)
      .order('fecha', { ascending: true });

    if (!events || events.length === 0) {
      return NextResponse.json({ tenants: [], profile: { id: profile.id, nombre: profile.nombre } });
    }

    // Agrupar por tenant (usar el primer evento activo de cada tenant)
    const tenantMap = new Map<string, typeof events[0]>();
    for (const event of events) {
      if (!tenantMap.has(event.tenant_id!)) {
        tenantMap.set(event.tenant_id!, event);
      }
    }

    // Filtrar tenants con provider_mode=approved_only si el usuario no es proveedor aprobado
    const approvedOnlyTenantIds = [...tenantMap.entries()]
      .filter(([, ev]) => {
        const cfg = ev.tenant_config as Record<string, unknown> | null;
        return cfg?.provider_mode === 'approved_only';
      })
      .map(([id]) => id);

    if (approvedOnlyTenantIds.length > 0) {
      const { data: providers } = await supabase
        .from('tenant_providers')
        .select('tenant_id')
        .eq('profile_id', profile.id)
        .eq('status', 'approved')
        .in('tenant_id', approvedOnlyTenantIds);

      const approvedSet = new Set((providers || []).map(p => p.tenant_id));
      for (const tid of approvedOnlyTenantIds) {
        if (!approvedSet.has(tid)) {
          tenantMap.delete(tid);
        }
      }
    }

    const tenantStatuses: TenantProfileStatus[] = [];

    for (const [tenantId, event] of tenantMap.entries()) {
      const formFields = (event.form_fields || []) as unknown as FormFieldDefinition[];
      
      // Skip tenants without dynamic form fields
      if (formFields.length === 0) {
        tenantStatuses.push({
          tenantId,
          tenantSlug: event.tenant_slug ?? '',
          tenantNombre: event.tenant_nombre ?? '',
          tenantShield: event.tenant_shield_url,
          tenantColor: event.tenant_color_primario || '#00C48C',
          eventId: event.id ?? undefined,
          eventNombre: event.nombre ?? undefined,
          eventFecha: event.fecha,
          formFields: [],
          totalRequired: 0,
          filledRequired: 0,
          missingFields: [],
          completionPct: 100,
          hasData: false,
          formChanged: false,
          newKeys: [],
          removedKeys: [],
        });
        continue;
      }

      const status = computeTenantProfileStatus(profile, tenantId, formFields);
      const datosBase = profile.datos_base || {};
      const tenantDataMap = (datosBase._tenant || {}) as Record<string, Record<string, unknown>>;
      const hasData = !!tenantDataMap[tenantId];

      tenantStatuses.push({
        tenantId,
        tenantSlug: event.tenant_slug ?? '',
        tenantNombre: event.tenant_nombre ?? '',
        tenantShield: event.tenant_shield_url,
        tenantColor: event.tenant_color_primario || '#00C48C',
        eventId: event.id ?? undefined,
        eventNombre: event.nombre ?? undefined,
        eventFecha: event.fecha,
        formFields,
        totalRequired: status.totalRequired,
        filledRequired: status.filledRequired,
        missingFields: status.missingFields,
        completionPct: status.totalRequired > 0
          ? Math.round((status.filledRequired / status.totalRequired) * 100)
          : 100,
        hasData,
        formChanged: status.formChanged,
        newKeys: status.newKeys,
        removedKeys: status.removedKeys,
      });
    }

    // Ordenar: incompletos primero, luego por nombre
    tenantStatuses.sort((a, b) => {
      if (a.completionPct < 100 && b.completionPct === 100) return -1;
      if (a.completionPct === 100 && b.completionPct < 100) return 1;
      return a.tenantNombre.localeCompare(b.tenantNombre);
    });

    return NextResponse.json({
      tenants: tenantStatuses,
      profile: {
        id: profile.id,
        nombre: profile.nombre,
        apellido: profile.apellido,
        rut: profile.rut,
      },
    });
  } catch (error) {
    console.error('[profiles/tenant-status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
