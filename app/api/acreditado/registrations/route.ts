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

    return NextResponse.json({
      registrations: {
        own: ownRegs || [],
        managed: managedRegs || [],
      },
      profile: {
        id: profile.id,
        nombre: profile.nombre,
        apellido: profile.apellido,
        rut: profile.rut,
      },
    });
  } catch (err) {
    console.error('[acreditado/registrations] Error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
