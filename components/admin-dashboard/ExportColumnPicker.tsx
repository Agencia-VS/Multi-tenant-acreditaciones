'use client';

/**
 * ExportColumnPicker — Modal para elegir columnas de exportación Excel
 * El admin selecciona qué columnas incluir en la descarga.
 */

import { useState, useCallback } from 'react';

export interface ExportColumn {
  key: string;
  label: string;
  group: 'acreditado' | 'credencial' | 'responsable';
}

export const ALL_EXPORT_COLUMNS: ExportColumn[] = [
  // Acreditado
  { key: 'nombre',           label: 'Nombre',            group: 'acreditado' },
  { key: 'primer_apellido',  label: 'Primer Apellido',   group: 'acreditado' },
  { key: 'segundo_apellido', label: 'Segundo Apellido',  group: 'acreditado' },
  { key: 'rut',              label: 'RUT',               group: 'acreditado' },
  { key: 'email',            label: 'Email',             group: 'acreditado' },
  { key: 'cargo',            label: 'Cargo',             group: 'acreditado' },
  // Credencial
  { key: 'tipo_credencial',  label: 'Tipo Credencial',   group: 'credencial' },
  { key: 'n_credencial',     label: 'N° Credencial',     group: 'credencial' },
  { key: 'empresa',          label: 'Empresa',           group: 'credencial' },
  { key: 'area',             label: 'Área',              group: 'credencial' },
  { key: 'zona',             label: 'Zona',              group: 'credencial' },
  { key: 'estado',           label: 'Estado',            group: 'credencial' },
  // Responsable
  { key: 'resp_nombre',      label: 'Responsable',       group: 'responsable' },
  { key: 'resp_primer_ap',   label: 'Primer Ap. Resp.',  group: 'responsable' },
  { key: 'resp_segundo_ap',  label: 'Segundo Ap. Resp.', group: 'responsable' },
  { key: 'resp_rut',         label: 'RUT Responsable',   group: 'responsable' },
  { key: 'resp_email',       label: 'Email Responsable', group: 'responsable' },
  { key: 'resp_telefono',    label: 'Tel. Responsable',  group: 'responsable' },
];

const GROUP_LABELS: Record<string, { label: string; icon: string }> = {
  acreditado:  { label: 'Acreditado',  icon: 'fa-user' },
  credencial:  { label: 'Credencial',  icon: 'fa-id-badge' },
  responsable: { label: 'Responsable', icon: 'fa-user-tie' },
};

interface Props {
  open: boolean;
  onClose: () => void;
  onExport: (columns: string[]) => void;
}

export default function ExportColumnPicker({ open, onClose, onExport }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(ALL_EXPORT_COLUMNS.map(c => c.key))
  );

  const toggle = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((group: string) => {
    const groupKeys = ALL_EXPORT_COLUMNS.filter(c => c.group === group).map(c => c.key);
    setSelected(prev => {
      const next = new Set(prev);
      const allSelected = groupKeys.every(k => next.has(k));
      groupKeys.forEach(k => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  }, []);

  const selectAll = () => setSelected(new Set(ALL_EXPORT_COLUMNS.map(c => c.key)));
  const selectNone = () => setSelected(new Set());

  const handleExport = () => {
    // Preserve column order from ALL_EXPORT_COLUMNS
    const ordered = ALL_EXPORT_COLUMNS.filter(c => selected.has(c.key)).map(c => c.key);
    if (ordered.length === 0) return;
    onExport(ordered);
    onClose();
  };

  if (!open) return null;

  const groups = ['acreditado', 'credencial', 'responsable'] as const;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-heading">
              <i className="fas fa-columns mr-2 text-brand" />
              Columnas de exportación
            </h3>
            <p className="text-sm text-body mt-0.5">
              {selected.size} de {ALL_EXPORT_COLUMNS.length} columnas seleccionadas
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-heading p-1">
            <i className="fas fa-times text-lg" />
          </button>
        </div>

        {/* Quick actions */}
        <div className="px-6 pt-3 flex gap-2">
          <button
            onClick={selectAll}
            className="text-xs px-2.5 py-1 rounded-full bg-accent-light text-brand hover:bg-info-light transition"
          >
            Seleccionar todas
          </button>
          <button
            onClick={selectNone}
            className="text-xs px-2.5 py-1 rounded-full bg-canvas text-body hover:bg-edge transition"
          >
            Ninguna
          </button>
        </div>

        {/* Column groups */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {groups.map(group => {
            const cols = ALL_EXPORT_COLUMNS.filter(c => c.group === group);
            const allGroupSelected = cols.every(c => selected.has(c.key));
            const someGroupSelected = cols.some(c => selected.has(c.key));
            const info = GROUP_LABELS[group];

            return (
              <div key={group}>
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allGroupSelected}
                    ref={el => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected; }}
                    onChange={() => toggleGroup(group)}
                    className="w-4 h-4 rounded text-brand"
                  />
                  <i className={`fas ${info.icon} text-brand text-sm`} />
                  <span className="text-sm font-semibold text-heading">{info.label}</span>
                  <span className="text-xs text-muted">
                    ({cols.filter(c => selected.has(c.key)).length}/{cols.length})
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-1.5 pl-6">
                  {cols.map(col => (
                    <label
                      key={col.key}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition text-sm ${
                        selected.has(col.key) ? 'bg-accent-light text-brand' : 'hover:bg-canvas text-body'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(col.key)}
                        onChange={() => toggle(col.key)}
                        className="w-3.5 h-3.5 rounded text-brand"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-canvas">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-body hover:text-heading transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleExport}
            disabled={selected.size === 0}
            className="px-5 py-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            <i className="fas fa-file-excel" />
            Exportar {selected.size} columnas
          </button>
        </div>
      </div>
    </div>
  );
}
