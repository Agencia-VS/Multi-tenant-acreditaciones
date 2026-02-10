'use client';

import { useState } from 'react';
import { AdminProvider, useAdmin } from './AdminContext';
import AdminHeader from './AdminHeader';
import AdminStats from './AdminStats';
import AdminFilters from './AdminFilters';
import AdminExportActions from './AdminExportActions';
import AdminTable from './AdminTable';
import AdminDetailModal from './AdminDetailModal';
import AdminRejectModal from './AdminRejectModal';
import AdminConfigTab from './AdminConfigTab';
import type { RegistrationFull } from '@/types';

function AdminDashboardInner() {
  const { activeTab } = useAdmin();
  const [detailReg, setDetailReg] = useState<RegistrationFull | null>(null);
  const [rejectReg, setRejectReg] = useState<RegistrationFull | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {activeTab === 'acreditaciones' ? (
          <div className="space-y-6">
            {/* Stats */}
            <AdminStats />

            {/* Filters + Export row */}
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <AdminFilters />
              </div>
              <div className="flex items-start">
                <AdminExportActions />
              </div>
            </div>

            {/* Table */}
            <AdminTable
              onViewDetail={reg => setDetailReg(reg)}
              onReject={reg => setRejectReg(reg)}
            />
          </div>
        ) : (
          <AdminConfigTab />
        )}
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
