/**
 * SuperAdmin Dashboard Layout — Protegido con auth
 * Solo superadmins autenticados pueden acceder a estas rutas.
 */
import { redirect } from 'next/navigation';
import { getCurrentUser, isSuperAdmin } from '@/lib/services/auth';
import SuperAdminLayoutClient from './layout-client';

export default async function SuperAdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/superadmin/login');

  const isSuper = await isSuperAdmin(user.id);
  if (!isSuper) redirect('/superadmin/login');

  return <SuperAdminLayoutClient>{children}</SuperAdminLayoutClient>;
}
