'use client';

/**
 * Acreditado Home — Da la bienvenida y muestra eventos activos
 */
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/shared/ui';
import { isDeadlinePast, formatDeadlineChile } from '@/lib/dates';
import type { TenantProfileStatus } from '@/types';

interface ActiveEvent {
  id: string;
  nombre: string;
  fecha: string | null;
  venue: string | null;
  fecha_limite_acreditacion: string | null;
  tenant: { nombre: string; slug: string; shield_url: string | null; color_primario: string };
}

export default function AcreditadoHomePage() {
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [profile, setProfile] = useState<{ nombre: string; apellido: string } | null>(null);
  const [tenantStatuses, setTenantStatuses] = useState<TenantProfileStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('nombre, apellido')
      .eq('user_id', user.id)
      .single();
    
    if (profileData) setProfile(profileData);

    // Get active events
    const { data: eventsData } = await supabase
      .from('events')
      .select('id, nombre, fecha, venue, fecha_limite_acreditacion, tenant:tenants(nombre, slug, shield_url, color_primario)')
      .eq('is_active', true)
      .order('fecha', { ascending: true });

    if (eventsData) setEvents(eventsData as unknown as ActiveEvent[]);

    // Get tenant completion statuses
    try {
      const statusRes = await fetch('/api/profiles/tenant-status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setTenantStatuses(statusData.tenants || []);
      }
    } catch { /* ignore */ }

    setLoading(false);
  };

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-heading">
          Hola, {profile?.nombre || 'Acreditado'} 👋
        </h1>
        <p className="text-body mt-1">Bienvenido a tu portal de acreditaciones</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/acreditado/dashboard" className="p-6 bg-accent-light rounded-xl border border-accent-light hover:bg-accent-light/80 transition">
          <i className="fas fa-ticket-alt text-2xl text-brand mb-2" />
          <h3 className="font-bold text-heading">Mis Acreditaciones</h3>
          <p className="text-sm text-body mt-1">Ver estado de mis solicitudes</p>
        </Link>
        <Link href="/acreditado/nueva" className="p-6 bg-success-light rounded-xl border border-success-light hover:bg-success-light/80 transition">
          <i className="fas fa-plus-circle text-2xl text-success mb-2" />
          <h3 className="font-bold text-heading">Nueva Solicitud</h3>
          <p className="text-sm text-body mt-1">Solicitar acreditación para un evento</p>
        </Link>
        <Link href="/acreditado/perfil" className="p-6 bg-purple-50 rounded-xl border border-purple-100 hover:bg-purple-100 transition">
          <i className="fas fa-user-edit text-2xl text-purple-600 mb-2" />
          <h3 className="font-bold text-heading">Mi Perfil</h3>
          <p className="text-sm text-body mt-1">Actualizar mis datos personales</p>
        </Link>
      </div>

      {/* Tenant Profile Completion */}
      {tenantStatuses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-heading mb-3">
            <i className="fas fa-tasks mr-2 text-muted" />
            Estado de tu Perfil por Organización
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tenantStatuses.map(t => {
              const isComplete = t.completionPct === 100 || t.totalRequired === 0;
              const hasChanges = t.formChanged && t.newKeys.length > 0;
              return (
                <Link
                  key={t.tenantId}
                  href={`/${t.tenantSlug}/acreditacion`}
                  className="flex items-center gap-3 p-4 bg-surface rounded-xl border border-edge hover:shadow-md transition"
                >
                  {/* Mini completion ring */}
                  <div className="relative w-10 h-10 shrink-0">
                    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-edge" />
                      <circle
                        cx="18" cy="18" r="15.5" fill="none"
                        stroke={isComplete ? 'var(--color-success)' : t.tenantColor}
                        strokeWidth="3"
                        strokeDasharray={`${t.completionPct * 0.975} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-heading">
                      {t.completionPct}%
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-heading text-sm truncate">{t.tenantNombre}</p>
                    {isComplete && (
                      <p className="text-xs text-success"><i className="fas fa-check mr-1" />Perfil completo</p>
                    )}
                    {!isComplete && t.missingFields.length > 0 && (
                      <p className="text-xs text-warn-dark">
                        {t.missingFields.length} campo{t.missingFields.length !== 1 ? 's' : ''} faltante{t.missingFields.length !== 1 ? 's' : ''}
                      </p>
                    )}
                    {hasChanges && (
                      <p className="text-xs text-info-dark"><i className="fas fa-sync-alt mr-1" />Formulario actualizado</p>
                    )}
                  </div>
                  <i className="fas fa-chevron-right text-muted text-xs" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Events */}
      <h2 className="text-xl font-bold text-heading mb-4">
        <i className="fas fa-calendar mr-2 text-muted" />
        Eventos con Acreditación Abierta
      </h2>

      {events.filter(e => !isDeadlinePast(e.fecha_limite_acreditacion)).length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-xl border border-edge">
          <i className="fas fa-calendar-times text-3xl text-muted mb-3" />
          <p className="text-muted">No hay eventos con acreditación abierta en este momento</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {events
            .filter((event) => !isDeadlinePast(event.fecha_limite_acreditacion))
            .map((event) => {
            const tenant = Array.isArray(event.tenant) ? event.tenant[0] : event.tenant;

            return (
              <div key={event.id} className="bg-surface rounded-xl border border-edge p-6 transition hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {tenant?.shield_url ? (
                      <img src={tenant.shield_url} alt="" className="w-12 h-12 object-contain" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: tenant?.color_primario || '#00C48C' }}
                      >
                        {tenant?.nombre?.charAt(0) || '?'}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-heading">{event.nombre}</h3>
                      <div className="flex items-center gap-3 text-sm text-body mt-1">
                        <span>{tenant?.nombre}</span>
                        {event.fecha && <span><i className="fas fa-calendar mr-1" />{new Date(event.fecha).toLocaleDateString('es-CL')}</span>}
                        {event.venue && <span><i className="fas fa-map-marker-alt mr-1" />{event.venue}</span>}
                      </div>
                      {event.fecha_limite_acreditacion && (
                        <p className="text-xs mt-1 text-amber-600">
                          <i className="fas fa-clock mr-1" />
                          Plazo hasta: {formatDeadlineChile(event.fecha_limite_acreditacion)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/${tenant?.slug}/acreditacion`}
                    className="px-4 py-2 bg-brand text-on-brand rounded-lg text-sm font-medium hover:bg-brand-hover transition"
                  >
                    Acreditarme
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
