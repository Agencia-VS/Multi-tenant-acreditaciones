'use client';

/**
 * SuperAdmin — Gestión de Eventos
 * Crear/editar eventos con form_fields dinámicos y cupos
 */
import { useState, useEffect, useCallback } from 'react';
import type { FormFieldDefinition } from '@/types';
import type { ZoneMatchField } from '@/types';
import { TIPOS_MEDIO, CARGOS } from '@/types';
import { Toast, useToast, PageHeader, Modal, LoadingSpinner, EmptyState, FormActions } from '@/components/shared/ui';
import { isoToLocalDatetime, localToChileISO } from '@/lib/dates';

interface Tenant { id: string; nombre: string; slug: string; config?: Record<string, unknown>; }
interface Event {
  id: string;
  tenant_id: string;
  nombre: string;
  descripcion: string | null;
  fecha: string | null;
  hora: string | null;
  venue: string | null;
  league: string | null;
  opponent_name: string | null;
  opponent_logo_url: string | null;
  is_active: boolean;
  qr_enabled: boolean;
  fecha_limite_acreditacion: string | null;
  form_fields: FormFieldDefinition[];
  tenant?: Tenant;
}

interface QuotaRule {
  id?: string;
  tipo_medio: string;
  max_per_organization: number;
  max_global: number;
}

const FIELD_TYPES = ['text', 'email', 'tel', 'select', 'checkbox', 'file', 'textarea', 'number'] as const;

/* ═══════════════════════════════════════════════════════
   Select Options Editor — tag-based UI for select fields
   ═══════════════════════════════════════════════════════ */
