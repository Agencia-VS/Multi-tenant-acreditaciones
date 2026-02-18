import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/services/requireAuth';
import { emailZoneContentPostSchema, safeParse } from '@/lib/schemas';

/**
 * GET /api/email/zone-content?tenant_id=X&tipo=aprobacion
 * Retorna todo el contenido de zona para un tenant+tipo
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const tipo = searchParams.get('tipo');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id requerido' }, { status: 400 });
    }

    // Auth: requiere admin del tenant
    await requireAuth(req, { role: 'admin_tenant', tenantId });

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('email_zone_content')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('zona');

  if (tipo) {
    query = query.eq('tipo', tipo);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

    return NextResponse.json(data || []);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * POST /api/email/zone-content
 * Upsert de contenido de zona (tenant_id + tipo + zona como unique key)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = safeParse(emailZoneContentPostSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { tenant_id, tipo, zona, titulo, instrucciones_acceso, info_especifica, notas_importantes } = parsed.data;

    // Auth: requiere admin del tenant
    await requireAuth(req, { role: 'admin_tenant', tenantId: tenant_id });

    const supabase = createSupabaseAdminClient();

    // Check if exists
    const { data: existing } = await supabase
      .from('email_zone_content')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('tipo', tipo)
      .eq('zona', zona)
      .single();

    if (existing) {
      // Update
      const { data, error } = await supabase
        .from('email_zone_content')
        .update({
          titulo: titulo || '',
          instrucciones_acceso: instrucciones_acceso || '',
          info_especifica: info_especifica || '',
          notas_importantes: notas_importantes || '',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    } else {
      // Insert
      const { data, error } = await supabase
        .from('email_zone_content')
        .insert({
          tenant_id,
          tipo,
          zona,
          titulo: titulo || '',
          instrucciones_acceso: instrucciones_acceso || '',
          info_especifica: info_especifica || '',
          notas_importantes: notas_importantes || '',
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * DELETE /api/email/zone-content?id=X&tenant_id=Y
 * Elimina un registro de contenido de zona
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const tenantId = searchParams.get('tenant_id');

    if (!id) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    }

    // Auth: requiere admin del tenant (o superadmin si no se provee tenant_id)
    if (tenantId) {
      await requireAuth(req, { role: 'admin_tenant', tenantId });
    } else {
      await requireAuth(req, { role: 'superadmin' });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from('email_zone_content')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
