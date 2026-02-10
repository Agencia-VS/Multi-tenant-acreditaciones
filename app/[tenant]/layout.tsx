/**
 * Tenant Layout — Carga datos del tenant y aplica branding
 */
import { notFound } from 'next/navigation';
import { getTenantBySlug } from '@/lib/services/tenants';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);

  if (!tenant) notFound();

  return (
    <div
      style={{
        '--tenant-primario': tenant.color_primario,
        '--tenant-secundario': tenant.color_secundario,
        '--tenant-light': tenant.color_light,
        '--tenant-dark': tenant.color_dark,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
