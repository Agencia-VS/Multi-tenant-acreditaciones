'use client';

import { useState } from 'react';
import { useAdmin } from './AdminContext';
import { createBrowserClient } from '@supabase/ssr';
import type { AdminTab } from '@/types';

export default function AdminHeader() {
  const { tenant, selectedEvent, activeTab, setActiveTab } = useAdmin();
  const [loggingOut, setLoggingOut] = useState(false);

  const tabs: { key: AdminTab; label: string; icon: string }[] = [
    { key: 'acreditaciones', label: 'Acreditaciones', icon: 'fa-id-badge' },
    { key: 'configuracion', label: 'Configuración', icon: 'fa-cog' },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      await supabase.auth.signOut();
      // Redirect to tenant login
      const slug = window.location.pathname.split('/')[1];
      window.location.href = `/${slug}/admin/login`;
    } catch {
      window.location.href = '/';
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            {tenant?.logo_url && (
              <img src={tenant.logo_url} alt={tenant.nombre} className="h-10 w-10 rounded-lg object-contain" />
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">{tenant?.nombre || 'Panel Admin'}</h1>
              <p className="text-sm text-gray-500">
                {selectedEvent ? selectedEvent.nombre : 'Sin evento seleccionado'}
                {selectedEvent?.fecha && (
                  <span className="ml-2 text-gray-400">
                    · {new Date(selectedEvent.fecha).toLocaleDateString('es-CL')}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
              title="Recargar"
            >
              <i className="fas fa-sync-alt" />
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-3 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-2 disabled:opacity-50"
              title="Cerrar sesión"
            >
              {loggingOut ? (
                <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <i className="fas fa-sign-out-alt" />
              )}
              <span className="hidden sm:inline text-sm font-medium">Salir</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium rounded-t-lg transition-all flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-gray-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <i className={`fas ${tab.icon}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
