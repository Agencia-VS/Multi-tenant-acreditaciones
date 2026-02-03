/**
 * Modal de Recuperación de Contraseña
 * 
 * Componente reutilizable para todos los formularios de login:
 * - SuperAdmin
 * - Admin Tenant
 * - Acreditados (futuro)
 */

"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Email pre-llenado desde el formulario de login */
  defaultEmail?: string;
}

export function ForgotPasswordModal({ isOpen, onClose, defaultEmail = "" }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const supabase = getSupabaseBrowserClient();

  // Actualizar email cuando cambia el defaultEmail
  if (isOpen && defaultEmail && email !== defaultEmail && !message) {
    setEmail(defaultEmail);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ 
          type: 'success', 
          text: 'Se ha enviado un enlace de recuperación a tu correo.' 
        });
        // Cerrar modal después de 3 segundos
        setTimeout(() => {
          handleClose();
        }, 3000);
      }
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Error al enviar el correo' 
      });
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      setEmail("");
      setMessage(null);
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8">
        {/* Botón cerrar */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          disabled={loading}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icono */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center">
            <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        {/* Título */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            Recuperar Contraseña
          </h2>
          <p className="text-sm text-gray-500">
            Te enviaremos un enlace para restablecer tu contraseña
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Correo Electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                disabled={loading}
                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-gray-900"
              />
            </div>
          </div>

          {/* Mensaje */}
          {message && (
            <div className={`px-4 py-3 rounded-lg flex items-start gap-2 ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {message.type === 'success' ? (
                <svg className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className="text-sm">{message.text}</span>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Enviando...
                </>
              ) : (
                "Enviar enlace"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
