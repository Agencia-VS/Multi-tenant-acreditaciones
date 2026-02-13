'use client';

import { useState } from 'react';
import Link from 'next/link';
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
    <div className="bg-surface/95 backdrop-blur-sm border-b border-edge sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            {/* Back to tenant landing */}
            <Link
              href={`/${tenant?.slug || ''}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-subtle border border-edge text-body text-sm font-medium hover:bg-edge hover:text-heading transition-all"
              title="Volver al sitio"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden md:inline">Sitio</span>
            </Link>
            {tenant?.logo_url && (
              <img src={tenant.logo_url} alt={tenant.nombre} className="h-10 w-10 rounded-lg object-contain" />
            )}
            <div>
              <h1 className="text-xl font-bold text-heading">{tenant?.nombre || 'Panel Admin'}</h1>
              <p className="text-base text-body">
                {selectedEvent ? selectedEvent.nombre : 'Sin evento seleccionado'}
                {selectedEvent?.fecha && (
                  <span className="ml-2 text-muted">
                    · {new Date(selectedEvent.fecha).toLocaleDateString('es-CL')}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-2 text-body hover:text-heading hover:bg-subtle rounded-lg transition"
              title="Recargar"
            >
              <i className="fas fa-sync-alt" />
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-3 py-2 text-body hover:text-danger hover:bg-danger-light rounded-lg transition flex items-center gap-2 disabled:opacity-50"
              title="Cerrar sesión"
            >
              {loggingOut ? (
                <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <i className="fas fa-sign-out-alt" />
              )}
              <span className="hidden sm:inline text-base font-medium">Salir</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-base font-medium rounded-t-lg transition-all flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-canvas text-brand border-b-2 border-brand'
                  : 'text-body hover:text-heading hover:bg-canvas'
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
