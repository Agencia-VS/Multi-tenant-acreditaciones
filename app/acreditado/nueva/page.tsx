'use client';

/**
 * Nueva Solicitud — El acreditado elige un evento y se redirige al formulario
 * Eventos agrupados por organización (tenant), con secciones visuales.
 * Solo muestra eventos con acreditación abierta (fecha_limite_acreditacion no vencida)
 */
import { useState, useEffect, useMemo } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { LoadingSpinner } from '@/components/shared/ui';
import { isDeadlinePast, formatDeadlineChile } from '@/lib/dates';
import { isReadyToAccredit, getMissingAccreditationFields } from '@/lib/profile';

interface ActiveEvent {
  id: string;
  nombre: string;
  fecha: string | null;
  fecha_limite_acreditacion: string | null;
  venue: string | null;
  tenant: { id: string; nombre: string; slug: string; shield_url: string | null; color_primario: string; config: Record<string, unknown> | null };
}

interface ProfileData {
  nombre: string | null;
  apellido: string | null;
  rut: string | null;
  medio: string | null;
  tipo_medio: string | null;
}

export default function NuevaSolicitudPage() {
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const supabase = getSupabaseBrowserClient();

      // Force token refresh before using session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Cargar eventos y perfil en paralelo
      const [eventsRes, profileRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, nombre, fecha, fecha_limite_acreditacion, venue, tenant:tenants(id, nombre, slug, shield_url, color_primario, config)')
          .eq('is_active', true)
          .order('fecha', { ascending: true }),
        fetch('/api/profiles/lookup').then(r => r.json()).catch(() => null),
      ]);

      // Obtener tenant IDs con approved_only para filtrar
      let approvedTenantIds: Set<string> = new Set();
      if (profileRes?.found && profileRes.profile) {
        setProfile(profileRes.profile);

        // Fetch provider accesses for the user
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const provRes = await fetch('/api/providers/my-access', {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (provRes.ok) {
              const provData = await provRes.json();
              approvedTenantIds = new Set(
                provData
                  .filter((p: { status: string }) => p.status === 'approved')
                  .map((p: { tenant_id: string }) => p.tenant_id)
              );
            }
          }
        } catch { /* ignore */ }
      }

      if (eventsRes.data) {
        const open = (eventsRes.data as unknown as ActiveEvent[]).filter((e) => {
          if (isDeadlinePast(e.fecha_limite_acreditacion)) return false;

          // Exclude provider tenant events (shown in Organizaciones tab)
          const tenant = Array.isArray(e.tenant) ? e.tenant[0] : e.tenant;
          if (approvedTenantIds.has(tenant?.id || '')) return false;

          // Hide approved_only tenants where user is NOT a provider
          const tenantConfig = tenant?.config as Record<string, unknown> | null;
          if (tenantConfig?.provider_mode === 'approved_only') return false;

          return true;
        });
        setEvents(open);
      }

      setLoading(false);
    };
    loadData();
  }, []);

  const missingFields = profile ? getMissingAccreditationFields(profile) : [];
  const ready = profile ? isReadyToAccredit(profile) : false;

  // Group events by tenant
  const tenantGroups = useMemo(() => {
    const map = new Map<string, { tenant: ActiveEvent['tenant']; events: ActiveEvent[] }>();
    for (const ev of events) {
      const tenant = Array.isArray(ev.tenant) ? ev.tenant[0] : ev.tenant;
      const key = tenant?.id || 'unknown';
      if (!map.has(key)) {
        map.set(key, { tenant, events: [] });
      }
      map.get(key)!.events.push(ev);
    }
    return [...map.values()];
  }, [events]);

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-heading">Nueva Solicitud</h1>
        <p className="text-body text-sm sm:text-base mt-1">Selecciona el evento al que deseas acreditarte</p>
      </div>

      {/* Banner: perfil incompleto para acreditación */}
      {profile && !ready && (
        <div className="bg-info-light border border-info/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <i className="fas fa-info-circle text-info mt-0.5" />
          <div>
            <p className="font-semibold text-heading text-sm">Completa tu perfil para agilizar la acreditación</p>
            <p className="text-body text-xs mt-1">
              Te faltan: {missingFields.map(f => f.label).join(', ')}.
              Puedes completarlos en tu{' '}
              <Link href="/acreditado/perfil" className="text-brand underline hover:text-brand-hover">
                perfil
              </Link>
              , o llenarlos en el formulario de acreditación.
            </p>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-xl border border-edge">
          <i className="fas fa-calendar-times text-4xl text-muted mb-4" />
          <p className="text-muted text-lg">No hay eventos con acreditación abierta</p>
          <Link href="/acreditado" className="text-brand hover:underline text-sm mt-2 inline-block">
            Volver al inicio
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {tenantGroups.map(({ tenant, events: tenantEvents }) => {
            const t = tenant as ActiveEvent['tenant'] & { shield_url?: string | null };
            const slug = t?.slug || '';
            const hasMultipleEvents = tenantEvents.length > 1;

            return (
              <div key={t?.id || slug} className="bg-surface rounded-xl border border-edge overflow-hidden">
                {/* Tenant header */}
                <div className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4 border-b border-edge bg-subtle/30">
                  {t?.shield_url ? (
                    <Image src={t.shield_url} alt="" width={36} height={36} className="w-9 h-9 object-contain shrink-0" />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ backgroundColor: t?.color_primario || '#00C48C' }}
                    >
                      {t?.nombre?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-heading text-sm sm:text-base truncate">{t?.nombre}</h2>
                    <p className="text-xs text-muted">
                      {tenantEvents.length} evento{tenantEvents.length !== 1 ? 's' : ''} disponible{tenantEvents.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Events list */}
                <div className="divide-y divide-edge">
                  {tenantEvents.map((event) => {
                    // Single event: go direct with ?event=id; multiple: go to landing
                    const href = hasMultipleEvents
                      ? `/${slug}`
                      : `/${slug}/acreditacion?event=${event.id}`;

                    return (
                      <Link
                        key={event.id}
                        href={href}
                        className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4 hover:bg-accent-light/40 transition group"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-heading text-sm group-hover:text-brand transition truncate">
                            {event.nombre}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted mt-0.5">
                            {event.fecha && (
                              <span><i className="fas fa-calendar mr-1" />{new Date(event.fecha).toLocaleDateString('es-CL')}</span>
                            )}
                            {event.venue && (
                              <span className="hidden sm:inline"><i className="fas fa-map-marker-alt mr-1" />{event.venue}</span>
                            )}
                          </div>
                          {event.fecha_limite_acreditacion && (
                            <p className="text-[11px] text-amber-600 mt-0.5">
                              <i className="fas fa-clock mr-1" />
                              Cierre: {formatDeadlineChile(event.fecha_limite_acreditacion)}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="hidden sm:inline px-3 py-1.5 bg-brand text-on-brand rounded-lg text-xs font-medium group-hover:bg-brand-hover transition">
                            Acreditarme
                          </span>
                          <i className="fas fa-chevron-right text-muted text-xs group-hover:text-brand transition" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
