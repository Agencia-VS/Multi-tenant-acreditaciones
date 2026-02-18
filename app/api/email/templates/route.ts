/**
 * API: Email Templates
 * GET  — Obtener templates de un tenant
 * POST — Crear/actualizar template (upsert por tenant_id + tipo)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/services/requireAuth';
import { emailTemplatePostSchema, safeParse } from '@/lib/schemas';
import type { EmailTemplateType } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id requerido' }, { status: 400 });
    }

    // Auth: requiere admin del tenant
    await requireAuth(request, { role: 'admin_tenant', tenantId });

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('tipo');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = safeParse(emailTemplatePostSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { tenant_id, tipo, subject, body_html, info_general } = parsed.data;

    // Auth: requiere admin del tenant
    await requireAuth(request, { role: 'admin_tenant', tenantId: tenant_id });

    const supabase = createSupabaseAdminClient();

    // Upsert: si existe para este tenant+tipo, actualizar; si no, insertar
    const { data: existing } = await supabase
      .from('email_templates')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('tipo', tipo)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from('email_templates')
        .update({ subject, body_html, info_general: info_general || '', updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('email_templates')
        .insert({ tenant_id, tipo, subject, body_html, info_general: info_general || '' })
        .select()
        .single();
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
