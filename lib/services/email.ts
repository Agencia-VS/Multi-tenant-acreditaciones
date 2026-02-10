/**
 * Servicio de Email — Envío de notificaciones
 * 
 * Usa Resend para enviar emails con plantillas dinámicas.
 * Los colores y branding se toman del tenant.
 */

import { Resend } from 'resend';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { RegistrationFull, Tenant } from '@/types';

const resend = new Resend(process.env.RESEND_API_KEY);

// Dirección de envío segura
function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || 'Accredia <onboarding@resend.dev>';
}

/**
 * Enviar email de aprobación con QR (si aplica)
 */
export async function sendApprovalEmail(
  registration: RegistrationFull,
  tenant: Tenant
): Promise<{ success: boolean; error?: string }> {
  try {
    const qrSection = registration.event_qr_enabled && registration.qr_token
      ? `
        <div style="text-align: center; margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
          <p style="font-size: 14px; color: #666;">Tu código QR de acceso:</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(registration.qr_token)}" 
               alt="QR de acceso" style="width: 200px; height: 200px;" />
          <p style="font-size: 12px; color: #999; margin-top: 10px;">Presenta este QR en la entrada del evento</p>
        </div>
      `
      : '';

    const html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: ${tenant.color_primario}; padding: 30px; text-align: center;">
          ${tenant.logo_url ? `<img src="${tenant.logo_url}" alt="${tenant.nombre}" style="height: 60px;" />` : ''}
          <h1 style="color: ${tenant.color_secundario}; margin: 10px 0 0;">Acreditación Aprobada</h1>
        </div>
        <div style="padding: 30px; background: #ffffff;">
          <p>Estimado/a <strong>${registration.profile_nombre} ${registration.profile_apellido}</strong>,</p>
          <p>Tu acreditación para el evento <strong>${registration.event_nombre}</strong> ha sido <span style="color: #22c55e; font-weight: bold;">APROBADA</span>.</p>
          
          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Evento:</strong> ${registration.event_nombre}</p>
            ${registration.event_fecha ? `<p style="margin: 5px 0 0;"><strong>Fecha:</strong> ${new Date(registration.event_fecha).toLocaleDateString('es-CL')}</p>` : ''}
            ${registration.event_venue ? `<p style="margin: 5px 0 0;"><strong>Lugar:</strong> ${registration.event_venue}</p>` : ''}
            <p style="margin: 5px 0 0;"><strong>Organización:</strong> ${registration.organizacion || '-'}</p>
            <p style="margin: 5px 0 0;"><strong>Cargo:</strong> ${registration.cargo || '-'}</p>
          </div>

          ${qrSection}
          
          <p style="color: #666; font-size: 13px;">Este es un correo automático del sistema de acreditaciones.</p>
        </div>
        <div style="background: ${tenant.color_dark || '#1a1a2e'}; padding: 15px; text-align: center;">
          <p style="color: #999; font-size: 12px; margin: 0;">${tenant.nombre} — Sistema de Acreditaciones</p>
        </div>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to: registration.profile_email || '',
      subject: `✅ Acreditación Aprobada — ${registration.event_nombre}`,
      html,
    });

    if (error) return { success: false, error: error.message };

    // Log del email
    await logEmail(registration.id, registration.tenant_id, registration.profile_email || '', 'aprobacion', `Acreditación Aprobada — ${registration.event_nombre}`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Enviar email de rechazo
 */
export async function sendRejectionEmail(
  registration: RegistrationFull,
  tenant: Tenant,
  motivo?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: ${tenant.color_primario}; padding: 30px; text-align: center;">
          ${tenant.logo_url ? `<img src="${tenant.logo_url}" alt="${tenant.nombre}" style="height: 60px;" />` : ''}
          <h1 style="color: ${tenant.color_secundario}; margin: 10px 0 0;">Acreditación No Aprobada</h1>
        </div>
        <div style="padding: 30px; background: #ffffff;">
          <p>Estimado/a <strong>${registration.profile_nombre} ${registration.profile_apellido}</strong>,</p>
          <p>Lamentamos informarle que su solicitud de acreditación para el evento <strong>${registration.event_nombre}</strong> no ha sido aprobada.</p>
          
          ${motivo ? `
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Motivo:</strong> ${motivo}</p>
          </div>
          ` : ''}
          
          <p>Si tiene consultas, por favor contacte al organizador del evento.</p>
          <p style="color: #666; font-size: 13px;">Este es un correo automático del sistema de acreditaciones.</p>
        </div>
        <div style="background: ${tenant.color_dark || '#1a1a2e'}; padding: 15px; text-align: center;">
          <p style="color: #999; font-size: 12px; margin: 0;">${tenant.nombre} — Sistema de Acreditaciones</p>
        </div>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to: registration.profile_email || '',
      subject: `Acreditación — ${registration.event_nombre}`,
      html,
    });

    if (error) return { success: false, error: error.message };

    await logEmail(registration.id, registration.tenant_id, registration.profile_email || '', 'rechazo', `Acreditación — ${registration.event_nombre}`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Enviar emails masivos (bulk approval)
 */
export async function sendBulkApprovalEmails(
  registrations: RegistrationFull[],
  tenant: Tenant
): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;

  for (const reg of registrations) {
    if (!reg.profile_email) { errors++; continue; }
    
    const result = await sendApprovalEmail(reg, tenant);
    if (result.success) sent++;
    else errors++;
    
    // Rate limiting: 2 emails por segundo
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { sent, errors };
}

/** Log interno de emails enviados */
async function logEmail(
  registrationId: string,
  tenantId: string,
  toEmail: string,
  tipo: string,
  subject: string
) {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from('email_logs').insert({
      registration_id: registrationId,
      tenant_id: tenantId,
      to_email: toEmail,
      tipo,
      subject,
    });
  } catch {
    // No bloquear por error de log
  }
}
