/**
 * API: Billing Plans CRUD (SuperAdmin)
 * GET   — Listar todos los planes (ya cubierto en /api/billing?action=plans)
 * POST  — Crear plan
 * PATCH — Actualizar plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { upsertPlan, listPlans } from '@/lib/services/billing';
import { requireAuth } from '@/lib/services/requireAuth';

export async function GET() {
  try {
    const plans = await listPlans();
    return NextResponse.json(plans);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request, { role: 'superadmin' });
    const body = await request.json();
    
    if (!body.name || !body.slug) {
      return NextResponse.json({ error: 'name y slug son requeridos' }, { status: 400 });
    }

    const plan = await upsertPlan(body);
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAuth(request, { role: 'superadmin' });
    const body = await request.json();
    
    if (!body.name || !body.slug) {
      return NextResponse.json({ error: 'name y slug son requeridos' }, { status: 400 });
    }

    const plan = await upsertPlan(body);
    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
