'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { useAdmin } from './AdminContext';
import AdminRow from './AdminRow';
import AdminExportActions from './AdminExportActions';
import type { RegistrationFull } from '@/types';
import { TIPOS_MEDIO } from '@/types';
import { LoadingSpinner, EmptyState, ButtonSpinner } from '@/components/shared/ui';

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

  const [page, setPage] = useState(1);

  const ids = Array.from(selectedIds);
  const hasSel = ids.length > 0;
  const allSelected = hasSel && selectedIds.size === registrations.length;

  // Count selected registrations that have email
  const selectedWithEmail = useMemo(() => {
    if (!hasSel) return 0;
    return registrations.filter(r => selectedIds.has(r.id) && r.profile_email).length;
  }, [registrations, selectedIds, hasSel]);

  const updateFilter = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleBulkReject = () => {
    if (!bulkRejectMotivo.trim()) return;
    handleBulkAction({ action: 'reject', registration_ids: ids, motivo_rechazo: bulkRejectMotivo });
    setShowBulkRejectInput(false);
    setBulkRejectMotivo('');
  };

  // Reset page when filters change
  const filterKey = `${filters.search}|${filters.status}|${filters.tipo_medio}|${filters.event_day_id}|${filters.event_id}`;
  useEffect(() => { setPage(1); }, [filterKey]);

  if (loading) return <LoadingSpinner size="lg" />;

  const hasActiveFilters = !!(filters.status || filters.tipo_medio || filters.search || filters.event_day_id);

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-edge">

      {/* ═══════ Filters ═══════ */}
      <div className="bg-surface border-b border-edge rounded-t-2xl">

        {/* ── Row 1: Filters ────────────────────────── */}
        <div className="px-4 py-3">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Event selector (multi-event tenants) */}
            {events.length > 1 && (
              <select
                value={filters.event_id}
                onChange={e => updateFilter('event_id', e.target.value)}
                className="px-3 py-2 rounded-lg border border-edge text-sm text-label bg-canvas focus:border-brand transition"
                aria-label="Seleccionar evento"
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
                aria-label="Filtrar por jornada"
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
                id="admin-search-input"
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
                  aria-label="Limpiar búsqueda"
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
              aria-label="Filtrar por estado"
            >
              <option value="">Estado</option>
              <option value="pendiente">⏳ Pendientes</option>
              <option value="aprobado">✅ Aprobados</option>
              <option value="rechazado">❌ Rechazados</option>
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
                    <button onClick={() => updateFilter('search', '')} aria-label="Quitar filtro búsqueda"><i className="fas fa-times text-[8px]" /></button>
                  </span>
                )}
                {filters.status && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                    {filters.status}
                    <button onClick={() => updateFilter('status', '')} aria-label="Quitar filtro estado"><i className="fas fa-times text-[8px]" /></button>
                  </span>
                )}
                {filters.tipo_medio && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-success-light text-success-dark rounded-full">
                    {filters.tipo_medio}
                    <button onClick={() => updateFilter('tipo_medio', '')} aria-label="Quitar filtro tipo medio"><i className="fas fa-times text-[8px]" /></button>
                  </span>
                )}
                {filters.event_day_id && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full">
                    {eventDays.find(d => d.id === filters.event_day_id)?.label || 'Jornada'}
                    <button onClick={() => updateFilter('event_day_id', '')} aria-label="Quitar filtro jornada"><i className="fas fa-times text-[8px]" /></button>
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
                  disabled={processing === 'bulk' || selectedWithEmail === 0}
                  title={selectedWithEmail === 0 ? 'Ninguno de los seleccionados tiene email' : `${selectedWithEmail} de ${ids.length} tienen email`}
                  className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition"
                >
                  <i className="fas fa-envelope mr-1" /> Email {selectedWithEmail < ids.length && `(${selectedWithEmail})`}
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
                <ButtonSpinner className="w-3.5 h-3.5" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════ Table ═══════ */}
      {registrations.length === 0 ? (
        <EmptyState message="No hay registros para este evento" icon="fa-inbox" />
      ) : (
        <PaginatedTable
          registrations={registrations}
          allSelected={allSelected}
          toggleSelectAll={toggleSelectAll}
          onViewDetail={onViewDetail}
          onReject={onReject}
          page={page}
          setPage={setPage}
        />
      )}

      {/* Footer */}
      {registrations.length > 0 && (
        <div className="px-4 py-2.5 bg-canvas/50 border-t border-edge text-xs text-muted flex justify-between items-center rounded-b-2xl">
          <span>Mostrando {registrations.length} registros</span>
          {hasSel && <span className="text-brand">{selectedIds.size} seleccionados</span>}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PaginatedTable — 100 rows per page, sticky thead,
   simple scroll for the current page slice.
   ═══════════════════════════════════════════════════════════ */

const PAGE_SIZE = 100;

interface PaginatedTableProps {
  registrations: RegistrationFull[];
  allSelected: boolean;
  toggleSelectAll: () => void;
  onViewDetail: (reg: RegistrationFull) => void;
  onReject: (reg: RegistrationFull) => void;
  page: number;
  setPage: (p: number) => void;
}

function PaginatedTable({
  registrations,
  allSelected,
  toggleSelectAll,
  onViewDetail,
  onReject,
  page,
  setPage,
}: PaginatedTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.ceil(registrations.length / PAGE_SIZE);
  const needsPagination = registrations.length > PAGE_SIZE;

  const pageRows = useMemo(() => {
    if (!needsPagination) return registrations;
    const start = (page - 1) * PAGE_SIZE;
    return registrations.slice(start, start + PAGE_SIZE);
  }, [registrations, page, needsPagination]);

  // Scroll to top of table when page changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [page]);

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) setPage(p);
  };

  return (
    <>
      <div ref={scrollRef} className="overflow-y-auto max-h-[70vh]">
        <table className="w-full text-base">
          <thead className="sticky top-0 z-10 bg-canvas [&_th]:border-b [&_th]:border-edge">
            <tr>
              <th className="px-3 py-2 pl-4 text-left w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-field-border text-brand"
                  aria-label="Seleccionar todos los registros"
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-body uppercase tracking-wider">RUT</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-body uppercase tracking-wider">Nombre</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-body uppercase tracking-wider">Organización</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-body uppercase tracking-wider">Tipo Medio</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-body uppercase tracking-wider">Cargo</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-body uppercase tracking-wider">Zona</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-body uppercase tracking-wider">Estado</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-body uppercase tracking-wider">Check-in</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-body uppercase tracking-wider pr-4">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {pageRows.map(reg => (
              <AdminRow key={reg.id} reg={reg} onViewDetail={onViewDetail} onReject={onReject} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {needsPagination && (
        <div className="px-4 py-2 border-t border-edge bg-surface flex items-center justify-between gap-4">
          <span className="text-xs text-muted">
            Página {page} de {totalPages}
            <span className="ml-2 text-edge">|</span>
            <span className="ml-2">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, registrations.length)} de {registrations.length}
            </span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(1)}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded-lg border border-edge text-body hover:bg-accent-light disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="Primera página"
            >
              <i className="fas fa-angle-double-left" />
            </button>
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded-lg border border-edge text-body hover:bg-accent-light disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="Página anterior"
            >
              <i className="fas fa-angle-left" />
            </button>

            {/* Page numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | 'dots')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push('dots');
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === 'dots' ? (
                  <span key={`dots-${idx}`} className="px-1 text-xs text-muted">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => goToPage(item)}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                      item === page
                        ? 'bg-brand text-white border-brand font-medium'
                        : 'border-edge text-body hover:bg-accent-light'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

            <button
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded-lg border border-edge text-body hover:bg-accent-light disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="Página siguiente"
            >
              <i className="fas fa-angle-right" />
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded-lg border border-edge text-body hover:bg-accent-light disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="Última página"
            >
              <i className="fas fa-angle-double-right" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
