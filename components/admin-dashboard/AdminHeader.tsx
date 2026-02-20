'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAdmin } from './AdminContext';
import { ButtonSpinner } from '@/components/shared/ui';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import ChangePasswordModal from './ChangePasswordModal';
import type { AdminTab } from '@/types';

const AUTO_REFRESH_MS = 60_000; // 60s

export default function AdminHeader() {
  const { tenant, selectedEvent, activeTab, setActiveTab, stats, fetchData, loading, registrations } = useAdmin();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeAgo, setTimeAgo] = useState('');
  const [mounted, setMounted] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  // localStorage key scoped by tenant + event
  const storageKey = useMemo(() => {
    const eid = selectedEvent?.id || 'none';
    return `admin_last_seen_${tenant?.slug || 'x'}_${eid}`;
  }, [tenant?.slug, selectedEvent?.id]);

  // Load last-seen timestamp on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setLastSeenAt(stored);
    } catch { /* SSR / storage unavailable */ }
  }, [storageKey]);

  // Count new pending registrations since last visit
  const newPendientes = useMemo(() => {
    if (!lastSeenAt) return stats.pendientes; // first visit → all pending are "new"
    return registrations.filter(
      r => r.status === 'pendiente' && r.created_at > lastSeenAt
    ).length;
  }, [registrations, lastSeenAt, stats.pendientes]);

  // Only initialize date on client to avoid hydration mismatch
  useEffect(() => {
    setLastUpdated(new Date());
    setTimeAgo('ahora');
    setMounted(true);
  }, []);

  const tabs: { key: AdminTab; label: string; icon: string; badge?: number; newBadge?: number }[] = [
    { key: 'acreditaciones', label: 'Acreditaciones', icon: 'fa-id-badge', badge: stats.pendientes, newBadge: newPendientes },
    { key: 'configuracion', label: 'Configuración', icon: 'fa-cog' },
    { key: 'mail', label: 'Mail', icon: 'fa-envelope' },
  ];

  // Mark as seen when switching to the acreditaciones tab
  const handleTabChange = useCallback((tab: AdminTab) => {
    if (tab === 'acreditaciones') {
      const now = new Date().toISOString();
      try { localStorage.setItem(storageKey, now); } catch { /* ignore */ }
      setLastSeenAt(now);
    }
    setActiveTab(tab);
  }, [setActiveTab, storageKey]);

  // Track last updated timestamp
  const doRefresh = useCallback(() => {
    fetchData();
    setLastUpdated(new Date());
  }, [fetchData]);

  // Update "time ago" label every 10s
  useEffect(() => {
    if (!lastUpdated) return;
    const tick = () => {
      const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (seconds < 10) setTimeAgo('ahora');
      else if (seconds < 60) setTimeAgo(`hace ${seconds}s`);
      else setTimeAgo(`hace ${Math.floor(seconds / 60)}m`);
    };
    tick();
    const interval = setInterval(tick, 10_000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      const slug = window.location.pathname.split('/')[1];
      window.location.href = `/${slug}/admin/login`;
    } catch {
      window.location.href = '/';
    }
  };

  return (
    <div className="bg-surface/95 backdrop-blur-sm border-b border-edge top-0 z-30">
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
              <Image src={tenant.logo_url} alt={tenant.nombre} width={40} height={40} className="h-10 w-10 rounded-lg object-contain" priority />
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
            {/* Last updated indicator */}
            {mounted && (
              <span className="hidden sm:inline text-xs text-muted" title={`Última actualización: ${lastUpdated?.toLocaleTimeString('es-CL') ?? ''}`}>
                <i className={`fas fa-circle text-[6px] mr-1 ${loading ? 'text-amber-400 animate-pulse' : 'text-success'}`} />
                {timeAgo}
              </span>
            )}
            <button
              onClick={doRefresh}
              className={`px-3 py-2 text-body hover:text-heading hover:bg-subtle rounded-lg transition ${loading ? 'animate-spin' : ''}`}
              title="Actualizar datos"
            >
              <i className="fas fa-sync-alt" />
            </button>
            {/* Scanner QR — solo si el evento tiene QR habilitado */}
            {selectedEvent?.qr_enabled && (
              <Link
                href={`/${tenant?.slug || ''}/admin/scanner`}
                className="px-3 py-2 text-body hover:text-brand hover:bg-accent-light rounded-lg transition flex items-center gap-2"
                title="Scanner QR — Control de acceso"
              >
                <i className="fas fa-qrcode" />
                <span className="hidden md:inline text-base font-medium">Scanner</span>
              </Link>
            )}
            <button
              onClick={() => setShowChangePassword(true)}
              className="px-3 py-2 text-body hover:text-brand hover:bg-accent-light rounded-lg transition flex items-center gap-2"
              title="Cambiar contraseña"
              aria-label="Cambiar contraseña"
            >
              <i className="fas fa-key" />
              <span className="hidden md:inline text-base font-medium">Contraseña</span>
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-3 py-2 text-body hover:text-danger hover:bg-danger-light rounded-lg transition flex items-center gap-2 disabled:opacity-50"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              {loggingOut ? (
                <ButtonSpinner />
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
              onClick={() => handleTabChange(tab.key)}
              className={`px-5 py-3 text-base font-medium rounded-t-lg transition-all flex items-center gap-2 relative ${
                activeTab === tab.key
                  ? 'bg-canvas text-brand border-b-2 border-brand'
                  : 'text-body hover:text-heading hover:bg-canvas'
              }`}
            >
              <i className={`fas ${tab.icon}`} />
              {tab.label}
              {/* Total pending badge (amber) */}
              {tab.badge && tab.badge > 0 ? (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full bg-amber-500 text-white shadow-sm">
                  {tab.badge}
                </span>
              ) : null}
              {/* New since last visit badge (red, pulsing) */}
              {tab.newBadge && tab.newBadge > 0 && activeTab !== tab.key ? (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white shadow-sm animate-pulse -ml-1">
                  +{tab.newBadge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Modal cambiar contraseña */}
      <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </div>
  );
}
