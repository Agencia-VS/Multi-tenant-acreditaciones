'use client';

import { useState, useMemo } from 'react';
import { useAdmin } from './AdminContext';

/**
 * AdminAccreditationControl
 * 
 * Panel de control para abrir/cerrar la ventana de acreditación de un evento.
 * Muestra:
 *  - Estado actual (abierto/cerrado) basado en fecha_limite + toggle manual
 *  - Toggle manual para override
 *  - Info de la ventana: fecha límite configurada
 *  - Formulario inline para cambiar fecha límite
 */
export default function AdminAccreditationControl() {
  const { selectedEvent, tenant, showSuccess, showError, fetchData } = useAdmin();
  const [saving, setSaving] = useState(false);
  const [manualOverride, setManualOverride] = useState<boolean | null>(null); // null = usar fecha_limite
  const [newDeadline, setNewDeadline] = useState('');
  const [showEditDeadline, setShowEditDeadline] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  // Compute effective status
  const { isOpen, reason } = useMemo(() => {
    if (!selectedEvent) return { isOpen: false, reason: 'Sin evento seleccionado' };

    // Manual override from event config
    const eventConfig = (selectedEvent.config || {}) as Record<string, unknown>;
    const manualOpen = eventConfig.acreditacion_abierta as boolean | undefined;

    // If there's a local manual override, use it
    if (manualOverride !== null) {
      return {
        isOpen: manualOverride,
        reason: manualOverride ? 'Abierto manualmente' : 'Cerrado manualmente',
      };
    }

    // If server has manual override
    if (typeof manualOpen === 'boolean') {
      return {
        isOpen: manualOpen,
        reason: manualOpen ? 'Abierto manualmente' : 'Cerrado manualmente',
      };
    }

    // Use fecha_limite_acreditacion
    if (selectedEvent.fecha_limite_acreditacion) {
      const deadline = new Date(selectedEvent.fecha_limite_acreditacion);
      const now = new Date();
      if (now <= deadline) {
        return {
          isOpen: true,
          reason: `Abierto hasta ${deadline.toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}`,
        };
      } else {
        return {
          isOpen: false,
          reason: `Cerrado desde ${deadline.toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}`,
        };
      }
    }

    return { isOpen: true, reason: 'Abierto (sin fecha límite configurada)' };
  }, [selectedEvent, manualOverride]);

  const handleToggle = async () => {
    if (!selectedEvent) return;
    const newValue = !isOpen;
    setManualOverride(newValue);
    setSaving(true);
    try {
      const currentConfig = (selectedEvent.config || {}) as Record<string, unknown>;
      const res = await fetch(`/api/events?id=${selectedEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { ...currentConfig, acreditacion_abierta: newValue },
        }),
      });
      if (res.ok) {
        showSuccess(`Acreditación ${newValue ? 'abierta' : 'cerrada'} manualmente`);
      } else {
        setManualOverride(null);
        showError('Error al cambiar estado');
      }
    } catch {
      setManualOverride(null);
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleClearOverride = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    try {
      const currentConfig = (selectedEvent.config || {}) as Record<string, unknown>;
      const { acreditacion_abierta, ...rest } = currentConfig;
      const res = await fetch(`/api/events?id=${selectedEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: rest }),
      });
      if (res.ok) {
        setManualOverride(null);
        showSuccess('Override removido — se usará la fecha límite');
      } else {
        showError('Error al actualizar');
      }
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDeadline = async () => {
    if (!selectedEvent || !newDeadline) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events?id=${selectedEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha_limite_acreditacion: new Date(newDeadline).toISOString() }),
      });
      if (res.ok) {
        showSuccess('Fecha límite actualizada');
        setShowEditDeadline(false);
        setNewDeadline('');
        fetchData();
        // Force page refresh to get updated event data
        window.location.reload();
      } else {
        showError('Error al actualizar fecha');
      }
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  if (!selectedEvent) {
    return (
      <div className="bg-surface rounded-2xl shadow-sm border border-edge p-6 text-center text-muted">
        <i className="fas fa-calendar-times text-2xl mb-2" />
        <p>Selecciona un evento para gestionar el control de acreditación</p>
      </div>
    );
  }

  const hasManualOverride = manualOverride !== null ||
    typeof ((selectedEvent.config || {}) as Record<string, unknown>).acreditacion_abierta === 'boolean';

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-edge overflow-hidden">
      {/* Compact header — always visible, clickable to expand */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-canvas/50 transition"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isOpen ? 'bg-[#d1fae5]' : 'bg-[#fee2e2]'}`}>
            <i className={`fas ${isOpen ? 'fa-lock-open text-[#059669]' : 'fa-lock text-[#dc2626]'} text-sm`} />
          </div>
          <div className="text-left">
            <span className="text-sm font-bold text-heading">Control de Acreditación</span>
            <span className="text-xs text-body ml-2">— {reason}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Quick toggle without expanding */}
          <div
            onClick={(e) => { e.stopPropagation(); handleToggle(); }}
            className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-200 ${
              isOpen ? 'bg-[#059669]' : 'bg-[#d1d5db]'
            } ${saving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
            role="switch"
            aria-checked={isOpen}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200 ${
              isOpen ? 'translate-x-5' : 'translate-x-1'
            }`} />
          </div>
          <i className={`fas fa-chevron-down text-muted text-xs transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
        </div>
      </button>

      {/* Expandable details */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${collapsed ? 'max-h-0' : 'max-h-[500px]'}`}>
        {/* Info cards */}
        <div className="p-5 pt-2 border-t border-edge">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {/* Status */}
          <div className={`p-3 rounded-xl border ${isOpen ? 'bg-[#d1fae5]/50 border-[#059669]/20' : 'bg-[#fee2e2]/50 border-[#dc2626]/20'}`}>
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Estado</p>
            <p className={`text-sm font-bold ${isOpen ? 'text-[#059669]' : 'text-[#dc2626]'}`}>
              {isOpen ? 'Abierto' : 'Cerrado'}
            </p>
          </div>

          {/* Deadline */}
          <div className="p-3 rounded-xl bg-canvas border border-edge">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Fecha Límite</p>
            <p className="text-sm font-medium text-heading">
              {selectedEvent.fecha_limite_acreditacion
                ? new Date(selectedEvent.fecha_limite_acreditacion).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })
                : 'No configurada'}
            </p>
          </div>

          {/* Override */}
          <div className="p-3 rounded-xl bg-canvas border border-edge">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Override Manual</p>
            <p className="text-sm font-medium text-heading">
              {hasManualOverride ? (isOpen ? 'Forzado abierto' : 'Forzado cerrado') : 'Automático'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {hasManualOverride && (
            <button
              onClick={handleClearOverride}
              disabled={saving}
              className="px-3 py-1.5 text-sm font-medium text-body bg-subtle hover:bg-edge rounded-lg transition disabled:opacity-50 flex items-center gap-1"
            >
              <i className="fas fa-undo text-xs" /> Quitar override (usar fecha límite)
            </button>
          )}

          {!showEditDeadline ? (
            <button
              onClick={() => {
                setShowEditDeadline(true);
                if (selectedEvent.fecha_limite_acreditacion) {
                  // Pre-fill with current value
                  const d = new Date(selectedEvent.fecha_limite_acreditacion);
                  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                  setNewDeadline(local);
                }
              }}
              className="px-3 py-1.5 text-sm font-medium text-brand bg-accent-light hover:bg-accent-light/80 rounded-lg transition flex items-center gap-1"
            >
              <i className="fas fa-calendar-alt text-xs" /> Cambiar fecha límite
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="datetime-local"
                value={newDeadline}
                onChange={e => setNewDeadline(e.target.value)}
                className="px-3 py-1.5 border border-edge rounded-lg text-sm text-heading"
              />
              <button
                onClick={handleUpdateDeadline}
                disabled={!newDeadline || saving}
                className="px-3 py-1.5 bg-brand text-on-brand rounded-lg text-sm font-medium hover:bg-brand-hover disabled:opacity-50 transition"
              >
                Guardar
              </button>
              <button
                onClick={() => { setShowEditDeadline(false); setNewDeadline(''); }}
                className="px-2 py-1.5 text-body hover:text-label text-sm"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
