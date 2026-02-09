import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/acreditaciones/areas?tenant=slug&evento_id=123
 *
 * Retorna las áreas de acreditación configuradas para un tenant/evento.
 * Si no hay áreas configuradas, retorna array vacío (el tenant opera sin restricciones de área).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenant');
    const eventoId = searchParams.get('evento_id');

    if (!tenantSlug) {
      return NextResponse.json({ error: 'Parámetro tenant requerido' }, { status: 400 });
    }

    // 1. Obtener tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('mt_tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });
    }

    // 2. Determinar evento_id
    let targetEventoId = eventoId ? parseInt(eventoId) : null;

    if (!targetEventoId) {
      // Buscar evento activo del tenant
      const { data: evento } = await supabaseAdmin
        .from('mt_eventos')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('fecha', { ascending: true })
        .limit(1)
        .single();

      targetEventoId = evento?.id || null;
    }

    if (!targetEventoId) {
      // Sin evento activo — retornar vacío
      return NextResponse.json({
        data: [],
        evento_id: null,
        message: 'No hay evento activo para este tenant',
      });
    }

    // 3. Consultar áreas del tenant/evento
    const { data: areas, error: areasError } = await supabaseAdmin
      .from('mt_areas_prensa')
      .select('id, nombre, cupo_maximo, evento_id')
      .eq('tenant_id', tenant.id)
      .eq('evento_id', targetEventoId)
      .order('nombre', { ascending: true });

    if (areasError) {
      console.warn('Error consultando mt_areas_prensa:', areasError.message);
    }

    // 4. Consultar cupos por tipo de medio (restricciones por empresa)
    let tipoMedioCupos: { tipo_medio: string; cupo_por_empresa: number; descripcion: string | null }[] = [];
    try {
      const { data: cuposData } = await supabaseAdmin
        .from('mt_cupos_tipo_medio')
        .select('tipo_medio, cupo_por_empresa, descripcion')
        .eq('tenant_id', tenant.id)
        .eq('evento_id', targetEventoId)
        .order('tipo_medio', { ascending: true });
      tipoMedioCupos = cuposData || [];
    } catch (err) {
      console.warn('Error consultando mt_cupos_tipo_medio:', err);
    }

    return NextResponse.json({
      data: areas || [],
      tipo_medio_cupos: tipoMedioCupos,
      evento_id: targetEventoId,
      tenant_id: tenant.id,
    });
  } catch (error) {
    console.error('Error en GET /api/acreditaciones/areas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
