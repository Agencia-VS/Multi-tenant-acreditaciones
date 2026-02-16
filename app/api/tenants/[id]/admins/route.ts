/**
 * API: Tenant Admins
 * GET  — Listar admins de un tenant
 * POST — Crear admin para un tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { createTenantAdmin, listTenantAdmins } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    // Auth: superadmin o admin del mismo tenant
    await requireAuth(request, { role: 'admin_tenant', tenantId });

    const admins = await listTenantAdmins(tenantId);
    return NextResponse.json(admins);
  } catch (error) {
    if (error instanceof NextResponse) return error;
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
    const { id: tenantId } = await params;
    // Auth: solo superadmin puede crear admins de tenant
    await requireAuth(request, { role: 'superadmin' });

    const body = await request.json();
    const { email, nombre, password } = body;

    if (!email || !nombre || !password) {
      return NextResponse.json(
        { error: 'Email, nombre y password son requeridos' },
        { status: 400 }
      );
    }

    const admin = await createTenantAdmin(tenantId, email, nombre, password);
    return NextResponse.json(admin, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
