'use client';

import type { FormFieldDefinition, ZoneMatchField } from '@/types';
import { TIPOS_MEDIO, CARGOS } from '@/types';

interface ZoneRule {
  id?: string;
  match_field: ZoneMatchField;
  cargo: string;
  zona: string;
}

interface EventZonesTabProps {
  zoneRules: ZoneRule[];
  formFields: FormFieldDefinition[];
  eventZonas: string[];
  setEventZonas: React.Dispatch<React.SetStateAction<string[]>>;
  newEventZona: string;
  setNewEventZona: React.Dispatch<React.SetStateAction<string>>;
  isEditing: boolean;
  addZoneRule: () => void;
  updateZoneRule: (index: number, updates: Partial<{ match_field: ZoneMatchField; cargo: string; zona: string }>) => void;
  removeZoneRule: (index: number) => void;
}

export default function EventZonesTab({
  zoneRules,
  formFields,
  eventZonas,
  setEventZonas,
  newEventZona,
  setNewEventZona,
  isEditing,
  addZoneRule,
  updateZoneRule,
  removeZoneRule,
}: EventZonesTabProps) {
  return (
    <div className="space-y-6">
      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
        <i className="fas fa-lightbulb mr-1.5 text-amber-500" />
        <strong>Zonas de acceso.</strong> Primero crea las zonas disponibles (ej: “Cancha”, “Tribuna Prensa”).
        Luego puedes crear reglas automáticas: “si es Fotógrafo → Cancha”. El admin del tenant también puede asignar zonas manualmente.
      </div>

      {/* ── 1. Zonas disponibles del evento ── */}
      <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
        <h4 className="text-sm font-semibold text-purple-900 mb-1">
          <i className="fas fa-map-signs mr-1" /> Zonas del Evento
        </h4>
        <p className="text-xs text-purple-700 mb-3">
          Define las zonas disponibles. El admin del tenant podrá asignar estas zonas manualmente, y las reglas de abajo las usarán para asignación automática.
        </p>
        {eventZonas.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {eventZonas.map(z => (
              <span key={z} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-sm font-medium text-purple-700 border border-purple-200 shadow-sm">
                {z}
                <button type="button" onClick={() => setEventZonas(prev => prev.filter(item => item !== z))} className="text-purple-400 hover:text-purple-700 transition">
                  <i className="fas fa-times text-xs" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={newEventZona}
            onChange={e => setNewEventZona(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const trimmed = newEventZona.trim();
                if (trimmed && !eventZonas.includes(trimmed)) {
                  setEventZonas(prev => [...prev, trimmed]);
                  setNewEventZona('');
                }
              }
            }}
            placeholder="Ej: Tribuna, Cancha, Mixta, Conferencia..."
            className="flex-1 px-3 py-2 border border-purple-200 rounded-lg text-sm text-heading bg-white"
          />
          <button
            type="button"
            onClick={() => {
              const trimmed = newEventZona.trim();
              if (trimmed && !eventZonas.includes(trimmed)) {
                setEventZonas(prev => [...prev, trimmed]);
                setNewEventZona('');
              }
            }}
            disabled={!newEventZona.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition"
          >
            <i className="fas fa-plus text-xs mr-1" /> Agregar
          </button>
        </div>
      </div>

      {/* ── 2. Reglas de auto-asignación ── */}
      <div>
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-sm font-semibold text-label mb-0.5">Reglas de Auto-Asignación</h4>
            <p className="text-xs text-body">
              Mapear cargo o tipo de medio → zona automáticamente al registrarse.
            </p>
            {isEditing && zoneRules.some(r => r.id) && (
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
      </div>

      {zoneRules.length === 0 ? (
        <div className="text-center py-8 text-muted">
          <i className="fas fa-map-marked-alt text-3xl mb-2" />
          <p>Sin reglas de zona. El admin asignará zonas manualmente.</p>
          <p className="text-xs mt-2">Haz clic en &quot;+ Regla&quot; para mapear cargo/área → zona.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
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
                  const sourceField = formFields.find(f => f.key === rule.match_field);
                  const valueOptions = sourceField?.options
                    || (rule.match_field === 'cargo' ? [...CARGOS] : [...TIPOS_MEDIO]);

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
                        {eventZonas.length > 0 ? (
                          <select
                            value={rule.zona}
                            onChange={(e) => updateZoneRule(i, { zona: e.target.value })}
                            className="w-full px-2 py-1 rounded border text-sm text-label bg-transparent"
                          >
                            <option value="">Seleccionar zona...</option>
                            {eventZonas.map(z => <option key={z} value={z}>{z}</option>)}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={rule.zona}
                            onChange={(e) => updateZoneRule(i, { zona: e.target.value })}
                            placeholder="Primero agrega zonas arriba ↑"
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
  );
}
