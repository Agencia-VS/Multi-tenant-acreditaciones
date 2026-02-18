'use client';

/**
 * Admin Login Form — Client Component con diseño glassmorphism
 * Adapta colores y logo al tenant
 */
import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import Image from 'next/image';
import { BackButton, useToast } from '@/components/shared/ui';

interface AdminLoginFormProps {
  tenantSlug: string;
  tenantName: string;
  logoUrl: string | null;
  colorPrimario: string;
  colorSecundario: string;
  colorDark: string;
  colorLight: string;
}

export default function AdminLoginForm({
  tenantSlug,
  tenantName,
  logoUrl,
  colorPrimario,
  colorSecundario,
  colorDark,
  colorLight,
}: AdminLoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { showError } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        const msg = authError.message === 'Invalid login credentials'
          ? 'Credenciales inválidas. Verifica tu email y contraseña.'
          : authError.message;
        setError(msg);
        showError(msg);
        setLoading(false);
        return;
      }

      if (data.session) {
        window.location.href = `/${tenantSlug}/admin`;
      }
    } catch {
      setError('Error al iniciar sesión. Intenta de nuevo.');
      showError('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${colorDark} 0%, ${colorPrimario} 40%, ${colorLight} 100%)`,
      }}
    >
      {/* Decorative blur circles */}
      <div
        className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl opacity-10"
        style={{ backgroundColor: colorSecundario }}
      />
      <div
        className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl opacity-10"
        style={{ backgroundColor: colorLight }}
      />

      {/* Back button */}
      <BackButton href={`/${tenantSlug}`} />

      {/* Login card */}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white shadow-2xl rounded-3xl border border-edge backdrop-blur-xl p-8 sm:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            {/* Logo */}
            {logoUrl && (
              <div className="flex justify-center mb-4">
                <Image
                  src={logoUrl}
                  alt={tenantName}
                  width={80}
                  height={48}
                  className="h-12 w-auto object-contain"
                  priority
                />
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold text-heading">
              Panel de Administración
            </h1>
            <p className="text-body text-sm mt-1">{tenantName}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-label mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ejemplo.com"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-edge text-heading placeholder-muted bg-canvas focus:bg-white disabled:opacity-60 transition-all text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-label mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-12 py-3 rounded-xl border border-edge text-heading placeholder-muted bg-canvas focus:bg-white disabled:opacity-60 transition-all text-sm"
                />
                {/* Toggle password visibility */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-body transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    /* Eye slash — password visible, click to hide */
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    /* Eye open — password hidden, click to show */
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-3 bg-danger-light border border-danger/20 rounded-xl px-4 py-3">
                <svg className="h-5 w-5 text-danger mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-danger-dark">{error}</p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${colorPrimario}, ${colorDark})`,
              }}
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Iniciando sesión...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Iniciar Sesión
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-edge text-center">
            <p className="text-xs text-body">
              Acceso exclusivo para administradores de {tenantName}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
