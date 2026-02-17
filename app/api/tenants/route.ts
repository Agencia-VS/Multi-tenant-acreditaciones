/**
 * API: Tenants
 * GET   — Listar tenants
 * POST  — Crear tenant (superadmin)
 * PATCH — Actualizar tenant existente
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { listTenants, listActiveTenants, createTenant, updateTenant, getCurrentUser, isSuperAdmin, logAuditAction } from '@/lib/services';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    const withStats = searchParams.get('withStats') === 'true';

    if (all || withStats) {
      const tenants = await listTenants();
      return NextResponse.json(tenants);
    }

    const tenants = await listActiveTenants();
    return NextResponse.json(tenants);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isSuperAdmin(user.id))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const tenant = await createTenant(body);

    await logAuditAction(user.id, 'tenant.created', 'tenant', tenant.id, {
      nombre: tenant.nombre,
      slug: tenant.slug,
    });

    // Invalidar caché de layouts tenant
    revalidatePath(`/${tenant.slug}`, 'layout');

    return NextResponse.json(tenant, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isSuperAdmin(user.id))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('id');
    if (!tenantId) {
      return NextResponse.json({ error: 'ID de tenant es requerido' }, { status: 400 });
    }

    const body = await request.json();
    const tenant = await updateTenant(tenantId, body);

    await logAuditAction(user.id, 'tenant.updated', 'tenant', tenant.id, {
      nombre: tenant.nombre,
    });

    // Invalidar caché del layout de este tenant
    if (tenant.slug) revalidatePath(`/${tenant.slug}`, 'layout');

    return NextResponse.json(tenant);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
