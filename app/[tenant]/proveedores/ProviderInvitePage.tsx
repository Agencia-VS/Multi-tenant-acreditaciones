/**
 * ProviderInvitePage — Client Component
 *
 * Flujo:
 * 1. Lee ?code= de la URL
 * 2. Valida código contra /api/providers/validate-code
 * 3. Si válido → muestra info del tenant + formulario de solicitud
 * 4. Si el usuario no está autenticado → CTA para login
 * 5. Al enviar → POST /api/providers/request
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingSpinner, ButtonSpinner } from '@/components/shared/ui';

interface Props {
  tenantId: string;
  tenantSlug: string;
  tenantNombre: string;
  tenantLogo: string | null;
  tenantDescription?: string;
  colorPrimario: string;
}

type PageState = 'loading' | 'no-code' | 'invalid-code' | 'ready' | 'submitting' | 'success' | 'already-exists';

export default function ProviderInvitePage({
  tenantId,
  tenantSlug,
  tenantNombre,
  tenantLogo,
  tenantDescription,
  colorPrimario,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code');

  const [pageState, setPageState] = useState<PageState>('loading');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [organizacion, setOrganizacion] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);

  // Check auth + validate code on mount
  useEffect(() => {
    const init = async () => {
      if (!code) {
        setPageState('no-code');
        return;
      }

      // Check auth
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsAuthenticated(true);
        setUserId(session.user.id);
      }

      // Validate code
      try {
        const res = await fetch(
          `/api/providers/validate-code?slug=${encodeURIComponent(tenantSlug)}&code=${encodeURIComponent(code)}`
        );
        if (!res.ok) {
          setPageState('invalid-code');
          return;
        }
        setPageState('ready');
      } catch {
        setPageState('invalid-code');
      }
    };

    init();
  }, [code, tenantSlug]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !isAuthenticated) return;

    setError(null);
    setPageState('submitting');

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch('/api/providers/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          code,
          organizacion: organizacion.trim() || undefined,
          mensaje: mensaje.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        const errorMsg = data.error || 'Error al enviar solicitud';

        // Detect "already exists" errors
        if (
          errorMsg.includes('solicitud pendiente') ||
          errorMsg.includes('Ya tienes acceso') ||
          errorMsg.includes('suspendido')
        ) {
          setExistingStatus(errorMsg);
          setPageState('already-exists');
          return;
        }

        throw new Error(errorMsg);
      }

      setPageState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar solicitud');
      setPageState('ready');
    }
  }, [code, isAuthenticated, tenantId, organizacion, mensaje]);

  const loginUrl = `/auth/acreditado?returnTo=${encodeURIComponent(`/${tenantSlug}/proveedores?code=${code}`)}`;

  // ── Render states ──

  if (pageState === 'loading') {
    return <LoadingSpinner fullPage />;
  }

  if (pageState === 'no-code') {
    return (
      <CenteredCard>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-link-slash text-2xl text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-heading mb-2">Enlace incompleto</h1>
          <p className="text-body text-sm mb-6">
            Este enlace de invitación no incluye un código válido. Solicita un nuevo enlace al administrador.
          </p>
          <Link
            href={`/${tenantSlug}`}
            className="text-sm font-medium hover:underline"
            style={{ color: colorPrimario }}
          >
            Ir a la página de {tenantNombre}
          </Link>
        </div>
      </CenteredCard>
    );
  }

  if (pageState === 'invalid-code') {
    return (
      <CenteredCard>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-times-circle text-2xl text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-heading mb-2">Código inválido</h1>
          <p className="text-body text-sm mb-6">
            El código de invitación no es válido o ha expirado. Contacta al administrador de <strong>{tenantNombre}</strong> para obtener un nuevo enlace.
          </p>
          <Link
            href={`/${tenantSlug}`}
            className="text-sm font-medium hover:underline"
            style={{ color: colorPrimario }}
          >
            Ir a la página de {tenantNombre}
          </Link>
        </div>
      </CenteredCard>
    );
  }

  if (pageState === 'success') {
    return (
      <CenteredCard>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-check-circle text-2xl text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-heading mb-2">¡Solicitud enviada!</h1>
          <p className="text-body text-sm mb-2">
            Tu solicitud de acceso a <strong>{tenantNombre}</strong> ha sido enviada correctamente.
          </p>
          <p className="text-muted text-xs mb-6">
            El equipo administrador revisará tu solicitud y te notificará cuando sea aprobada.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/acreditado/organizaciones"
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition hover:opacity-90"
              style={{ backgroundColor: colorPrimario }}
            >
              Ver mis organizaciones
            </Link>
            <Link
              href="/acreditado"
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-body bg-canvas border border-edge hover:bg-surface transition"
            >
              Ir al portal
            </Link>
          </div>
        </div>
      </CenteredCard>
    );
  }

  if (pageState === 'already-exists') {
    return (
      <CenteredCard>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-info-circle text-2xl text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-heading mb-2">Solicitud existente</h1>
          <p className="text-body text-sm mb-6">{existingStatus}</p>
          <Link
            href="/acreditado/organizaciones"
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: colorPrimario }}
          >
            Ver mis organizaciones
          </Link>
        </div>
      </CenteredCard>
    );
  }

  // ── Main form (ready / submitting) ──
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Tenant header */}
        <div className="text-center mb-6">
          {tenantLogo ? (
            <Image
              src={tenantLogo}
              alt={tenantNombre}
              width={80}
              height={80}
              className="mx-auto mb-3 object-contain"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-xl mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: colorPrimario }}
            >
              {tenantNombre.charAt(0)}
            </div>
          )}
          <h1 className="text-2xl font-bold text-heading">{tenantNombre}</h1>
          {tenantDescription && (
            <p className="text-body text-sm mt-2 max-w-sm mx-auto">{tenantDescription}</p>
          )}
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl border border-edge shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${colorPrimario}15` }}
            >
              <i className="fas fa-handshake text-sm" style={{ color: colorPrimario }} />
            </div>
            <h2 className="font-bold text-heading">Solicitud de Proveedor</h2>
          </div>

          <p className="text-body text-sm mb-5">
            Has sido invitado como proveedor autorizado. Completa tu solicitud para obtener acceso a las acreditaciones de esta organización.
          </p>

          {!isAuthenticated ? (
            /* ── Not logged in → CTA ── */
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-user-lock text-amber-600" />
              </div>
              <p className="text-body text-sm mb-4">
                Necesitas iniciar sesión o crear una cuenta para enviar tu solicitud.
              </p>
              <Link
                href={loginUrl}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white transition hover:opacity-90"
                style={{ backgroundColor: colorPrimario }}
              >
                <i className="fas fa-sign-in-alt" />
                Iniciar sesión
              </Link>
              <p className="text-muted text-xs mt-3">
                ¿No tienes cuenta? Se creará una al registrarte.
              </p>
            </div>
          ) : (
            /* ── Logged in → Request form ── */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-heading mb-1.5">
                  Organización / Empresa
                  <span className="text-muted text-xs font-normal ml-1">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={organizacion}
                  onChange={e => setOrganizacion(e.target.value)}
                  placeholder="Nombre de tu empresa o medio"
                  maxLength={200}
                  className="w-full px-3 py-2.5 rounded-lg border border-edge bg-canvas text-heading text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': colorPrimario } as React.CSSProperties}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-heading mb-1.5">
                  Mensaje al administrador
                  <span className="text-muted text-xs font-normal ml-1">(opcional)</span>
                </label>
                <textarea
                  value={mensaje}
                  onChange={e => setMensaje(e.target.value)}
                  placeholder="Ej: Somos el medio oficial del evento..."
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-edge bg-canvas text-heading text-sm focus:outline-none focus:ring-2 resize-none"
                  style={{ '--tw-ring-color': colorPrimario } as React.CSSProperties}
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  <i className="fas fa-exclamation-triangle mr-1.5" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={pageState === 'submitting'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: colorPrimario }}
              >
                {pageState === 'submitting' ? (
                  <>
                    <ButtonSpinner />
                    Enviando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane" />
                    Enviar solicitud
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-muted text-xs mt-4">
          Powered by <Link href="/" className="font-semibold hover:underline">ACCREDIA</Link>
        </p>
      </div>
    </div>
  );
}

/** Card centrada reutilizable para estados simples */
function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface rounded-2xl border border-edge shadow-sm p-8">
        {children}
      </div>
    </div>
  );
}
