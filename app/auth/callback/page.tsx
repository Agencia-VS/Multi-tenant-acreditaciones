'use client';

/**
 * Auth Callback — Maneja el callback de Supabase Auth
 * Soporta: email confirmation, password recovery, force change
 */
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingSpinner, ButtonSpinner, useToast } from '@/components/shared/ui';

function PasswordResetForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      showError(updateError.message);
      setLoading(false);
      return;
    }

    // Clear must_change_password flag if set
    await supabase.auth.updateUser({
      data: { must_change_password: false },
    });

    showSuccess('Contraseña actualizada correctamente');
    setTimeout(() => router.push(next), 1000);
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-field-border bg-canvas text-heading placeholder-muted text-sm transition-snappy';

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center p-6 relative dark-surface">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-brand/8 blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 opacity-0 animate-fade-in">
          <div className="w-14 h-14 bg-brand/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-key text-accent text-xl" />
          </div>
          <h1 className="text-2xl font-bold text-white">Nueva contraseña</h1>
          <p className="text-sm text-white/50 mt-1">Ingresa tu nueva contraseña</p>
        </div>

        <div className="bg-surface rounded-2xl shadow-2xl shadow-black/20 p-6 sm:p-8 opacity-0 animate-fade-in-delay-1">
          {error && (
            <div className="flex items-start gap-2.5 bg-danger-light border border-danger/15 rounded-xl px-4 py-3 mb-5 animate-fade-in">
              <i className="fas fa-circle-exclamation text-danger mt-0.5 text-sm" />
              <p className="text-sm text-danger-dark">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="field-label">Nueva contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className={inputClass}
                autoFocus
              />
            </div>
            <div>
              <label className="field-label">Confirmar contraseña</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
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
                  Actualizando...
                </>
              ) : 'Guardar nueva contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [nextUrl, setNextUrl] = useState('/auth/acreditado');

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const type = searchParams.get('type');
    const next = searchParams.get('next') || '/auth/acreditado';
    setNextUrl(next);

    const handleCallback = async () => {
      // Listen for auth state changes first (recovery comes via hash fragment)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
        if (event === 'PASSWORD_RECOVERY') {
          setShowPasswordReset(true);
        }
      });

      // If type=recovery, Supabase handles session via hash — just wait for the event
      if (type === 'recovery' || type === 'force-change') {
        // The onAuthStateChange above will detect PASSWORD_RECOVERY
        // Give it a moment, then fall back to showing the form anyway
        setTimeout(() => {
          setShowPasswordReset(true);
        }, 3000);
        return () => subscription.unsubscribe();
      }

      // Normal code exchange (email confirmation, etc.)
      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          router.push('/auth/acreditado?error=auth');
          subscription.unsubscribe();
          return;
        }

        // Create/link profile from metadata (saved during signUp)
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata?.rut) {
          await fetch('/api/profiles/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rut: user.user_metadata.rut,
              nombre: user.user_metadata.nombre || '',
              apellido: user.user_metadata.apellido || '',
              email: user.email || '',
            }),
          });
        }

        // Check if must change password
        if (user?.user_metadata?.must_change_password) {
          setShowPasswordReset(true);
          subscription.unsubscribe();
          return;
        }

        router.push(next || '/acreditado');
      } else {
        // No code — might be a hash-based flow, wait for auth event
        setTimeout(() => {
          router.push(next || '/acreditado');
        }, 5000);
      }

      return () => subscription.unsubscribe();
    };

    handleCallback();
  }, [router, searchParams]);

  if (showPasswordReset) {
    return <PasswordResetForm next={nextUrl} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="text-center">
        <LoadingSpinner />
        <p className="text-body mt-4">Verificando sesión...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <LoadingSpinner />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
