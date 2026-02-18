/**
 * Admin Protected Layout — Auth guard centralizado
 * 
 * Verifica autenticación + acceso al tenant una sola vez.
 * Aplica a todas las rutas admin excepto /login.
 */
import { redirect } from 'next/navigation';
import { getTenantBySlug } from '@/lib/services/tenants';
import { getCurrentUser, hasAccessToTenant } from '@/lib/services/auth';

export default async function AdminProtectedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);

  if (!tenant) redirect('/');

  const user = await getCurrentUser();
  if (!user) redirect(`/${slug}/admin/login`);

  const hasAccess = await hasAccessToTenant(user.id, tenant.id);
  if (!hasAccess) redirect(`/${slug}/admin/login`);

  return <>{children}</>;
}
