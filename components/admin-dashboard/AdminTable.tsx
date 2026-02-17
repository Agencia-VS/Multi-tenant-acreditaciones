'use client';

import { useState } from 'react';
import { useAdmin } from './AdminContext';
import AdminRow from './AdminRow';
import AdminExportActions from './AdminExportActions';
import type { RegistrationFull } from '@/types';
import { TIPOS_MEDIO } from '@/types';
import { LoadingSpinner, EmptyState } from '@/components/shared/ui';

interface AdminTableProps {
  onViewDetail: (reg: RegistrationFull) => void;
  onReject: (reg: RegistrationFull) => void;
}

export default function AdminTable({ onViewDetail, onReject }: AdminTableProps) {
  const {
    registrations, loading, selectedIds, toggleSelectAll,
    handleBulkAction, processing,
    events, filters, setFilters, fetchData,
    eventDays, isMultidia,
  } = useAdmin();

  const [showBulkRejectInput, setShowBulkRejectInput] = useState(false);
  const [bulkRejectMotivo, setBulkRejectMotivo] = useState('');
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const ids = Array.from(selectedIds);
  const hasSel = ids.length > 0;
  const allSelected = hasSel && selectedIds.size === registrations.length;

  const updateFilter = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleBulkReject = () => {
    if (!bulkRejectMotivo.trim()) return;
    handleBulkAction({ action: 'reject', registration_ids: ids, motivo_rechazo: bulkRejectMotivo });
    setShowBulkRejectInput(false);
    setBulkRejectMotivo('');
  };

  if (loading) return <LoadingSpinner size="lg" />;

  const hasActiveFilters = !!(filters.status || filters.tipo_medio || filters.search || filters.event_day_id);

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-edge overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 260px)' }}>

      {/* ═══════ STICKY: Filters + Table Head ═══════ */}
      <div className="sticky top-0 z-20 bg-surface border-b border-edge flex-shrink-0">

        {/* ── Row 1: Filters ────────────────────────── */}
        <div className="px-4 py-3">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Event selector (multi-event tenants) */}
            {events.length > 1 && (
              <select
                value={filters.event_id}
                onChange={e => updateFilter('event_id', e.target.value)}
                className="px-3 py-2 rounded-lg border border-edge text-sm text-label bg-canvas focus:border-brand transition"
              >
                <option value="">Seleccionar evento</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.nombre} {ev.is_active ? '●' : ''}
                  </option>
                ))}
              </select>
            )}

            {/* Day selector (multidia events) */}
            {isMultidia && eventDays.length > 0 && (
              <select
                value={filters.event_day_id}
                onChange={e => updateFilter('event_day_id', e.target.value)}
                className="px-3 py-2 rounded-lg border border-amber-300 text-sm text-amber-800 bg-amber-50 focus:border-amber-500 transition font-medium"
              >
                <option value="">Todas las jornadas</option>
                {eventDays.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.label || d.fecha}
                  </option>
                ))}
              </select>
            )}

            {/* Search */}
            <div className="flex-1 min-w-[180px] relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm" />
              <input
                type="text"
                placeholder="Buscar nombre, RUT, org..."
                value={filters.search}
                onChange={e => updateFilter('search', e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-edge text-sm text-label bg-canvas focus:border-brand transition"
              />
              {filters.search && (
                <button
                  onClick={() => updateFilter('search', '')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-body"
                >
                  <i className="fas fa-times text-xs" />
                </button>
              )}
            </div>

            {/* Status */}
            <select
              value={filters.status}
              onChange={e => updateFilter('status', e.target.value)}
              className="px-3 py-2 rounded-lg border border-edge text-sm text-label bg-canvas focus:border-brand transition"
            >
              <option value="">Estado</option>
              <option value="pendiente">⏳ Pendientes</option>
              <option value="aprobado">✅ Aprobados</option>
              <option value="rechazado">❌ Rechazados</option>
              <option value="revision">🔍 Revisión</option>
            </select>

            {/* Tipo medio */}
            <select
              value={filters.tipo_medio}
              onChange={e => updateFilter('tipo_medio', e.target.value)}
              className="px-3 py-2 rounded-lg border border-edge text-sm text-label bg-canvas focus:border-brand transition"
            >
              <option value="">Medio</option>
              {TIPOS_MEDIO.map(tm => (
                <option key={tm} value={tm}>{tm}</option>
              ))}
            </select>

            {/* Refresh */}
            <button
              onClick={fetchData}
              className="p-2 text-body hover:text-brand hover:bg-accent-light rounded-lg transition"
              title="Actualizar"
            >
              <i className="fas fa-sync-alt text-sm" />
            </button>

            {/* Export (pushed right) */}
            <div className="ml-auto">
              <AdminExportActions />
            </div>
          </div>

          {/* Active filter pills + count */}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted">
            <span className="font-medium">{registrations.length} registros</span>
            {selectedIds.size > 0 && (
              <span className="text-brand font-medium">· {selectedIds.size} sel.</span>
            )}
            {hasActiveFilters && (
              <>
                <span className="text-edge">|</span>
                {filters.search && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-accent-light text-brand rounded-full">
                    &quot;{filters.search}&quot;
                    <button onClick={() => updateFilter('search', '')}><i className="fas fa-times text-[8px]" /></button>
                  </span>
                )}
                {filters.status && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                    {filters.status}
                    <button onClick={() => updateFilter('status', '')}><i className="fas fa-times text-[8px]" /></button>
                  </span>
                )}
                {filters.tipo_medio && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-success-light text-success-dark rounded-full">
                    {filters.tipo_medio}
                    <button onClick={() => updateFilter('tipo_medio', '')}><i className="fas fa-times text-[8px]" /></button>
                  </span>
                )}
                {filters.event_day_id && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full">
                    {eventDays.find(d => d.id === filters.event_day_id)?.label || 'Jornada'}
                    <button onClick={() => updateFilter('event_day_id', '')}><i className="fas fa-times text-[8px]" /></button>
                  </span>
                )}
                <button
                  onClick={() => setFilters({ ...filters, search: '', status: '', tipo_medio: '', event_day_id: '' })}
                  className="text-danger hover:underline"
                >
                  Limpiar
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Bulk action bar (conditional) ─────────── */}
        {hasSel && (
          <div className="bg-accent-light border-t border-blue-100 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-info-dark">
                <i className="fas fa-check-square mr-1" />
                {selectedIds.size} sel.
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleBulkAction({ action: 'approve', registration_ids: ids })}
                  disabled={processing === 'bulk'}
                  className="px-2.5 py-1 bg-[#059669] text-white rounded-lg text-xs font-medium hover:bg-[#047857] disabled:opacity-50 transition"
                >
                  <i className="fas fa-check mr-1" /> Aprobar
                </button>
                {!showBulkRejectInput ? (
                  <button
                    onClick={() => setShowBulkRejectInput(true)}
                    disabled={processing === 'bulk'}
                    className="px-2.5 py-1 bg-danger text-white rounded-lg text-xs font-medium hover:bg-danger/90 disabled:opacity-50 transition"
                  >
                    <i className="fas fa-times mr-1" /> Rechazar
                  </button>
                ) : (
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="text"
                      value={bulkRejectMotivo}
                      onChange={e => setBulkRejectMotivo(e.target.value)}
                      placeholder="Motivo..."
                      className="px-2 py-1 text-xs border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 text-heading w-48"
                      autoFocus
                    />
                    <button
                      onClick={handleBulkReject}
                      disabled={!bulkRejectMotivo.trim()}
                      className="px-2 py-1 bg-danger text-white rounded-lg text-xs font-medium hover:bg-danger/90 disabled:opacity-50 transition"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => { setShowBulkRejectInput(false); setBulkRejectMotivo(''); }}
                      className="px-1.5 py-1 text-body hover:text-label text-xs"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <button
                  onClick={() => handleBulkAction({ action: 'email', registration_ids: ids })}
                  disabled={processing === 'bulk'}
                  className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition"
                >
                  <i className="fas fa-envelope mr-1" /> Email
                </button>
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  disabled={processing === 'bulk'}
                  className="px-2.5 py-1 bg-heading text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-50 transition"
                >
                  <i className="fas fa-trash mr-1" /> Eliminar
                </button>
              </div>
              {showBulkDeleteConfirm && (
                <div className="flex items-center gap-1.5 ml-1">
                  <span className="text-xs text-danger font-medium">¿Eliminar {ids.length}?</span>
                  <button
                    onClick={() => { handleBulkAction({ action: 'delete', registration_ids: ids }); setShowBulkDeleteConfirm(false); }}
                    className="px-2 py-0.5 bg-danger text-white rounded text-xs font-medium"
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => setShowBulkDeleteConfirm(false)}
                    className="px-2 py-0.5 text-body text-xs"
                  >
                    No
                  </button>
                </div>
              )}
              {processing === 'bulk' && (
                <div className="w-3.5 h-3.5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>
        )}

        {/* ── Table head ──────────────────────────────── */}
        {registrations.length > 0 && (
          <div className="overflow-x-auto border-t border-edge">
            <table className="w-full text-base">
              <thead>
                <tr className="bg-canvas/80">
                  <th className="p-3 pl-4 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-field-border text-brand"
                    />
                  </th>
                  <th className="p-3 text-left text-xs font-semibold text-body uppercase tracking-wider">RUT</th>
                  <th className="p-3 text-left text-xs font-semibold text-body uppercase tracking-wider">Nombre</th>
                  <th className="p-3 text-left text-xs font-semibold text-body uppercase tracking-wider">Organización</th>
                  <th className="p-3 text-left text-xs font-semibold text-body uppercase tracking-wider">Tipo Medio</th>
                  <th className="p-3 text-left text-xs font-semibold text-body uppercase tracking-wider">Cargo</th>
                  <th className="p-3 text-left text-xs font-semibold text-body uppercase tracking-wider">Zona</th>
                  <th className="p-3 text-left text-xs font-semibold text-body uppercase tracking-wider">Estado</th>
                  <th className="p-3 text-left text-xs font-semibold text-body uppercase tracking-wider">Check-in</th>
                  <th className="p-3 text-left text-xs font-semibold text-body uppercase tracking-wider pr-4">Acciones</th>
                </tr>
              </thead>
            </table>
          </div>
        )}
      </div>

      {/* ═══════ SCROLLABLE: Table body ═══════ */}
      {registrations.length === 0 ? (
        <EmptyState message="No hay registros para este evento" icon="fa-inbox" />
      ) : (
        <div className="overflow-auto flex-1">
          <table className="w-full text-base">
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

      {/* Footer */}
      {registrations.length > 0 && (
        <div className="px-4 py-2.5 bg-canvas/50 border-t border-edge text-xs text-muted flex justify-between flex-shrink-0">
          <span>Mostrando {registrations.length} registros</span>
          {hasSel && <span className="text-brand">{selectedIds.size} seleccionados</span>}
        </div>
      )}
    </div>
  );
}