function SelectOptionsEditor({ options, onChange }: { options: string[]; onChange: (opts: string[]) => void }) {
  const [inputValue, setInputValue] = useState('');

  const addOption = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    // Support comma-separated batch add
    const newOpts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    const unique = newOpts.filter(o => !options.includes(o));
    if (unique.length > 0) {
      onChange([...options, ...unique]);
    }
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addOption();
    }
    if (e.key === 'Backspace' && inputValue === '' && options.length > 0) {
      onChange(options.slice(0, -1));
    }
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-lg border border-field-border bg-surface">
        {options.map((opt, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-light text-brand rounded-md text-xs font-medium">
            {opt}
            <button type="button" onClick={() => removeOption(i)} className="text-brand/60 hover:text-danger transition">
              <i className="fas fa-times text-[10px]" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addOption}
          placeholder={options.length === 0 ? 'Escribe opciones (Enter o coma para agregar)' : 'Agregar...'}
          className="flex-1 min-w-[120px] px-1 py-0.5 text-sm text-label border-none outline-none bg-transparent"
        />
      </div>
      <p className="text-[11px] text-muted">Enter o coma para agregar. Backspace para borrar la última.</p>
    </div>
  );
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
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'form' | 'cupos' | 'zonas'>('general');
  const [saving, setSaving] = useState(false);
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
  });
  const [formFields, setFormFields] = useState<FormFieldDefinition[]>(DEFAULT_FORM_FIELDS);
  const [quotaRules, setQuotaRules] = useState<QuotaRule[]>([]);
  const [zoneRules, setZoneRules] = useState<{ id?: string; match_field: ZoneMatchField; cargo: string; zona: string }[]>([]);

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
    });
    setFormFields(DEFAULT_FORM_FIELDS);
    setQuotaRules([]);
    setZoneRules([]);
    setActiveTab('general');
    setShowForm(true);
  };

  const handleEdit = async (event: Event) => {
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
    });
    setFormFields(event.form_fields?.length ? event.form_fields : DEFAULT_FORM_FIELDS);

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
      const body = {
        ...eventForm,
        form_fields: formFields,
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
            <div className="px-8 pt-4 flex gap-1 border-b">
              {(['general', 'form', 'cupos', 'zonas'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 -mb-px text-sm font-medium border-b-2 transition ${
                    activeTab === tab
                      ? 'border-brand text-brand'
                      : 'border-transparent text-body hover:text-label'
                  }`}
                >
                  {tab === 'general' && <><i className="fas fa-info-circle mr-2" />General</>}
                  {tab === 'form' && <><i className="fas fa-list-alt mr-2" />Formulario ({formFields.length})</>}
                  {tab === 'cupos' && <><i className="fas fa-chart-pie mr-2" />Cupos ({quotaRules.length})</>}
                  {tab === 'zonas' && <><i className="fas fa-map-signs mr-2" />Zonas ({zoneRules.length})</>}
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
                    <div>
                      <label className="block text-sm font-medium text-label mb-1">Logo Rival URL</label>
                      <input
                        type="url"
                        value={eventForm.opponent_logo_url}
                        onChange={(e) => setEventForm(prev => ({ ...prev, opponent_logo_url: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                      />
                    </div>
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
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-body">
                      Define los campos que debe llenar el acreditado. Los campos con <code className="bg-subtle px-1 rounded">profile_field</code> se auto-rellenan.
                    </p>
                    <button type="button" onClick={addField} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">
                      <i className="fas fa-plus mr-1" /> Campo
                    </button>
                  </div>

                  <div className="space-y-2">
                    {formFields.map((field, i) => (
                      <div key={i} className="bg-canvas rounded-lg p-4 border">
                        <div className="grid grid-cols-12 gap-3 items-center">
                          <input
                            type="text"
                            value={field.key}
                            onChange={(e) => updateField(i, { key: e.target.value })}
                            placeholder="key"
                            className="col-span-2 px-2 py-1 rounded border text-xs font-mono text-label"
                          />
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(i, { label: e.target.value })}
                            placeholder="Label"
                            className="col-span-3 px-2 py-1 rounded border text-sm text-label"
                          />
                          <select
                            value={field.type}
                            onChange={(e) => updateField(i, { type: e.target.value as FormFieldDefinition['type'] })}
                            className="col-span-2 px-2 py-1 rounded border text-sm text-label"
                          >
                            {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <input
                            type="text"
                            value={field.profile_field || ''}
                            onChange={(e) => updateField(i, { profile_field: e.target.value || undefined })}
                            placeholder="profile_field"
                            className="col-span-2 px-2 py-1 rounded border text-xs font-mono text-body"
                          />
                          <label className="col-span-2 flex items-center gap-1 text-xs text-body">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateField(i, { required: e.target.checked })}
                              className="rounded"
                            />
                            Obligatorio
                          </label>
                          <button
                            type="button"
                            onClick={() => removeField(i)}
                            className="col-span-1 text-red-400 hover:text-red-600 transition"
                          >
                            <i className="fas fa-trash" />
                          </button>
                        </div>
                        {field.type === 'select' && (
                          <SelectOptionsEditor
                            options={field.options || []}
                            onChange={(opts) => updateField(i, { options: opts })}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quota Rules Tab */}
              {activeTab === 'cupos' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-body">
                        Limitar acreditaciones por tipo de medio y organización.
                      </p>
                      {editing && quotaRules.some(r => r.id) && (
                        <p className="text-xs text-success mt-1">
                          <i className="fas fa-check-circle mr-1" />
                          {quotaRules.filter(r => r.id).length} regla(s) guardada(s) en base de datos
                        </p>
                      )}
                    </div>
                    <button type="button" onClick={addQuotaRule} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">
                      <i className="fas fa-plus mr-1" /> Regla
                    </button>
                  </div>

                  {quotaRules.length === 0 ? (
                    <div className="text-center py-8 text-muted">
                      <i className="fas fa-infinity text-3xl mb-2" />
                      <p>Sin restricciones de cupo. Se permiten acreditaciones ilimitadas.</p>
                      <p className="text-xs mt-2">Haz clic en &quot;+ Regla&quot; para agregar un límite.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Summary table */}
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-canvas text-left">
                              <th className="px-4 py-2 font-medium text-label">Tipo de Medio</th>
                              <th className="px-4 py-2 font-medium text-label text-center">Máx. por Org</th>
                              <th className="px-4 py-2 font-medium text-label text-center">Máx. Global</th>
                              <th className="px-4 py-2 font-medium text-label text-center">Estado</th>
                              <th className="px-4 py-2 font-medium text-label text-center w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {quotaRules.map((rule, i) => {
                              // Derive tipo_medio options from current form_fields
                              const tipoField = formFields.find(f => f.key === 'tipo_medio');
                              const tipoOptions = tipoField?.options?.length ? tipoField.options : [...TIPOS_MEDIO];

                              return (
                              <tr key={i} className="hover:bg-canvas/50">
                                <td className="px-4 py-3">
                                  <select
                                    value={rule.tipo_medio}
                                    onChange={(e) => updateQuotaRule(i, { tipo_medio: e.target.value })}
                                    className="px-2 py-1 rounded border text-sm text-label bg-transparent"
                                  >
                                    {tipoOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={rule.max_per_organization}
                                    onChange={(e) => updateQuotaRule(i, { max_per_organization: parseInt(e.target.value) || 0 })}
                                    className="w-20 px-2 py-1 rounded border text-sm text-label text-center"
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={rule.max_global}
                                    onChange={(e) => updateQuotaRule(i, { max_global: parseInt(e.target.value) || 0 })}
                                    className="w-20 px-2 py-1 rounded border text-sm text-label text-center"
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {rule.id ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success-light text-success-dark rounded-full text-xs font-medium">
                                      <i className="fas fa-check text-[10px]" /> Guardada
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warn-light text-warn-dark rounded-full text-xs font-medium">
                                      <i className="fas fa-clock text-[10px]" /> Nueva
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeQuotaRule(i)}
                                    className="text-red-400 hover:text-red-600 transition"
                                  >
                                    <i className="fas fa-trash text-sm" />
                                  </button>
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-muted">
                        <i className="fas fa-info-circle mr-1" />
                        0 = sin límite. Los cambios se aplicarán al guardar el evento.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Zone Rules Tab */}
              {activeTab === 'zonas' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-body">
                        Asignar zonas automáticamente según un campo del registro (cargo o tipo medio/área).
                      </p>
                      {editing && zoneRules.some(r => r.id) && (
                        <p className="text-xs text-success mt-1">
                          <i className="fas fa-check-circle mr-1" />
                          {zoneRules.filter(r => r.id).length} regla(s) guardada(s) en base de datos
                        </p>
                      )}
                    </div>
                    <button type="button" onClick={addZoneRule} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">
                      <i className="fas fa-plus mr-1" /> Regla
                    </button>
                  </div>

                  {zoneRules.length === 0 ? (
                    <div className="text-center py-8 text-muted">
                      <i className="fas fa-map-marked-alt text-3xl mb-2" />
                      <p>Sin reglas de zona. El admin asignará zonas manualmente.</p>
                      <p className="text-xs mt-2">Haz clic en &quot;+ Regla&quot; para mapear cargo/área → zona.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-canvas text-left">
                              <th className="px-3 py-2 font-medium text-label w-28">Campo</th>
                              <th className="px-3 py-2 font-medium text-label">Valor</th>
                              <th className="px-3 py-2 font-medium text-label w-8"><i className="fas fa-arrow-right mx-1" /></th>
                              <th className="px-3 py-2 font-medium text-label">Zona asignada</th>
                              <th className="px-3 py-2 font-medium text-label text-center w-20">Estado</th>
                              <th className="px-3 py-2 font-medium text-label text-center w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {zoneRules.map((rule, i) => {
                              // Derive options based on match_field
                              const sourceField = formFields.find(f => f.key === rule.match_field);
                              const valueOptions = sourceField?.options
                                || (rule.match_field === 'cargo' ? [...CARGOS] : [...TIPOS_MEDIO]);

                              // Also get tenant zonas for autocomplete (if available)
                              const selectedTenant = tenants.find(t => t.id === eventForm.tenant_id);
                              const tenantZonas = (selectedTenant?.config as Record<string, unknown>)?.zonas as string[] | undefined;

                              return (
                                <tr key={i} className="hover:bg-canvas/50">
                                  <td className="px-3 py-3">
                                    <select
                                      value={rule.match_field}
                                      onChange={(e) => updateZoneRule(i, { match_field: e.target.value as ZoneMatchField, cargo: '' })}
                                      className="px-2 py-1 rounded border text-xs text-label bg-transparent font-medium"
                                    >
                                      <option value="cargo">Cargo</option>
                                      <option value="tipo_medio">Tipo Medio / Área</option>
                                    </select>
                                  </td>
                                  <td className="px-3 py-3">
                                    <select
                                      value={rule.cargo}
                                      onChange={(e) => updateZoneRule(i, { cargo: e.target.value })}
                                      className="w-full px-2 py-1 rounded border text-sm text-label bg-transparent"
                                    >
                                      <option value="">Seleccionar...</option>
                                      {valueOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                  </td>
                                  <td className="px-3 py-3 text-center text-muted">
                                    <i className="fas fa-arrow-right" />
                                  </td>
                                  <td className="px-3 py-3">
                                    {tenantZonas && tenantZonas.length > 0 ? (
                                      <select
                                        value={rule.zona}
                                        onChange={(e) => updateZoneRule(i, { zona: e.target.value })}
                                        className="w-full px-2 py-1 rounded border text-sm text-label bg-transparent"
                                      >
                                        <option value="">Seleccionar zona...</option>
                                        {tenantZonas.map(z => <option key={z} value={z}>{z}</option>)}
                                      </select>
                                    ) : (
                                      <input
                                        type="text"
                                        value={rule.zona}
                                        onChange={(e) => updateZoneRule(i, { zona: e.target.value })}
                                        placeholder="Ej: Prensa, VIP, Staff, Cancha..."
                                        className="w-full px-2 py-1 rounded border text-sm text-label"
                                      />
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    {rule.id ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success-light text-success-dark rounded-full text-xs font-medium">
                                        <i className="fas fa-check text-[10px]" /> Guardada
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warn-light text-warn-dark rounded-full text-xs font-medium">
                                        <i className="fas fa-clock text-[10px]" /> Nueva
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => removeZoneRule(i)}
                                      className="text-red-400 hover:text-red-600 transition"
                                    >
                                      <i className="fas fa-trash text-sm" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-muted">
                        <i className="fas fa-info-circle mr-1" />
                        Al crear una acreditación, si el valor del campo coincide con una regla, la zona se asigna automáticamente.
                        Para mapeos 1:muchos, el admin asigna desde su dashboard.
                      </p>
                    </div>
                  )}
                </div>
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
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
