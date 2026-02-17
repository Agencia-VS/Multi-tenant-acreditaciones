'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminProvider, useAdmin } from './AdminContext';
import AdminHeader from './AdminHeader';
import AdminStats from './AdminStats';
import AdminAccreditationControl from './AdminAccreditationControl';
import AdminTable from './AdminTable';
import AdminDetailModal from './AdminDetailModal';
import AdminRejectModal from './AdminRejectModal';
import AdminConfigTab from './AdminConfigTab';
import AdminMailTab from './AdminMailTab';
import type { RegistrationFull } from '@/types';

function AdminDashboardInner() {
  const { activeTab, setFilters, filters, fetchData } = useAdmin();
  const [detailReg, setDetailReg] = useState<RegistrationFull | null>(null);
  const [rejectReg, setRejectReg] = useState<RegistrationFull | null>(null);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl/Cmd + F → focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      const searchInput = document.getElementById('admin-search-input');
      if (searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    }
    // Escape → clear filters or close modal
    if (e.key === 'Escape') {
      if (detailReg) { setDetailReg(null); return; }
      if (rejectReg) { setRejectReg(null); return; }
      if (filters.search || filters.status || filters.tipo_medio || filters.event_day_id) {
        setFilters({ ...filters, search: '', status: '', tipo_medio: '', event_day_id: '' });
      }
    }
    // Ctrl/Cmd + R → refresh data (prevent browser reload)
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      fetchData();
    }
  }, [detailReg, rejectReg, filters, setFilters, fetchData]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="max-w-[1600px] mx-auto px-3 py-4 sm:px-6 sm:py-6">
        {activeTab === 'acreditaciones' ? (
          <div className="space-y-6">
            {/* Stats */}
            <AdminStats />

            {/* Accreditation Control */}
            <AdminAccreditationControl />

            {/* Table (includes inline filters + export + thead — all sticky) */}
            <AdminTable
              onViewDetail={reg => setDetailReg(reg)}
              onReject={reg => setRejectReg(reg)}
            />
          </div>
        ) : activeTab === 'configuracion' ? (
          <AdminConfigTab />
        ) : activeTab === 'mail' ? (
          <AdminMailTab />
        ) : null}
      </div>

      {/* Modals */}
      <AdminDetailModal
        reg={detailReg}
        open={!!detailReg}
        onClose={() => setDetailReg(null)}
      />
      <AdminRejectModal
        reg={rejectReg}
        open={!!rejectReg}
        onClose={() => setRejectReg(null)}
      />
    </div>
  );
}

interface AdminDashboardV2Props {
  tenantId: string;
  tenantSlug: string;
  initialTenant?: import('@/types').Tenant;
}

export default function AdminDashboardV2({ tenantId, tenantSlug, initialTenant }: AdminDashboardV2Props) {
  return (
    <AdminProvider tenantId={tenantId} tenantSlug={tenantSlug} initialTenant={initialTenant}>
      <AdminDashboardInner />
    </AdminProvider>
  );
}
