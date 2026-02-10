/**
 * Admin Login del Tenant — Server Component
 * Obtiene datos del tenant y renderiza el formulario con branding
 */
import { getTenantBySlug } from '@/lib/services/tenants';
import { notFound } from 'next/navigation';
import AdminLoginForm from './AdminLoginForm';

export default async function TenantAdminLoginPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  return (
    <AdminLoginForm
      tenantSlug={slug}
      tenantName={tenant.nombre}
      logoUrl={tenant.logo_url || tenant.shield_url || null}
      colorPrimario={tenant.color_primario}
      colorSecundario={tenant.color_secundario}
      colorDark={tenant.color_dark}
      colorLight={tenant.color_light}
    />
  );
}
