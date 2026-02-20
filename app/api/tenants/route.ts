/**
 * API: Tenants
 * GET   — Listar tenants
 * POST  — Crear tenant (superadmin)
 * PATCH — Actualizar tenant existente
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { listTenants, listActiveTenants, createTenant, updateTenant, logAuditAction, assignFreePlan } from '@/lib/services';
import type { TenantFormData } from '@/types';
import { requireAuth } from '@/lib/services/requireAuth';
import { tenantCreateSchema, tenantUpdateSchema, safeParse } from '@/lib/schemas';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    const withStats = searchParams.get('withStats') === 'true';

    if (all || withStats) {
      // listTenants (incluyendo inactivos) requiere superadmin
      await requireAuth(request, { role: 'superadmin' });
      const tenants = await listTenants();
      return NextResponse.json(tenants);
    }

    const tenants = await listActiveTenants();
    return NextResponse.json(tenants);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request, { role: 'superadmin' });

    const body = await request.json();
    const parsed = safeParse(tenantCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const tenant = await createTenant(parsed.data as TenantFormData);

    // Auto-assign plan Free al nuevo tenant
    await assignFreePlan(tenant.id).catch(() => {
      // No bloquear creación si falla asignación de plan
    });

    await logAuditAction(user.id, 'tenant.created', 'tenant', tenant.id, {
      nombre: tenant.nombre,
      slug: tenant.slug,
    });

    // Invalidar caché de layouts tenant
    revalidatePath(`/${tenant.slug}`, 'layout');

    return NextResponse.json(tenant, { status: 201 });
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
    const { user } = await requireAuth(request, { role: 'superadmin' });

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('id');
    if (!tenantId) {
      return NextResponse.json({ error: 'ID de tenant es requerido' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = safeParse(tenantUpdateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const tenant = await updateTenant(tenantId, parsed.data as Partial<TenantFormData>);

    await logAuditAction(user.id, 'tenant.updated', 'tenant', tenant.id, {
      nombre: tenant.nombre,
    });

    // Invalidar caché del layout de este tenant
    if (tenant.slug) revalidatePath(`/${tenant.slug}`, 'layout');

    return NextResponse.json(tenant);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
