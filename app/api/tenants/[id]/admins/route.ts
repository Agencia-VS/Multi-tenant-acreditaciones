/**
 * API: Tenant Admins
 * GET  — Listar admins de un tenant
 * POST — Crear admin para un tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { createTenantAdmin, listTenantAdmins } from '@/lib/services';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const admins = await listTenantAdmins(tenantId);
    return NextResponse.json(admins);
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
    const { id: tenantId } = await params;
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
