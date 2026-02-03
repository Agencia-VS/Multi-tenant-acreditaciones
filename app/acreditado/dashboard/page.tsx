'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface Perfil {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  empresa: string | null;
  telefono: string | null;
  rut: string;
}

interface Acreditacion {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  cargo: string;
  empresa: string;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  created_at: string;
  tenant: {
    nombre: string;
    slug: string;
    shield_url: string | null;
  };
  evento: {
    nombre: string;
    fecha: string;
  } | null;
}

interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  shield_url: string | null;
  color_primario: string;
}

interface Evento {
  id: number;
  nombre: string;
  fecha: string;
  tenant_id: string;
}

export default function DashboardAcreditado() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [acreditaciones, setAcreditaciones] = useState<Acreditacion[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'solicitudes' | 'nueva'>('solicitudes');

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth/acreditado');
        return;
      }

      setUser(session.user);

      // Cargar perfil
      const { data: perfilData } = await supabase
        .from('mt_perfiles_acreditados')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (perfilData) {
        setPerfil(perfilData);
      }

      // Cargar acreditaciones del usuario (por email o RUT)
      const userEmail = session.user.email;
      const { data: acreditacionesData } = await supabase
        .from('mt_acreditados')
        .select(`
          id, nombre, apellido, email, cargo, empresa, status, created_at,
          tenant:tenant_id(nombre, slug, shield_url),
          evento:evento_id(nombre, fecha)
        `)
        .or(`responsable_email.eq.${userEmail},email.eq.${userEmail}`)
        .order('created_at', { ascending: false });

      if (acreditacionesData) {
        setAcreditaciones(acreditacionesData as unknown as Acreditacion[]);
      }

      // Cargar tenants disponibles
      const { data: tenantsData } = await supabase
        .from('mt_tenants')
        .select('id, nombre, slug, shield_url, color_primario')
        .eq('activo', true);

      if (tenantsData) {
        setTenants(tenantsData);
      }

      setLoading(false);
    };

    loadData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/acreditado');
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pendiente: 'bg-yellow-100 text-yellow-800',
      aprobado: 'bg-green-100 text-green-800',
      rechazado: 'bg-red-100 text-red-800',
    };
    const labels = {
      pendiente: '⏳ Pendiente',
      aprobado: '✅ Aprobado',
      rechazado: '❌ Rechazado',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const stats = {
    total: acreditaciones.length,
    pendientes: acreditaciones.filter(a => a.status === 'pendiente').length,
    aprobadas: acreditaciones.filter(a => a.status === 'aprobado').length,
    rechazadas: acreditaciones.filter(a => a.status === 'rechazado').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold">
                {perfil?.nombre?.charAt(0) || user?.email?.charAt(0) || 'A'}
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {perfil ? `${perfil.nombre} ${perfil.apellido}` : user?.email}
                </h1>
                <p className="text-sm text-gray-500">{perfil?.empresa || 'Sin empresa registrada'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link 
                href="/acreditado/perfil"
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Mi Perfil
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm border">
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Total Solicitudes</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border">
            <p className="text-3xl font-bold text-yellow-600">{stats.pendientes}</p>
            <p className="text-sm text-gray-500">Pendientes</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border">
            <p className="text-3xl font-bold text-green-600">{stats.aprobadas}</p>
            <p className="text-sm text-gray-500">Aprobadas</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border">
            <p className="text-3xl font-bold text-red-600">{stats.rechazadas}</p>
            <p className="text-sm text-gray-500">Rechazadas</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('solicitudes')}
            className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'solicitudes'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                : 'bg-white text-gray-600 hover:bg-gray-50 border'
            }`}
          >
            📋 Mis Solicitudes
          </button>
          <button
            onClick={() => setActiveTab('nueva')}
            className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'nueva'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                : 'bg-white text-gray-600 hover:bg-gray-50 border'
            }`}
          >
            ➕ Nueva Acreditación
          </button>
        </div>

        {/* Content */}
        {activeTab === 'solicitudes' ? (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            {acreditaciones.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No tienes solicitudes aún</h3>
                <p className="text-gray-500 mb-6">Comienza solicitando acreditación para un evento</p>
                <button
                  onClick={() => setActiveTab('nueva')}
                  className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                >
                  Crear primera solicitud
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acreditado</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Evento</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cargo</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {acreditaciones.map((acreditacion) => (
                      <tr key={acreditacion.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {acreditacion.tenant?.shield_url && (
                              <img 
                                src={acreditacion.tenant.shield_url} 
                                alt="" 
                                className="w-8 h-8 object-contain"
                              />
                            )}
                            <div>
                              <p className="font-medium text-gray-900">
                                {acreditacion.nombre} {acreditacion.apellido}
                              </p>
                              <p className="text-sm text-gray-500">{acreditacion.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{acreditacion.tenant?.nombre || '-'}</p>
                          <p className="text-sm text-gray-500">{acreditacion.evento?.nombre || '-'}</p>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{acreditacion.cargo}</td>
                        <td className="px-6 py-4">{getStatusBadge(acreditacion.status)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(acreditacion.created_at).toLocaleDateString('es-CL')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Selecciona un evento</h2>
            <p className="text-gray-500 mb-6">Elige la organización donde deseas solicitar acreditación</p>
            
            {tenants.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🏟️</div>
                <p className="text-gray-500">No hay eventos disponibles actualmente</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tenants.map((tenant) => (
                  <Link
                    key={tenant.id}
                    href={`/${tenant.slug}/acreditacion`}
                    className="group flex items-center gap-4 p-5 border-2 border-gray-100 rounded-2xl hover:border-blue-200 hover:bg-blue-50/50 transition-all"
                  >
                    {tenant.shield_url ? (
                      <img 
                        src={tenant.shield_url} 
                        alt={tenant.nombre}
                        className="w-14 h-14 object-contain"
                      />
                    ) : (
                      <div 
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold"
                        style={{ backgroundColor: tenant.color_primario }}
                      >
                        {tenant.nombre.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {tenant.nombre}
                      </h3>
                      <p className="text-sm text-gray-500">Solicitar acreditación →</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
