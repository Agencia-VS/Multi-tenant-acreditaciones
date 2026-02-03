/**
 * Layout para las páginas de autenticación
 * 
 * Proporciona un diseño consistente para todas las páginas de auth.
 */

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Autenticación - Sistema de Acreditaciones",
  description: "Gestión de acceso al sistema de acreditaciones",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
