/**
 * Provider Invitation Page — Server Component
 * Ruta: /{tenant-slug}/proveedores?code=X7k9mZ
 *
 * Hereda el layout del tenant (branding via CSS custom properties).
 * Delega la lógica de validación de código al client component.
 */
import { getTenantBySlug } from '@/lib/services/tenants';
import { notFound } from 'next/navigation';
import ProviderInvitePage from './ProviderInvitePage';

export default async function ProviderInviteRoute({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  // Verificar que el tenant tiene proveedores habilitados
  if (tenant.config?.provider_mode !== 'approved_only') {
    notFound();
  }

  return (
    <ProviderInvitePage
      tenantId={tenant.id}
      tenantSlug={slug}
      tenantNombre={tenant.nombre}
      tenantLogo={tenant.logo_url}
      tenantDescription={tenant.config?.provider_description}
      colorPrimario={tenant.color_primario}
    />
  );
}
