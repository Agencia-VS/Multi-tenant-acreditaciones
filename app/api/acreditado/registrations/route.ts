/**
 * GET /api/acreditado/registrations
 * Devuelve las acreditaciones del usuario autenticado:
 * - Propias (profile_id = su perfil)
 * - Gestionadas (submitted_by = su perfil, profile_id ≠ su perfil)
 * Usa admin client para bypasear RLS.
 */
import { NextResponse } from 'next/server';
import { getCurrentUser, getProfileByUserId } from '@/lib/services';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const profile = await getProfileByUserId(user.id);
    if (!profile) {
      // Usuario autenticado sin perfil — no tiene acreditaciones
      return NextResponse.json({ registrations: [], profile: null });
    }

    const supabase = createSupabaseAdminClient();

    // Propias acreditaciones
    const { data: ownRegs, error: ownErr } = await supabase
      .from('v_registration_full')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false });

    if (ownErr) {
      console.error('[acreditado/registrations] Error own regs:', ownErr);
    }

    // Acreditaciones enviadas como manager
    const { data: managedRegs, error: managedErr } = await supabase
      .from('v_registration_full')
      .select('*')
      .eq('submitted_by', profile.id)
      .neq('profile_id', profile.id)
      .order('created_at', { ascending: false });

    if (managedErr) {
      console.error('[acreditado/registrations] Error managed regs:', managedErr);
    }

    const ownRows = ownRegs || [];
    const managedRows = managedRegs || [];
    const allRows = [...ownRows, ...managedRows];

    const profileIds = Array.from(new Set(
      allRows
        .map((row) => row.profile_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    ));

    let profileDocumentMap = new Map<string, { document_type: string | null; document_number: string | null; rut: string | null }>();

    if (profileIds.length > 0) {
      const { data: profileDocs } = await supabase
        .from('profiles')
        .select('id, document_type, document_number, rut')
        .in('id', profileIds);

      profileDocumentMap = new Map(
        (profileDocs || []).map((p) => [
          p.id,
          {
            document_type: p.document_type || null,
            document_number: p.document_number || null,
            rut: p.rut,
          },
        ])
      );
    }

    const withDocument = (rows: typeof ownRows) => rows.map((row) => {
      const doc = row.profile_id ? profileDocumentMap.get(row.profile_id) : undefined;
      return {
        ...row,
        document_type: doc?.document_type || null,
        document_number: doc?.document_number || row.rut || null,
      };
    });

    return NextResponse.json({
      registrations: {
        own: withDocument(ownRows),
        managed: withDocument(managedRows),
      },
      profile: {
        id: profile.id,
        nombre: profile.nombre,
        apellido: profile.apellido,
        rut: profile.rut,
        document_type: profile.document_type || null,
        document_number: profile.document_number || profile.rut || null,
      },
    });
  } catch (err) {
    console.error('[acreditado/registrations] Error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
