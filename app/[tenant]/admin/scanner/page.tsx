/**
 * Scanner QR Page — Control de acceso en puerta
 */
import { redirect } from 'next/navigation';
import { getTenantBySlug } from '@/lib/services/tenants';
import { getCurrentUser, hasAccessToTenant } from '@/lib/services/auth';
import QRScanner from '@/components/qr/QRScanner';

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

  return <QRScanner />;
}
