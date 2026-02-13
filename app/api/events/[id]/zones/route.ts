/**
 * API: Zone Assignment Rules by Event
 * GET    — Obtener reglas de zona (cargo → zona)
 * POST   — Crear/actualizar regla
 * DELETE — Eliminar regla
 */

import { NextRequest, NextResponse } from 'next/server';
import { getZoneRules, upsertZoneRule, deleteZoneRule, resolveZone } from '@/lib/services/zones';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const { searchParams } = new URL(request.url);

    // Check específico: resolver zona para un cargo
    const cargo = searchParams.get('cargo');
    if (cargo) {
      const zona = await resolveZone(eventId, cargo);
      return NextResponse.json({ cargo, zona });
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
    const { id: eventId } = await params;
    const body = await request.json();
    const { cargo, zona } = body;

    if (!cargo || !zona) {
      return NextResponse.json({ error: 'cargo y zona son requeridos' }, { status: 400 });
    }

    const rule = await upsertZoneRule(eventId, cargo, zona);
    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('rule_id');

    if (!ruleId) {
      return NextResponse.json({ error: 'rule_id es requerido' }, { status: 400 });
    }

    await deleteZoneRule(ruleId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
