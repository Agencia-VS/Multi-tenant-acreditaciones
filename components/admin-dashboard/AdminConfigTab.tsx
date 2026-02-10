'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from './AdminContext';
import { Modal, EmptyState } from '@/components/shared/ui';
import { isoToLocalDatetime, localToChileISO } from '@/lib/dates';
import type { Event } from '@/types';

export default function AdminConfigTab() {
  const { tenant, events, selectedEvent, selectEvent, showSuccess, showError, fetchData } = useAdmin();
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for create/edit
  const [form, setForm] = useState({
    nombre: '',
    fecha: '',
    hora: '',
    venue: '',
    opponent_name: '',
    opponent_logo_url: '',
    league: '',
    descripcion: '',
    fecha_limite_acreditacion: '',
    qr_enabled: false,
  });

  useEffect(() => {
    if (editEvent) {
      setForm({
        nombre: editEvent.nombre || '',
        fecha: editEvent.fecha || '',
        hora: editEvent.hora || '',
        venue: editEvent.venue || '',
        opponent_name: editEvent.opponent_name || '',
        opponent_logo_url: editEvent.opponent_logo_url || '',
        league: editEvent.league || '',
        descripcion: editEvent.descripcion || '',
        fecha_limite_acreditacion: isoToLocalDatetime(editEvent.fecha_limite_acreditacion),
        qr_enabled: editEvent.qr_enabled || false,
      });
    }
  }, [editEvent]);

  const resetForm = () => {
    setForm({ nombre: '', fecha: '', hora: '', venue: '', opponent_name: '', opponent_logo_url: '', league: '', descripcion: '', fecha_limite_acreditacion: '', qr_enabled: false });
  };

  const handleCreateEvent = async () => {
    if (!form.nombre.trim() || !tenant) return;
    setSaving(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tenant_id: tenant.id,
          fecha_limite_acreditacion: form.fecha_limite_acreditacion
            ? localToChileISO(form.fecha_limite_acreditacion)
            : null,
        }),
      });
      if (res.ok) {
        showSuccess('Evento creado correctamente');
        setShowCreateModal(false);
        resetForm();
        // Reload events
        window.location.reload();
      } else {
        const d = await res.json();
        showError(d.error || 'Error creando evento');
      }
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEvent = async () => {
    if (!editEvent) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events?id=${editEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          fecha_limite_acreditacion: form.fecha_limite_acreditacion
            ? localToChileISO(form.fecha_limite_acreditacion)
            : null,
        }),
      });
      if (res.ok) {
        showSuccess('Evento actualizado');
        setEditEvent(null);
        resetForm();
        window.location.reload();
      } else {
        const d = await res.json();
        showError(d.error || 'Error actualizando evento');
      }
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (ev: Event) => {
    try {
      if (ev.is_active) {
        const res = await fetch(`/api/events?id=${ev.id}`, { method: 'DELETE' });
        if (res.ok) { showSuccess('Evento desactivado'); window.location.reload(); }
      } else {
        const res = await fetch(`/api/events?id=${ev.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true }),
        });
        if (res.ok) { showSuccess('Evento activado'); window.location.reload(); }
      }
    } catch {
      showError('Error actualizando evento');
    }
  };

  const renderFormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Nombre del evento *</label>
          <input
            value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej: UC vs Colo-Colo"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Liga / Competencia</label>
          <input
            value={form.league}
            onChange={e => setForm(f => ({ ...f, league: e.target.value }))}
            placeholder="Ej: Copa Libertadores"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Fecha</label>
          <input
            type="date"
            value={form.fecha}
            onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Hora</label>
          <input
            type="time"
            value={form.hora}
            onChange={e => setForm(f => ({ ...f, hora: e.target.value }))}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Lugar / Venue</label>
          <input
            value={form.venue}
            onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
            placeholder="Ej: Estadio San Carlos de Apoquindo"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Rival</label>
          <input
            value={form.opponent_name}
            onChange={e => setForm(f => ({ ...f, opponent_name: e.target.value }))}
            placeholder="Ej: Colo-Colo"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Logo rival (URL)</label>
          <input
            value={form.opponent_logo_url}
            onChange={e => setForm(f => ({ ...f, opponent_logo_url: e.target.value }))}
            placeholder="https://..."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Descripción</label>
        <textarea
          value={form.descripcion}
          onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
          rows={2}
          placeholder="Descripción del evento..."
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Fecha límite acreditación</label>
          <input
            type="datetime-local"
            value={form.fecha_limite_acreditacion}
            onChange={e => setForm(f => ({ ...f, fecha_limite_acreditacion: e.target.value }))}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer w-full">
            <input
              type="checkbox"
              checked={form.qr_enabled}
              onChange={e => setForm(f => ({ ...f, qr_enabled: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-gray-700">Habilitar QR</p>
              <p className="text-xs text-gray-400">Generar códigos QR al aprobar</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Events list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Eventos</h2>
            <p className="text-sm text-gray-500">Gestiona los eventos de {tenant?.nombre}</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
          >
            <i className="fas fa-plus" /> Nuevo evento
          </button>
        </div>

        {events.length === 0 ? (
          <EmptyState
            message="No hay eventos creados"
            icon="fa-calendar-plus"
            action={{ label: 'Crear primer evento', onClick: () => { resetForm(); setShowCreateModal(true); } }}
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {events.map(ev => (
              <div
                key={ev.id}
                className={`px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition ${
                  selectedEvent?.id === ev.id ? 'bg-blue-50/30 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${ev.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{ev.nombre}</p>
                    <p className="text-xs text-gray-500">
                      {ev.fecha ? new Date(ev.fecha).toLocaleDateString('es-CL') : 'Sin fecha'}
                      {ev.venue && ` · ${ev.venue}`}
                      {ev.opponent_name && ` · vs ${ev.opponent_name}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle active */}
                  <button
                    onClick={() => handleToggleActive(ev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      ev.is_active
                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {ev.is_active ? 'Activo' : 'Inactivo'}
                  </button>

                  {/* Select for dashboard */}
                  <button
                    onClick={() => selectEvent(ev.id)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition"
                  >
                    <i className="fas fa-eye mr-1" /> Ver registros
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => setEditEvent(ev)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    <i className="fas fa-pen text-sm" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tenant config info */}
      {tenant && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Configuración del Tenant</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400">Slug</p>
              <p className="text-sm font-mono text-gray-700 mt-1">{tenant.slug}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400">Color primario</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-5 h-5 rounded-md" style={{ backgroundColor: tenant.color_primario }} />
                <span className="text-sm font-mono text-gray-700">{tenant.color_primario}</span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400">Estado</p>
              <p className="text-sm text-gray-700 mt-1">{tenant.activo ? '✅ Activo' : '❌ Inactivo'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400">Total eventos</p>
              <p className="text-sm font-bold text-gray-700 mt-1">{events.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Crear Nuevo Evento" maxWidth="max-w-2xl">
        {renderFormFields()}
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={handleCreateEvent}
            disabled={!form.nombre.trim() || saving}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <i className="fas fa-plus" />}
            Crear evento
          </button>
          <button onClick={() => setShowCreateModal(false)} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition">
            Cancelar
          </button>
        </div>
      </Modal>

      {/* Edit Event Modal */}
      <Modal open={!!editEvent} onClose={() => setEditEvent(null)} title={`Editar: ${editEvent?.nombre || ''}`} maxWidth="max-w-2xl">
        {renderFormFields()}
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={handleUpdateEvent}
            disabled={!form.nombre.trim() || saving}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <i className="fas fa-save" />}
            Guardar cambios
          </button>
          <button onClick={() => setEditEvent(null)} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition">
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  );
}
