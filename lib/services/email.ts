/**
 * Servicio de Email — Envío de notificaciones
 * 
 * Usa Resend para enviar emails con plantillas dinámicas.
 * Busca plantillas custom en email_templates (DB) por tenant_id + tipo.
 * Busca contenido por zona en email_zone_content (DB) por tenant_id + tipo + zona.
 * Si no existe, usa los templates hardcodeados como fallback.
 * Los colores y branding se toman del tenant.
 */

import { Resend } from 'resend';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { RegistrationFull, Tenant, EmailTemplateType } from '@/types';

const resend = new Resend(process.env.RESEND_API_KEY);

function formatSenderNameFromSlug(tenantSlug?: string): string {
  if (!tenantSlug) return 'Accredia';

  const normalized = tenantSlug
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  if (!normalized) return 'Accredia';

  return normalized
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Dirección de envío segura — usa slug del tenant en la dirección
function getFromEmail(tenantSlug?: string): string {
  const raw = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  // Si el valor es un dominio (sin @), convertir a noreply@dominio
  const domain = raw.includes('@') ? raw.split('@')[1] : raw;
  const local = tenantSlug ? `noreply.${tenantSlug}` : 'noreply';
  const name = formatSenderNameFromSlug(tenantSlug);
  return `${name} <${local}@${domain}>`;
}

/* ─── Template Engine ─────────────────────────────────────────────── */

/** Escapa caracteres HTML para prevenir inyección en emails */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Valida que un string sea un color CSS seguro (hex o nombre simple) */
export function safeColor(color: string | null | undefined, fallback: string): string {
  if (!color) return fallback;
  // Solo permitir #hex y nombres de colores simples
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  if (/^[a-zA-Z]{1,20}$/.test(color)) return color;
  return fallback;
}

/** Valida que un string sea una URL segura (https) */
export function safeUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return escapeHtml(url);
    }
  } catch { /* invalid URL */ }
  return '';
}

export interface TemplateVars {
  nombre: string;
  apellido: string;
  evento: string;
  fecha: string;
  lugar: string;
  organizacion: string;
  cargo: string;
  motivo: string;
  tenant: string;
  zona: string;
  area: string;
  qr_section: string;
  instrucciones_acceso: string;
  info_especifica: string;
  notas_importantes: string;
  info_general: string;
  [key: string]: string;
}

/**
 * Reemplaza todas las variables {key} en un string.
 * Las variables de texto del usuario se escapan para prevenir HTML injection.
 * Las variables de contenido HTML (qr_section, instrucciones, info, notas) NO se escapan
 * porque son generadas por el sistema o por admins de confianza.
 */
export function replaceVars(template: string, vars: TemplateVars): string {
  let rendered = template;
  for (const [key, value] of Object.entries(vars)) {
    rendered = rendered.split(`{${key}}`).join(value ?? '');
  }
  return rendered;
}

function normalizeEventMailVariables(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const source = raw as Record<string, unknown>;
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    const normalizedKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!normalizedKey) continue;
    const normalizedValue = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    if (!normalizedValue) continue;
    result[normalizedKey] = escapeHtml(normalizedValue);
  }

  return result;
}

async function getEventMailVariables(eventId: string): Promise<Record<string, string>> {
  if (!eventId) return {};
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from('events')
      .select('config')
      .eq('id', eventId)
      .single();

    const config = (data?.config || {}) as Record<string, unknown>;
    return normalizeEventMailVariables(config.email_variables);
  } catch {
    return {};
  }
}

/** Obtiene plantilla custom de la DB. Retorna null si no existe. */
async function getCustomTemplate(
  tenantId: string,
  tipo: EmailTemplateType
): Promise<{ subject: string; body_html: string; info_general: string | null } | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from('email_templates')
      .select('subject, body_html, info_general')
      .eq('tenant_id', tenantId)
      .eq('tipo', tipo)
      .single();

    if (data?.subject && data?.body_html) return data as { subject: string; body_html: string; info_general: string | null };
    return null;
  } catch {
    return null;
  }
}

