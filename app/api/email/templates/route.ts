/**
 * API: Email Templates
 * GET  — Obtener templates de un tenant
 * POST — Crear/actualizar template (upsert por tenant_id + tipo)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { EmailTemplateType } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id requerido' }, { status: 400 });
    }

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, tipo, subject, body_html, info_general } = body as {
      tenant_id: string;
      tipo: EmailTemplateType;
      subject: string;
      body_html: string;
      info_general?: string;
    };

    if (!tenant_id || !tipo) {
      return NextResponse.json({ error: 'tenant_id y tipo son requeridos' }, { status: 400 });
    }

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
