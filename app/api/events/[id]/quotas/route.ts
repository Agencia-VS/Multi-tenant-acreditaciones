/**
 * API: Quota Rules by Event
 * GET   — Obtener reglas de cupo con uso actual
 * POST  — Crear/actualizar regla
 * DELETE — Eliminar regla
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQuotaRulesWithUsage, upsertQuotaRule, deleteQuotaRule, checkQuota } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';

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
    await requireAuth(request, { role: 'admin_tenant' });

    const { id: eventId } = await params;
    const body = await request.json();
    const { tipo_medio, max_per_organization, max_global } = body;

    if (!tipo_medio) {
      return NextResponse.json({ error: 'tipo_medio es requerido' }, { status: 400 });
    }

    const rule = await upsertQuotaRule(
      eventId,
      tipo_medio,
      max_per_organization || 0,
      max_global || 0
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

export async function DELETE(request: NextRequest) {
  try {
    // Auth: requiere admin_tenant o superadmin
    await requireAuth(request, { role: 'admin_tenant' });

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
