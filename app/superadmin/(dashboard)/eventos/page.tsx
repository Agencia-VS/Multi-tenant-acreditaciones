'use client';

/**
 * SuperAdmin — Gestión de Eventos
 * Crear/editar eventos con form_fields dinámicos y cupos
 */
import { useState, useEffect, useCallback } from 'react';
import type { FormFieldDefinition } from '@/types';
import { TIPOS_MEDIO, CARGOS } from '@/types';
import { Toast, useToast, PageHeader, Modal, LoadingSpinner, EmptyState, FormActions } from '@/components/shared/ui';
import { isoToLocalDatetime, localToChileISO } from '@/lib/dates';

interface Tenant { id: string; nombre: string; slug: string; }
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

const DEFAULT_FORM_FIELDS: FormFieldDefinition[] = [
  { key: 'nombre', label: 'Nombre', type: 'text', required: true, profile_field: 'nombre' },
  { key: 'apellido', label: 'Apellido', type: 'text', required: true, profile_field: 'apellido' },
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
  const [activeTab, setActiveTab] = useState<'general' | 'form' | 'cupos'>('general');
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

    // Load quota rules
    const res = await fetch(`/api/events/${event.id}/quotas`);
    if (res.ok) {
      const data = await res.json();
      setQuotaRules(data.rules || []);
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

      // Save quota rules
      if (eventId && quotaRules.length > 0) {
        for (const rule of quotaRules) {
          await fetch(`/api/events/${eventId}/quotas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rule),
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
    setQuotaRules(prev => [...prev, { tipo_medio: TIPOS_MEDIO[0], max_per_organization: 5, max_global: 0 }]);
  };

  const updateQuotaRule = (index: number, updates: Partial<QuotaRule>) => {
    setQuotaRules(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
  };

  const removeQuotaRule = (index: number) => {
    setQuotaRules(prev => prev.filter((_, i) => i !== index));
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
              {(['general', 'form', 'cupos'] as const).map((tab) => (
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
                          <div className="mt-2">
                            <input
                              type="text"
                              value={field.options?.join(', ') || ''}
                              onChange={(e) => updateField(i, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                              placeholder="Opciones separadas por coma"
                              className="w-full px-2 py-1 rounded border text-sm text-body"
                            />
                          </div>
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
                    <p className="text-sm text-body">
                      Limitar acreditaciones por tipo de medio y organización.
                    </p>
                    <button type="button" onClick={addQuotaRule} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">
                      <i className="fas fa-plus mr-1" /> Regla
                    </button>
                  </div>

                  {quotaRules.length === 0 ? (
                    <div className="text-center py-8 text-muted">
                      <i className="fas fa-infinity text-3xl mb-2" />
                      <p>Sin restricciones de cupo. Se permiten acreditaciones ilimitadas.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {quotaRules.map((rule, i) => (
                        <div key={i} className="bg-canvas rounded-lg p-4 border flex items-center gap-4">
                          <select
                            value={rule.tipo_medio}
                            onChange={(e) => updateQuotaRule(i, { tipo_medio: e.target.value })}
                            className="px-3 py-2 rounded-lg border text-sm text-label flex-1"
                          >
                            {TIPOS_MEDIO.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-body whitespace-nowrap">Max/Org:</label>
                            <input
                              type="number"
                              min="0"
                              value={rule.max_per_organization}
                              onChange={(e) => updateQuotaRule(i, { max_per_organization: parseInt(e.target.value) || 0 })}
                              className="w-20 px-2 py-2 rounded-lg border text-sm text-label"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-body whitespace-nowrap">Max Global:</label>
                            <input
                              type="number"
                              min="0"
                              value={rule.max_global}
                              onChange={(e) => updateQuotaRule(i, { max_global: parseInt(e.target.value) || 0 })}
                              className="w-20 px-2 py-2 rounded-lg border text-sm text-label"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeQuotaRule(i)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <i className="fas fa-trash" />
                          </button>
                        </div>
                      ))}
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
