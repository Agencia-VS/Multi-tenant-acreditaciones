'use client';

/**
 * SuperAdmin Dashboard — Estadísticas globales
 */
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { LoadingSpinner, StatusBadge } from '@/components/shared/ui';

interface Stats {
  total_tenants: number;
  total_events: number;
  total_registrations: number;
  pending_registrations: number;
  approved_registrations: number;
  rejected_registrations: number;
  total_profiles: number;
  recent_registrations: Array<{
    id: string;
    status: string;
    created_at: string;
    profile_nombre: string;
    profile_apellido: string;
    event_nombre: string;
    tenant_nombre: string;
  }>;
}

export default function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await fetch('/api/superadmin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      console.error('Error loading stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  const statCards = [
    { label: 'Tenants', value: stats?.total_tenants || 0, icon: 'fas fa-building', color: 'blue', href: '/superadmin/tenants' },
    { label: 'Eventos', value: stats?.total_events || 0, icon: 'fas fa-calendar', color: 'purple', href: '/superadmin/eventos' },
    { label: 'Perfiles', value: stats?.total_profiles || 0, icon: 'fas fa-id-card', color: 'green', href: '/superadmin/acreditados' },
    { label: 'Acreditaciones', value: stats?.total_registrations || 0, icon: 'fas fa-ticket-alt', color: 'indigo', href: '#' },
    { label: 'Pendientes', value: stats?.pending_registrations || 0, icon: 'fas fa-clock', color: 'yellow', href: '#' },
    { label: 'Aprobadas', value: stats?.approved_registrations || 0, icon: 'fas fa-check-circle', color: 'emerald', href: '#' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Vista general de la plataforma</p>
        </div>
        <div className="flex gap-3">
          <Link href="/superadmin/tenants" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <i className="fas fa-plus mr-2" />Nuevo Tenant
          </Link>
          <Link href="/superadmin/eventos" className="px-4 py-2 bg-white border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            <i className="fas fa-calendar-plus mr-2" />Nuevo Evento
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`p-6 rounded-xl border ${colorMap[card.color]} hover:shadow-md transition`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-70">{card.label}</p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
              </div>
              <i className={`${card.icon} text-2xl opacity-40`} />
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Registrations */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          <i className="fas fa-history mr-2 text-gray-400" />
          Acreditaciones Recientes
        </h2>
        {stats?.recent_registrations && stats.recent_registrations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 font-medium">Nombre</th>
                  <th className="py-2 font-medium">Evento</th>
                  <th className="py-2 font-medium">Tenant</th>
                  <th className="py-2 font-medium">Estado</th>
                  <th className="py-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.recent_registrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">
                      {reg.profile_nombre} {reg.profile_apellido}
                    </td>
                    <td className="py-3 text-gray-600">{reg.event_nombre}</td>
                    <td className="py-3 text-gray-600">{reg.tenant_nombre}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          reg.status === 'aprobado'
                            ? 'bg-green-100 text-green-700'
                            : reg.status === 'rechazado'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {reg.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500">
                      {new Date(reg.created_at).toLocaleDateString('es-CL')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">No hay acreditaciones recientes</p>
        )}
      </div>
    </div>
  );
}
