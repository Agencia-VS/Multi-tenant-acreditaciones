'use client';

/**
 * SuperAdmin — Gestión de Eventos
 * Crear/editar eventos con form_fields dinámicos y cupos
 * Incluye filtros por tenant, estado, búsqueda y agrupación visual.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FormFieldDefinition, Tenant, EventFull, ZoneMatchField, EventType, EventVisibility, EventDayFormData, BulkTemplateColumn } from '@/types';
import { TIPOS_MEDIO, CARGOS } from '@/types';
import { useToast, PageHeader, Modal, LoadingSpinner, EmptyState, FormActions } from '@/components/shared/ui';
import { isoToLocalDatetime, localToChileISO } from '@/lib/dates';
import ImageUploadField from '@/components/shared/ImageUploadField';
import EventFormFieldsTab from './EventFormFieldsTab';
import EventQuotasTab from './EventQuotasTab';
import EventZonesTab from './EventZonesTab';
import EventDaysTab from './EventDaysTab';
import EventBulkTemplateTab from './EventBulkTemplateTab';
import EventInvitationsTab from './EventInvitationsTab';

type SAEvent = EventFull;

interface QuotaRule {
  id?: string;
  tipo_medio: string;
  max_per_organization: number;
  max_global: number;
}

const DEFAULT_FORM_FIELDS: FormFieldDefinition[] = [
  { key: 'nombre', label: 'Nombre', type: 'text', required: true, profile_field: 'nombre' },
  { key: 'apellido', label: 'Primer Apellido', type: 'text', required: true, profile_field: 'apellido' },
  { key: 'segundo_apellido', label: 'Segundo Apellido', type: 'text', required: false, profile_field: 'datos_base.segundo_apellido' },
  { key: 'rut', label: 'RUT', type: 'text', required: true, profile_field: 'rut' },
  { key: 'email', label: 'Email', type: 'email', required: true, profile_field: 'email' },
  { key: 'telefono', label: 'Teléfono', type: 'tel', required: false, profile_field: 'telefono' },
  { key: 'medio', label: 'Medio de Comunicación', type: 'text', required: true, profile_field: 'medio' },
  { key: 'tipo_medio', label: 'Tipo de Medio', type: 'select', required: true, profile_field: 'tipo_medio', options: [...TIPOS_MEDIO] },
  { key: 'cargo', label: 'Cargo', type: 'select', required: true, profile_field: 'cargo', options: [...CARGOS] },
  { key: 'foto_url', label: 'Foto', type: 'file', required: true, profile_field: 'foto_url' },
];

export default function EventosPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [events, setEvents] = useState<SAEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SAEvent | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'form' | 'bulk' | 'cupos' | 'zonas' | 'dias' | 'invitaciones'>('general');
  const [saving, setSaving] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  // ── Filter & search state ──────────────────────────────────────────────
  const [filterTenantId, setFilterTenantId] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Derived: filtered events + grouped by tenant ───────────────────────
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (filterTenantId !== 'all' && e.tenant_id !== filterTenantId) return false;
      if (filterActive === 'active' && !e.is_active) return false;
      if (filterActive === 'inactive' && e.is_active) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const haystack = [e.nombre, e.tenant_nombre, e.venue, e.opponent_name]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, filterTenantId, filterActive, searchQuery]);

  const groupedByTenant = useMemo(() => {
    const groups: { tenantId: string; tenantName: string; color: string; events: SAEvent[] }[] = [];
    const map = new Map<string, typeof groups[number]>();
    for (const e of filteredEvents) {
      const tid = e.tenant_id;
      if (!map.has(tid)) {
        const group = {
          tenantId: tid,
          tenantName: e.tenant_nombre ?? 'Sin tenant',
          color: e.tenant_color_primario ?? '#6366f1',
          events: [] as SAEvent[],
        };
        map.set(tid, group);
        groups.push(group);
      }
      map.get(tid)!.events.push(e);
    }
    // Sort groups by tenant name
    groups.sort((a, b) => a.tenantName.localeCompare(b.tenantName));
    return groups;
  }, [filteredEvents]);

  // Counters
  const totalActive = events.filter(e => e.is_active).length;
  const totalInactive = events.length - totalActive;

  // Event form state
  const [eventForm, setEventForm] = useState({
    tenant_id: '',
    nombre: '',
    descripcion: '',
    fecha: '',
    hora: '',
    venue: '',
    league: '',
    opponent_name: '',
    opponent_logo_url: '',
    qr_enabled: false,
    fecha_limite_acreditacion: '',
    event_type: 'simple' as EventType,
    visibility: 'public' as EventVisibility,
    fecha_inicio: '',
    fecha_fin: '',
  });
  const [formFields, setFormFields] = useState<FormFieldDefinition[]>(DEFAULT_FORM_FIELDS);
  const [eventDays, setEventDays] = useState<EventDayFormData[]>([]);
  const [quotaRules, setQuotaRules] = useState<QuotaRule[]>([]);
  const [zoneRules, setZoneRules] = useState<{ id?: string; match_field: ZoneMatchField; cargo: string; zona: string }[]>([]);
  // Zonas configuradas para el evento (event.config.zonas)
  const [eventZonas, setEventZonas] = useState<string[]>([]);
  const [newEventZona, setNewEventZona] = useState('');
  // Columnas del template de carga masiva
  const [bulkTemplateColumns, setBulkTemplateColumns] = useState<BulkTemplateColumn[]>([]);

  const loadData = useCallback(async () => {
    const [tenantsRes, eventsRes] = await Promise.all([
      fetch('/api/tenants'),
      fetch('/api/events'),
    ]);
    if (tenantsRes.ok) {
      const td = await tenantsRes.json();
      setTenants(td.tenants || td);
    }
    if (eventsRes.ok) {
      const ed = await eventsRes.json();
      setEvents(ed.events || ed);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Clone event: load all config from a source event
  const handleCloneFrom = async (sourceEventId: string) => {
    if (!sourceEventId) return;
    const source = events.find(e => e.id === sourceEventId);
    if (!source) return;

    // Populate form fields from source (keep tenant_id, clear name/date)
    setEventForm(prev => ({
      ...prev,
      descripcion: source.descripcion || '',
      venue: source.venue || '',
      league: source.league || '',
      opponent_name: '',
      opponent_logo_url: '',
      qr_enabled: source.qr_enabled,
      event_type: source.event_type || 'simple',
      fecha_inicio: '',
      fecha_fin: '',
    }));
    setFormFields(source.form_fields?.length ? source.form_fields : DEFAULT_FORM_FIELDS);

    // Load event config zonas & bulk template columns
    const evConfig = source.config ?? {};
    setEventZonas(evConfig.zonas || []);
    setBulkTemplateColumns(evConfig.bulk_template_columns || []);

    // Load event days structure (without dates)
    if (source.event_type === 'multidia') {
      try {
        const daysRes = await fetch(`/api/events/${source.id}/days`);
        if (daysRes.ok) {
          const daysData = await daysRes.json();
          const daysArr = Array.isArray(daysData) ? daysData : [];
          setEventDays(daysArr.map((d: { label: string; orden: number }, i: number) => ({
            fecha: '',
            label: d.label || `Día ${i + 1}`,
            orden: d.orden,
          })));
        }
      } catch { /* ignore */ }
    } else {
      setEventDays([]);
    }

    // Load quota rules
    try {
      const res = await fetch(`/api/events/${source.id}/quotas`);
      if (res.ok) {
        const data = await res.json();
        const rules = Array.isArray(data) ? data : (data.rules || []);
        setQuotaRules(rules.map((r: QuotaRule) => ({
          tipo_medio: r.tipo_medio,
          max_per_organization: r.max_per_organization,
          max_global: r.max_global,
        })));
      }
    } catch { /* ignore */ }

    // Load zone rules
    try {
      const zRes = await fetch(`/api/events/${source.id}/zones`);
      if (zRes.ok) {
        const zData = await zRes.json();
        const zArr = Array.isArray(zData) ? zData : [];
        setZoneRules(zArr.map((r: { match_field?: string; cargo: string; zona: string }) => ({
          match_field: (r.match_field as ZoneMatchField) || 'cargo',
          cargo: r.cargo,
          zona: r.zona,
        })));
      }
    } catch { /* ignore */ }

    showSuccess(`Configuración copiada de "${source.nombre}"`);
  };

  const handleNew = () => {
    setEditing(null);
    setEventForm({
      tenant_id: tenants[0]?.id || '',
      nombre: '',
      descripcion: '',
      fecha: '',
      hora: '',
      venue: '',
      league: '',
      opponent_name: '',
      opponent_logo_url: '',
      qr_enabled: false,
      fecha_limite_acreditacion: '',
      event_type: 'simple' as EventType,
      visibility: 'public' as EventVisibility,
      fecha_inicio: '',
      fecha_fin: '',
    });
    setFormFields(DEFAULT_FORM_FIELDS);
    setEventDays([]);
    setQuotaRules([]);
    setZoneRules([]);
    setEventZonas([]);
    setNewEventZona('');
    setBulkTemplateColumns([]);
    setActiveTab('general');
    setShowForm(true);
  };

  const handleEdit = async (event: SAEvent) => {
    setEditing(event);
    setEventForm({
      tenant_id: event.tenant_id,
      nombre: event.nombre,
      descripcion: event.descripcion || '',
      fecha: event.fecha || '',
      hora: event.hora || '',
      venue: event.venue || '',
      league: event.league || '',
      opponent_name: event.opponent_name || '',
      opponent_logo_url: event.opponent_logo_url || '',
      qr_enabled: event.qr_enabled,
      fecha_limite_acreditacion: isoToLocalDatetime(event.fecha_limite_acreditacion),
      event_type: event.event_type || 'simple',
      visibility: (event.visibility as EventVisibility) || 'public',
      fecha_inicio: event.fecha_inicio || '',
      fecha_fin: event.fecha_fin || '',
    });
    setFormFields(event.form_fields?.length ? event.form_fields : DEFAULT_FORM_FIELDS);

    // Load event days for multidía events
    if (event.event_type === 'multidia') {
      try {
        const daysRes = await fetch(`/api/events/${event.id}/days`);
        if (daysRes.ok) {
          const daysData = await daysRes.json();
          const daysArr = Array.isArray(daysData) ? daysData : [];
          setEventDays(daysArr.map((d: { fecha: string; label: string; orden: number }) => ({
            fecha: d.fecha,
            label: d.label,
            orden: d.orden,
          })));
        }
      } catch {
        console.warn('No se pudieron cargar días del evento');
      }
    } else {
      setEventDays([]);
    }

    // Load event zonas from config
    const evConfig = event.config ?? {};
    setEventZonas(evConfig.zonas || []);
    setNewEventZona('');
    setBulkTemplateColumns(evConfig.bulk_template_columns || []);

    // Load quota rules (API returns array directly, not { rules: [...] })
    try {
      const res = await fetch(`/api/events/${event.id}/quotas`);
      if (res.ok) {
        const data = await res.json();
        // API returns array directly from getQuotaRulesWithUsage
        const rules = Array.isArray(data) ? data : (data.rules || []);
        setQuotaRules(rules.map((r: QuotaRule & { id?: string }) => ({
          id: r.id,
          tipo_medio: r.tipo_medio,
          max_per_organization: r.max_per_organization,
          max_global: r.max_global,
        })));
      }
    } catch {
      console.warn('No se pudieron cargar reglas de cupos');
    }

    // Load zone rules
    try {
      const zRes = await fetch(`/api/events/${event.id}/zones`);
      if (zRes.ok) {
        const zData = await zRes.json();
        const zArr = Array.isArray(zData) ? zData : [];
        setZoneRules(zArr.map((r: { id?: string; match_field?: string; cargo: string; zona: string }) => ({
          id: r.id,
          match_field: (r.match_field as ZoneMatchField) || 'cargo',
          cargo: r.cargo,
          zona: r.zona,
        })));
      }
    } catch {
      console.warn('No se pudieron cargar reglas de zonas');
    }

    setActiveTab('general');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Merge zonas into existing event config (preserving other config keys like acreditacion_abierta)
      const existingConfig: Record<string, unknown> = editing?.config && typeof editing.config === 'object' ? { ...(editing.config as Record<string, unknown>) } : {};
      const eventConfig = {
        ...existingConfig,
        zonas: eventZonas.length > 0 ? eventZonas : undefined,
        bulk_template_columns: bulkTemplateColumns.length > 0 ? bulkTemplateColumns : undefined,
      };
      if (!eventConfig.zonas) delete eventConfig.zonas;
      if (!eventConfig.bulk_template_columns) delete eventConfig.bulk_template_columns;

      const body = {
        ...eventForm,
        form_fields: formFields,
        config: eventConfig,
        event_type: eventForm.event_type,
        fecha_inicio: eventForm.event_type === 'multidia' ? eventForm.fecha_inicio || null : null,
        fecha_fin: eventForm.event_type === 'multidia' ? eventForm.fecha_fin || null : null,
        fecha_limite_acreditacion: eventForm.fecha_limite_acreditacion
          ? localToChileISO(eventForm.fecha_limite_acreditacion)
          : null,
      };

      const method = editing ? 'PATCH' : 'POST';
      const url = editing ? `/api/events?id=${editing.id}` : '/api/events';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status}: ${res.statusText}`);
      }

      const eventData = await res.json();
      const eventId = eventData.event?.id || eventData.id || editing?.id;

      // Save quota rules — upsert handles duplicates via (event_id, tipo_medio) constraint
      if (eventId) {
        // First, get existing rules to detect deletions
        const existingRes = await fetch(`/api/events/${eventId}/quotas`);
        const existingRules = existingRes.ok ? await existingRes.json() : [];
        const existingArray = Array.isArray(existingRules) ? existingRules : (existingRules.rules || []);

        // Delete rules that were removed
        for (const existing of existingArray) {
          const stillExists = quotaRules.some(r => r.tipo_medio === existing.tipo_medio);
          if (!stillExists && existing.id) {
            await fetch(`/api/events/${eventId}/quotas?rule_id=${existing.id}`, { method: 'DELETE' });
          }
        }

        // Upsert current rules
        for (const rule of quotaRules) {
          await fetch(`/api/events/${eventId}/quotas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rule),
          });
        }

        // Save zone rules — same pattern: detect deletions + upsert
        const existingZRes = await fetch(`/api/events/${eventId}/zones`);
        const existingZones = existingZRes.ok ? await existingZRes.json() : [];
        const existingZArr = Array.isArray(existingZones) ? existingZones : [];

        for (const existing of existingZArr) {
          const stillExists = zoneRules.some(r => r.match_field === existing.match_field && r.cargo === existing.cargo);
          if (!stillExists && existing.id) {
            await fetch(`/api/events/${eventId}/zones?rule_id=${existing.id}`, { method: 'DELETE' });
          }
        }

        for (const rule of zoneRules) {
          await fetch(`/api/events/${eventId}/zones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cargo: rule.cargo, zona: rule.zona, match_field: rule.match_field }),
          });
        }

        // Sync event days for multidía events
        if (eventForm.event_type === 'multidia' && eventDays.length > 0) {
          await fetch(`/api/events/${eventId}/days`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days: eventDays }),
          });
        }
      }

      setShowForm(false);
      showSuccess(editing ? 'Evento actualizado exitosamente' : 'Evento creado exitosamente');
      loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Error al guardar el evento');
    } finally {
      setSaving(false);
    }
  };

  // Form Field Management
  const addField = () => {
    setFormFields(prev => [
      ...prev,
      { key: `custom_${Date.now()}`, label: '', type: 'text', required: false },
    ]);
  };

  const updateField = (index: number, updates: Partial<FormFieldDefinition>) => {
    setFormFields(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const removeField = (index: number) => {
    setFormFields(prev => prev.filter((_, i) => i !== index));
  };

  // Quota Management
  const addQuotaRule = () => {
    const tipoField = formFields.find(f => f.key === 'tipo_medio');
    const firstTipo = tipoField?.options?.[0] || TIPOS_MEDIO[0];
    setQuotaRules(prev => [...prev, { tipo_medio: firstTipo, max_per_organization: 5, max_global: 0 }]);
  };

  const updateQuotaRule = (index: number, updates: Partial<QuotaRule>) => {
    setQuotaRules(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
  };

  const removeQuotaRule = (index: number) => {
    setQuotaRules(prev => prev.filter((_, i) => i !== index));
  };

  // Zone Management
  const addZoneRule = () => {
    setZoneRules(prev => [...prev, { match_field: 'cargo' as ZoneMatchField, cargo: '', zona: '' }]);
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const res = await fetch(`/api/events?id=${eventId}&action=delete`, { method: 'DELETE' });
      if (res.ok) {
        showSuccess('Evento eliminado permanentemente');
        setDeletingEventId(null);
        loadData();
      } else {
        const d = await res.json();
        showError(d.error || 'Error eliminando evento');
      }
    } catch {
      showError('Error de conexión');
    }
  };

  const updateZoneRule = (index: number, updates: Partial<{ match_field: ZoneMatchField; cargo: string; zona: string }>) => {
    setZoneRules(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
  };

  const removeZoneRule = (index: number) => {
    setZoneRules(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-w-0 overflow-hidden">
      <PageHeader
        title="Eventos"
        subtitle="Gestión de eventos y formularios de acreditación"
        action={{ label: 'Nuevo Evento', icon: 'fa-plus', onClick: handleNew }}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Editar Evento' : 'Nuevo Evento'}
        maxWidth="max-w-4xl"
      >

            {/* Tabs */}
            <div className="pt-3 flex gap-1 border-b overflow-x-auto">
              {(['general', 'form', 'bulk', 'cupos', 'zonas', ...(eventForm.event_type === 'multidia' ? ['dias' as const] : []), ...(editing && eventForm.visibility === 'invite_only' ? ['invitaciones' as const] : [])] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`px-4 py-2 -mb-px text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === tab
                      ? 'border-brand text-brand'
                      : 'border-transparent text-body hover:text-label'
                  }`}
                >
                  {tab === 'general' && <><i className="fas fa-info-circle mr-2" />General</>}
                  {tab === 'form' && <><i className="fas fa-list-alt mr-2" />Formulario ({formFields.length})</>}
                  {tab === 'bulk' && <><i className="fas fa-file-excel mr-2" />Template Masivo ({bulkTemplateColumns.length})</>}
                  {tab === 'cupos' && <><i className="fas fa-chart-pie mr-2" />Cupos ({quotaRules.length})</>}
                  {tab === 'zonas' && <><i className="fas fa-map-signs mr-2" />Zonas ({zoneRules.length})</>}
                  {tab === 'dias' && <><i className="fas fa-calendar-week mr-2" />Días ({eventDays.length})</>}
                  {tab === 'invitaciones' && <><i className="fas fa-envelope mr-2" />Invitaciones</>}
                </button>
              ))}
            </div>

            <form onSubmit={handleSave} className="pt-4">
              {/* General Tab */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                    <i className="fas fa-lightbulb mr-1.5 text-amber-500" />
                    <strong>Información general del evento.</strong> Configura nombre, fecha, lugar y tipo. Los campos obligatorios están marcados con *.
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-label mb-1">Tenant *</label>
                    <select
                      required
                      value={eventForm.tenant_id}
                      onChange={(e) => setEventForm(prev => ({ ...prev, tenant_id: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                    >
                      <option value="">Seleccionar...</option>
                      {tenants.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                    <p className="text-xs text-muted mt-1">Organización dueña del evento. Cada tenant tiene su propio panel de administración.</p>
                  </div>

                  {/* Clone from previous event */}
                  {!editing && eventForm.tenant_id && (
                    <div className="p-3 rounded-lg bg-info-light border border-brand/20">
                      <label className="block text-sm font-medium text-brand mb-1">
                        <i className="fas fa-copy mr-1.5" />Copiar configuración de evento anterior
                      </label>
                      <select
                        value=""
                        onChange={(e) => handleCloneFrom(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-brand/30 text-heading bg-white text-sm"
                      >
                        <option value="">Crear desde cero (sin copiar)</option>
                        {events
                          .filter(e => e.tenant_id === eventForm.tenant_id)
                          .map(e => (
                            <option key={e.id} value={e.id}>
                              {e.nombre}{e.fecha ? ` — ${new Date(e.fecha).toLocaleDateString('es-CL')}` : ''}
                            </option>
                          ))
                        }
                      </select>
                      <p className="text-xs text-brand/70 mt-1">
                        Copia formulario, cupos, zonas y tipo de evento. Nombre, fecha y rival quedan vacíos.
                      </p>
                    </div>
                  )}

                  {/* Tipo de evento */}
                  <div>
                    <label className="block text-sm font-medium text-label mb-1">Tipo de Evento</label>
                    <p className="text-xs text-muted mb-2">Define el flujo del evento. Puedes cambiarlo después.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                      {([
                        { value: 'simple', label: 'Simple', icon: 'fa-calendar-check', desc: 'Un solo check-in' },
                        { value: 'deportivo', label: 'Deportivo', icon: 'fa-futbol', desc: 'Con rival (VS)' },
                        { value: 'multidia', label: 'Multidía', icon: 'fa-calendar-week', desc: 'Varias jornadas' },
                      ] as const).map(({ value, label, icon, desc }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setEventForm(prev => ({ ...prev, event_type: value }))}
                          className={`p-3 rounded-lg border-2 text-left transition ${
                            eventForm.event_type === value
                              ? 'border-brand bg-info-light'
                              : 'border-field-border hover:border-brand/40'
                          }`}
                        >
                          <i className={`fas ${icon} mr-2 ${eventForm.event_type === value ? 'text-brand' : 'text-muted'}`} />
                          <span className={`text-sm font-semibold ${eventForm.event_type === value ? 'text-brand' : 'text-heading'}`}>{label}</span>
                          <p className="text-xs text-body mt-0.5">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Visibilidad del evento */}
                  <div>
                    <label className="block text-sm font-medium text-label mb-1">Visibilidad</label>
                    <p className="text-xs text-muted mb-2">Público: aparece en la landing. Por invitación: solo accesible con link directo.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {([
                        { value: 'public', label: 'Público', icon: 'fa-globe', desc: 'Visible en landing del tenant' },
                        { value: 'invite_only', label: 'Por Invitación', icon: 'fa-envelope', desc: 'Requiere link de invitación' },
                      ] as const).map(({ value, label, icon, desc }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setEventForm(prev => ({ ...prev, visibility: value }))}
                          className={`p-3 rounded-lg border-2 text-left transition ${
                            eventForm.visibility === value
                              ? 'border-brand bg-info-light'
                              : 'border-field-border hover:border-brand/40'
                          }`}
                        >
                          <i className={`fas ${icon} mr-2 ${eventForm.visibility === value ? 'text-brand' : 'text-muted'}`} />
                          <span className={`text-sm font-semibold ${eventForm.visibility === value ? 'text-brand' : 'text-heading'}`}>{label}</span>
                          <p className="text-xs text-body mt-0.5">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-label mb-1">Nombre del Evento *</label>
                      <input
                        type="text"
                        required
                        value={eventForm.nombre}
                        onChange={(e) => setEventForm(prev => ({ ...prev, nombre: e.target.value }))}
                        placeholder="ej: UC vs Colo-Colo"
                        className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                      />
                      <p className="text-xs text-muted mt-1">Nombre visible para los acreditados en el formulario de registro.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-label mb-1">Venue</label>
                      <input
                        type="text"
                        value={eventForm.venue}
                        onChange={(e) => setEventForm(prev => ({ ...prev, venue: e.target.value }))}
                        placeholder="ej: Estadio San Carlos de Apoquindo"
                        className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                      />
                      <p className="text-xs text-muted mt-1">Lugar donde se realiza el evento. Se muestra en la credencial y landing.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-label mb-1">Descripción</label>
                    <textarea
                      value={eventForm.descripcion}
                      onChange={(e) => setEventForm(prev => ({ ...prev, descripcion: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                    />
                    <p className="text-xs text-muted mt-1">Información adicional que se muestra en la landing del evento. Opcional.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-label mb-1">Fecha</label>
                      <input
                        type="date"
                        value={eventForm.fecha}
                        onChange={(e) => setEventForm(prev => ({ ...prev, fecha: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                      />
                      <p className="text-xs text-muted mt-1">Día del evento (o primer día si es multidía).</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-label mb-1">Hora</label>
                      <input
                        type="time"
                        value={eventForm.hora}
                        onChange={(e) => setEventForm(prev => ({ ...prev, hora: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                      />
                      <p className="text-xs text-muted mt-1">Hora de inicio. Se usa en la credencial.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-label mb-1">Fecha Límite Acreditación</label>
                      <input
                        type="datetime-local"
                        value={eventForm.fecha_limite_acreditacion}
                        onChange={(e) => setEventForm(prev => ({ ...prev, fecha_limite_acreditacion: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                      />
                      <p className="text-xs text-muted mt-1">Después de esta fecha, el formulario se cierra automáticamente.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-label mb-1">Liga/Competición</label>
                      <input
                        type="text"
                        value={eventForm.league}
                        onChange={(e) => setEventForm(prev => ({ ...prev, league: e.target.value }))}
                        placeholder="ej: Primera División"
                        className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                      />
                      <p className="text-xs text-muted mt-1">Solo para eventos deportivos. Se muestra en el banner VS.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-label mb-1">Rival</label>
                      <input
                        type="text"
                        value={eventForm.opponent_name}
                        onChange={(e) => setEventForm(prev => ({ ...prev, opponent_name: e.target.value }))}
                        placeholder="ej: Colo-Colo"
                        className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                      />
                      <p className="text-xs text-muted mt-1">Equipo rival. Solo aplica para eventos de tipo Deportivo.</p>
                    </div>
                    <ImageUploadField
                      label="Logo Rival"
                      value={eventForm.opponent_logo_url}
                      onChange={(url) => setEventForm(prev => ({ ...prev, opponent_logo_url: url }))}
                      folder="events"
                      rounded
                      previewSize="sm"
                    />
                  </div>

                  <label className="flex items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      checked={eventForm.qr_enabled}
                      onChange={(e) => setEventForm(prev => ({ ...prev, qr_enabled: e.target.checked }))}
                      className="w-5 h-5 rounded text-brand"
                    />
                    <div>
                      <span className="font-medium text-label">
                        <i className="fas fa-qrcode mr-2" />
                        Habilitar QR para control de acceso
                      </span>
                      <p className="text-xs text-muted mt-0.5">Genera un código QR único por acreditado aprobado para escanear en la entrada.</p>
                    </div>
                  </label>
                </div>
              )}

              {/* Form Builder Tab */}
              {activeTab === 'form' && (
                <EventFormFieldsTab
                  formFields={formFields}
                  addField={addField}
                  updateField={updateField}
                  removeField={removeField}
                />
              )}

              {/* Bulk Template Tab */}
              {activeTab === 'bulk' && (
                <EventBulkTemplateTab
                  columns={bulkTemplateColumns}
                  formFields={formFields}
                  onChange={setBulkTemplateColumns}
                  eventZonas={eventZonas}
                />
              )}

              {/* Quota Rules Tab */}
              {activeTab === 'cupos' && (
                <EventQuotasTab
                  quotaRules={quotaRules}
                  formFields={formFields}
                  isEditing={!!editing}
                  addQuotaRule={addQuotaRule}
                  updateQuotaRule={updateQuotaRule}
                  removeQuotaRule={removeQuotaRule}
                />
              )}

              {/* Zone Rules Tab */}
              {activeTab === 'zonas' && (
                <EventZonesTab
                  zoneRules={zoneRules}
                  formFields={formFields}
                  eventZonas={eventZonas}
                  setEventZonas={setEventZonas}
                  newEventZona={newEventZona}
                  setNewEventZona={setNewEventZona}
                  isEditing={!!editing}
                  addZoneRule={addZoneRule}
                  updateZoneRule={updateZoneRule}
                  removeZoneRule={removeZoneRule}
                />
              )}

              {/* Event Days Tab (multidía only) */}
              {activeTab === 'dias' && eventForm.event_type === 'multidia' && (
                <EventDaysTab
                  days={eventDays}
                  setDays={setEventDays}
                  fechaInicio={eventForm.fecha_inicio}
                  fechaFin={eventForm.fecha_fin}
                  setFechaInicio={(v) => setEventForm(prev => ({ ...prev, fecha_inicio: v }))}
                  setFechaFin={(v) => setEventForm(prev => ({ ...prev, fecha_fin: v }))}
                />
              )}

              {/* Invitations Tab (invite_only, editing only) */}
              {activeTab === 'invitaciones' && editing && (
                <EventInvitationsTab eventId={editing.id} tenantSlug={editing.tenant_slug || ''} />
              )}

              <FormActions
                saving={saving}
                onCancel={() => setShowForm(false)}
                submitLabel={editing ? 'Actualizar Evento' : 'Crear Evento'}
              />
            </form>
      </Modal>

      {/* Events List */}
      {loading ? (
        <LoadingSpinner />
      ) : events.length === 0 ? (
        <EmptyState message="No hay eventos creados" icon="fa-calendar-times" action={{ label: 'Crear Evento', onClick: handleNew }} />
      ) : (
        <>
          {/* ── Filter Bar ───────────────────────────────────────────────── */}
          <div className="bg-surface rounded-xl border p-3 sm:p-4 mb-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 overflow-hidden">
            {/* Search */}
            <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, tenant, venue..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-field-border text-heading text-sm"
              />
            </div>

            {/* Tenant filter */}
            <select
              value={filterTenantId}
              onChange={(e) => setFilterTenantId(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-lg border border-field-border text-heading text-sm"
            >
              <option value="all">Todos los tenants</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>

            {/* Active/Inactive filter */}
            <div className="flex rounded-lg border border-field-border overflow-hidden text-sm w-full sm:w-auto">
              {([
                { value: 'all', label: 'Todos', count: events.length },
                { value: 'active', label: 'Activos', count: totalActive },
                { value: 'inactive', label: 'Inactivos', count: totalInactive },
              ] as const).map(({ value, label, count }) => (
                <button
                  key={value}
                  onClick={() => setFilterActive(value)}
                  className={`flex-1 sm:flex-none px-3 py-2 transition font-medium text-center ${
                    filterActive === value
                      ? 'bg-brand text-white'
                      : 'text-body hover:bg-muted/10'
                  }`}
                >
                  {label} <span className="ml-1 opacity-70">({count})</span>
                </button>
              ))}
            </div>

            {/* Results counter */}
            <span className="text-sm text-muted whitespace-nowrap">
              {filteredEvents.length === events.length
                ? `${events.length} eventos`
                : `${filteredEvents.length} de ${events.length}`}
            </span>
          </div>

          {/* ── Grouped Event List ───────────────────────────────────────── */}
          {filteredEvents.length === 0 ? (
            <EmptyState
              message="No hay eventos que coincidan con los filtros"
              icon="fa-filter"
              action={{ label: 'Limpiar filtros', onClick: () => { setFilterTenantId('all'); setFilterActive('all'); setSearchQuery(''); } }}
            />
          ) : (
            <div className="space-y-6">
              {groupedByTenant.map((group) => (
                <div key={group.tenantId}>
                  {/* Tenant group header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-1 h-8 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <h2 className="font-bold text-heading text-base">{group.tenantName}</h2>
                    <span className="text-xs text-muted bg-muted/10 px-2 py-0.5 rounded-full">
                      {group.events.length} evento{group.events.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid gap-3 pl-4 border-l-2 min-w-0" style={{ borderColor: `${group.color}30` }}>
                    {group.events.map((event) => (
                      <div key={event.id} className="bg-surface rounded-xl border p-4 sm:p-5 hover:shadow-md transition overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                          {/* Event info */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-3 h-3 rounded-full shrink-0 ${event.is_active ? 'bg-success' : 'bg-edge'}`} />
                            <div className="min-w-0">
                              <h3 className="font-bold text-heading text-base sm:text-lg truncate">{event.nombre}</h3>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-body mt-1">
                                {event.fecha && <span><i className="fas fa-calendar mr-1" />{new Date(event.fecha).toLocaleDateString('es-CL')}</span>}
                                {event.venue && <span className="truncate max-w-[180px]"><i className="fas fa-map-marker-alt mr-1" />{event.venue}</span>}
                                {event.opponent_name && <span><i className="fas fa-futbol mr-1" />vs {event.opponent_name}</span>}
                              </div>
                            </div>
                          </div>
                          {/* Badges + actions */}
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 pl-6 sm:pl-0">
                            <div className="flex flex-wrap gap-1.5 text-xs">
                              {event.event_type === 'deportivo' && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
                                  <i className="fas fa-futbol mr-1" />Deportivo
                                </span>
                              )}
                              {event.event_type === 'multidia' && (
                                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                                  <i className="fas fa-calendar-week mr-1" />Multidía
                                </span>
                              )}
                              {event.qr_enabled && (
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                                  <i className="fas fa-qrcode mr-1" />QR
                                </span>
                              )}
                              {event.visibility === 'invite_only' && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                  <i className="fas fa-envelope mr-1" />Invitación
                                </span>
                              )}
                              <span className="px-2 py-1 bg-info-light text-brand rounded-full">
                                {event.form_fields?.length || 0} campos
                              </span>
                            </div>
                            <button
                              onClick={() => handleEdit(event)}
                              className="px-3 py-1.5 bg-accent-light text-brand rounded-lg text-sm hover:bg-info-light transition"
                            >
                              <i className="fas fa-edit mr-1" /> Editar
                            </button>

                            {deletingEventId === event.id ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-danger font-medium">¿Eliminar?</span>
                                <button
                                  onClick={() => handleDeleteEvent(event.id)}
                                  className="px-2 py-1 bg-danger text-white rounded-lg text-xs font-medium hover:bg-danger/90 transition"
                                >
                                  Sí
                                </button>
                                <button
                                  onClick={() => setDeletingEventId(null)}
                                  className="px-2 py-1 text-body hover:text-label text-xs"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingEventId(event.id)}
                                className="p-1.5 text-muted hover:text-danger hover:bg-red-50 rounded-lg transition"
                                title="Eliminar evento"
                              >
                                <i className="fas fa-trash text-sm" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Link de invitación compartible */}
                        {event.visibility === 'invite_only' && event.invite_token && (
                          <div className="mt-3 p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
                            <div className="flex items-center gap-2 mb-1.5">
                              <i className="fas fa-link text-blue-500 text-xs" />
                              <span className="text-xs font-semibold text-blue-700">Link de invitación</span>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <code className="flex-1 text-xs bg-white px-3 py-2 rounded-lg border border-blue-200 text-heading block min-w-0 break-all overflow-hidden text-ellipsis">
                                {typeof window !== 'undefined' ? `${window.location.origin}/${event.tenant_slug}/acreditacion?invite=${event.invite_token}` : `/${event.tenant_slug}/acreditacion?invite=${event.invite_token}`}
                              </code>
                              <div className="flex gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  const link = `${window.location.origin}/${event.tenant_slug}/acreditacion?invite=${event.invite_token}`;
                                  navigator.clipboard.writeText(link).then(() => showSuccess('Link copiado'));
                                }}
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition flex items-center gap-1.5"
                              >
                                <i className="fas fa-copy" /> Copiar
                              </button>
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(`Te invito a acreditarte: ${typeof window !== 'undefined' ? window.location.origin : ''}/${event.tenant_slug}/acreditacion?invite=${event.invite_token}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition flex items-center gap-1.5"
                              >
                                <i className="fab fa-whatsapp" /> WhatsApp
                              </a>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
