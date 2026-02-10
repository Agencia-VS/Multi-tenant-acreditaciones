'use client';

/**
 * Acreditado Home — Da la bienvenida y muestra eventos activos
 */
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/shared/ui';
import { isDeadlinePast, formatDeadlineChile } from '@/lib/dates';

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
    setLoading(false);
  };

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Hola, {profile?.nombre || 'Acreditado'} 👋
        </h1>
        <p className="text-gray-500 mt-1">Bienvenido a tu portal de acreditaciones</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/acreditado/dashboard" className="p-6 bg-blue-50 rounded-xl border border-blue-100 hover:bg-blue-100 transition">
          <i className="fas fa-ticket-alt text-2xl text-blue-600 mb-2" />
          <h3 className="font-bold text-gray-900">Mis Acreditaciones</h3>
          <p className="text-sm text-gray-500 mt-1">Ver estado de mis solicitudes</p>
        </Link>
        <Link href="/acreditado/nueva" className="p-6 bg-green-50 rounded-xl border border-green-100 hover:bg-green-100 transition">
          <i className="fas fa-plus-circle text-2xl text-green-600 mb-2" />
          <h3 className="font-bold text-gray-900">Nueva Solicitud</h3>
          <p className="text-sm text-gray-500 mt-1">Solicitar acreditación para un evento</p>
        </Link>
        <Link href="/acreditado/perfil" className="p-6 bg-purple-50 rounded-xl border border-purple-100 hover:bg-purple-100 transition">
          <i className="fas fa-user-edit text-2xl text-purple-600 mb-2" />
          <h3 className="font-bold text-gray-900">Mi Perfil</h3>
          <p className="text-sm text-gray-500 mt-1">Actualizar mis datos personales</p>
        </Link>
      </div>

      {/* Active Events */}
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        <i className="fas fa-calendar mr-2 text-gray-400" />
        Eventos con Acreditación Abierta
      </h2>

      {events.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <i className="fas fa-calendar-times text-3xl text-gray-300 mb-3" />
          <p className="text-gray-400">No hay eventos activos en este momento</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Primero los eventos con plazo abierto, luego los cerrados */}
          {events
            .sort((a, b) => {
              const aClosed = isDeadlinePast(a.fecha_limite_acreditacion);
              const bClosed = isDeadlinePast(b.fecha_limite_acreditacion);
              if (aClosed !== bClosed) return aClosed ? 1 : -1; // abiertos primero
              return 0;
            })
            .map((event) => {
            const tenant = Array.isArray(event.tenant) ? event.tenant[0] : event.tenant;
            const deadlinePassed = isDeadlinePast(event.fecha_limite_acreditacion);

            return (
              <div key={event.id} className={`bg-white rounded-xl border p-6 transition ${deadlinePassed ? 'opacity-60' : 'hover:shadow-md'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {tenant?.shield_url ? (
                      <img src={tenant.shield_url} alt="" className="w-12 h-12 object-contain" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: tenant?.color_primario || '#3b82f6' }}
                      >
                        {tenant?.nombre?.charAt(0) || '?'}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900">{event.nombre}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span>{tenant?.nombre}</span>
                        {event.fecha && <span><i className="fas fa-calendar mr-1" />{new Date(event.fecha).toLocaleDateString('es-CL')}</span>}
                        {event.venue && <span><i className="fas fa-map-marker-alt mr-1" />{event.venue}</span>}
                      </div>
                      {event.fecha_limite_acreditacion && (
                        <p className={`text-xs mt-1 ${deadlinePassed ? 'text-red-500' : 'text-gray-400'}`}>
                          <i className={`fas ${deadlinePassed ? 'fa-lock' : 'fa-clock'} mr-1`} />
                          {deadlinePassed
                            ? `Plazo cerrado: ${formatDeadlineChile(event.fecha_limite_acreditacion)}`
                            : `Plazo hasta: ${formatDeadlineChile(event.fecha_limite_acreditacion)}`
                          }
                        </p>
                      )}
                    </div>
                  </div>
                  {deadlinePassed ? (
                    <span className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed">
                      <i className="fas fa-lock mr-1" /> Cerrado
                    </span>
                  ) : (
                    <Link
                      href={`/${tenant?.slug}/acreditacion`}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                    >
                      Acreditarme
                    </Link>
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
