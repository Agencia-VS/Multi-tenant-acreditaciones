import React from "react";
import { TenantProvider } from "../../components/tenant/TenantContext";
import { supabase } from "../../lib/supabase";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}

async function validateTenant(slug: string) {
  try {
    const { data: tenant, error } = await supabase
      .from('mt_tenants')
      .select('*')
      .eq('slug', slug)
      .single();

    console.log('Query result for slug', slug, ':', { data: tenant, error });

    if (error || !tenant) {
      console.log('Tenant not found:', slug);
      return null;
    }

    // Mapear name a nombre si existe
    return { ...tenant, nombre: tenant.nombre || tenant.name };
  } catch (error) {
    console.error('Error validating tenant:', error);
    return null;
  }
}

export default async function TenantLayout({ children, params }: LayoutProps) {
  const { tenant: tenantSlug } = await params;

  // Validar que el tenant existe en la base de datos
  const tenant = await validateTenant(tenantSlug);

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Tenant no encontrado</h1>
          <p className="text-gray-600 mb-4">
            El tenant "{tenantSlug}" no existe en el sistema.
          </p>
          <p className="text-sm text-gray-500">
            Contacta al administrador para crear este tenant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TenantProvider tenant={tenant}>
      {children}
    </TenantProvider>
  );
}
