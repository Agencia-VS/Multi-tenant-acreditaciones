/**
 * Formulario de Acreditación del Tenant
 * NO requiere autenticación — cualquier persona puede registrarse.
 * Si el usuario está logueado, se pre-llenan sus datos.
 *
 * Visibilidad:
 * - public      → acceso libre
 * - invite_only → requiere ?invite=<token> que coincida con event.invite_token
 */
import { getTenantBySlug } from '@/lib/services/tenants';
import { getActiveEvent } from '@/lib/services/events';
import { getCurrentUser } from '@/lib/services/auth';
import { getProfileByUserId } from '@/lib/services/profiles';
import { isSuperAdmin, isTenantAdmin } from '@/lib/services/auth';
import { listEventDays } from '@/lib/services/eventDays';
import { notFound } from 'next/navigation';
import { RegistrationWizard as DynamicRegistrationForm } from '@/components/forms/registration';
import Link from 'next/link';
import Image from 'next/image';
import { isAccreditationClosed } from '@/lib/dates';
import { BackButton } from '@/components/shared/ui';

export default async function AcreditacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { tenant: slug } = await params;
  const { invite: inviteToken } = await searchParams;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  // ─── Auth opcional: si hay sesión de ACREDITADO, pre-llena datos ───
  // Superadmins y tenant admins NO deben pre-llenar — la acreditación es solo para acreditados.
  const user = await getCurrentUser();
  let userProfile = null;
  if (user) {
    const [isSuper, isAdmin] = await Promise.all([
      isSuperAdmin(user.id),
      isTenantAdmin(user.id, tenant.id),
    ]);
    // Solo pre-llenar si NO es admin ni superadmin (es un acreditado real)
    if (!isSuper && !isAdmin) {
      userProfile = await getProfileByUserId(user.id);
    }
  }

  const event = await getActiveEvent(tenant.id);

  if (!event) {
    return (
      <main className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="text-center">
          <i className="fas fa-calendar-times text-5xl text-edge mb-4" />
          <h1 className="text-2xl font-bold text-label">No hay eventos activos</h1>
          <p className="text-body mt-2">No hay acreditación disponible en este momento.</p>
          <Link href={`/${slug}`} className="mt-4 inline-block text-brand hover:underline">
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  // ─── Verificar visibilidad del evento ───
  const visibility = event.visibility || 'public';

  // Evento por invitación: validar que el token del URL coincida con el del evento
  if (visibility === 'invite_only') {
    const eventToken = event.invite_token;
    if (!inviteToken || inviteToken !== eventToken) {
      return (
        <main className="min-h-screen bg-canvas flex items-center justify-center p-6">
          <div className="text-center">
            <i className="fas fa-envelope text-5xl text-edge mb-4" />
            <h1 className="text-2xl font-bold text-label">Evento por Invitación</h1>
            <p className="text-body mt-2">
              {!inviteToken
                ? 'Necesitas un link de invitación para acceder a este evento.'
                : 'El link de invitación no es válido o ha expirado.'}
            </p>
            <Link href={`/${slug}`} className="mt-4 inline-block text-brand hover:underline">
              Volver al inicio
            </Link>
          </div>
        </main>
      );
    }
  }

  // Verificar si la acreditación está cerrada (override manual + fecha límite)
  const eventConfig = event.config ?? {};
  const disclaimerConfig = eventConfig.disclaimer as import('@/types').DisclaimerConfig | undefined;
  const eventZonas: string[] = (eventConfig as import('@/types').EventConfig).zonas || [];
  const zonaEnFormulario = !!(eventConfig as import('@/types').EventConfig).zona_en_formulario;
  const { closed: pastDeadline, reason: closedReason } = isAccreditationClosed(
    eventConfig,
    event.fecha_limite_acreditacion
  );

  // ─── Multi-día: obtener jornadas del evento ───
  const eventType = event.event_type || 'simple';
  const eventDays = eventType === 'multidia' ? await listEventDays(event.id) : [];

  return (
    <main className="min-h-screen bg-canvas">
      {/* Header — Wise: forest anchors, bright is strategic */}
      <div
        className="relative py-5 sm:py-8 px-4 sm:px-6 text-center overflow-hidden"
        style={{ backgroundColor: tenant.color_dark }}
      >
        {/* Subtle brand glow */}
        <div
          className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 80% 50%, ${tenant.color_primario}18 0%, transparent 70%)`,
          }}
        />
        <BackButton href={`/${slug}`} />
        <div className="relative flex flex-col items-center justify-center gap-3 pt-8 sm:pt-0">
          {tenant.shield_url && (
            <Image src={tenant.shield_url} alt={tenant.nombre}  width={80} height={48} className="h-10 sm:h-12 w-auto object-contain opacity-90" />
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Acreditación
            </h1>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-4xl mx-auto py-4 sm:py-8 px-3 sm:px-6">
        {pastDeadline ? (
          <div className="text-center py-12">
            <i className="fas fa-lock text-5xl text-danger/40 mb-4" />
            <h2 className="text-2xl font-bold text-label">Acreditación Cerrada</h2>
            <p className="text-body mt-2">
              {closedReason || 'La acreditación no está disponible en este momento.'}
            </p>
          </div>
        ) : (
          <DynamicRegistrationForm
            eventId={event.id}
            eventName={event.nombre}
            formFields={event.form_fields || []}
            tenantColors={{
              primario: tenant.color_primario,
              secundario: tenant.color_secundario,
            }}
            tenantSlug={slug}
            tenantId={tenant.id}
            tenantName={tenant.nombre}
            eventFecha={event.fecha}
            eventVenue={event.venue}
            fechaLimite={event.fecha_limite_acreditacion}
            bulkEnabled={!!tenant.config?.acreditacion_masiva_enabled}
            eventType={eventType}
            eventDays={eventDays}
            disclaimerConfig={disclaimerConfig}
            eventZonas={zonaEnFormulario ? eventZonas : []}
            userProfile={userProfile ? {
              id: userProfile.id,
              rut: userProfile.rut,
              nombre: userProfile.nombre,
              apellido: userProfile.apellido,
              email: userProfile.email,
              telefono: userProfile.telefono,
              cargo: userProfile.cargo,
              medio: userProfile.medio,
              tipo_medio: userProfile.tipo_medio,
              foto_url: userProfile.foto_url,
              datos_base: userProfile.datos_base,
            } : null}
          />
        )}
      </div>
    </main>
  );
}
