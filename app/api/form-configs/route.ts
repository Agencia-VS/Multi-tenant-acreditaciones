import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/form-configs?tenant=slug&form=prensa&evento_id=123
 * 
 * Obtiene la configuración de formulario activa para un tenant.
 * Prioridad: config específica del evento > config por defecto del tenant.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenant');
    const formSlug = searchParams.get('form') || 'prensa';
    const eventoId = searchParams.get('evento_id');

    if (!tenantSlug) {
      return NextResponse.json({ error: 'Parámetro tenant requerido' }, { status: 400 });
    }

    // Obtener tenant_id
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('mt_tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });
    }

    // Intentar config específica del evento
    if (eventoId) {
      const { data: eventoConfig } = await supabaseAdmin
        .from('mt_form_configs')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('slug', formSlug)
        .eq('evento_id', parseInt(eventoId))
        .eq('activo', true)
        .single();

      if (eventoConfig) {
        return NextResponse.json({ data: eventoConfig, source: 'evento' });
      }
    }

    // Fallback: config por defecto del tenant (evento_id IS NULL)
    const { data: defaultConfig, error: configError } = await supabaseAdmin
      .from('mt_form_configs')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('slug', formSlug)
      .is('evento_id', null)
      .eq('activo', true)
      .single();

    if (configError || !defaultConfig) {
      return NextResponse.json({ 
        data: null, 
        source: 'none',
        message: 'No hay configuración de formulario para este tenant. Se usará la configuración por defecto del sistema.'
      });
    }

    return NextResponse.json({ data: defaultConfig, source: 'tenant' });
  } catch (error) {
    console.error('Error en GET /api/form-configs:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/form-configs
 * 
 * Crea una nueva configuración de formulario.
 * Solo accesible por superadmin/admin.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenant_id, evento_id, nombre, slug, tipo, secciones, campos, config, activo, orden } = body;

    if (!tenant_id || !nombre || !slug || !campos) {
      return NextResponse.json(
        { error: 'Campos requeridos: tenant_id, nombre, slug, campos' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('mt_form_configs')
      .insert({
        tenant_id,
        evento_id: evento_id || null,
        nombre,
        slug,
        tipo: tipo || 'individual',
        secciones: secciones || [],
        campos,
        config: config || {},
        activo: activo ?? true,
        orden: orden ?? 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe una configuración con ese slug para este tenant/evento' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/form-configs:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/form-configs?id=uuid
 * 
 * Actualiza una configuración de formulario existente.
 */
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');

    if (!configId) {
      return NextResponse.json({ error: 'Parámetro id requerido' }, { status: 400 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    // Solo actualizar campos proporcionados
    const allowedFields = ['nombre', 'slug', 'tipo', 'secciones', 'campos', 'config', 'activo', 'orden'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron campos para actualizar' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('mt_form_configs')
      .update(updateData)
      .eq('id', configId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error en PATCH /api/form-configs:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/form-configs?id=uuid
 * 
 * Elimina (o desactiva) una configuración de formulario.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');
    const hard = searchParams.get('hard') === 'true';

    if (!configId) {
      return NextResponse.json({ error: 'Parámetro id requerido' }, { status: 400 });
    }

    if (hard) {
      const { error } = await supabaseAdmin
        .from('mt_form_configs')
        .delete()
        .eq('id', configId);
      if (error) throw error;
    } else {
      // Soft delete — solo desactivar
      const { error } = await supabaseAdmin
        .from('mt_form_configs')
        .update({ activo: false })
        .eq('id', configId);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error en DELETE /api/form-configs:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
