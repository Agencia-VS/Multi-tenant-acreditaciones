'use client';

/**
 * Login / Registro de Acreditado (Manager/User)
 * Se autentica con email+password, linkea a un perfil por RUT.
 * Smooth animated tab transition between Login ↔ Register.
 */
import { useState, useRef, Suspense } from 'react';
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
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', rut: '', nombre: '', apellido: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const { showSuccess, showError } = useToast();

  const supabase = getSupabaseBrowserClient();

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

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (authError) {
      setError('Credenciales inválidas. Verifica tu email y contraseña.');
      showError('Credenciales inválidas');
      setLoading(false);
      return;
    }

    // Si el usuario tiene RUT en metadata, asegurar que exista su perfil
    const meta = authData.user?.user_metadata;
    if (meta?.rut) {
      try {
        const checkRes = await fetch('/api/profiles/lookup');
        const checkData = await checkRes.json();
        if (!checkData.found) {
          await fetch('/api/profiles/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rut: meta.rut,
              nombre: meta.nombre || '',
              apellido: meta.apellido || '',
              email: authData.user?.email || '',
            }),
          });
        }
      } catch { /* ignore — perfil se creará luego */ }
    }

    router.push(returnTo || '/acreditado');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { rut: form.rut, nombre: form.nombre, apellido: form.apellido },
      },
    });

    if (authError) {
      setError(authError.message);
      showError(authError.message);
      setLoading(false);
      return;
    }

    if (authData.session) {
      // Auto-confirm habilitado: crear perfil inmediatamente (ya hay cookie)
      await fetch('/api/profiles/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut: form.rut,
          nombre: form.nombre,
          apellido: form.apellido,
          email: form.email,
        }),
      });
      router.push(returnTo || '/acreditado');
    } else {
      // Email confirmation requerido: los datos están en user_metadata
      // El perfil se creará en el callback cuando confirme el email
      setSuccess('Cuenta creada. Revisa tu email para confirmarla.');
      showSuccess('Cuenta creada. Revisa tu email para confirmarla.');
    }

    setLoading(false);
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

                  {/* Hint */}
                  <p className="text-center text-xs text-muted pt-1">
                    ¿No tienes cuenta?{' '}
                    <button type="button" onClick={() => switchMode('register')} className="text-brand font-semibold hover:underline">
                      Regístrate
                    </button>
                  </p>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="field-label">Nombre</label>
                      <input
                        type="text"
                        required
                        value={form.nombre}
                        onChange={(e) => setForm(prev => ({ ...prev, nombre: e.target.value }))}
                        placeholder="Juan"
                        className={inputClass}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="field-label">Apellido</label>
                      <input
                        type="text"
                        required
                        value={form.apellido}
                        onChange={(e) => setForm(prev => ({ ...prev, apellido: e.target.value }))}
                        placeholder="Pérez"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="field-label">RUT</label>
                    <input
                      type="text"
                      required
                      placeholder="12.345.678-9"
                      value={form.rut}
                      onChange={(e) => setForm(prev => ({ ...prev, rut: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
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
