/**
 * API: Zone Assignment Rules by Event
 * GET    — Obtener reglas de zona (cargo/tipo_medio → zona)
 * POST   — Crear/actualizar regla
 * DELETE — Eliminar regla
 */

import { NextRequest, NextResponse } from 'next/server';
import { getZoneRules, upsertZoneRule, deleteZoneRule, resolveZone } from '@/lib/services/zones';
import { getEventTenantId } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';
import { zoneRuleSchema, safeParse } from '@/lib/schemas';
import type { ZoneMatchField } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const { searchParams } = new URL(request.url);

    // Check específico: resolver zona para un cargo/tipo_medio
    const cargo = searchParams.get('cargo');
    const tipoMedio = searchParams.get('tipo_medio');
    if (cargo || tipoMedio) {
      const zona = await resolveZone(eventId, cargo || undefined, tipoMedio || undefined);
      return NextResponse.json({ cargo, tipo_medio: tipoMedio, zona });
    }

    // General: obtener todas las reglas
    const rules = await getZoneRules(eventId);
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
    const parsed = safeParse(zoneRuleSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const rule = await upsertZoneRule(eventId, parsed.data.cargo, parsed.data.zona, parsed.data.match_field as ZoneMatchField);
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

    await deleteZoneRule(ruleId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
