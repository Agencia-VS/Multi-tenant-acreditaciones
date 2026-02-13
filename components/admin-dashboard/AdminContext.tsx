'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type {
  Tenant, Event, EventFull, RegistrationFull, RegistrationStatus,
  AdminTab, AdminFilterState, AdminStats, AdminContextType, BulkActionPayload,
} from '@/types';
import { useToast } from '@/components/shared/ui';

const AdminCtx = createContext<AdminContextType | null>(null);

export function useAdmin() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}

interface AdminProviderProps {
  tenantId: string;
  tenantSlug: string;
  initialTenant?: Tenant;
  children: ReactNode;
}

const EMPTY_STATS: AdminStats = { total: 0, pendientes: 0, aprobados: 0, rechazados: 0, revision: 0, checked_in: 0 };
const INITIAL_FILTERS: AdminFilterState = { search: '', status: '', tipo_medio: '', event_id: '' };

export function AdminProvider({ tenantId, tenantSlug, initialTenant, children }: AdminProviderProps) {
  // ─── State ─────────────────────────────────────────
  const [tenant, setTenant] = useState<Tenant | null>(initialTenant || null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventFull | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationFull[]>([]);
  const [stats, setStats] = useState<AdminStats>(EMPTY_STATS);
  const [activeTab, setActiveTab] = useState<AdminTab>('acreditaciones');
  const [filters, setFilters] = useState<AdminFilterState>(INITIAL_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { showSuccess, showError, toast, dismiss } = useToast();

  // ─── Debounce search ─────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 400);
    return () => clearTimeout(t);
  }, [filters.search]);

  // ─── Fetch tenant + events ────────────────────────
  useEffect(() => {
    (async () => {
      try {
        // Solo fetch tenant si no se proveyó initialTenant
        if (!initialTenant) {
          const res = await fetch(`/api/tenants?all=true`);
          if (res.ok) {
            const data = await res.json();
            const tenants = Array.isArray(data) ? data : [];
            const t = tenants.find((t: Tenant) => t.id === tenantId);
            if (t) setTenant(t);
          }
        }
        const evRes = await fetch(`/api/events?tenant_id=${tenantId}`);
        if (evRes.ok) {
          const evts = await evRes.json();
          setEvents(Array.isArray(evts) ? evts : []);
        }
      } catch {
        showError('Error cargando datos del tenant');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // ─── Fetch active event on mount ──────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/events?tenant_slug=${tenantSlug}&active=true`);
        if (res.ok) {
          const ev = await res.json();
          if (ev?.id) {
            setSelectedEvent(ev);
            setFilters(f => ({ ...f, event_id: ev.id }));
          }
        }
      } catch { /* ignore */ }
    })();
  }, [tenantSlug]);

  // ─── Fetch registrations whenever event/filters change ──────────
  const fetchData = useCallback(async () => {
    const eventId = filters.event_id || selectedEvent?.id;
    if (!eventId) { setLoading(false); return; }

    setLoading(true);
    try {
      const params = new URLSearchParams({ event_id: eventId });
      if (filters.status) params.set('status', filters.status);
      if (filters.tipo_medio) params.set('tipo_medio', filters.tipo_medio);
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('limit', '500');

      const res = await fetch(`/api/registrations?${params}`);
      const json = await res.json();
      const data: RegistrationFull[] = json.data || [];
      setRegistrations(data);

      // Compute stats from full unfiltered set if no filters, otherwise from result
      setStats({
        total: data.length,
        pendientes: data.filter(r => r.status === 'pendiente').length,
        aprobados: data.filter(r => r.status === 'aprobado').length,
        rechazados: data.filter(r => r.status === 'rechazado').length,
        revision: data.filter(r => r.status === 'revision').length,
        checked_in: data.filter(r => r.checked_in).length,
      });
    } catch {
      showError('Error cargando registros');
    } finally {
      setLoading(false);
    }
  }, [filters.event_id, filters.status, filters.tipo_medio, debouncedSearch, selectedEvent?.id, showError]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Select event ─────────────────────────────────
  const selectEvent = useCallback((eventId: string) => {
    const ev = events.find(e => e.id === eventId);
    if (ev) {
      setSelectedEvent(ev as unknown as EventFull);
      setFilters(f => ({ ...f, event_id: eventId }));
      setSelectedIds(new Set());
    }
  }, [events]);

  // ─── Status change (single) ───────────────────────
  const handleStatusChange = useCallback(async (regId: string, status: RegistrationStatus, motivo?: string) => {
    setProcessing(regId);
    try {
      const res = await fetch(`/api/registrations/${regId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, motivo_rechazo: motivo, send_email: true }),
      });
      if (res.ok) {
        showSuccess(`Registro ${status === 'aprobado' ? 'aprobado' : status === 'rechazado' ? 'rechazado' : 'actualizado'} correctamente`);
        fetchData();
      } else {
        const d = await res.json();
        showError(d.error || 'Error al actualizar');
      }
    } catch {
      showError('Error de conexión');
    } finally {
      setProcessing(null);
    }
  }, [fetchData, showSuccess, showError]);

  // ─── Bulk action ──────────────────────────────────
  const handleBulkAction = useCallback(async (payload: BulkActionPayload) => {
    if (payload.registration_ids.length === 0) return;
    setProcessing('bulk');
    try {
      if (payload.action === 'approve' || payload.action === 'reject') {
        const res = await fetch('/api/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registration_ids: payload.registration_ids,
            status: payload.action === 'approve' ? 'aprobado' : 'rechazado',
            motivo_rechazo: payload.motivo_rechazo,
            send_emails: true,
          }),
        });
        const data = await res.json();
        showSuccess(`${data.success || 0} registros ${payload.action === 'approve' ? 'aprobados' : 'rechazados'}`);
      } else if (payload.action === 'delete') {
        // Delete one by one via API
        let deleted = 0;
        for (const id of payload.registration_ids) {
          const res = await fetch(`/api/registrations/${id}`, { method: 'DELETE' });
          if (res.ok) deleted++;
        }
        showSuccess(`${deleted} registros eliminados`);
      } else if (payload.action === 'email') {
        // Resend approval emails
        const res = await fetch('/api/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registration_ids: payload.registration_ids,
            status: 'aprobado',
            send_emails: true,
            resend_only: true,
          }),
        });
        const data = await res.json();
        showSuccess(`Emails reenviados: ${data.emails?.sent || 0}`);
      }
      setSelectedIds(new Set());
      fetchData();
    } catch {
      showError('Error en operación masiva');
    } finally {
      setProcessing(null);
    }
  }, [fetchData, showSuccess, showError]);

  // ─── Delete single ────────────────────────────────
  const handleDelete = useCallback(async (regId: string) => {
    setProcessing(regId);
    try {
      const res = await fetch(`/api/registrations/${regId}`, { method: 'DELETE' });
      if (res.ok) {
        showSuccess('Registro eliminado');
        fetchData();
      } else {
        const d = await res.json();
        showError(d.error || 'Error al eliminar');
      }
    } catch {
      showError('Error de conexión');
    } finally {
      setProcessing(null);
    }
  }, [fetchData, showSuccess, showError]);

  // ─── Update zona for a registration ───────────────
  const updateRegistrationZona = useCallback(async (regId: string, zona: string) => {
    try {
      const res = await fetch(`/api/registrations/${regId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datos_extra: { zona } }),
      });
      if (res.ok) {
        // Update locally without full refetch for snappy UX
        setRegistrations(prev => prev.map(r =>
          r.id === regId
            ? { ...r, datos_extra: { ...r.datos_extra, zona } }
            : r
        ));
        showSuccess(`Zona asignada: ${zona}`);
      } else {
        const d = await res.json();
        showError(d.error || 'Error asignando zona');
      }
    } catch {
      showError('Error de conexión');
    }
  }, [showSuccess, showError]);

  // ─── Selection helpers ────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === registrations.length ? new Set() : new Set(registrations.map(r => r.id))
    );
  }, [registrations]);

  // ─── Context value ─────────────────────────────────
  const value: AdminContextType = {
    tenant, events, selectedEvent, registrations, stats,
    activeTab, setActiveTab, filters, setFilters,
    selectedIds, setSelectedIds, loading, processing,
    fetchData, selectEvent, handleStatusChange, handleBulkAction, handleDelete,
    updateRegistrationZona,
    toggleSelect, toggleSelectAll,
    showSuccess, showError,
  };

  return (
    <AdminCtx.Provider value={value}>
      {children}
      {/* Global toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] max-w-md px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-3 transition-all ${
            toast.type === 'success' ? 'bg-success-light text-success-dark border-green-200' : 'bg-danger-light text-danger-dark border-red-200'
          }`}
        >
          <i className={`fas ${toast.type === 'success' ? 'fa-check-circle text-success' : 'fa-exclamation-circle text-danger'}`} />
          <span className="flex-1">{toast.text}</span>
          <button onClick={dismiss} className="text-muted hover:text-body"><i className="fas fa-times" /></button>
        </div>
      )}
    </AdminCtx.Provider>
  );
}
