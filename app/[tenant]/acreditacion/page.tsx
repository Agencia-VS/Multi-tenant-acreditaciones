/**
 * Formulario de Acreditación del Tenant
 * NO requiere autenticación — cualquier persona puede registrarse.
 * Si el usuario está logueado, se pre-llenan sus datos.
 */
import { getTenantBySlug } from '@/lib/services/tenants';
import { getActiveEvent } from '@/lib/services/events';
import { getCurrentUser } from '@/lib/services/auth';
import { getProfileByUserId } from '@/lib/services/profiles';
import { notFound } from 'next/navigation';
import DynamicRegistrationForm from '@/components/forms/DynamicRegistrationForm';
import Link from 'next/link';
import { isDeadlinePast, formatDeadlineChile } from '@/lib/dates';
import { BackButton } from '@/components/shared/ui';

export default async function AcreditacionPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  // ─── Auth opcional: si hay sesión, pre-llena datos ───
  const user = await getCurrentUser();
  const userProfile = user ? await getProfileByUserId(user.id) : null;

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

  // Verificar fecha límite (timezone Chile)
  const pastDeadline = isDeadlinePast(event.fecha_limite_acreditacion);

  return (
    <main className="min-h-screen bg-canvas">
      {/* Header con branding del tenant */}
      <div
        className="py-4 sm:py-6 px-4 sm:px-6 text-center relative"
        style={{ backgroundColor: tenant.color_primario }}
      >
        <BackButton href={`/${slug}`} />
        <div className="flex flex-col items-center justify-center gap-2 sm:gap-4 pt-8 sm:pt-0">
          {tenant.logo_url && (
            <img src={tenant.logo_url} alt={tenant.nombre} className="h-10 sm:h-12 object-contain" />
          )}
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: tenant.color_secundario }}>
            Acreditación
          </h1>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-4xl mx-auto py-4 sm:py-8 px-3 sm:px-6">
        {pastDeadline ? (
          <div className="text-center py-12">
            <i className="fas fa-lock text-5xl text-danger/40 mb-4" />
            <h2 className="text-2xl font-bold text-label">Plazo Cerrado</h2>
            <p className="text-body mt-2">
              El plazo para solicitar acreditación cerró el{' '}
              {formatDeadlineChile(event.fecha_limite_acreditacion!)}.
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
            bulkEnabled={!!(tenant.config as Record<string, unknown>)?.acreditacion_masiva_enabled}
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
