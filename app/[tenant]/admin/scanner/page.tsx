/**
 * Scanner QR Page — Control de acceso en puerta
 */
import { redirect } from 'next/navigation';
import { getTenantBySlug } from '@/lib/services/tenants';
import { getActiveEvent } from '@/lib/services/events';
import { getCurrentUser, hasAccessToTenant } from '@/lib/services/auth';
import { listEventDays } from '@/lib/services/eventDays';
import QRScanner from '@/components/qr/QRScanner';
import type { EventType } from '@/types';

export default async function ScannerPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) redirect('/');

  const user = await getCurrentUser();
  if (!user) redirect(`/${slug}/admin/login`);

  const hasAccess = await hasAccessToTenant(user.id, tenant.id);
  if (!hasAccess) redirect(`/${slug}/admin/login`);

  // Fetch event days for multidia events
  const event = await getActiveEvent(tenant.id);
  const eventType = event ? (((event as Record<string, unknown>).event_type as EventType) || 'simple') : 'simple';
  const eventDays = event && eventType === 'multidia' ? await listEventDays(event.id) : [];

  return <QRScanner backHref={`/${slug}/admin`} eventDays={eventDays} />;
}
