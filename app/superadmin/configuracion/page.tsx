/**
 * Página de Configuración (SuperAdmin)
 * 
 * Configuraciones globales del sistema y
 * utilidades de administración.
 */

"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { useSuperAdmin } from "../../../components/superadmin";

export default function ConfiguracionPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { user, signOut } = useSuperAdmin();
  const supabase = getSupabaseBrowserClient();

  const handleResetPassword = async () => {
    if (!user?.email) return;

    try {
      setLoading(true);
      
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Se envió un email para cambiar tu contraseña' });
    } catch (err) {
      console.error('Error resetting password:', err);
      setMessage({ type: 'error', text: 'Error al enviar email' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Configuración</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ajustes de la plataforma y tu cuenta
        </p>
      </div>

      {/* Mensaje */}
      {message && (
        <div className={`px-4 py-3 rounded-lg flex items-center justify-between ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-current hover:opacity-70">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Tu Cuenta */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Tu Cuenta</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <div className="text-sm font-medium text-gray-700">Email</div>
              <div className="text-sm text-gray-500">{user?.email || '-'}</div>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <div className="text-sm font-medium text-gray-700">Rol</div>
              <div className="text-sm text-gray-500">SuperAdmin</div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              Full Access
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-medium text-gray-700">Contraseña</div>
              <div className="text-sm text-gray-500">Última actualización desconocida</div>
            </div>
            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="px-4 py-2 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </div>
      </div>

      {/* Información del Sistema */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Sistema</h2>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Versión</span>
            <span className="text-sm font-mono text-gray-900">1.0.0</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Entorno</span>
            <span className="text-sm font-mono text-gray-900">
              {process.env.NODE_ENV || 'development'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Base de datos</span>
            <span className="text-sm font-mono text-gray-900">Supabase</span>
          </div>
        </div>
      </div>

      {/* Integraciones */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Integraciones</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">Resend (Emails)</div>
                <div className="text-sm text-gray-500">Envío de notificaciones</div>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              Activo
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">Cloudinary (Imágenes)</div>
                <div className="text-sm text-gray-500">Almacenamiento de fotos</div>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              Activo
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">Supabase</div>
                <div className="text-sm text-gray-500">Base de datos y autenticación</div>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              Activo
            </span>
          </div>
        </div>
      </div>

      {/* Zona de Peligro */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="text-lg font-medium text-red-700 mb-4">Zona de Peligro</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700">Cerrar sesión</div>
              <div className="text-sm text-gray-500">Salir de tu cuenta de SuperAdmin</div>
            </div>
            <button
              onClick={signOut}
              className="px-4 py-2 text-sm text-red-600 hover:text-white hover:bg-red-600 border border-red-300 rounded-lg font-medium transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 pb-8">
        <p>Sistema de Acreditaciones Multi-tenant</p>
        <p className="mt-1">Desarrollado por Agencia VS</p>
      </div>
    </div>
  );
}
