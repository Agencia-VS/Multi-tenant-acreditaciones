/**
 * Header del panel de administración
 * 
 * Muestra el logo, título, rol del usuario y botón de logout.
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import { useTenant } from "../tenant/TenantContext";

// ============================================================================
// TIPOS
// ============================================================================

export interface AdminHeaderProps {
  /** Email del usuario actual */
  userEmail?: string;
  /** Si está cerrando sesión */
  isLoggingOut: boolean;
  /** Callback para cerrar sesión */
  onLogout: () => void;
  /** Rol del usuario actual */
  userRole?: 'superadmin' | 'admin' | 'editor' | 'lector' | null;
}

// ============================================================================
// HELPERS
// ============================================================================

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  superadmin: { label: "Super Admin", color: "bg-purple-500" },
  admin: { label: "Administrador", color: "bg-blue-500" },
  editor: { label: "Editor", color: "bg-green-500" },
  lector: { label: "Lector", color: "bg-gray-500" },
};

// ============================================================================
// COMPONENTE
// ============================================================================

export default function AdminHeader({
  userEmail,
  isLoggingOut,
  onLogout,
  userRole,
}: AdminHeaderProps) {
  const { tenant } = useTenant();
  
  const roleInfo = userRole ? ROLE_LABELS[userRole] : null;

  return (
    <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
      <div className="flex items-center gap-6">
        {/* Botón Volver */}
        <Link
          href={`/${tenant.slug}`}
          className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur rounded-xl text-white transition-all hover:scale-105 active:scale-95"
          title="Volver al evento"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        
        {tenant.shield_url || tenant.logo_url ? (
          <Image
            src={tenant.shield_url || tenant.logo_url || "/UCimg/LogoUC.png"}
            alt={`Logo ${tenant.nombre}`}
            width={80}
            height={80}
            className="h-auto"
          />
        ) : (
          <div className="w-20 h-20 bg-white/10 rounded-lg flex items-center justify-center">
            <span className="text-white text-2xl font-bold">
              {tenant.nombre?.charAt(0) || "?"}
            </span>
          </div>
        )}
        <div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">
            Panel de Administración
          </h1>
          <p className="text-white/90 text-sm mt-1 font-medium">
            Sistema de Acreditaciones - {tenant.nombre}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          {roleInfo && (
            <span className={`inline-block px-2 py-0.5 ${roleInfo.color} text-white text-xs rounded-full mb-1`}>
              {roleInfo.label}
            </span>
          )}
          <p className="text-white font-medium text-sm">{userEmail}</p>
        </div>
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoggingOut ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Cerrando...
            </>
          ) : (
            "Cerrar Sesión"
          )}
        </button>
      </div>
    </div>
  );
}
