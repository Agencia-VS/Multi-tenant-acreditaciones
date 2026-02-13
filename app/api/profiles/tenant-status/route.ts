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
      .select('id, nombre, fecha, form_fields, tenant_id, tenant_nombre, tenant_slug, tenant_logo, tenant_color_primario, tenant_shield')
      .eq('is_active', true)
      .order('fecha', { ascending: true });

    if (!events || events.length === 0) {
      return NextResponse.json({ tenants: [], profile: { id: profile.id, nombre: profile.nombre } });
    }

    // Agrupar por tenant (usar el primer evento activo de cada tenant)
    const tenantMap = new Map<string, typeof events[0]>();
    for (const event of events) {
      if (!tenantMap.has(event.tenant_id)) {
        tenantMap.set(event.tenant_id, event);
      }
    }

    const tenantStatuses: TenantProfileStatus[] = [];

    for (const [tenantId, event] of tenantMap.entries()) {
      const formFields = (event.form_fields || []) as FormFieldDefinition[];
      
      // Skip tenants without dynamic form fields
      if (formFields.length === 0) {
        tenantStatuses.push({
          tenantId,
          tenantSlug: event.tenant_slug,
          tenantNombre: event.tenant_nombre,
          tenantShield: event.tenant_shield,
          tenantColor: event.tenant_color_primario || '#00C48C',
          eventId: event.id,
          eventNombre: event.nombre,
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
        tenantSlug: event.tenant_slug,
        tenantNombre: event.tenant_nombre,
        tenantShield: event.tenant_shield,
        tenantColor: event.tenant_color_primario || '#00C48C',
        eventId: event.id,
        eventNombre: event.nombre,
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
