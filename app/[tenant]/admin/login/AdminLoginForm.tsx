'use client';

/**
 * Admin Login Form — Wise Design Foundations
 *
 * Consistente con TenantLanding:
 *   - Fondo oscuro multicapa (forest + orbs + grain + vignette)
 *   - Tarjeta glassmorphism oscura
 *   - Motion tokens (snappy, fluid)
 *   - Paleta semántica via generateTenantPalette
 */
import { useState, useMemo } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import Image from 'next/image';
import { BackButton, useToast, ButtonSpinner } from '@/components/shared/ui';
import { shouldForcePasswordChange, getForceChangeRedirectUrl } from '@/lib/services/passwordPolicy';
import { generateTenantPalette } from '@/lib/colors';

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
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { showError, showSuccess } = useToast();

  const p = useMemo(() => generateTenantPalette(
    colorPrimario,
    colorSecundario,
    colorLight,
    colorDark,
  ), [colorPrimario, colorSecundario, colorLight, colorDark]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
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
        if (shouldForcePasswordChange(data.user)) {
          window.location.href = getForceChangeRedirectUrl(
            window.location.origin,
            `/${tenantSlug}/admin`
          );
          return;
        }
        window.location.href = `/${tenantSlug}/admin`;
      }
    } catch {
      setError('Error al iniciar sesión. Intenta de nuevo.');
      showError('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Ingresa tu email para recuperar la contraseña');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    const supabase = getSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery&next=/${tenantSlug}/admin`,
    });
    if (resetError) {
      setError(resetError.message);
      showError(resetError.message);
    } else {
      setSuccess('Se envió un enlace de recuperación a tu email.');
      showSuccess('Email de recuperación enviado');
    }
    setLoading(false);
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden dark-surface"
      style={{ background: p.forest }}
    >
      {/* ── Background layers (matching TenantLanding) ── */}

      {/* Orb 1 — bright accent, top-right (the "pop") */}
      <div
        className="absolute orb-drift-1 pointer-events-none"
        style={{
          top: '-8%',
          right: '-5%',
          width: '55%',
          height: '55%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${p.bright}14 0%, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />

      {/* Orb 2 — primario, center-left */}
      <div
        className="absolute orb-drift-2 pointer-events-none"
        style={{
          bottom: '5%',
          left: '-10%',
          width: '50%',
          height: '60%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colorPrimario}18 0%, transparent 65%)`,
          filter: 'blur(100px)',
        }}
      />

      {/* Orb 3 — secondary, subtle mid-right warmth */}
      <div
        className="absolute orb-drift-3 pointer-events-none"
        style={{
          top: '40%',
          right: '10%',
          width: '30%',
          height: '35%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colorSecundario}0C 0%, transparent 60%)`,
          filter: 'blur(90px)',
        }}
      />

      {/* Diagonal accent lines */}
      <div
        className="diagonal-accent"
        style={{ '--accent-line-color': `${p.bright}0A` } as React.CSSProperties}
      />

      {/* Grain texture */}
      <div className="absolute inset-0 grain-overlay" />

      {/* Bottom vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 100% 60% at 50% 100%, ${p.forest}C0 0%, transparent 70%)`,
        }}
      />

      {/* Ambient glow */}
      <div
        className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full blur-[160px] pointer-events-none"
        style={{ background: `${p.bright}06` }}
      />

      {/* Back button */}
      <BackButton href={`/${tenantSlug}`} />

      {/* ── Login card — white surface ── */}
      <div className="w-full max-w-md relative z-10 opacity-0 animate-fade-in">
        <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-2xl border border-white/20">
          {/* Header */}
          <div className="text-center mb-8">
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
            <p className="text-sm text-body mt-1">{tenantName}</p>
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
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-edge text-heading placeholder-muted bg-canvas focus:bg-white disabled:opacity-60 transition-snappy text-sm"
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
                  className="w-full pl-10 pr-12 py-3 rounded-xl border border-edge text-heading placeholder-muted bg-canvas focus:bg-white disabled:opacity-60 transition-snappy text-sm"
                />
                {/* Toggle password visibility */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-body transition-snappy"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
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
            {success && (
              <div className="flex items-start gap-3 bg-success-light border border-success/20 rounded-xl px-4 py-3">
                <svg className="h-5 w-5 text-success mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-success-dark">{success}</p>
              </div>
            )}

            {/* Submit button — matching TenantLanding CTA */}
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-2xl py-3.5 font-bold shadow-2xl transition-snappy hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2 cursor-pointer"
              style={{
                background: p.ctaBg,
                border: `1px solid ${p.ctaBorder}50`,
                color: p.ctaText,
                boxShadow: `0 8px 32px ${p.forest}60`,
              }}
            >
              {/* Hover fill layer */}
              <span
                className="absolute inset-0 translate-y-full group-hover:translate-y-0 transition-fluid"
                style={{ background: p.ctaHoverBg }}
              />
              <span className="relative flex items-center gap-2">
                {loading ? (
                  <>
                    <ButtonSpinner />
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
              </span>
            </button>
          </form>

          {/* Forgot password */}
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="text-xs font-medium transition-snappy hover:underline disabled:opacity-50"
              style={{ color: colorPrimario }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

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
