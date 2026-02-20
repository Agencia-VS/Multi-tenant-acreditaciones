'use client';

/**
 * Nueva Solicitud — El acreditado elige un evento y se redirige al formulario
 * Solo muestra eventos con acreditación abierta (fecha_limite_acreditacion no vencida)
 * Muestra un banner si el perfil no está completo para acreditación (falta RUT, nombre, etc.)
 */
import { useState, useEffect } from 'react';
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
  tenant: { nombre: string; slug: string; shield_url: string | null; color_primario: string };
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

      // Cargar eventos y perfil en paralelo
      const [eventsRes, profileRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, nombre, fecha, fecha_limite_acreditacion, venue, tenant:tenants(nombre, slug, shield_url, color_primario)')
          .eq('is_active', true)
          .order('fecha', { ascending: true }),
        fetch('/api/profiles/lookup').then(r => r.json()).catch(() => null),
      ]);

      if (eventsRes.data) {
        const open = (eventsRes.data as unknown as ActiveEvent[]).filter(
          (e) => !isDeadlinePast(e.fecha_limite_acreditacion)
        );
        setEvents(open);
      }

      if (profileRes?.found && profileRes.profile) {
        setProfile(profileRes.profile);
      }

      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  const missingFields = profile ? getMissingAccreditationFields(profile) : [];
  const ready = profile ? isReadyToAccredit(profile) : false;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-heading">Nueva Solicitud</h1>
        <p className="text-body mt-1">Selecciona el evento al que deseas acreditarte</p>
      </div>

      {/* Banner: perfil incompleto para acreditación */}
      {profile && !ready && (
        <div className="bg-info-light border border-info rounded-lg p-4 mb-6 flex items-start gap-3">
          <i className="fas fa-info-circle text-info mt-0.5" />
          <div>
            <p className="font-semibold text-heading text-sm">Completa tu perfil para agilizar la acreditación</p>
            <p className="text-body text-xs mt-1">
              Te faltan: {missingFields.map(f => f.label).join(', ')}.
              Puedes completarlos ahora en tu{' '}
              <Link href="/acreditado/perfil" className="text-brand underline hover:text-brand-hover">
                perfil
              </Link>
              , o llenarlos directamente en el formulario de acreditación.
            </p>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-xl border border-edge">
          <i className="fas fa-calendar-times text-4xl text-muted mb-4" />
          <p className="text-muted text-lg">No hay eventos con acreditación abierta</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => {
            const tenant = Array.isArray(event.tenant) ? event.tenant[0] : event.tenant;
            return (
              <Link
                key={event.id}
                href={`/${tenant?.slug}/acreditacion`}
                className="bg-surface rounded-xl border border-edge p-6 hover:shadow-lg hover:border-brand transition group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {tenant?.shield_url ? (
                      <Image src={tenant.shield_url} alt="" width={56} height={56} className="w-14 h-14 object-contain" />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                        style={{ backgroundColor: tenant?.color_primario || '#00C48C' }}
                      >
                        {tenant?.nombre?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-heading text-lg group-hover:text-brand transition">
                        {event.nombre}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-body mt-1">
                        <span>{tenant?.nombre}</span>
                        {event.fecha && <span><i className="fas fa-calendar mr-1" />{new Date(event.fecha).toLocaleDateString('es-CL')}</span>}
                        {event.venue && <span><i className="fas fa-map-marker-alt mr-1" />{event.venue}</span>}
                      </div>
                      {event.fecha_limite_acreditacion && (
                        <p className="text-xs text-amber-600 mt-1">
                          <i className="fas fa-clock mr-1" />
                          Cierre: {formatDeadlineChile(event.fecha_limite_acreditacion)}
                        </p>
                      )}
                    </div>
                  </div>
                  <i className="fas fa-arrow-right text-muted group-hover:text-brand group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
