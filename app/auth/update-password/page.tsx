/**
 * Página de Actualizar Contraseña
 * 
 * El usuario llega aquí desde el link enviado por email.
 * Permite establecer una nueva contraseña.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  // Verificar que el usuario llegó desde un link de recuperación válido
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // El usuario debe tener una sesión activa (el link de Supabase la crea automáticamente)
      setIsValidSession(!!session);
    };

    checkSession();

    // Escuchar cambios de autenticación (cuando el usuario llega desde el link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const validatePassword = (pass: string): string | null => {
    if (pass.length < 8) {
      return "La contraseña debe tener al menos 8 caracteres";
    }
    if (!/[A-Z]/.test(pass)) {
      return "La contraseña debe incluir al menos una mayúscula";
    }
    if (!/[a-z]/.test(pass)) {
      return "La contraseña debe incluir al menos una minúscula";
    }
    if (!/[0-9]/.test(pass)) {
      return "La contraseña debe incluir al menos un número";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    // Validar contraseñas
    const validationError = validatePassword(password);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden" });
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setMessage({
          type: "error",
          text: error.message === "New password should be different from the old password."
            ? "La nueva contraseña debe ser diferente a la anterior."
            : error.message,
        });
        return;
      }

      setMessage({
        type: "success",
        text: "¡Contraseña actualizada exitosamente! Redirigiendo...",
      });

      // Redirigir después de 2 segundos
      setTimeout(() => {
        router.push("/");
      }, 2000);

    } catch {
      setMessage({
        type: "error",
        text: "Error al actualizar la contraseña. Intenta de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mostrar loading mientras verificamos la sesión
  if (isValidSession === null) {
    return (
      <main className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Verificando enlace...</p>
        </div>
      </main>
    );
  }

  // Si no hay sesión válida
  if (!isValidSession) {
    return (
      <main className="min-h-screen w-full flex items-center justify-center px-4 py-10 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Enlace inválido o expirado
            </h1>
            <p className="text-gray-500 mb-6">
              Este enlace de recuperación ya no es válido. Por favor solicita uno nuevo desde la página de inicio de sesión.
            </p>
            <Link
              href="/superadmin/login"
              className="inline-block py-3 px-6 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all"
            >
              Ir al Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center px-4 py-10 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Decoración de fondo */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-96 h-96 bg-green-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10">
          {/* Icono */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
          </div>

          {/* Título */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
              Nueva contraseña
            </h1>
            <p className="text-gray-500 text-sm">
              Ingresa tu nueva contraseña
            </p>
          </div>

          {/* Mensaje de estado */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-lg text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nueva contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nueva Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  className="w-full rounded-xl border border-gray-300 pl-10 pr-12 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Mínimo 8 caracteres, una mayúscula, una minúscula y un número
              </p>
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <input
                  className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Botón Guardar */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:from-green-700 hover:to-green-800 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    ></path>
                  </svg>
                  Guardando...
                </span>
              ) : (
                "Actualizar contraseña"
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