/** Obtiene contenido específico de zona de la DB. Retorna null si no existe. */
async function getZoneContent(
  tenantId: string,
  tipo: EmailTemplateType,
  zona: string
): Promise<{ titulo: string; instrucciones_acceso: string; info_especifica: string; notas_importantes: string } | null> {
  if (!zona) return null;
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from('email_zone_content')
      .select('titulo, instrucciones_acceso, info_especifica, notas_importantes')
      .eq('tenant_id', tenantId)
      .eq('tipo', tipo)
      .eq('zona', zona)
      .single();

    if (data) return data as { titulo: string; instrucciones_acceso: string; info_especifica: string; notas_importantes: string };
    return null;
  } catch {
    return null;
  }
}

/** Extrae la zona del registration (vive en datos_extra.zona) */
function extractZona(registration: RegistrationFull): string {
  return registration.datos_extra?.zona || '';
}

/** Extrae un campo de datos_extra */
function extractField(registration: RegistrationFull, field: string): string {
  return String(registration.datos_extra?.[field] || '');
}

/** Construye las variables de plantilla a partir de registration + tenant + zone content */
function buildVars(
  registration: RegistrationFull,
  tenant: Tenant,
  zoneContent: { titulo: string; instrucciones_acceso: string; info_especifica: string; notas_importantes: string } | null,
  infoGeneral: string | null,
  eventVariables: Record<string, string>,
  motivo?: string
): TemplateVars {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const qrUrl = `${baseUrl}/qr/${registration.qr_token}`;
  const qrSection = registration.event_qr_enabled && registration.qr_token
    ? `
      <div style="text-align: center; margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
        <p style="font-size: 14px; color: #666;">Tu código QR de acceso:</p>
        <a href="${qrUrl}" target="_blank" rel="noopener">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}" 
               alt="QR de acceso" style="width: 200px; height: 200px;" />
        </a>
        <p style="font-size: 12px; color: #999; margin-top: 10px;">Presenta este QR en la entrada del evento</p>
        <p style="font-size: 11px; color: #bbb; margin-top: 4px;">o abre <a href="${qrUrl}" style="color: #2563eb;">este enlace</a> desde tu celular</p>
      </div>
    `
    : '';

  // Formatear zone content como HTML si existe
  const instrucciones = zoneContent?.instrucciones_acceso || '';
  const especifica = zoneContent?.info_especifica || '';
  const notas = zoneContent?.notas_importantes || '';

  return {
    nombre: escapeHtml(registration.profile_nombre || ''),
    apellido: escapeHtml(registration.profile_apellido || ''),
    evento: escapeHtml(registration.event_nombre || ''),
    fecha: registration.event_fecha
      ? escapeHtml(new Date(registration.event_fecha).toLocaleDateString('es-CL', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        }))
      : '',
    lugar: escapeHtml(registration.event_venue || ''),
    organizacion: escapeHtml(registration.organizacion || '-'),
    cargo: escapeHtml(registration.cargo || '-'),
    motivo: escapeHtml(motivo || registration.motivo_rechazo || ''),
    tenant: escapeHtml(tenant.nombre),
    zona: escapeHtml(extractZona(registration)),
    area: escapeHtml(registration.tipo_medio || extractField(registration, 'area') || extractField(registration, 'tipo_credencial') || ''),
    qr_section: qrSection,
    instrucciones_acceso: instrucciones,
    info_especifica: especifica,
    notas_importantes: notas,
    info_general: infoGeneral || '',
    ...eventVariables,
  };
}

/* ─── Fallback HTML Templates (hardcoded) ─────────────────────────── */

