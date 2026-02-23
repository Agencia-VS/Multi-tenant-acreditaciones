'use client';

import { useState } from 'react';
import type { DisclaimerSection } from '@/types';

// ─── Default sections (matching current hardcoded Disclaimer.tsx) ────────────

export const DEFAULT_DISCLAIMER_SECTIONS: DisclaimerSection[] = [
  {
    id: 'proceso',
    icon: '📋',
    title: 'Proceso de Acreditación',
    body: 'La solicitud debe ser realizada por el editor o responsable del medio de comunicación. Cada solicitud será revisada y aprobada según disponibilidad de cupos y criterios internos.\n\nUna vez aprobada, recibirá una notificación por correo electrónico con los detalles de su acreditación.',
    color: 'blue',
  },
  {
    id: 'restricciones',
    icon: '⚠️',
    title: 'Restricciones de Cupos',
    body: 'Existe un número limitado de acreditaciones según el tipo de medio. La organización se reserva el derecho de limitar la cantidad de acreditados por medio. Si los cupos se agotan, la solicitud quedará en lista de espera.',
    color: 'red',
  },
  {
    id: 'excepciones',
    icon: '📞',
    title: 'Excepciones y Consultas',
    body: 'Para consultas, solicitar excepciones o resolver inconvenientes, contacte al departamento de comunicaciones de la organización.',
    color: 'green',
  },
  {
    id: 'datos',
    icon: '🔒',
    title: 'Protección de Datos Personales',
    body: 'Los datos serán tratados de forma confidencial y usados exclusivamente para acreditación de prensa, conforme a la Ley 19.628 sobre Protección de la Vida Privada. Información falsa puede resultar en revocación sin previo aviso.',
    color: 'purple',
  },
];

const COLORS: { value: DisclaimerSection['color']; label: string; bg: string; border: string }[] = [
  { value: 'blue', label: 'Azul', bg: 'bg-blue-50', border: 'border-blue-300' },
  { value: 'yellow', label: 'Amarillo', bg: 'bg-yellow-50', border: 'border-yellow-300' },
  { value: 'red', label: 'Rojo', bg: 'bg-red-50', border: 'border-red-300' },
  { value: 'green', label: 'Verde', bg: 'bg-green-50', border: 'border-green-300' },
  { value: 'purple', label: 'Morado', bg: 'bg-purple-50', border: 'border-purple-300' },
  { value: 'gray', label: 'Gris', bg: 'bg-gray-50', border: 'border-gray-300' },
];

const COMMON_EMOJIS = ['📋', '⚠️', '📞', '🔒', '⏰', '📌', '✅', '❌', '💡', '🎫', '📷', '🚫'];

interface DisclaimerEditorProps {
  enabled: boolean;
  sections: DisclaimerSection[];
  onToggle: (enabled: boolean) => void;
  onSectionsChange: (sections: DisclaimerSection[]) => void;
}

