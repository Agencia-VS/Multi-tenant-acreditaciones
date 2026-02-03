/**
 * Página de Acceso Denegado
 * 
 * Se muestra cuando un usuario intenta acceder a una ruta
 * para la cual no tiene permisos.
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";

export default function AccessDeniedPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center px-4 py-10 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Decoración de fondo */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-96 h-96 bg-red-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-500 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10 text-center">
          {/* Icono */}
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>

          {/* Título */}
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">
            Acceso Denegado
          </h1>

          {/* Mensaje */}
          <p className="text-gray-500 mb-6">
            No tienes permisos para acceder a esta página. 
            Si crees que esto es un error, contacta al administrador.
          </p>

          {/* Código de error */}
          <div className="bg-gray-100 rounded-lg py-3 px-4 mb-6">
            <p className="text-sm text-gray-600 font-mono">
              Error 403 - Forbidden
            </p>
          </div>

          {/* Acciones */}
          <div className="space-y-3">
            <Link
              href="/"
              className="block w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all"
            >
              Ir al inicio
            </Link>
            
            <button
              onClick={handleLogout}
              className="block w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
            >
              Cerrar sesión
            </button>
          </div>

          {/* Información adicional */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-400">
              Si necesitas acceso, solicítalo al administrador de tu organización.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
