'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RegistrationFull, RegistrationStatus, EventFull } from '@/types';
import { StatusBadge, Card, StatCard, LoadingSpinner, EmptyState, Alert } from '@/components/shared/ui';

interface AdminDashboardProps {
  tenantId: string;
  tenantSlug: string;
}

export default function AdminDashboard({ tenantId, tenantSlug }: AdminDashboardProps) {
  const [event, setEvent] = useState<EventFull | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationFull[]>([]);
  const [stats, setStats] = useState({ total: 0, pendientes: 0, aprobados: 0, rechazados: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Debounce search to avoid API bombardment on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Obtener evento activo
      const eventRes = await fetch(`/api/events?tenant_slug=${tenantSlug}&active=true`);
      const eventData = await eventRes.json();
      setEvent(eventData);

      if (eventData?.id) {
        // Obtener registros
        const params = new URLSearchParams({ event_id: eventData.id });
        if (filterStatus) params.set('status', filterStatus);
        if (debouncedSearch) params.set('search', debouncedSearch);

        const regRes = await fetch(`/api/registrations?${params}`);
        const regData = await regRes.json();
        setRegistrations(regData.data || []);
        
        // Calcular stats
        const all = regData.data || [];
        setStats({
          total: all.length,
          pendientes: all.filter((r: RegistrationFull) => r.status === 'pendiente').length,
          aprobados: all.filter((r: RegistrationFull) => r.status === 'aprobado').length,
          rechazados: all.filter((r: RegistrationFull) => r.status === 'rechazado').length,
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error cargando datos' });
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, filterStatus, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = async (regId: string, status: RegistrationStatus, motivo?: string) => {
    setProcessingId(regId);
    try {
      const res = await fetch(`/api/registrations/${regId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, motivo_rechazo: motivo, send_email: true }),
      });
      
      if (res.ok) {
        setMessage({ type: 'success', text: `Registro ${status === 'aprobado' ? 'aprobado' : 'rechazado'} correctamente` });
        fetchData();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Error al actualizar' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      const res = await fetch('/api/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_ids: Array.from(selectedIds),
          status: 'aprobado',
          send_emails: true,
        }),
      });
      
      const data = await res.json();
      setMessage({ type: 'success', text: `${data.success} registros aprobados` });
      setSelectedIds(new Set());
      fetchData();
    } catch {
      setMessage({ type: 'error', text: 'Error en operación masiva' });
    }
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    if (!event?.id) return;
    window.open(`/api/admin/export?event_id=${event.id}&format=${format}`, '_blank');
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === registrations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(registrations.map((r) => r.id)));
    }
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Panel de Administración
        </h1>
        <p className="text-gray-500 mt-1">{event?.nombre || 'Sin evento activo'}</p>
      </div>

      {message && <div className="mb-4"><Alert message={message} onClose={() => setMessage(null)} /></div>}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={stats.total} icon="fa-users" color="blue" />
        <StatCard label="Pendientes" value={stats.pendientes} icon="fa-clock" color="yellow" />
        <StatCard label="Aprobados" value={stats.aprobados} icon="fa-check" color="green" />
        <StatCard label="Rechazados" value={stats.rechazados} icon="fa-times" color="red" />
      </div>

      {/* Controls */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Buscar por nombre, RUT, organización..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
            />
          </div>

          {/* Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-900"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobado">Aprobados</option>
            <option value="rechazado">Rechazados</option>
          </select>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <button onClick={handleBulkApprove} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              <i className="fas fa-check mr-1" /> Aprobar {selectedIds.size} seleccionados
            </button>
          )}

          {/* Export */}
          <div className="flex gap-2">
            <button onClick={() => handleExport('xlsx')} className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800">
              <i className="fas fa-file-excel mr-1" /> Excel
            </button>
            <button onClick={() => handleExport('csv')} className="px-3 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700">
              <i className="fas fa-file-csv mr-1" /> CSV
            </button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {registrations.length === 0 ? (
          <EmptyState message="No hay registros" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3 text-left">
                    <input type="checkbox" checked={selectedIds.size === registrations.length && registrations.length > 0} onChange={toggleSelectAll} className="rounded" />
                  </th>
                  <th className="p-3 text-left font-semibold text-gray-600">RUT</th>
                  <th className="p-3 text-left font-semibold text-gray-600">Nombre</th>
                  <th className="p-3 text-left font-semibold text-gray-600">Organización</th>
                  <th className="p-3 text-left font-semibold text-gray-600">Tipo Medio</th>
                  <th className="p-3 text-left font-semibold text-gray-600">Cargo</th>
                  <th className="p-3 text-left font-semibold text-gray-600">Estado</th>
                  <th className="p-3 text-left font-semibold text-gray-600">Check-in</th>
                  <th className="p-3 text-left font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((reg) => (
                  <tr key={reg.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-3">
                      <input type="checkbox" checked={selectedIds.has(reg.id)} onChange={() => toggleSelect(reg.id)} className="rounded" />
                    </td>
                    <td className="p-3 font-mono text-gray-700">{reg.rut}</td>
                    <td className="p-3">
                      <div className="font-medium text-gray-900">{reg.profile_nombre} {reg.profile_apellido}</div>
                      <div className="text-xs text-gray-400">{reg.profile_email}</div>
                    </td>
                    <td className="p-3 text-gray-700">{reg.organizacion || '-'}</td>
                    <td className="p-3 text-gray-700">{reg.tipo_medio || '-'}</td>
                    <td className="p-3 text-gray-700">{reg.cargo || '-'}</td>
                    <td className="p-3"><StatusBadge status={reg.status} /></td>
                    <td className="p-3">
                      {reg.checked_in ? (
                        <span className="text-green-600 text-xs font-medium"><i className="fas fa-check-circle mr-1" />Sí</span>
                      ) : (
                        <span className="text-gray-400 text-xs">No</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {reg.status === 'pendiente' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(reg.id, 'aprobado')}
                              disabled={processingId === reg.id}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                            >
                              <i className="fas fa-check" />
                            </button>
                            <button
                              onClick={() => {
                                const motivo = prompt('Motivo del rechazo:');
                                if (motivo) handleStatusChange(reg.id, 'rechazado', motivo);
                              }}
                              disabled={processingId === reg.id}
                              className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
                            >
                              <i className="fas fa-times" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
