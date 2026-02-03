/**
 * Layout Client Component para SuperAdmin
 * 
 * Maneja el contexto y el sidebar del panel.
 */

"use client";

import { usePathname } from "next/navigation";
import { SuperAdminProvider, SuperAdminSidebar, useSuperAdmin } from "../../components/superadmin";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading, isAuthenticated } = useSuperAdmin();
  
  // No mostrar layout en login
  const isLoginPage = pathname === '/superadmin/login';
  
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  // No autenticado
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SuperAdminSidebar />
      <main className="pl-64">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export function SuperAdminLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <SuperAdminProvider>
      <LayoutContent>{children}</LayoutContent>
    </SuperAdminProvider>
  );
}
