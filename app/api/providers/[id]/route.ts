/**
 * API: Provider individual
 * PATCH  — Aprobar / Rechazar / Suspender / Actualizar zonas (admin)
 * DELETE — Eliminar proveedor (admin o superadmin)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getProviderById,
  approveProvider,
  rejectProvider,
  suspendProvider,
  updateProviderZones,
  deleteProvider,
  logAuditAction,
} from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';
import { providerApproveSchema, providerRejectSchema, providerUpdateZonesSchema, safeParse } from '@/lib/schemas';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: providerId } = await params;

    // Buscar proveedor para obtener tenant_id
    const existing = await getProviderById(providerId);
    if (!existing) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    // Requiere admin del tenant
    const { user } = await requireAuth(request, {
      role: 'admin_tenant',
      tenantId: existing.tenant_id,
    });

    const body = await request.json();
    const action = body.action as string;

    let result;

    switch (action) {
      case 'approve': {
        const parsed = safeParse(providerApproveSchema, body);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        result = await approveProvider(providerId, {
          allowedZones: parsed.data.allowed_zones,
          notas: parsed.data.notas,
          approvedBy: user.id,
        });
        await logAuditAction(user.id, 'provider.approved', 'tenant_providers', providerId, {
          tenant_id: existing.tenant_id,
          allowed_zones: parsed.data.allowed_zones,
        });
        break;
      }

      case 'reject': {
        const parsed = safeParse(providerRejectSchema, body);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        result = await rejectProvider(providerId, parsed.data.motivo);
        await logAuditAction(user.id, 'provider.rejected', 'tenant_providers', providerId, {
          tenant_id: existing.tenant_id,
          motivo: parsed.data.motivo,
        });
        break;
      }

      case 'suspend': {
        result = await suspendProvider(providerId);
        await logAuditAction(user.id, 'provider.suspended', 'tenant_providers', providerId, {
          tenant_id: existing.tenant_id,
        });
        break;
      }

      case 'update_zones': {
        const parsed = safeParse(providerUpdateZonesSchema, body);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        result = await updateProviderZones(providerId, parsed.data.allowed_zones);
        await logAuditAction(user.id, 'provider.zones_updated', 'tenant_providers', providerId, {
          tenant_id: existing.tenant_id,
          allowed_zones: parsed.data.allowed_zones,
        });
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Acción inválida. Usa: approve, reject, suspend, update_zones' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
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
    const { id: providerId } = await params;

    const existing = await getProviderById(providerId);
    if (!existing) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    // Admin del tenant o superadmin
    const { user } = await requireAuth(request, {
      role: 'admin_tenant',
      tenantId: existing.tenant_id,
    });

    await deleteProvider(providerId);

    await logAuditAction(user.id, 'provider.deleted', 'tenant_providers', providerId, {
      tenant_id: existing.tenant_id,
      profile_id: existing.profile_id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
