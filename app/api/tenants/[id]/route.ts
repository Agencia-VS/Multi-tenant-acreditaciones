/**
 * API: Tenant individual
 * DELETE — Eliminar tenant y todos sus datos (superadmin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteTenant, getTenantById, logAuditAction } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request, { role: 'superadmin' });
    const { id: tenantId } = await params;

    // Verificar que el tenant existe
    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });
    }

    // Requiere confirmación del nombre en el body
    const body = await request.json().catch(() => ({}));
    if (body.confirmName !== tenant.nombre) {
      return NextResponse.json(
        { error: 'Debes confirmar el nombre del tenant para eliminar' },
        { status: 400 }
      );
    }

    await deleteTenant(tenantId);

    await logAuditAction(user.id, 'tenant.deleted', 'tenant', tenantId, {
      nombre: tenant.nombre,
      slug: tenant.slug,
    });

    return NextResponse.json({ success: true, message: `Tenant "${tenant.nombre}" eliminado` });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
