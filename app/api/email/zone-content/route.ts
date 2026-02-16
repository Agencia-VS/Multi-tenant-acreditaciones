import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/email/zone-content?tenant_id=X&tipo=aprobacion
 * Retorna todo el contenido de zona para un tenant+tipo
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenant_id');
  const tipo = searchParams.get('tipo');

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id requerido' }, { status: 400 });
  }

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
}

/**
 * POST /api/email/zone-content
 * Upsert de contenido de zona (tenant_id + tipo + zona como unique key)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tenant_id, tipo, zona, titulo, instrucciones_acceso, info_especifica, notas_importantes } = body;

    if (!tenant_id || !tipo || !zona) {
      return NextResponse.json(
        { error: 'tenant_id, tipo y zona son requeridos' },
        { status: 400 }
      );
    }

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
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * DELETE /api/email/zone-content?id=X
 * Elimina un registro de contenido de zona
 */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
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
}
