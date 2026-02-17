'use client';

/**
 * SuperAdmin — Gestión de Eventos
 * Crear/editar eventos con form_fields dinámicos y cupos
 */
import { useState, useEffect, useCallback } from 'react';
import type { FormFieldDefinition, Tenant, Event as BaseEvent, ZoneMatchField, EventType, EventDayFormData } from '@/types';
import { TIPOS_MEDIO, CARGOS } from '@/types';
import { Toast, useToast, PageHeader, Modal, LoadingSpinner, EmptyState, FormActions } from '@/components/shared/ui';
import { isoToLocalDatetime, localToChileISO } from '@/lib/dates';
import ImageUploadField from '@/components/shared/ImageUploadField';
import EventFormFieldsTab from './EventFormFieldsTab';
import EventQuotasTab from './EventQuotasTab';
import EventZonesTab from './EventZonesTab';
import EventDaysTab from './EventDaysTab';

type SAEvent = BaseEvent & { tenant?: Tenant };

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
  const [activeTab, setActiveTab] = useState<'general' | 'form' | 'cupos' | 'zonas' | 'dias'>('general');
  const [saving, setSaving] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const { toast, showSuccess, showError, dismiss } = useToast();

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
      event_type: (source as BaseEvent & { event_type?: EventType }).event_type || 'simple',
      fecha_inicio: '',
      fecha_fin: '',
    }));
    setFormFields(source.form_fields?.length ? source.form_fields : DEFAULT_FORM_FIELDS);

    // Load event config zonas
    const evConfig = (source.config || {}) as Record<string, unknown>;
    setEventZonas((evConfig.zonas as string[]) || []);

    // Load event days structure (without dates)
    if ((source as BaseEvent & { event_type?: string }).event_type === 'multidia') {
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
      fecha_inicio: '',
      fecha_fin: '',
    });
    setFormFields(DEFAULT_FORM_FIELDS);
    setEventDays([]);
    setQuotaRules([]);
    setZoneRules([]);
    setEventZonas([]);
    setNewEventZona('');
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
      event_type: (event as BaseEvent & { event_type?: EventType }).event_type || 'simple',
      fecha_inicio: (event as BaseEvent & { fecha_inicio?: string }).fecha_inicio || '',
      fecha_fin: (event as BaseEvent & { fecha_fin?: string }).fecha_fin || '',
    });
    setFormFields(event.form_fields?.length ? event.form_fields : DEFAULT_FORM_FIELDS);

    // Load event days for multidía events
    if ((event as BaseEvent & { event_type?: string }).event_type === 'multidia') {
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
    const evConfig = (event.config || {}) as Record<string, unknown>;
    setEventZonas((evConfig.zonas as string[]) || []);
    setNewEventZona('');

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
      const existingConfig = editing ? ((editing.config || {}) as Record<string, unknown>) : {};
      const eventConfig = { ...existingConfig, zonas: eventZonas.length > 0 ? eventZonas : undefined };
      if (!eventConfig.zonas) delete eventConfig.zonas;

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
    <div>
      <Toast toast={toast} onDismiss={dismiss} />
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
            <div className="px-8 pt-4 flex gap-1 border-b overflow-x-auto">
              {(['general', 'form', 'cupos', 'zonas', ...(eventForm.event_type === 'multidia' ? ['dias' as const] : [])] as const).map((tab) => (
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
                  {tab === 'cupos' && <><i className="fas fa-chart-pie mr-2" />Cupos ({quotaRules.length})</>}
                  {tab === 'zonas' && <><i className="fas fa-map-signs mr-2" />Zonas ({zoneRules.length})</>}
                  {tab === 'dias' && <><i className="fas fa-calendar-week mr-2" />Días ({eventDays.length})</>}
                </button>
              ))}
            </div>

            <form onSubmit={handleSave} className="p-8">
              {/* General Tab */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-label mb-1">Tenant</label>
                    <select
                      required
                      value={eventForm.tenant_id}
                      onChange={(e) => setEventForm(prev => ({ ...prev, tenant_id: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                    >
                      <option value="">Seleccionar...</option>
                      {tenants.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
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
                    <div className="flex gap-3">
                      {([
                        { value: 'simple', label: 'Simple', icon: 'fa-calendar-check', desc: 'Un solo check-in' },
                        { value: 'deportivo', label: 'Deportivo', icon: 'fa-futbol', desc: 'Con rival (VS)' },
                        { value: 'multidia', label: 'Multidía', icon: 'fa-calendar-week', desc: 'Varias jornadas' },
                      ] as const).map(({ value, label, icon, desc }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setEventForm(prev => ({ ...prev, event_type: value }))}
                          className={`flex-1 p-3 rounded-lg border-2 text-left transition ${
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-label mb-1">Nombre del Evento</label>
                      <input
                        type="text"
                        required
                        value={eventForm.nombre}
                        onChange={(e) => setEventForm(prev => ({ ...prev, nombre: e.target.value }))}
                        placeholder="ej: UC vs Colo-Colo"
                        className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                      />
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
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-label mb-1">Fecha</label>
                      <input
                        type="date"
                        value={eventForm.fecha}
                        onChange={(e) => setEventForm(prev => ({ ...prev, fecha: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-label mb-1">Hora</label>
                      <input
                        type="time"
                        value={eventForm.hora}
                        onChange={(e) => setEventForm(prev => ({ ...prev, hora: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-label mb-1">Fecha Límite Acreditación</label>
                      <input
                        type="datetime-local"
                        value={eventForm.fecha_limite_acreditacion}
                        onChange={(e) => setEventForm(prev => ({ ...prev, fecha_limite_acreditacion: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-label mb-1">Liga/Competición</label>
                      <input
                        type="text"
                        value={eventForm.league}
                        onChange={(e) => setEventForm(prev => ({ ...prev, league: e.target.value }))}
                        placeholder="ej: Primera División"
                        className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                      />
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
                    <span className="font-medium text-label">
                      <i className="fas fa-qrcode mr-2" />
                      Habilitar QR para control de acceso
                    </span>
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
        <div className="grid gap-4">
          {events.map((event) => (
            <div key={event.id} className="bg-surface rounded-xl border p-6 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${event.is_active ? 'bg-success' : 'bg-edge'}`} />
                  <div>
                    <h3 className="font-bold text-heading text-lg">{event.nombre}</h3>
                    <div className="flex items-center gap-4 text-sm text-body mt-1">
                      {event.tenant && <span><i className="fas fa-building mr-1" />{event.tenant.nombre}</span>}
                      {event.fecha && <span><i className="fas fa-calendar mr-1" />{new Date(event.fecha).toLocaleDateString('es-CL')}</span>}
                      {event.venue && <span><i className="fas fa-map-marker-alt mr-1" />{event.venue}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2 text-xs">
                    {/* Event type badge */}
                    {(event as BaseEvent & { event_type?: string }).event_type === 'deportivo' && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
                        <i className="fas fa-futbol mr-1" />Deportivo
                      </span>
                    )}
                    {(event as BaseEvent & { event_type?: string }).event_type === 'multidia' && (
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                        <i className="fas fa-calendar-week mr-1" />Multidía
                      </span>
                    )}
                    {event.qr_enabled && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                        <i className="fas fa-qrcode mr-1" />QR
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

                  {/* Delete event */}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
