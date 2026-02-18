/**
 * API: Teams — Gestión de equipos del Manager
 * GET    — Obtener equipo del manager (con enrichment opcional por evento)
 * POST   — Agregar miembro al equipo
 * DELETE — Eliminar miembro del equipo
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTeamMembers, getTeamMembersForEvent, addTeamMember, removeTeamMember } from '@/lib/services';
import { getProfileByUserId, getCurrentUser } from '@/lib/services';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const profile = await getProfileByUserId(user.id);
    if (!profile) {
      // Si no hay perfil aún, devolver lista vacía (no 404)
      return NextResponse.json([]);
    }

    // Si se provee event_id, enriquecer con datos del contexto del evento (M12)
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    const members = eventId
      ? await getTeamMembersForEvent(profile.id, eventId)
      : await getTeamMembers(profile.id);

    return NextResponse.json(members);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const profile = await getProfileByUserId(user.id);
    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const member = await addTeamMember(profile.id, body, body.alias);

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    const status = message.includes('ya está en tu equipo') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const profile = await getProfileByUserId(user.id);
    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('member_id');
    
    if (!memberId) {
      return NextResponse.json({ error: 'member_id es requerido' }, { status: 400 });
    }

    await removeTeamMember(profile.id, memberId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
