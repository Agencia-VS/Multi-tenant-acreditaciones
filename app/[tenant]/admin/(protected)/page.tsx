/**
 * Admin Dashboard del Tenant
 * Auth is handled by the (protected) layout.
 */
import { redirect } from 'next/navigation';
import { getTenantBySlug } from '@/lib/services/tenants';
import { AdminDashboardV2 } from '@/components/admin-dashboard';

export default async function TenantAdminPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);

  if (!tenant) redirect('/');

  return <AdminDashboardV2 tenantId={tenant.id} tenantSlug={slug} initialTenant={JSON.parse(JSON.stringify(tenant))} />;
}
