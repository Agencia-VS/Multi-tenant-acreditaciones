/**
 * API: Tenant-Context Profile Data
 *
 * GET  ?tenant_id=xxx — Retorna datos del perfil para el tenant + estado de completitud
 * POST { tenant_id, data, form_keys } — Guarda datos del perfil contextualizados por tenant
 *
 * Requiere sesión activa (cookie auth).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentUser,
  getProfileByUserId,
  getTenantProfileData,
  saveTenantProfileData,
  buildMergedAutofillData,
  computeTenantProfileStatus,
} from '@/lib/services';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { FormFieldDefinition, Profile } from '@/types';

/**
 * GET — Retorna datos del perfil + estado de completitud para un tenant.
 * Query params: tenant_id (required), event_id (optional — si no se pasa, usa el activo)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const profile = await getProfileByUserId(user.id);
    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');
    const eventId = searchParams.get('event_id');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id es requerido' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Obtener form_fields del evento especificado o del evento activo del tenant
    let formFields: FormFieldDefinition[] = [];
    let resolvedEventId: string | null = eventId;

    if (eventId) {
      const { data: event } = await supabase
        .from('events')
        .select('form_fields')
        .eq('id', eventId)
        .single();
      formFields = (event?.form_fields || []) as unknown as FormFieldDefinition[];
    } else {
      // Buscar evento activo del tenant
      const { data: event } = await supabase
        .from('events')
        .select('id, form_fields')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('fecha', { ascending: true })
        .limit(1)
        .single();
      if (event) {
        formFields = (event.form_fields || []) as unknown as FormFieldDefinition[];
        resolvedEventId = event.id;
      }
    }

    // Datos almacenados del tenant
    const tenantData = await getTenantProfileData(profile.id, tenantId);

    // Datos mergeados para autofill
    const mergedData = buildMergedAutofillData(profile, tenantId, formFields);

    // Estado de completitud
    const status = computeTenantProfileStatus(profile, tenantId, formFields);

    return NextResponse.json({
      profile: {
        id: profile.id,
        rut: profile.rut,
        nombre: profile.nombre,
        apellido: profile.apellido,
        email: profile.email,
        telefono: profile.telefono,
        cargo: profile.cargo,
        medio: profile.medio,
        tipo_medio: profile.tipo_medio,
      },
      tenantData: tenantData || {},
      mergedData,
      eventId: resolvedEventId,
      formFields,
      status: {
        totalRequired: status.totalRequired,
        filledRequired: status.filledRequired,
        missingFields: status.missingFields,
        completionPct: status.totalRequired > 0
          ? Math.round((status.filledRequired / status.totalRequired) * 100)
          : 100,
        formChanged: status.formChanged,
        newKeys: status.newKeys,
        removedKeys: status.removedKeys,
        hasData: !!tenantData,
      },
    });
  } catch (error) {
    console.error('[profiles/tenant-data] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

/**
 * POST — Guarda datos contextualizados por tenant.
 * Body: { tenant_id: string, data: Record<string, unknown>, form_keys: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const profile = await getProfileByUserId(user.id);
    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { tenant_id, data, form_keys } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id es requerido' }, { status: 400 });
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'data debe ser un objeto' }, { status: 400 });
    }

    await saveTenantProfileData(
      profile.id,
      tenant_id,
      data,
      form_keys || Object.keys(data)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[profiles/tenant-data] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/profiles/tenant-data/status-all
 * Retorna el estado de completitud del perfil para TODOS los tenants activos.
 * Usado por el dashboard del acreditado.
 */
// NOTA: Esta funcionalidad se expone en la ruta /api/profiles/tenant-data
// pasando el query param ?all=true
