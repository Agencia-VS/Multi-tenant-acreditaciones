/**
 * Tenant Landing — Server Component
 * Obtiene datos del tenant y eventos activos, delega la UI al client component
 */
import { getTenantBySlug } from '@/lib/services/tenants';
import { getActiveEvents } from '@/lib/services/events';
import { getCurrentUser } from '@/lib/services/auth';
import { getProfileByUserId } from '@/lib/services/profiles';
import { getProviderByTenantAndProfile } from '@/lib/services/providers';
import { notFound } from 'next/navigation';
import TenantLanding from './TenantLanding';

export default async function TenantPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  // ── Provider status para landing (si es approved_only) ──
  let providerStatus: string | null = null;
  const isProviderMode = tenant.config?.provider_mode === 'approved_only';

  if (isProviderMode) {
    const user = await getCurrentUser();
    if (user) {
      const profile = await getProfileByUserId(user.id);
      if (profile) {
        const provider = await getProviderByTenantAndProfile(tenant.id, profile.id);
        providerStatus = provider?.status || null;
      }
    }
  }

  // En provider_mode la landing siempre muestra eventos (el acceso se controla por provider status, no por visibility).
  // Proveedores aprobados ven todo; el resto ve la landing con mensaje de restricción pero los eventos se listan.
  const isApprovedProvider = isProviderMode && providerStatus === 'approved';
  const events = await getActiveEvents(tenant.id, (isProviderMode || isApprovedProvider) ? {} : { publicOnly: true });

  return (
    <TenantLanding
      tenant={tenant}
      events={events}
      slug={slug}
      providerMode={isProviderMode}
      providerStatus={providerStatus}
    />
  );
}
