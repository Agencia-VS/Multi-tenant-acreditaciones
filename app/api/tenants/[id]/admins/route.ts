/**
 * API: Tenant Admins
 * GET    — Listar admins de un tenant
 * POST   — Crear admin para un tenant
 * PATCH  — Actualizar admin (rol, nombre)
 * DELETE — Eliminar admin de un tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { createTenantAdmin, listTenantAdmins, updateTenantAdmin, deleteTenantAdmin, sendWelcomeEmail, getTenantById } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';
import { adminCreateSchema, safeParse } from '@/lib/schemas';

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
    const parsed = safeParse(adminCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { email, nombre, password } = parsed.data;

    const admin = await createTenantAdmin(tenantId, email, nombre, password || undefined);

    // Enviar email de bienvenida si se generó contraseña temporal
    if (admin.tempPassword) {
      const tenant = await getTenantById(tenantId);
      if (tenant) {
        const origin = request.headers.get('origin') || request.headers.get('x-forwarded-host') || 'https://accredia.cl';
        await sendWelcomeEmail({
          to: email,
          nombre,
          tenantName: tenant.nombre,
          tenantSlug: tenant.slug,
          tempPassword: admin.tempPassword,
          loginUrl: `${origin}/${tenant.slug}/admin/login`,
        });
      }
    }

    // No devolver tempPassword al frontend
    const { tempPassword: _tp, ...adminData } = admin;
    return NextResponse.json(adminData, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    await requireAuth(request, { role: 'superadmin' });

    const body = await request.json();
    const { admin_id, rol, nombre } = body;

    if (!admin_id) {
      return NextResponse.json({ error: 'admin_id es requerido' }, { status: 400 });
    }

    if (rol && !['admin', 'editor', 'viewer'].includes(rol)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    const updates: { rol?: string; nombre?: string } = {};
    if (rol) updates.rol = rol;
    if (nombre !== undefined) updates.nombre = nombre;

    // Verify admin belongs to this tenant
    const admins = await listTenantAdmins(tenantId);
    if (!admins.some(a => a.id === admin_id)) {
      return NextResponse.json({ error: 'Admin no pertenece a este tenant' }, { status: 404 });
    }

    const updated = await updateTenantAdmin(admin_id, updates);
    return NextResponse.json(updated);
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
    const { id: tenantId } = await params;
    await requireAuth(request, { role: 'superadmin' });

    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('admin_id');

    if (!adminId) {
      return NextResponse.json({ error: 'admin_id es requerido' }, { status: 400 });
    }

    // Verify admin belongs to this tenant
    const admins = await listTenantAdmins(tenantId);
    if (!admins.some(a => a.id === adminId)) {
      return NextResponse.json({ error: 'Admin no pertenece a este tenant' }, { status: 404 });
    }

    await deleteTenantAdmin(adminId, true);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
