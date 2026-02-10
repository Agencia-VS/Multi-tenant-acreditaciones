'use client';

/**
 * Nueva Solicitud — El acreditado elige un evento y se redirige al formulario
 */
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/shared/ui';

interface ActiveEvent {
  id: string;
  nombre: string;
  fecha: string | null;
  venue: string | null;
  tenant: { nombre: string; slug: string; shield_url: string | null; color_primario: string };
}

export default function NuevaSolicitudPage() {
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data } = await supabase
        .from('events')
        .select('id, nombre, fecha, venue, tenant:tenants(nombre, slug, shield_url, color_primario)')
        .eq('is_active', true)
        .order('fecha', { ascending: true });

      if (data) setEvents(data as unknown as ActiveEvent[]);
      setLoading(false);
    };
    loadEvents();
  }, []);

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Nueva Solicitud</h1>
        <p className="text-gray-500 mt-1">Selecciona el evento al que deseas acreditarte</p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <i className="fas fa-calendar-times text-4xl text-gray-300 mb-4" />
          <p className="text-gray-400 text-lg">No hay eventos con acreditación abierta</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => {
            const tenant = Array.isArray(event.tenant) ? event.tenant[0] : event.tenant;
            return (
              <Link
                key={event.id}
                href={`/${tenant?.slug}/acreditacion`}
                className="bg-white rounded-xl border p-6 hover:shadow-lg hover:border-blue-300 transition group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {tenant?.shield_url ? (
                      <img src={tenant.shield_url} alt="" className="w-14 h-14 object-contain" />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                        style={{ backgroundColor: tenant?.color_primario || '#3b82f6' }}
                      >
                        {tenant?.nombre?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition">
                        {event.nombre}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span>{tenant?.nombre}</span>
                        {event.fecha && <span><i className="fas fa-calendar mr-1" />{new Date(event.fecha).toLocaleDateString('es-CL')}</span>}
                        {event.venue && <span><i className="fas fa-map-marker-alt mr-1" />{event.venue}</span>}
                      </div>
                    </div>
                  </div>
                  <i className="fas fa-arrow-right text-gray-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
