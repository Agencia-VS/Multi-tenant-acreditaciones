/**
 * API: My Provider Access
 * GET — Acreditado consulta sus accesos como proveedor a distintos tenants
 */

import { NextRequest, NextResponse } from 'next/server';
import { listProvidersByProfile, getProfileByUserId } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    // Obtener perfil
    const profile = await getProfileByUserId(user.id);
    if (!profile) {
      return NextResponse.json([]);
    }

    // Obtener todos los accesos del perfil
    const providers = await listProvidersByProfile(profile.id);

    if (providers.length === 0) {
      return NextResponse.json([]);
    }

    // Expandir con datos del tenant
    const supabase = createSupabaseAdminClient();
    const tenantIds = [...new Set(providers.map(p => p.tenant_id))];
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, nombre, slug, logo_url')
      .in('id', tenantIds);

    const tenantMap = new Map((tenants || []).map(t => [t.id, t]));

    const result = providers.map(p => ({
      ...p,
      tenant: tenantMap.get(p.tenant_id) || null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
