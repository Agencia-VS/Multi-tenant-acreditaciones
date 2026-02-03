/**
 * Dashboard Principal de SuperAdmin
 * 
 * Panel de control global con diseño limpio y moderno.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useSuperAdmin } from "../../components/superadmin";

interface Tenant {
  id: string;
  slug: string;
  nombre: string;
  logo_url: string | null;
  created_at: string;
}

export default function SuperAdminDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const { stats, isAuthenticated } = useSuperAdmin();
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (isAuthenticated) {
      loadTenants();
    }
  }, [isAuthenticated]);

  const loadTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('mt_tenants')
        .select('id, slug, nombre, logo_url, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!error && data) {
        setTenants(data);
      }
    } catch (error) {
      console.error('Error loading tenants:', error);
    } finally {
      setLoadingTenants(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Resumen general del sistema de acreditaciones
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Tenants"
          value={stats.totalTenants}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
          color="blue"
        />
        <StatCard
          title="Eventos Activos"
          value={stats.eventosActivos}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          color="green"
        />
        <StatCard
          title="Total Acreditados"
          value={stats.totalAcreditados}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
          color="purple"
        />
        <StatCard
          title="Total Eventos"
          value={stats.totalEventos}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
          color="orange"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/superadmin/tenants/new"
          className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900">Nuevo Tenant</p>
            <p className="text-sm text-gray-500">Crear nuevo cliente</p>
          </div>
        </Link>

        <Link
          href="/superadmin/eventos"
          className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900">Nuevo Evento</p>
            <p className="text-sm text-gray-500">Crear evento/partido</p>
          </div>
        </Link>

        <Link
          href="/superadmin/admins"
          className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900">Gestionar Admins</p>
            <p className="text-sm text-gray-500">Asignar administradores</p>
          </div>
        </Link>
      </div>

      {/* Tenants List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Tenants Recientes</h2>
          <Link
            href="/superadmin/tenants"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Ver todos →
          </Link>
        </div>
        
        <div className="divide-y divide-gray-100">
          {loadingTenants ? (
            <div className="px-6 py-8 text-center">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No hay tenants registrados aún.
            </div>
          ) : (
            tenants.map((tenant) => (
              <div key={tenant.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                    {tenant.logo_url ? (
                      <img src={tenant.logo_url} alt={tenant.nombre} className="w-8 h-8 object-contain" />
                    ) : (
                      <span className="text-gray-600 font-semibold">{tenant.nombre?.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{tenant.nombre}</p>
                    <p className="text-sm text-gray-500">/{tenant.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/${tenant.slug}`}
                    target="_blank"
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Ver sitio
                  </Link>
                  <Link
                    href={`/superadmin/tenants/${tenant.id}`}
                    className="px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    Editar
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  icon, 
  color 
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
