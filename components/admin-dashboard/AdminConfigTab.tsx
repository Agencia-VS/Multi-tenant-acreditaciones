'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from './AdminContext';
import { Modal, ButtonSpinner } from '@/components/shared/ui';
import { localToChileISO } from '@/lib/dates';
import { useEventForm } from './useEventForm';
import EventFormFields from './EventFormFields';
import EventList from './EventList';
import TenantConfigInfo from './TenantConfigInfo';
import type { Event, EventConfig } from '@/types';

export default function AdminConfigTab() {
  const { tenant, events, fetchData, showSuccess, showError } = useAdmin();
  const eventForm = useEventForm();
  const { form, formFields, quotaRules, zoneRules, zonas, cloneSourceId, cloning, resetForm, syncFromEvent } = eventForm;

  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editEvent) syncFromEvent(editEvent);
  }, [editEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenCreate = () => { resetForm(); setShowCreateModal(true); };

  const handleCreateEvent = async () => {
    if (!form.nombre.trim() || !tenant) return;
    setSaving(true);
    try {
      const eventConfig: EventConfig = {};
      if (zonas.length > 0) eventConfig.zonas = zonas;

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, tenant_id: tenant.id, config: eventConfig, form_fields: formFields,
          fecha_limite_acreditacion: form.fecha_limite_acreditacion ? localToChileISO(form.fecha_limite_acreditacion) : null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        // Clonar cupos si existen
        if (quotaRules.length > 0) {
          try { for (const rule of quotaRules) { await fetch(`/api/events/${created.id}/quotas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rule) }); } } catch { /* ignore */ }
        }
        // Clonar reglas de zona si existen
        if (zoneRules.length > 0) {
          try { for (const rule of zoneRules) { await fetch(`/api/events/${created.id}/zones`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rule) }); } } catch { /* ignore */ }
        }
        showSuccess('Evento creado correctamente');
        setShowCreateModal(false);
        resetForm();
        fetchData();
      } else {
        const d = await res.json();
        showError(d.error || 'Error creando evento');
      }
    } catch { showError('Error de conexión'); }
    finally { setSaving(false); }
  };

  const handleUpdateEvent = async () => {
    if (!editEvent) return;
    setSaving(true);
    try {
      const existingConfig: EventConfig = editEvent.config || {};
      const updatedConfig: EventConfig = { ...existingConfig, zonas: zonas.length > 0 ? zonas : undefined };
      if (!updatedConfig.zonas) delete updatedConfig.zonas;

      const res = await fetch(`/api/events?id=${editEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, config: updatedConfig,
          fecha_limite_acreditacion: form.fecha_limite_acreditacion ? localToChileISO(form.fecha_limite_acreditacion) : null,
        }),
      });
      if (res.ok) { showSuccess('Evento actualizado'); setEditEvent(null); resetForm(); fetchData(); }
      else { const d = await res.json(); showError(d.error || 'Error actualizando evento'); }
    } catch { showError('Error de conexión'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <EventList onCreateNew={handleOpenCreate} onEditEvent={setEditEvent} />

      {tenant && <TenantConfigInfo tenant={tenant} eventCount={events.length} />}

      {/* Create Event Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Crear Nuevo Evento" maxWidth="max-w-2xl">
        {events.length > 0 && (
          <div className="mb-5 p-4 bg-accent-light/40 border border-brand/20 rounded-xl">
            <label className="text-xs font-semibold text-brand mb-2 block">
              <i className="fas fa-copy mr-1.5" />Copiar configuración de un evento anterior
            </label>
            <p className="text-xs text-body mb-2">Copia formulario, cupos, zonas y reglas de un evento pasado. Solo necesitas ajustar nombre y fechas.</p>
            <select
              value={cloneSourceId}
              onChange={e => eventForm.handleCloneFrom(e.target.value)}
              disabled={cloning}
              className="w-full px-4 py-2.5 border border-edge rounded-xl text-sm text-heading bg-white disabled:opacity-60"
            >
              <option value="">Crear desde cero (formulario estándar)</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.nombre}{ev.fecha ? ` — ${new Date(ev.fecha).toLocaleDateString('es-CL')}` : ''}</option>
              ))}
            </select>
            {cloning && <div className="flex items-center gap-2 mt-2 text-xs text-brand"><ButtonSpinner className="w-3 h-3" />Copiando configuración…</div>}
            {cloneSourceId && !cloning && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {formFields.length > 0 && <span className="px-2 py-1 bg-green-50 text-green-700 rounded-lg border border-green-200"><i className="fas fa-check-circle mr-1" />{formFields.length} campos</span>}
                {quotaRules.length > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200"><i className="fas fa-check-circle mr-1" />{quotaRules.length} cupos</span>}
                {zoneRules.length > 0 && <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg border border-purple-200"><i className="fas fa-check-circle mr-1" />{zoneRules.length} reglas zona</span>}
                {zonas.length > 0 && <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-200"><i className="fas fa-check-circle mr-1" />{zonas.length} zonas</span>}
              </div>
            )}
          </div>
        )}
        <EventFormFields {...eventForm} />
        <div className="flex gap-3 mt-6 pt-4 border-t border-edge">
          <button onClick={handleCreateEvent} disabled={!form.nombre.trim() || saving || cloning} className="flex-1 py-2.5 bg-brand text-on-brand rounded-xl font-medium hover:bg-brand-hover disabled:opacity-50 transition flex items-center justify-center gap-2">
            {saving ? <ButtonSpinner /> : <i className="fas fa-plus" />}
            {cloneSourceId ? 'Crear evento (con copia)' : 'Crear evento'}
          </button>
          <button onClick={() => setShowCreateModal(false)} className="px-6 py-2.5 bg-subtle text-body rounded-xl font-medium hover:bg-edge transition">Cancelar</button>
        </div>
      </Modal>

      {/* Edit Event Modal */}
      <Modal open={!!editEvent} onClose={() => setEditEvent(null)} title={`Editar: ${editEvent?.nombre || ''}`} maxWidth="max-w-2xl">
        <EventFormFields {...eventForm} />
        <div className="flex gap-3 mt-6 pt-4 border-t border-edge">
          <button onClick={handleUpdateEvent} disabled={!form.nombre.trim() || saving} className="flex-1 py-2.5 bg-brand text-on-brand rounded-xl font-medium hover:bg-brand-hover disabled:opacity-50 transition flex items-center justify-center gap-2">
            {saving ? <ButtonSpinner /> : <i className="fas fa-save" />}Guardar cambios
          </button>
          <button onClick={() => setEditEvent(null)} className="px-6 py-2.5 bg-subtle text-body rounded-xl font-medium hover:bg-edge transition">Cancelar</button>
        </div>
      </Modal>
    </div>
  );
}