export default function DisclaimerEditor({
  enabled,
  sections,
  onToggle,
  onSectionsChange,
}: DisclaimerEditorProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // If sections are empty and enabled, show the defaults as a reference
  const displaySections = sections.length > 0 ? sections : DEFAULT_DISCLAIMER_SECTIONS;
  const isUsingDefaults = sections.length === 0;

  const handleAdd = () => {
    const newSection: DisclaimerSection = {
      id: `custom_${Date.now()}`,
      icon: '📌',
      title: '',
      body: '',
      color: 'blue',
    };
    const updated = isUsingDefaults
      ? [...DEFAULT_DISCLAIMER_SECTIONS, newSection]
      : [...sections, newSection];
    onSectionsChange(updated);
    setEditingIdx(updated.length - 1);
  };

  const handleUpdate = (idx: number, patch: Partial<DisclaimerSection>) => {
    const base = isUsingDefaults ? [...DEFAULT_DISCLAIMER_SECTIONS] : [...sections];
    base[idx] = { ...base[idx], ...patch };
    onSectionsChange(base);
  };

  const handleRemove = (idx: number) => {
    const base = isUsingDefaults ? [...DEFAULT_DISCLAIMER_SECTIONS] : [...sections];
    base.splice(idx, 1);
    onSectionsChange(base);
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const base = isUsingDefaults ? [...DEFAULT_DISCLAIMER_SECTIONS] : [...sections];
    [base[idx - 1], base[idx]] = [base[idx], base[idx - 1]];
    onSectionsChange(base);
    setEditingIdx(idx - 1);
  };

  const handleMoveDown = (idx: number) => {
    const base = isUsingDefaults ? [...DEFAULT_DISCLAIMER_SECTIONS] : [...sections];
    if (idx >= base.length - 1) return;
    [base[idx], base[idx + 1]] = [base[idx + 1], base[idx]];
    onSectionsChange(base);
    setEditingIdx(idx + 1);
  };

  const handleResetDefaults = () => {
    onSectionsChange([]);
    setEditingIdx(null);
  };

  return (
    <div className="space-y-3">
      {/* ── Switch on/off ── */}
      <label className="flex items-center gap-3 p-3 bg-canvas rounded-xl cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => onToggle(e.target.checked)}
          className="rounded border-field-border text-brand w-4 h-4"
        />
        <div>
          <p className="text-sm font-medium text-label">
            <i className="fas fa-file-contract mr-1.5 text-indigo-500" />
            Mostrar Disclaimer
          </p>
          <p className="text-xs text-muted">
            {enabled
              ? 'Se mostrará antes del formulario de acreditación'
              : 'El formulario se mostrará directamente sin términos previos'}
          </p>
        </div>
      </label>

      {/* ── Editor (only when enabled) ── */}
      {enabled && (
        <div className="border border-edge rounded-xl p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-heading uppercase tracking-wide">
              <i className="fas fa-list-alt mr-1.5 text-indigo-400" />
              Secciones del Disclaimer
            </p>
            <div className="flex gap-2">
              {!isUsingDefaults && (
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="text-xs text-muted hover:text-body transition px-2 py-1 rounded-lg hover:bg-subtle"
                >
                  <i className="fas fa-undo mr-1" />Restaurar predeterminados
                </button>
              )}
              <button
                type="button"
                onClick={handleAdd}
                className="text-xs text-brand hover:text-brand-hover transition font-medium px-2 py-1 rounded-lg hover:bg-accent-light"
              >
                <i className="fas fa-plus mr-1" />Agregar sección
              </button>
            </div>
          </div>

          {isUsingDefaults && (
            <p className="text-xs text-muted bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <i className="fas fa-info-circle mr-1 text-blue-400" />
              Usando secciones predeterminadas. Edita cualquier sección para personalizar.
            </p>
          )}

          {/* ── Nota: sección de Plazo es automática ── */}
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <i className="fas fa-clock text-amber-500" />
            La sección <strong>&quot;Plazo de Acreditación&quot;</strong> se genera automáticamente a partir de la fecha límite configurada.
          </div>

          {/* ── Section list ── */}
          <div className="space-y-2">
            {displaySections.map((section, idx) => {
              const colorInfo = COLORS.find(c => c.value === section.color) || COLORS[0];
              const isEditing = editingIdx === idx;

              return (
                <div
                  key={section.id}
                  className={`rounded-xl border ${colorInfo.border} ${colorInfo.bg} transition-all ${
                    isEditing ? 'ring-2 ring-brand/30' : ''
                  }`}
                >
                  {/* ── Collapsed view ── */}
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
                    onClick={() => setEditingIdx(isEditing ? null : idx)}
                  >
                    <span className="text-base">{section.icon}</span>
                    <span className="text-sm font-medium text-heading flex-1 truncate">
                      {section.title || '(sin título)'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleMoveUp(idx); }}
                        disabled={idx === 0}
                        className="p-1 text-xs text-muted hover:text-body disabled:opacity-30 transition"
                        aria-label="Mover arriba"
                      >
                        <i className="fas fa-chevron-up" />
                      </button>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleMoveDown(idx); }}
                        disabled={idx === displaySections.length - 1}
                        className="p-1 text-xs text-muted hover:text-body disabled:opacity-30 transition"
                        aria-label="Mover abajo"
                      >
                        <i className="fas fa-chevron-down" />
                      </button>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleRemove(idx); }}
                        className="p-1 text-xs text-red-400 hover:text-red-600 transition ml-1"
                        aria-label="Eliminar sección"
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                      <i className={`fas fa-chevron-${isEditing ? 'up' : 'down'} text-xs text-muted ml-1`} />
                    </div>
                  </div>

                  {/* ── Expanded editor ── */}
                  {isEditing && (
                    <div className="px-3 pb-3 pt-1 space-y-3 border-t border-white/50">
                      {/* Icon + Title row */}
                      <div className="flex gap-2">
                        <div className="w-20">
                          <label className="text-[10px] text-muted mb-0.5 block">Icono</label>
                          <div className="flex flex-wrap gap-1">
                            {COMMON_EMOJIS.map(emoji => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleUpdate(idx, { icon: emoji })}
                                className={`w-7 h-7 rounded text-sm flex items-center justify-center transition ${
                                  section.icon === emoji ? 'bg-white shadow ring-1 ring-brand/40' : 'hover:bg-white/60'
                                }`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-muted mb-0.5 block">Título</label>
                          <input
                            value={section.title}
                            onChange={e => handleUpdate(idx, { title: e.target.value })}
                            placeholder="Ej: Proceso de Acreditación"
                            className="w-full px-3 py-2 border border-edge rounded-lg text-sm text-heading bg-white"
                          />
                        </div>
                      </div>

                      {/* Body */}
                      <div>
                        <label className="text-[10px] text-muted mb-0.5 block">Contenido</label>
                        <textarea
                          value={section.body}
                          onChange={e => handleUpdate(idx, { body: e.target.value })}
                          rows={3}
                          placeholder="Texto que verá el acreditado..."
                          className="w-full px-3 py-2 border border-edge rounded-lg text-sm text-heading bg-white resize-none"
                        />
                        <p className="text-[10px] text-muted mt-0.5">Usa doble salto de línea para separar párrafos.</p>
                      </div>

                      {/* Color */}
                      <div>
                        <label className="text-[10px] text-muted mb-0.5 block">Color de fondo</label>
                        <div className="flex gap-1.5">
                          {COLORS.map(c => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => handleUpdate(idx, { color: c.value })}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${c.bg} ${c.border} ${
                                section.color === c.value ? 'ring-2 ring-brand/40 shadow-sm' : 'opacity-70 hover:opacity-100'
                              }`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {displaySections.length === 0 && (
            <p className="text-center text-sm text-muted py-6">
              No hay secciones. El disclaimer solo mostrará el plazo de acreditación.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
