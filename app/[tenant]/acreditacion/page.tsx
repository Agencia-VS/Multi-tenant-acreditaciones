/**
 * Formulario de Acreditación del Tenant
 * REQUIERE AUTENTICACIÓN — redirige a login si no hay sesión.
 * Carga evento activo y renderiza el formulario dinámico con 3 opciones.
 */
import { getTenantBySlug } from '@/lib/services/tenants';
import { getActiveEvent } from '@/lib/services/events';
import { getCurrentUser } from '@/lib/services/auth';
import { getProfileByUserId } from '@/lib/services/profiles';
import { notFound, redirect } from 'next/navigation';
import DynamicRegistrationForm from '@/components/forms/DynamicRegistrationForm';
import Link from 'next/link';
import { isDeadlinePast, formatDeadlineChile } from '@/lib/dates';

export default async function AcreditacionPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  // ─── Auth Gate: redirige a login si no autenticado ───
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/acreditado?returnTo=/${slug}/acreditacion`);
  }

  // Cargar perfil del usuario
  const userProfile = await getProfileByUserId(user.id);

  const event = await getActiveEvent(tenant.id);

  if (!event) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <i className="fas fa-calendar-times text-5xl text-gray-300 mb-4" />
          <h1 className="text-2xl font-bold text-gray-700">No hay eventos activos</h1>
          <p className="text-gray-500 mt-2">No hay acreditación disponible en este momento.</p>
          <Link href={`/${slug}`} className="mt-4 inline-block text-blue-600 hover:underline">
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  // Verificar fecha límite (timezone Chile)
  const pastDeadline = isDeadlinePast(event.fecha_limite_acreditacion);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header con branding del tenant */}
      <div
        className="py-6 px-6 text-center"
        style={{ backgroundColor: tenant.color_primario }}
      >
        <div className="flex items-center justify-center gap-4">
          {tenant.logo_url && (
            <img src={tenant.logo_url} alt={tenant.nombre} className="h-12 object-contain" />
          )}
          <h1 className="text-2xl font-bold" style={{ color: tenant.color_secundario }}>
            Acreditación de Prensa
          </h1>
        </div>
        <p className="text-white/70 text-sm mt-1">{event.nombre}</p>
      </div>

      {/* Contenido */}
      <div className="max-w-4xl mx-auto py-8 px-6">
        {pastDeadline ? (
          <div className="text-center py-12">
            <i className="fas fa-lock text-5xl text-red-300 mb-4" />
            <h2 className="text-2xl font-bold text-gray-700">Plazo Cerrado</h2>
            <p className="text-gray-500 mt-2">
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
