/**
 * Layout para el panel de SuperAdmin
 * 
 * Proporciona la estructura base con sidebar y verificación de permisos
 * para todas las páginas de superadmin.
 */

import { Metadata } from "next";
import { SuperAdminLayoutClient } from "./layout-client";

export const metadata: Metadata = {
  title: "Super Admin - Accredia",
  description: "Panel de administración global del sistema de acreditaciones",
};

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SuperAdminLayoutClient>{children}</SuperAdminLayoutClient>;
}
