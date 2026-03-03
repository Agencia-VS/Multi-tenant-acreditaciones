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

  // Proveedores aprobados pueden ver eventos invite_only (ya están autorizados a nivel tenant)
  const isApprovedProvider = isProviderMode && providerStatus === 'approved';
  const events = await getActiveEvents(tenant.id, isApprovedProvider ? {} : { publicOnly: true });

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