function fallbackApprovalHtml(registration: RegistrationFull, tenant: Tenant, vars: TemplateVars): string {
  // Sección de zona (si hay zona asignada)
  const zonaSection = vars.zona ? `
    <div style="background: #fef3c7; border-left: 4px solid #e8b543; padding: 15px; margin: 10px 0 20px 0; border-radius: 4px;">
      <p style="margin: 0 0 4px; color: #92400e; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Zona Asignada</p>
      <p style="margin: 0; color: #78350f; font-size: 16px; font-weight: 700;">${vars.zona}</p>
    </div>
  ` : '';

  const areaSection = vars.area ? `
    <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 10px 0 20px 0; border-radius: 4px;">
      <p style="margin: 0 0 4px; color: #0c4a6e; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Área de Acreditación</p>
      <p style="margin: 0; color: #1e40af; font-size: 16px; font-weight: 700;">${vars.area}</p>
    </div>
  ` : '';

  // Sección de instrucciones de acceso por zona
  const instruccionesSection = vars.instrucciones_acceso ? `
    <div style="background: #eff6ff; border-left: 4px solid #1e5799; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px; color: #0c4a6e; font-weight: 600; font-size: 14px;">📋 Instrucciones de Acceso:</p>
      ${vars.instrucciones_acceso}
    </div>
  ` : '';

  // Info específica de la zona
  const infoEspSection = vars.info_especifica ? `
    <div style="background: #f9fafb; border-left: 4px solid #6b7280; padding: 15px; margin: 15px 0; border-radius: 4px;">
      ${vars.info_especifica}
    </div>
  ` : '';

  // Notas importantes (warnings)
  const notasSection = vars.notas_importantes ? `
    <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; border-radius: 4px;">
      ${vars.notas_importantes}
    </div>
  ` : '';

  // Info general (común a todas las zonas)
  const infoGeneralSection = vars.info_general ? `
    <div style="background: #f9fafb; border-left: 4px solid #6b7280; padding: 15px; margin: 15px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px; color: #374151; font-weight: 600; font-size: 14px;">ℹ️ Información General:</p>
      ${vars.info_general}
    </div>
  ` : '';

  return `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
      <div style="background: ${safeColor(tenant.color_primario, '#1a1a2e')}; padding: 30px; text-align: center;">
        ${tenant.logo_url ? `<img src="${safeUrl(tenant.logo_url)}" alt="${escapeHtml(tenant.nombre)}" style="height: 60px;" />` : ''}
        <h1 style="color: ${safeColor(tenant.color_secundario, '#ffffff')}; margin: 10px 0 0;">Acreditación Aprobada</h1>
      </div>
      <div style="padding: 30px; background: #ffffff;">
        <p>Estimado/a <strong>${vars.nombre} ${vars.apellido}</strong>,</p>
        <p>Tu acreditación para el evento <strong>${vars.evento}</strong> ha sido <span style="color: #22c55e; font-weight: bold;">APROBADA</span>.</p>
        
        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Evento:</strong> ${vars.evento}</p>
          ${vars.fecha ? `<p style="margin: 5px 0 0;"><strong>Fecha:</strong> ${vars.fecha}</p>` : ''}
          ${vars.lugar ? `<p style="margin: 5px 0 0;"><strong>Lugar:</strong> ${vars.lugar}</p>` : ''}
          <p style="margin: 5px 0 0;"><strong>Organización:</strong> ${vars.organizacion}</p>
          <p style="margin: 5px 0 0;"><strong>Cargo:</strong> ${vars.cargo}</p>
        </div>

        ${areaSection}
        ${zonaSection}
        ${instruccionesSection}
        ${infoEspSection}
        ${notasSection}
        ${infoGeneralSection}
        ${vars.qr_section}
        
        <p style="color: #666; font-size: 13px;">Este es un correo automático del sistema de acreditaciones.</p>
      </div>
      <div style="background: ${safeColor(tenant.color_dark, '#1a1a2e')}; padding: 15px; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">${vars.tenant} — Sistema de Acreditaciones</p>
      </div>
    </div>
  `;
}

