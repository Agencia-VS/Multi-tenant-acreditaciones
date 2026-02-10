/**
 * Admin Dashboard del Tenant — Server Component que verifica permisos
 */
import { redirect } from 'next/navigation';
import { getTenantBySlug } from '@/lib/services/tenants';
import { getCurrentUser, hasAccessToTenant } from '@/lib/services/auth';
import { AdminDashboardV2 } from '@/components/admin-dashboard';

export default async function TenantAdminPage({
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

  return <AdminDashboardV2 tenantId={tenant.id} tenantSlug={slug} initialTenant={JSON.parse(JSON.stringify(tenant))} />;
}
