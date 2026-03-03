/**
 * Mis Organizaciones — Portal Acreditado
 *
 * Muestra los accesos como proveedor autorizado del usuario a distintos tenants.
 * Fetches GET /api/providers/my-access
 */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingSpinner } from '@/components/shared/ui';

interface ProviderAccess {
  id: string;
  tenant_id: string;
  profile_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  organizacion: string | null;
  mensaje: string | null;
  allowed_zones: string[];
  motivo_rechazo: string | null;
  notas_admin: string | null;
  created_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  tenant: {
    id: string;
    nombre: string;
    slug: string;
    logo_url: string | null;
  } | null;
}

const statusConfig: Record<string, { label: string; bg: string; icon: string }> = {
  pending:   { label: 'Pendiente',   bg: 'bg-amber-50 text-amber-700 border-amber-200',  icon: 'fa-clock' },
  approved:  { label: 'Aprobado',    bg: 'bg-green-50 text-green-700 border-green-200',   icon: 'fa-check-circle' },
  rejected:  { label: 'Rechazado',   bg: 'bg-red-50 text-red-700 border-red-200',         icon: 'fa-times-circle' },
  suspended: { label: 'Suspendido',  bg: 'bg-gray-50 text-gray-600 border-gray-200',      icon: 'fa-ban' },
};

export default function OrganizacionesPage() {
  const [accesses, setAccesses] = useState<ProviderAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccesses = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setError('Sesión expirada');
          setLoading(false);
          return;
        }

        const res = await fetch('/api/providers/my-access', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) {
          throw new Error('Error al obtener accesos');
        }

        const data = await res.json();
        setAccesses(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchAccesses();
  }, []);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-heading">
          <i className="fas fa-building mr-2 text-brand" />
          Mis Organizaciones
        </h1>
        <p className="text-body text-sm mt-1">
          Accesos como proveedor autorizado a organizaciones
        </p>
      </div>

      {error && (
        <div className="p-4 mb-6 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <i className="fas fa-exclamation-triangle mr-2" />
          {error}
        </div>
      )}

      {accesses.length === 0 && !error ? (
        /* ── Empty state ── */
        <div className="text-center py-16 bg-surface rounded-2xl border border-edge">
          <div className="w-16 h-16 rounded-full bg-accent-light flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-handshake text-2xl text-brand" />
          </div>
          <h2 className="text-lg font-bold text-heading mb-2">Sin organizaciones</h2>
          <p className="text-body text-sm max-w-md mx-auto mb-6">
            Aún no tienes acceso como proveedor a ninguna organización.
            Si recibiste un enlace de invitación, úsalo para solicitar acceso.
          </p>
        </div>
      ) : (
        /* ── Provider access list ── */
        <div className="space-y-4">
          {accesses.map((access) => {
            const tenant = access.tenant;
            const status = statusConfig[access.status] || statusConfig.pending;

            return (
              <div
                key={access.id}
                className="bg-surface rounded-xl border border-edge p-4 sm:p-5 hover:shadow-md transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Tenant logo/avatar */}
                  <div className="shrink-0">
                    {tenant?.logo_url ? (
                      <Image
                        src={tenant.logo_url}
                        alt={tenant.nombre}
                        width={48}
                        height={48}
                        className="w-12 h-12 object-contain rounded-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-brand flex items-center justify-center text-white font-bold text-lg">
                        {tenant?.nombre?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold text-heading">
                        {tenant?.nombre || 'Organización'}
                      </h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${status.bg}`}>
                        <i className={`fas ${status.icon} text-[10px]`} />
                        {status.label}
                      </span>
                    </div>

                    {access.organizacion && (
                      <p className="text-body text-sm">
                        <i className="fas fa-briefcase mr-1 text-muted" />
                        {access.organizacion}
                      </p>
                    )}

                    {/* Approved → show zones */}
                    {access.status === 'approved' && access.allowed_zones.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="text-xs text-muted mr-1">Zonas:</span>
                        {access.allowed_zones.map(zone => (
                          <span
                            key={zone}
                            className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-light text-brand"
                          >
                            {zone}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Rejected → show reason */}
                    {access.status === 'rejected' && access.motivo_rechazo && (
                      <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700">
                        <i className="fas fa-comment-alt mr-1" />
                        <strong>Motivo:</strong> {access.motivo_rechazo}
                      </div>
                    )}

                    {/* Suspended notice */}
                    {access.status === 'suspended' && (
                      <p className="mt-2 text-xs text-gray-500">
                        <i className="fas fa-info-circle mr-1" />
                        Tu acceso ha sido suspendido. Contacta al administrador.
                      </p>
                    )}

                    {/* Date */}
                    {access.created_at && (
                      <p className="text-muted text-xs mt-2">
                        <i className="fas fa-calendar mr-1" />
                        Solicitud: {new Date(access.created_at).toLocaleDateString('es-CL')}
                        {access.status === 'approved' && access.approved_at && (
                          <span className="ml-2">
                            · Aprobado: {new Date(access.approved_at).toLocaleDateString('es-CL')}
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Action */}
                  {access.status === 'approved' && tenant?.slug && (
                    <div className="shrink-0 self-center">
                      <Link
                        href={`/${tenant.slug}`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-on-brand text-sm font-medium hover:bg-brand-hover transition"
                      >
                        <i className="fas fa-ticket-alt text-xs" />
                        Acreditarme
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