function fallbackRejectionHtml(tenant: Tenant, vars: TemplateVars): string {
  return `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
      <div style="background: ${safeColor(tenant.color_primario, '#1a1a2e')}; padding: 30px; text-align: center;">
        ${tenant.logo_url ? `<img src="${safeUrl(tenant.logo_url)}" alt="${escapeHtml(tenant.nombre)}" style="height: 60px;" />` : ''}
        <h1 style="color: ${safeColor(tenant.color_secundario, '#ffffff')}; margin: 10px 0 0;">Acreditación No Aprobada</h1>
      </div>
      <div style="padding: 30px; background: #ffffff;">
        <p>Estimado/a <strong>${vars.nombre} ${vars.apellido}</strong>,</p>
        <p>Lamentamos informarle que su solicitud de acreditación para el evento <strong>${vars.evento}</strong> no ha sido aprobada.</p>
        
        ${vars.motivo ? `
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Motivo:</strong> ${vars.motivo}</p>
        </div>
        ` : ''}
        
        <p>Si tiene consultas, por favor contacte al organizador del evento.</p>
        <p style="color: #666; font-size: 13px;">Este es un correo automático del sistema de acreditaciones.</p>
      </div>
      <div style="background: ${safeColor(tenant.color_dark, '#1a1a2e')}; padding: 15px; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">${vars.tenant} — Sistema de Acreditaciones</p>
      </div>
    </div>
  `;
}

/* ─── Funciones públicas de envío ─────────────────────────────────── */

/**
 * Enviar email de aprobación con QR (si aplica).
 * Usa plantilla custom de email_templates si existe, si no usa el fallback.
 */
