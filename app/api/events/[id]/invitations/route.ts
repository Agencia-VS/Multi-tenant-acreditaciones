/**
 * API: Event Invitations
 * GET    — Listar invitaciones del evento
 * POST   — Crear invitaciones (batch)
 * DELETE — Eliminar una invitación
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/services/requireAuth';
import {
  listInvitations,
  createInvitations,
  deleteInvitation,
  markInvitationSent,
} from '@/lib/services/invitations';
import { getEventById } from '@/lib/services/events';
import { sendInvitationEmail } from '@/lib/services/email';
import { invitationSchema, safeParse } from '@/lib/schemas';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    await requireAuth(request, { role: 'superadmin' });

    const invitations = await listInvitations(eventId);
    return NextResponse.json(invitations);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    await requireAuth(request, { role: 'superadmin' });

    const body = await request.json();
    const parsed = safeParse(invitationSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { invitees } = parsed.data;
    const sendEmail = body.sendEmail !== false;

    // Validar que el evento existe
    const event = await getEventById(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    const created = await createInvitations(eventId, invitees);

    // Enviar emails si se solicita
    if (sendEmail) {
      for (const invitation of created) {
        try {
          await sendInvitationEmail({
            to: invitation.email,
            nombre: invitation.nombre || undefined,
            eventName: event.nombre,
            tenantId: event.tenant_id,
            token: invitation.token,
          });
          await markInvitationSent(invitation.id);
        } catch {
          // No fallar el batch si un email individual falla
          console.warn(`Failed to send invitation email to ${invitation.email}`);
        }
      }
    }

    return NextResponse.json({ invitations: created, count: created.length });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // consume params
    await requireAuth(request, { role: 'superadmin' });

    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('invitation_id');

    if (!invitationId) {
      return NextResponse.json({ error: 'invitation_id requerido' }, { status: 400 });
    }

    await deleteInvitation(invitationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
