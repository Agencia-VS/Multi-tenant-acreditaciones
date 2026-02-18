/**
 * Tenant Landing — Server Component
 * Obtiene datos del tenant y evento activo, delega la UI al client component
 */
import { getTenantBySlug } from '@/lib/services/tenants';
import { getActiveEvent } from '@/lib/services/events';
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

  return <TenantLanding tenant={tenant} event={event} slug={slug} />;
}
