/**
 * Layout para el panel de Admin del Tenant
 * 
 * Proporciona la estructura base para todas las páginas
 * de administración del tenant.
 */

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin - Panel de Acreditaciones",
  description: "Panel de administración de acreditaciones del tenant",
};

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}

export default async function TenantAdminLayout({
  children,
  params,
}: LayoutProps) {
  // Extraemos params pero no los usamos directamente aquí
  // La verificación de auth se hace en la página con useUserRole
  // porque necesitamos acceso al cliente de Supabase para el estado
  const resolvedParams = await params;
  
  return (
    <div className="min-h-screen bg-gray-100">
      {children}
    </div>
  );
}
