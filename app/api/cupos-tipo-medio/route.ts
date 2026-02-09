import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/cupos-tipo-medio?tenant_id=uuid&evento_id=123
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');
    const eventoId = searchParams.get('evento_id');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id requerido' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('mt_cupos_tipo_medio')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('tipo_medio', { ascending: true });

    if (eventoId) {
      query = query.eq('evento_id', parseInt(eventoId));
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error GET /api/cupos-tipo-medio:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * POST /api/cupos-tipo-medio
 * Body: { tenant_id, evento_id, tipo_medio, cupo_por_empresa, descripcion? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenant_id, evento_id, tipo_medio, cupo_por_empresa, descripcion } = body;

    if (!tenant_id || !evento_id || !tipo_medio) {
      return NextResponse.json(
        { error: 'Campos requeridos: tenant_id, evento_id, tipo_medio' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('mt_cupos_tipo_medio')
      .insert({
        tenant_id,
        evento_id: parseInt(evento_id),
        tipo_medio: tipo_medio.trim(),
        cupo_por_empresa: parseInt(cupo_por_empresa) || 0,
        descripcion: descripcion?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `Ya existe el tipo de medio "${tipo_medio}" para este evento` },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error POST /api/cupos-tipo-medio:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * PATCH /api/cupos-tipo-medio?id=123
 * Body: { tipo_medio?, cupo_por_empresa?, descripcion? }
 */
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.tipo_medio !== undefined) updateData.tipo_medio = body.tipo_medio.trim();
    if (body.cupo_por_empresa !== undefined) updateData.cupo_por_empresa = parseInt(body.cupo_por_empresa) || 0;
    if (body.descripcion !== undefined) updateData.descripcion = body.descripcion?.trim() || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('mt_cupos_tipo_medio')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error PATCH /api/cupos-tipo-medio:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * DELETE /api/cupos-tipo-medio?id=123
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('mt_cupos_tipo_medio')
      .delete()
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error DELETE /api/cupos-tipo-medio:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
