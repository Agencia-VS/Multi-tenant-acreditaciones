'use client';

/**
 * SuperAdmin Login Page — Wise Design Foundations
 */
import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { BackButton, useToast, ButtonSpinner } from '@/components/shared/ui';

export default function SuperAdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { showError } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = getSupabaseBrowserClient();

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('Credenciales inválidas');
        showError('Credenciales inválidas');
        return;
      }

      const { data: sa } = await supabase
        .from('superadmins')
        .select('id')
        .eq('user_id', authData.user.id)
        .single();

      if (!sa) {
        await supabase.auth.signOut();
        setError('No tienes permisos de Super Administrador');
        showError('Sin permisos de Super Administrador');
        return;
      }

      window.location.href = '/superadmin';
    } catch {
      setError('Error de conexión');
      showError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-field-border bg-canvas text-heading placeholder-muted text-sm transition-snappy';

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center p-6 relative dark-surface">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-brand/6 blur-[120px]" />
      </div>

      <BackButton href="/" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-10 group opacity-0 animate-fade-in">
          <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center group-hover:bg-brand/30 transition-snappy">
            <i className="fas fa-shield-halved text-accent text-lg" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">Accredia</span>
        </Link>

        {/* Card */}
        <div className="bg-surface rounded-2xl shadow-2xl shadow-black/20 overflow-hidden opacity-0 animate-fade-in-delay-1">
          {/* Header */}
          <div className="px-8 pt-8 pb-0">
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-heading">Super Administración</h1>
              <p className="text-sm text-muted mt-1">Acceso restringido</p>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 pb-8">
            {error && (
              <div className="flex items-start gap-2.5 bg-danger-light border border-danger/15 rounded-xl px-4 py-3 mb-5 animate-fade-in">
                <i className="fas fa-circle-exclamation text-danger mt-0.5 text-sm" />
                <p className="text-sm text-danger-dark">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="field-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@accredia.cl"
                  className={inputClass}
                  autoFocus
                />
              </div>

              <div>
                <label className="field-label">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
                    Verificando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-lock text-sm" />
                    Ingresar
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-white/25 mt-6 opacity-0 animate-fade-in-delay-2">
          Solo usuarios con rol de super administrador.
        </p>
      </div>
    </div>
  );
}