export async function sendApprovalEmail(
  registration: RegistrationFull,
  tenant: Tenant,
  eventVariables?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    const zona = extractZona(registration);
    const [custom, zoneContent, resolvedEventVars] = await Promise.all([
      getCustomTemplate(tenant.id, 'aprobacion'),
      getZoneContent(tenant.id, 'aprobacion', zona),
      eventVariables ? Promise.resolve(eventVariables) : getEventMailVariables(registration.event_id),
    ]);
    const vars = buildVars(registration, tenant, zoneContent, custom?.info_general || null, resolvedEventVars);

    const subject = custom
      ? replaceVars(custom.subject, vars)
      : `✅ Acreditación Aprobada — ${registration.event_nombre}`;

    const html = custom
      ? replaceVars(custom.body_html, vars)
      : fallbackApprovalHtml(registration, tenant, vars);

    const { error } = await resend.emails.send({
      from: getFromEmail(tenant.slug),
      to: registration.profile_email || '',
      subject,
      html,
    });

    if (error) return { success: false, error: error.message };

    await logEmail(registration.id, registration.tenant_id || '', registration.profile_email || '', 'aprobacion', subject);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Enviar email de rechazo.
 * Usa plantilla custom de email_templates si existe, si no usa el fallback.
 */
export async function sendRejectionEmail(
  registration: RegistrationFull,
  tenant: Tenant,
  motivo?: string,
  eventVariables?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    const zona = extractZona(registration);
    const [custom, zoneContent, resolvedEventVars] = await Promise.all([
      getCustomTemplate(tenant.id, 'rechazo'),
      getZoneContent(tenant.id, 'rechazo', zona),
      eventVariables ? Promise.resolve(eventVariables) : getEventMailVariables(registration.event_id),
    ]);
    const vars = buildVars(registration, tenant, zoneContent, custom?.info_general || null, resolvedEventVars, motivo);

    const subject = custom
      ? replaceVars(custom.subject, vars)
      : `Acreditación — ${registration.event_nombre}`;

    const html = custom
      ? replaceVars(custom.body_html, vars)
      : fallbackRejectionHtml(tenant, vars);

    const { error } = await resend.emails.send({
      from: getFromEmail(tenant.slug),
      to: registration.profile_email || '',
      subject,
      html,
    });

    if (error) return { success: false, error: error.message };

    await logEmail(registration.id, registration.tenant_id || '', registration.profile_email || '', 'rechazo', subject);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Enviar emails masivos (bulk) — despacha aprobación o rechazo según status.
 * Solo procesa registros con status aprobado o rechazado.
 */
export async function sendBulkApprovalEmails(
  registrations: RegistrationFull[],
  tenant: Tenant
): Promise<{ sent: number; skipped: number; errors: number }> {
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  const uniqueEventIds = [...new Set(registrations.map(r => r.event_id).filter(Boolean))];
  const eventVarsMap = new Map<string, Record<string, string>>();
  await Promise.all(
    uniqueEventIds.map(async (eventId) => {
      eventVarsMap.set(eventId, await getEventMailVariables(eventId));
    })
  );

  for (const reg of registrations) {
    if (!reg.profile_email) { skipped++; continue; }
    // Solo enviar a estados finales (guard server-side)
    if (reg.status !== 'aprobado' && reg.status !== 'rechazado') { skipped++; continue; }

    const eventVars = eventVarsMap.get(reg.event_id) || {};
    let result: { success: boolean; error?: string };
    if (reg.status === 'rechazado') {
      result = await sendRejectionEmail(reg, tenant, undefined, eventVars);
    } else {
      result = await sendApprovalEmail(reg, tenant, eventVars);
    }
    if (result.success) sent++;
    else errors++;
    
    // Rate limiting: 2 emails por segundo
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { sent, skipped, errors };
}

/**
 * Enviar email de bienvenida con credenciales temporales al admin de un tenant.
 */
export async function sendWelcomeEmail(params: {
  to: string;
  nombre: string;
  tenantName: string;
  tenantSlug: string;
  tempPassword: string;
  loginUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, nombre, tenantName, tempPassword, loginUrl } = params;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #111827; margin-bottom: 8px;">Bienvenido/a, ${escapeHtml(nombre)}</h2>
      <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
        Tu cuenta de administrador para <strong>${escapeHtml(tenantName)}</strong> ha sido creada.
      </p>

      <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <p style="font-size: 13px; color: #374151; margin: 0 0 12px 0;"><strong>Credenciales de acceso:</strong></p>
        <p style="font-size: 14px; color: #111827; margin: 4px 0;">📧 Email: <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${escapeHtml(to)}</code></p>
        <p style="font-size: 14px; color: #111827; margin: 4px 0;">🔑 Contraseña temporal: <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${escapeHtml(tempPassword)}</code></p>
      </div>

      <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
        <p style="font-size: 13px; color: #92400e; margin: 0;">
          ⚠️ <strong>Importante:</strong> Deberás cambiar tu contraseña en tu primer inicio de sesión.
        </p>
      </div>

      <a href="${escapeHtml(loginUrl)}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Iniciar sesión
      </a>

      <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">
        Si no solicitaste esta cuenta, puedes ignorar este email.
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: getFromEmail(params.tenantSlug),
      to,
      subject: `Bienvenido/a a ${tenantName} — Credenciales de acceso`,
      html,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error enviando email' };
  }
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

/**
 * Enviar email de invitación a un evento
 */
export async function sendInvitationEmail({
  to,
  nombre,
  eventName,
  tenantId,
  token,
}: {
  to: string;
  nombre?: string;
  eventName: string;
  tenantId: string;
  token: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Obtener branding del tenant
    const supabase = createSupabaseAdminClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('nombre, slug, color_primario, color_secundario, logo_url')
      .eq('id', tenantId)
      .single();

    const tenantName = tenant?.nombre || 'Organización';
    const tenantSlug = tenant?.slug || '';
    const primaryColor = tenant?.color_primario || '#2563eb';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/${tenantSlug}/acreditacion?invite=${token}`;
    const greeting = nombre ? `Hola ${escapeHtml(nombre)}` : 'Hola';

    const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: ${primaryColor}; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
        ${tenant?.logo_url ? `<img src="${tenant.logo_url}" alt="${escapeHtml(tenantName)}" style="height: 48px; margin-bottom: 12px;" />` : ''}
        <h1 style="color: ${tenant?.color_secundario || '#ffffff'}; font-size: 20px; margin: 0;">
          Invitación a Acreditación
        </h1>
      </div>
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 16px; color: #374151;">${greeting},</p>
        <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
          Has sido invitado/a a acreditarte para el evento <strong style="color: #111827;">${escapeHtml(eventName)}</strong>
          de <strong>${escapeHtml(tenantName)}</strong>.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${inviteUrl}"
             style="display: inline-block; background: ${primaryColor}; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Completar Acreditación
          </a>
        </div>
        <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 24px;">
          Si no esperabas esta invitación, puedes ignorar este mensaje.
        </p>
      </div>
    </div>`;

    await resend.emails.send({
      from: getFromEmail(tenantSlug),
      to,
      subject: `Invitación: ${eventName} — ${tenantName}`,
      html,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error enviando email' };
  }
}
