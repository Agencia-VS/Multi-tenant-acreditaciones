/**
 * Scanner QR Page — Control de acceso en puerta
 * Auth is handled by the (protected) layout.
 */
import { redirect } from 'next/navigation';
import { getTenantBySlug } from '@/lib/services/tenants';
import { getActiveEvent } from '@/lib/services/events';
import { listEventDays } from '@/lib/services/eventDays';
import QRScanner from '@/components/qr/QRScanner';

export default async function ScannerPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) redirect('/');

  // Fetch event days for multidia events
  const event = await getActiveEvent(tenant.id);
  const eventType = event ? (event.event_type || 'simple') : 'simple';
  const eventDays = event && eventType === 'multidia' ? await listEventDays(event.id) : [];

  return <QRScanner backHref={`/${slug}/admin`} eventDays={eventDays} />;
}
