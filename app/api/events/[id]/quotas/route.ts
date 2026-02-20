/**
 * API: Quota Rules by Event
 * GET   — Obtener reglas de cupo con uso actual
 * POST  — Crear/actualizar regla
 * DELETE — Eliminar regla
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQuotaRulesWithUsage, upsertQuotaRule, deleteQuotaRule, checkQuota, getEventTenantId } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';
import { quotaRuleSchema, safeParse } from '@/lib/schemas';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const { searchParams } = new URL(request.url);
    
    // Check específico: verificar cupo para un tipo_medio + organización
    const tipoMedio = searchParams.get('tipo_medio');
    const organizacion = searchParams.get('organizacion');
    
    if (tipoMedio && organizacion) {
      const result = await checkQuota(eventId, tipoMedio, organizacion);
      return NextResponse.json(result);
    }
    
    // General: obtener todas las reglas con uso
    const rules = await getQuotaRulesWithUsage(eventId);
    return NextResponse.json(rules);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth: requiere admin_tenant o superadmin
    const { id: eventId } = await params;
    const tenantId = await getEventTenantId(eventId);
    if (!tenantId) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }
    await requireAuth(request, { role: 'admin_tenant', tenantId });

    const body = await request.json();
    const parsed = safeParse(quotaRuleSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const rule = await upsertQuotaRule(
      eventId,
      parsed.data.tipo_medio,
      parsed.data.max_per_organization,
      parsed.data.max_global
    );

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth: requiere admin_tenant del evento
    const { id: eventId } = await params;
    const tenantId = await getEventTenantId(eventId);
    if (!tenantId) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }
    await requireAuth(request, { role: 'admin_tenant', tenantId });

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('rule_id');
    if (!ruleId) {
      return NextResponse.json({ error: 'rule_id es requerido' }, { status: 400 });
    }

    await deleteQuotaRule(ruleId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
