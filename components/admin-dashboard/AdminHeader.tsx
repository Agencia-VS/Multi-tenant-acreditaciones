/**
 * Header del panel de administración
 * 
 * Muestra el logo, título y botón de logout.
 */

"use client";

import Image from "next/image";

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
}

// ============================================================================
// COMPONENTE
// ============================================================================

export default function AdminHeader({
  userEmail,
  isLoggingOut,
  onLogout,
}: AdminHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
      <div className="flex items-center gap-6">
        <Image
          src="/UCimg/LogoUC.png"
          alt="Logo UC"
          width={80}
          height={80}
          className="h-auto"
        />
        <div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">
            Panel de Administración
          </h1>
          <p className="text-white/90 text-sm mt-1 font-medium">
            Sistema de Acreditaciones prensa UC
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-white/70 text-xs">Administrador</p>
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
