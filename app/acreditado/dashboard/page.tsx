'use client';

/**
 * Mis Acreditaciones — Lista de solicitudes del acreditado
 * Muestra tanto las acreditaciones propias (profile_id) como las
 * enviadas por el usuario como manager (submitted_by).
 * Consume /api/acreditado/registrations (server-side, bypasea RLS).
 */
import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/shared/ui';

interface Registration {
  id: string;
  status: string;
  organizacion: string | null;
  tipo_medio: string | null;
  cargo: string | null;
  qr_token: string | null;
  created_at: string;
  profile_id: string;
  submitted_by: string | null;
  profile_nombre: string;
  profile_apellido: string;
  rut: string;
  event: { nombre: string; fecha: string | null; venue: string | null };
  tenant: { nombre: string; slug: string; color_primario: string };
  /** true si es del propio usuario, false si fue enviada por él para otro */
  isSelf: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapReg = (r: any, isSelf: boolean): Registration => ({
  id: r.id,
  status: r.status,
  organizacion: r.organizacion ?? null,
  tipo_medio: r.tipo_medio ?? null,
  cargo: r.cargo ?? null,
  qr_token: r.qr_token ?? null,
  created_at: r.created_at,
  profile_id: r.profile_id,
  submitted_by: r.submitted_by ?? null,
  profile_nombre: r.profile_nombre,
  profile_apellido: r.profile_apellido,
  rut: r.rut,
  event: {
    nombre: r.event_nombre,
    fecha: r.event_fecha ?? null,
    venue: r.event_venue ?? null,
  },
  tenant: {
    nombre: r.tenant_nombre,
    slug: r.tenant_slug,
    color_primario: r.tenant_color_primario || '#3b82f6',
  },
  isSelf,
});

export default function DashboardPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'self' | 'team'>('all');

  useEffect(() => {
    loadRegistrations();
  }, []);

  const loadRegistrations = async () => {
    try {
      const res = await fetch('/api/acreditado/registrations');
      if (!res.ok) {
        console.error('Error cargando acreditaciones:', res.status);
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (!data.profile) {
        // Usuario sin perfil
        setLoading(false);
        return;
      }

      const own: Registration[] = (data.registrations.own || []).map((r: any) => mapReg(r, true));
      const managed: Registration[] = (data.registrations.managed || []).map((r: any) => mapReg(r, false));

      const all = [...own, ...managed]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Deduplicar por id
      const seen = new Set<string>();
      const deduped = all.filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });

      setRegistrations(deduped);
    } catch (err) {
      console.error('Error cargando acreditaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<string, { bg: string; text: string; icon: string }> = {
    pendiente: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: 'fas fa-clock' },
    aprobado: { bg: 'bg-green-100', text: 'text-green-700', icon: 'fas fa-check-circle' },
    rechazado: { bg: 'bg-red-100', text: 'text-red-700', icon: 'fas fa-times-circle' },
    revision: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'fas fa-search' },
  };

  const filtered = filter === 'all'
    ? registrations
    : filter === 'self'
      ? registrations.filter(r => r.isSelf)
      : registrations.filter(r => !r.isSelf);

  const selfCount = registrations.filter(r => r.isSelf).length;
  const teamCount = registrations.filter(r => !r.isSelf).length;

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Mis Acreditaciones</h1>
        <p className="text-gray-500 mt-1">{registrations.length} solicitudes en total</p>
      </div>

      {/* Filtros rápidos */}
      {teamCount > 0 && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas ({registrations.length})
          </button>
          <button
            onClick={() => setFilter('self')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'self' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            <i className="fas fa-user mr-1" /> Propias ({selfCount})
          </button>
          <button
            onClick={() => setFilter('team')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'team' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
            }`}
          >
            <i className="fas fa-users mr-1" /> Equipo ({teamCount})
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <i className="fas fa-ticket-alt text-4xl text-gray-300 mb-4" />
          <p className="text-gray-400 text-lg">
            {filter === 'all' ? 'No tienes acreditaciones aún' : `No hay acreditaciones de ${filter === 'self' ? 'tipo propio' : 'equipo'}`}
          </p>
          <a href="/acreditado" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            Ver eventos disponibles
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((reg) => {
            const statusCfg = statusConfig[reg.status] || statusConfig.pendiente;
            return (
              <div key={reg.id} className="bg-white rounded-xl border p-6 hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-lg">{reg.event.nombre}</h3>
                      {!reg.isSelf && (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full font-medium">
                          <i className="fas fa-users mr-1" />Equipo
                        </span>
                      )}
                    </div>
                    {!reg.isSelf && (
                      <p className="text-sm text-purple-600 mt-0.5">
                        <i className="fas fa-user mr-1" />
                        {reg.profile_nombre} {reg.profile_apellido} — {reg.rut}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span>{reg.tenant.nombre}</span>
                      {reg.event.fecha && (
                        <span><i className="fas fa-calendar mr-1" />{new Date(reg.event.fecha).toLocaleDateString('es-CL')}</span>
                      )}
                      {reg.organizacion && <span><i className="fas fa-building mr-1" />{reg.organizacion}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      {reg.tipo_medio && <span className="px-2 py-0.5 bg-gray-100 rounded-full">{reg.tipo_medio}</span>}
                      {reg.cargo && <span className="px-2 py-0.5 bg-gray-100 rounded-full">{reg.cargo}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                      <i className={`${statusCfg.icon} mr-1`} />
                      {reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
                    </span>

                    {reg.status === 'aprobado' && reg.qr_token && (
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                          <i className="fas fa-qrcode text-2xl text-gray-600" />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">QR</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
