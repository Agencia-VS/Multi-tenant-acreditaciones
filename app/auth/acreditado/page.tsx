'use client';

/**
 * Login / Registro de Acreditado (Manager/User)
 * Se autentica con email+password, linkea a un perfil por RUT.
 * Smooth animated tab transition between Login ↔ Register.
 */
import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { BackButton, useToast, LoadingSpinner, ButtonSpinner } from '@/components/shared/ui';

export default function AcreditadoAuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    }>
      <AcreditadoAuthContent />
    </Suspense>
  );
}

function AcreditadoAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const urlError = searchParams.get('error');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const { showSuccess, showError } = useToast();

  const supabase = getSupabaseBrowserClient();

  // Auto-redirect si ya hay sesión activa
  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        window.location.href = returnTo || '/acreditado';
      } else if (urlError) {
        // Solo mostrar error de URL si el usuario no tiene sesión
        setError('La sesión expiró o hubo un error de autenticación. Intenta de nuevo.');
        // Limpiar el param del URL sin recargar la página
        window.history.replaceState({}, '', '/auth/acreditado');
      }
    };
    checkSession();
  }, []);

  const switchMode = (newMode: 'login' | 'register') => {
    if (newMode === mode) return;
    setError('');
    setSuccess('');
    setTransitioning(true);
    // Fade out → switch → fade in
    setTimeout(() => {
      setMode(newMode);
      setTimeout(() => setTransitioning(false), 20);
    }, 150);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (authError) {
      // Mostrar error real de Supabase (puede ser "Email not confirmed", etc.)
      const msg = authError.message.includes('Email not confirmed')
        ? 'Tu email no ha sido confirmado. Revisa tu bandeja de entrada.'
        : authError.message.includes('Invalid login')
          ? 'Credenciales inválidas. Verifica tu email y contraseña.'
          : authError.message;
      setError(msg);
      showError(msg);
      setLoading(false);
      return;
    }

    // Asegurar que exista perfil vinculado al usuario
    try {
      const checkRes = await fetch('/api/profiles/lookup');
      const checkData = await checkRes.json();
      if (!checkData.found) {
        // Crear perfil mínimo sin RUT (se completa después en /acreditado/perfil)
        const meta = authData.user?.user_metadata;
        await fetch('/api/profiles/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: meta?.nombre || meta?.full_name?.split(' ')[0] || '',
            apellido: meta?.apellido || meta?.full_name?.split(' ').slice(1).join(' ') || '',
            email: authData.user?.email || '',
          }),
        });
      }
    } catch { /* ignore — perfil se creará luego */ }

    setLoading(false);
    // Hard redirect para que el Server Component del layout vea las cookies de sesión
    window.location.href = returnTo || '/acreditado';
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (authError) {
      setError(authError.message);
      showError(authError.message);
      setLoading(false);
      return;
    }

    if (authData.session) {
      // Auto-confirm habilitado: crear perfil mínimo inmediatamente
      await fetch('/api/profiles/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
        }),
      });
      // Hard redirect para que el Server Component del layout vea las cookies
      window.location.href = returnTo || '/acreditado';
    } else {
      // Email confirmation requerido
      setSuccess('Cuenta creada. Revisa tu email para confirmarla.');
      showSuccess('Cuenta creada. Revisa tu email para confirmarla.');
    }

    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!form.email.trim()) {
      setError('Ingresa tu email para recuperar la contraseña');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    if (resetError) {
      setError(resetError.message);
      showError(resetError.message);
    } else {
      setSuccess('Se envió un enlace de recuperación a tu email. Revisa tu bandeja de entrada.');
      showSuccess('Email de recuperación enviado');
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Usar el API route (server-side) para el code exchange — más confiable que el page callback
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(returnTo || '/acreditado')}`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      showError(oauthError.message);
      setLoading(false);
    }
    // Si no hay error, el usuario es redirigido a Google
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-field-border bg-canvas text-heading placeholder-muted text-sm transition-snappy';

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center p-4 sm:p-6 relative dark-surface">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-brand/8 blur-[120px]" />
      </div>

      <BackButton href="/" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-10 group opacity-0 animate-fade-in">
          <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center group-hover:bg-brand/30 transition-snappy">
            <i className="fas fa-id-badge text-accent text-lg" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">Accredia</span>
        </Link>

        {/* Card */}
        <div className="bg-surface rounded-2xl shadow-2xl shadow-black/20 overflow-hidden opacity-0 animate-fade-in-delay-1">
          {/* Tab switcher — pill style */}
          <div className="px-5 pt-6 sm:px-8 sm:pt-8 pb-0">
            <div className="flex bg-subtle rounded-xl p-1 relative">
              {/* Sliding indicator */}
              <div
                className="absolute top-1 bottom-1 rounded-lg bg-surface shadow-sm transition-all"
                style={{
                  width: 'calc(50% - 4px)',
                  left: mode === 'login' ? '4px' : 'calc(50% + 0px)',
                  transitionDuration: 'var(--duration-intuitive)',
                  transitionTimingFunction: 'var(--ease-intuitive)',
                }}
              />
              <button
                onClick={() => switchMode('login')}
                className={`relative z-10 flex-1 py-2.5 rounded-lg text-sm font-semibold transition-snappy ${
                  mode === 'login' ? 'text-heading' : 'text-muted hover:text-body'
                }`}
              >
                Iniciar sesión
              </button>
              <button
                onClick={() => switchMode('register')}
                className={`relative z-10 flex-1 py-2.5 rounded-lg text-sm font-semibold transition-snappy ${
                  mode === 'register' ? 'text-heading' : 'text-muted hover:text-body'
                }`}
              >
                Crear cuenta
              </button>
            </div>
          </div>

          {/* Form area with smooth transition */}
          <div className="px-5 pt-5 pb-6 sm:px-8 sm:pt-6 sm:pb-8">
            {/* Alerts */}
            {error && (
              <div className="flex items-start gap-2.5 bg-danger-light border border-danger/15 rounded-xl px-4 py-3 mb-5 animate-fade-in">
                <i className="fas fa-circle-exclamation text-danger mt-0.5 text-sm" />
                <p className="text-sm text-danger-dark">{error}</p>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-2.5 bg-success-light border border-success/15 rounded-xl px-4 py-3 mb-5 animate-fade-in">
                <i className="fas fa-circle-check text-success mt-0.5 text-sm" />
                <p className="text-sm text-success-dark">{success}</p>
              </div>
            )}

            {/* Form content — crossfade */}
            <div
              ref={formRef}
              className="transition-all"
              style={{
                opacity: transitioning ? 0 : 1,
                transform: transitioning ? 'translateY(8px)' : 'translateY(0)',
                transitionDuration: '150ms',
                transitionTimingFunction: 'var(--ease-fluid)',
              }}
            >
              {mode === 'login' ? (
                <div className="space-y-5">
                  {/* Google OAuth */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full py-3.5 bg-white border border-field-border text-heading rounded-xl font-semibold hover:bg-subtle disabled:opacity-50 transition-snappy flex items-center justify-center gap-3 shadow-sm"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continuar con Google
                  </button>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-field-border" />
                    <span className="text-xs text-muted font-medium">o con email</span>
                    <div className="flex-1 h-px bg-field-border" />
                  </div>

                  <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="field-label">Email</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="tu@email.com"
                      className={inputClass}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="field-label">Contraseña</label>
                    <input
                      type="password"
                      required
                      value={form.password}
                      onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="••••••••"
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-brand text-on-brand rounded-xl font-semibold hover:bg-brand-hover disabled:opacity-50 transition-snappy flex items-center justify-center gap-2 shadow-lg shadow-brand/15"
                  >
                    {loading ? (
                      <>
                        <ButtonSpinner />
                        Ingresando...
                      </>
                    ) : 'Ingresar'}
                  </button>

                  {/* Forgot password */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={loading}
                      className="text-xs text-brand hover:underline disabled:opacity-50"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  {/* Hint */}
                  <p className="text-center text-xs text-muted pt-1">
                    ¿No tienes cuenta?{' '}
                    <button type="button" onClick={() => switchMode('register')} className="text-brand font-semibold hover:underline">
                      Regístrate
                    </button>
                  </p>
                </form>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Google OAuth */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full py-3.5 bg-white border border-field-border text-heading rounded-xl font-semibold hover:bg-subtle disabled:opacity-50 transition-snappy flex items-center justify-center gap-3 shadow-sm"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continuar con Google
                  </button>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-field-border" />
                    <span className="text-xs text-muted font-medium">o con email</span>
                    <div className="flex-1 h-px bg-field-border" />
                  </div>

                  {/* Email + Password form */}
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="field-label">Email</label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="tu@email.com"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="field-label">Contraseña</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={form.password}
                        onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Mínimo 6 caracteres"
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 bg-brand text-on-brand rounded-xl font-semibold hover:bg-brand-hover disabled:opacity-50 transition-snappy flex items-center justify-center gap-2 shadow-lg shadow-brand/15"
                    >
                      {loading ? (
                        <>
                          <ButtonSpinner />
                          Creando cuenta...
                        </>
                      ) : 'Crear cuenta'}
                    </button>

                    <p className="text-center text-xs text-muted pt-1">
                      ¿Ya tienes cuenta?{' '}
                      <button type="button" onClick={() => switchMode('login')} className="text-brand font-semibold hover:underline">
                        Inicia sesión
                      </button>
                    </p>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-white/25 mt-6 opacity-0 animate-fade-in-delay-2">
          Tu cuenta te permite guardar tu perfil, equipo y ver el historial de tus acreditaciones.
        </p>
      </div>
    </div>
  );
}
