'use client';

import { useState } from 'react';
import { useAdmin } from './AdminContext';
import AdminRow from './AdminRow';
import type { RegistrationFull } from '@/types';
import { LoadingSpinner, EmptyState } from '@/components/shared/ui';

interface AdminTableProps {
  onViewDetail: (reg: RegistrationFull) => void;
  onReject: (reg: RegistrationFull) => void;
}

export default function AdminTable({ onViewDetail, onReject }: AdminTableProps) {
  const {
    registrations, loading, selectedIds, toggleSelectAll,
    handleBulkAction, processing,
  } = useAdmin();

  const [showBulkRejectInput, setShowBulkRejectInput] = useState(false);
  const [bulkRejectMotivo, setBulkRejectMotivo] = useState('');

  const ids = Array.from(selectedIds);
  const hasSel = ids.length > 0;
  const allSelected = hasSel && selectedIds.size === registrations.length;

  const handleBulkReject = () => {
    if (!bulkRejectMotivo.trim()) return;
    handleBulkAction({ action: 'reject', registration_ids: ids, motivo_rechazo: bulkRejectMotivo });
    setShowBulkRejectInput(false);
    setBulkRejectMotivo('');
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-edge overflow-hidden">
      {/* Bulk action bar */}
      {hasSel && (
        <div className="bg-accent-light border-b border-blue-100 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-info-dark">
              <i className="fas fa-check-square mr-1" />
              {selectedIds.size} seleccionados
            </span>

            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction({ action: 'approve', registration_ids: ids })}
                disabled={processing === 'bulk'}
                className="px-3 py-1.5 bg-success text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition flex items-center gap-1"
              >
                <i className="fas fa-check" /> Aprobar
              </button>

              {!showBulkRejectInput ? (
                <button
                  onClick={() => setShowBulkRejectInput(true)}
                  disabled={processing === 'bulk'}
                  className="px-3 py-1.5 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger/90 disabled:opacity-50 transition flex items-center gap-1"
                >
                  <i className="fas fa-times" /> Rechazar
                </button>
              ) : (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={bulkRejectMotivo}
                    onChange={e => setBulkRejectMotivo(e.target.value)}
                    placeholder="Motivo del rechazo..."
                    className="px-3 py-1.5 text-sm border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 text-heading w-full sm:w-64"
                    autoFocus
                  />
                  <button
                    onClick={handleBulkReject}
                    disabled={!bulkRejectMotivo.trim()}
                    className="px-3 py-1.5 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger/90 disabled:opacity-50 transition"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => { setShowBulkRejectInput(false); setBulkRejectMotivo(''); }}
                    className="px-2 py-1.5 text-body hover:text-label text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              <button
                onClick={() => handleBulkAction({ action: 'email', registration_ids: ids })}
                disabled={processing === 'bulk'}
                className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition flex items-center gap-1"
              >
                <i className="fas fa-envelope" /> Email
              </button>

              <button
                onClick={() => {
                  if (confirm(`¿Eliminar ${ids.length} registros?`)) {
                    handleBulkAction({ action: 'delete', registration_ids: ids });
                  }
                }}
                disabled={processing === 'bulk'}
                className="px-3 py-1.5 bg-heading text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition flex items-center gap-1"
              >
                <i className="fas fa-trash" /> Eliminar
              </button>
            </div>

            {processing === 'bulk' && (
              <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {registrations.length === 0 ? (
        <EmptyState message="No hay registros para este evento" icon="fa-inbox" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="bg-canvas/80 border-b border-edge">
                <th className="p-3 pl-4 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-field-border text-brand"
                  />
                </th>
                <th className="p-3 text-left text-sm font-semibold text-body uppercase tracking-wider">RUT</th>
                <th className="p-3 text-left text-sm font-semibold text-body uppercase tracking-wider">Nombre</th>
                <th className="p-3 text-left text-sm font-semibold text-body uppercase tracking-wider">Organización</th>
                <th className="p-3 text-left text-sm font-semibold text-body uppercase tracking-wider">Tipo Medio</th>
                <th className="p-3 text-left text-sm font-semibold text-body uppercase tracking-wider">Cargo</th>
                <th className="p-3 text-left text-sm font-semibold text-body uppercase tracking-wider">Zona</th>
                <th className="p-3 text-left text-sm font-semibold text-body uppercase tracking-wider">Estado</th>
                <th className="p-3 text-left text-sm font-semibold text-body uppercase tracking-wider">Check-in</th>
                <th className="p-3 text-left text-sm font-semibold text-body uppercase tracking-wider pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {registrations.map(reg => (
                <AdminRow
                  key={reg.id}
                  reg={reg}
                  onViewDetail={onViewDetail}
                  onReject={onReject}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer with count */}
      {registrations.length > 0 && (
        <div className="px-4 py-3 bg-canvas/50 border-t border-edge text-sm text-muted flex justify-between">
          <span>Mostrando {registrations.length} registros</span>
          {hasSel && <span className="text-brand">{selectedIds.size} seleccionados</span>}
        </div>
      )}
    </div>
  );
}
