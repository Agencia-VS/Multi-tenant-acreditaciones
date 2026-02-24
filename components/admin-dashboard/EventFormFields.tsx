'use client';

import ImageUploadField from '@/components/shared/ImageUploadField';
import DisclaimerEditor from './DisclaimerEditor';
import type { DisclaimerSection, EventType } from '@/types';
import type { EventForm } from './useEventForm';

interface EventFormFieldsProps {
  form: EventForm;
  setForm: React.Dispatch<React.SetStateAction<EventForm>>;
  zonas: string[];
  newZona: string;
  setNewZona: (v: string) => void;
  addZona: () => void;
  removeZona: (z: string) => void;
}

export default function EventFormFields({
  form, setForm, zonas, newZona, setNewZona, addZona, removeZona,
}: EventFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-body mb-1 block">Nombre del evento *</label>
          <input
            value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej: UC vs Colo-Colo"
            className="w-full px-4 py-2.5 border border-edge rounded-xl text-sm text-heading"
          />
          <p className="text-[11px] text-muted mt-1">Este nombre se muestra en la landing y en los emails a los acreditados.</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Liga / Competencia</label>
          <input
            value={form.league}
            onChange={e => setForm(f => ({ ...f, league: e.target.value }))}
            placeholder="Ej: Copa Libertadores"
            className="w-full px-4 py-2.5 border border-edge rounded-xl text-sm text-heading"
          />
          <p className="text-[11px] text-muted mt-1">Opcional. Se muestra como contexto adicional del evento.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Fecha</label>
          <input
            type="date"
            value={form.fecha}
            onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
            className="w-full px-4 py-2.5 border border-edge rounded-xl text-sm text-heading"
          />
          <p className="text-[11px] text-muted mt-1">Día del evento. Se usa en emails con <code className="text-[10px] text-purple-600">{'{fecha}'}</code>.</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Hora</label>
          <input
            type="time"
            value={form.hora}
            onChange={e => setForm(f => ({ ...f, hora: e.target.value }))}
            className="w-full px-4 py-2.5 border border-edge rounded-xl text-sm text-heading"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Lugar / Venue</label>
          <input
            value={form.venue}
            onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
            placeholder="Ej: Estadio San Carlos de Apoquindo"
            className="w-full px-4 py-2.5 border border-edge rounded-xl text-sm text-heading"
          />
          <p className="text-[11px] text-muted mt-1">Aparece en la landing y en emails con <code className="text-[10px] text-purple-600">{'{lugar}'}</code>.</p>
        </div>
      </div>

      {/* Tipo de evento */}
      <div>
        <label className="text-xs text-body mb-1 block">
          <i className="fas fa-layer-group mr-1 text-indigo-500" />
          Tipo de evento
        </label>
        <div className="flex gap-2">
          {([
            { value: 'simple' as EventType, label: 'Simple', icon: 'fa-calendar', desc: 'Evento de un día' },
            { value: 'deportivo' as EventType, label: 'Deportivo', icon: 'fa-futbol', desc: 'Partido / competencia' },
            { value: 'multidia' as EventType, label: 'Multi-día', icon: 'fa-calendar-week', desc: 'Evento de varias jornadas' },
          ]).map(({ value, label, icon, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm(f => ({ ...f, event_type: value }))}
              className={`flex-1 p-2.5 rounded-xl border-2 text-left transition text-sm ${
                form.event_type === value
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-edge hover:border-indigo-300'
              }`}
            >
              <i className={`fas ${icon} mr-1.5 ${form.event_type === value ? 'text-indigo-600' : 'text-muted'}`} />
              <span className={`font-medium ${form.event_type === value ? 'text-indigo-700' : 'text-heading'}`}>{label}</span>
              <p className="text-xs text-muted mt-0.5">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Rival — solo visible para eventos deportivos */}
      {form.event_type === 'deportivo' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-200/50">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Rival</label>
            <input
              value={form.opponent_name}
              onChange={e => setForm(f => ({ ...f, opponent_name: e.target.value }))}
              placeholder="Ej: Colo-Colo"
              className="w-full px-4 py-2.5 border border-edge rounded-xl text-sm text-heading bg-white"
            />
          </div>
          <ImageUploadField
            label="Logo rival"
            value={form.opponent_logo_url}
            onChange={(url) => setForm(f => ({ ...f, opponent_logo_url: url }))}
            folder="events"
            rounded
            previewSize="sm"
          />
        </div>
      )}

      <div>
        <label className="text-xs text-body mb-1 block">Descripción</label>
        <textarea
          value={form.descripcion}
          onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
          rows={2}
          placeholder="Descripción del evento..."
          className="w-full px-4 py-2.5 border border-edge rounded-xl text-sm text-heading resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-body mb-1 block">Fecha límite acreditación</label>
          <input
            type="datetime-local"
            value={form.fecha_limite_acreditacion}
            onChange={e => setForm(f => ({ ...f, fecha_limite_acreditacion: e.target.value }))}
            className="w-full px-4 py-2.5 border border-edge rounded-xl text-sm text-heading"
          />
          <p className="text-[11px] text-muted mt-1">Después de esta fecha, el formulario de acreditación se cierra automáticamente.</p>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-3 p-3 bg-canvas rounded-xl cursor-pointer w-full">
            <input
              type="checkbox"
              checked={form.qr_enabled}
              onChange={e => setForm(f => ({ ...f, qr_enabled: e.target.checked }))}
              className="rounded border-field-border text-brand"
            />
            <div>
              <p className="text-sm font-medium text-label">Habilitar QR</p>
              <p className="text-xs text-muted">Generar códigos QR al aprobar</p>
            </div>
          </label>
        </div>
      </div>

      {/* Visibilidad */}
      <div>
        <label className="text-xs text-body mb-1 block">
          <i className="fas fa-eye mr-1 text-blue-500" />
          Visibilidad del evento
        </label>
        <div className="flex gap-2">
          {([
            { value: 'public' as const, label: 'Público', icon: 'fa-globe', desc: 'Visible en landing' },
            { value: 'invite_only' as const, label: 'Por Invitación', icon: 'fa-envelope', desc: 'Solo con link de invitación' },
          ]).map(({ value, label, icon, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm(f => ({ ...f, visibility: value }))}
              className={`flex-1 p-2.5 rounded-xl border-2 text-left transition text-sm ${
                form.visibility === value
                  ? 'border-brand bg-info-light'
                  : 'border-edge hover:border-brand/40'
              }`}
            >
              <i className={`fas ${icon} mr-1.5 ${form.visibility === value ? 'text-brand' : 'text-muted'}`} />
              <span className={`font-medium ${form.visibility === value ? 'text-brand' : 'text-heading'}`}>{label}</span>
              <p className="text-xs text-muted mt-0.5">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Zonas del evento */}
      <div>
        <label className="text-xs text-body mb-1 block">
          <i className="fas fa-map-signs mr-1 text-purple-500" />
          Zonas de acceso
        </label>
        <p className="text-xs text-muted mb-2">Define las zonas disponibles para este evento. El admin podrá asignar zona manualmente a cada acreditado.</p>

        {zonas.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {zonas.map(z => (
              <span key={z} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-sm font-medium text-purple-700 border border-purple-200">
                {z}
                <button
                  type="button"
                  onClick={() => removeZona(z)}
                  className="text-purple-400 hover:text-purple-700 transition"
                  aria-label={`Eliminar zona ${z}`}
                >
                  <i className="fas fa-times text-xs" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={newZona}
            onChange={e => setNewZona(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addZona(); } }}
            placeholder="Ej: Tribuna, Cancha, Mixta, Conferencia..."
            className="flex-1 px-4 py-2.5 border border-edge rounded-xl text-sm text-heading"
            aria-label="Nombre de nueva zona"
          />
          <button
            type="button"
            onClick={addZona}
            disabled={!newZona.trim()}
            className="px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition flex items-center gap-1"
          >
            <i className="fas fa-plus text-xs" /> Agregar
          </button>
        </div>
      </div>

      {/* Disclaimer configurable */}
      <div>
        <label className="text-xs text-body mb-1 block">
          <i className="fas fa-file-contract mr-1 text-indigo-500" />
          Disclaimer / Términos y Condiciones
        </label>
        <p className="text-xs text-muted mb-2">Configura si el acreditado debe aceptar términos antes de registrarse y personaliza las secciones.</p>
        <DisclaimerEditor
          enabled={form.disclaimer_enabled}
          sections={form.disclaimer_sections}
          onToggle={(enabled: boolean) => setForm(f => ({ ...f, disclaimer_enabled: enabled }))}
          onSectionsChange={(sections: DisclaimerSection[]) => setForm(f => ({ ...f, disclaimer_sections: sections }))}
        />
      </div>
    </div>
  );
}
