'use client';

/**
 * EventDaysTab — Editor de jornadas para eventos multidía
 * Permite agregar/editar/eliminar días con fecha + label
 */
import type { EventDayFormData } from '@/types';

interface EventDaysTabProps {
  days: EventDayFormData[];
  setDays: (days: EventDayFormData[]) => void;
  fechaInicio: string;
  fechaFin: string;
  setFechaInicio: (v: string) => void;
  setFechaFin: (v: string) => void;
}

export default function EventDaysTab({
  days,
  setDays,
  fechaInicio,
  fechaFin,
  setFechaInicio,
  setFechaFin,
}: EventDaysTabProps) {

  const addDay = () => {
    const nextOrden = days.length + 1;
    // Default: día siguiente al último, o fecha_inicio
    const lastDate = days.length > 0 ? days[days.length - 1].fecha : fechaInicio;
    let nextDate = '';
    if (lastDate) {
      const d = new Date(lastDate + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      nextDate = d.toISOString().split('T')[0];
    }
    setDays([...days, { fecha: nextDate, label: `Día ${nextOrden}`, orden: nextOrden }]);
  };

  const updateDay = (index: number, updates: Partial<EventDayFormData>) => {
    setDays(days.map((d, i) => i === index ? { ...d, ...updates } : d));
  };

  const removeDay = (index: number) => {
    setDays(days.filter((_, i) => i !== index).map((d, i) => ({ ...d, orden: i + 1 })));
  };

  const autoGenerate = () => {
    if (!fechaInicio || !fechaFin) return;
    const start = new Date(fechaInicio + 'T12:00:00');
    const end = new Date(fechaFin + 'T12:00:00');
    if (start > end) return;

    const generated: EventDayFormData[] = [];
    const current = new Date(start);
    let orden = 1;
    while (current <= end) {
      const fecha = current.toISOString().split('T')[0];
      const dLabel = current.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
      generated.push({ fecha, label: `Día ${orden} — ${dLabel}`, orden });
      current.setDate(current.getDate() + 1);
      orden++;
    }
    setDays(generated);
  };

  return (
    <div className="space-y-6">
      {/* Rango de fechas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-label mb-1">Fecha Inicio</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-label mb-1">Fecha Fin</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
          />
        </div>
      </div>

      {fechaInicio && fechaFin && (
        <button
          type="button"
          onClick={autoGenerate}
          className="text-sm text-brand hover:text-brand/80 font-medium transition"
        >
          <i className="fas fa-magic mr-1.5" />
          Auto-generar días desde rango
        </button>
      )}

      {/* Lista de días */}
      <div className="space-y-3">
        {days.map((day, idx) => (
          <div key={idx} className="flex flex-wrap items-center gap-3 p-3 bg-surface-alt rounded-lg border">
            <span className="text-xs font-bold text-muted w-6 text-center">{idx + 1}</span>
            <input
              type="date"
              value={day.fecha}
              onChange={(e) => updateDay(idx, { fecha: e.target.value })}
              className="px-2 py-1.5 rounded border border-field-border text-heading text-sm"
            />
            <input
              type="text"
              value={day.label}
              onChange={(e) => updateDay(idx, { label: e.target.value })}
              placeholder="Ej: Día 1 — Clasificación"
              className="flex-1 px-2 py-1.5 rounded border border-field-border text-heading text-sm"
            />
            <button
              type="button"
              onClick={() => removeDay(idx)}
              className="p-1.5 text-muted hover:text-danger hover:bg-red-50 rounded transition"
              title="Eliminar día"
            >
              <i className="fas fa-trash text-xs" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addDay}
        className="w-full py-2.5 border-2 border-dashed border-field-border rounded-lg text-sm text-body hover:border-brand hover:text-brand transition"
      >
        <i className="fas fa-plus mr-1.5" />
        Agregar Día
      </button>

      {days.length === 0 && (
        <p className="text-sm text-muted text-center py-4">
          Define las fechas de inicio y fin, luego usa &quot;Auto-generar&quot; o agrega días manualmente.
        </p>
      )}
    </div>
  );
}
