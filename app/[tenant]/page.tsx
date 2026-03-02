/**
 * Tenant Landing — Server Component
 * Obtiene datos del tenant y evento activo, delega la UI al client component
 */
import { getTenantBySlug } from '@/lib/services/tenants';
import { getActiveEvent } from '@/lib/services/events';
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

  const event = await getActiveEvent(tenant.id, { publicOnly: true });

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

  return (
    <TenantLanding
      tenant={tenant}
      event={event}
      slug={slug}
      providerMode={isProviderMode}
      providerStatus={providerStatus}
    />
  );
}
