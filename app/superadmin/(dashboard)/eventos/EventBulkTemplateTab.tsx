'use client';

import type { BulkTemplateColumn, FormFieldDefinition } from '@/types';

interface EventBulkTemplateTabProps {
  columns: BulkTemplateColumn[];
  formFields: FormFieldDefinition[];
  onChange: (columns: BulkTemplateColumn[]) => void;
  eventZonas?: string[];
}

const DEFAULT_EXAMPLES: Record<string, string> = {
  nombre: 'Juan',
  apellido: 'Pérez',
  segundo_apellido: 'González',
  rut: '12.345.678-9',
  email: 'juan@ejemplo.cl',
  telefono: '+56912345678',
  cargo: 'Periodista',
  tipo_medio: 'TV',
  medio: 'Canal 13',
  organizacion: 'Medio ABC',
  empresa: 'Medio ABC',
  patente: 'ABCD-12',
  zona: 'Tribuna Prensa',
  area: 'General',
};

export default function EventBulkTemplateTab({
  columns,
  formFields,
  onChange,
  eventZonas = [],
}: EventBulkTemplateTabProps) {

  const addColumn = () => {
    onChange([...columns, { key: '', header: '', required: false, example: '', width: 20 }]);
  };

  const updateColumn = (index: number, updates: Partial<BulkTemplateColumn>) => {
    const updated = columns.map((col, i) => (i === index ? { ...col, ...updates } : col));
    onChange(updated);
  };

  const removeColumn = (index: number) => {
    onChange(columns.filter((_, i) => i !== index));
  };

  const moveColumn = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= columns.length) return;
    const updated = [...columns];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  /** Auto-generar columnas desde los form_fields del evento */
  const generateFromFormFields = () => {
    const generated: BulkTemplateColumn[] = formFields
      .filter(f => f.type !== 'file' && f.key !== 'foto_url')
      .map(f => {
        // Extraer opciones de campos select
        let opts: string[] | undefined;
        if (f.type === 'select' && f.options && f.options.length > 0) {
          opts = f.options.map((o: string | { value: string; label: string }) =>
            typeof o === 'string' ? o : (o as { value: string }).value
          );
        }
        return {
          key: f.key,
          header: f.label,
          required: f.required,
          example: DEFAULT_EXAMPLES[f.key] || (opts ? opts[0] : ''),
          width: f.key === 'email' ? 28 : f.key === 'rut' ? 16 : 20,
          ...(opts ? { options: opts } : {}),
        };
      });

    // Auto-agregar columna Zona si hay zonas del evento y no está ya en form_fields
    if (eventZonas.length > 0 && !generated.some(c => c.key === 'zona')) {
      generated.push({
        key: 'zona',
        header: 'Zona',
        required: false,
        example: eventZonas[0] || '',
        width: 22,
        options: eventZonas,
      });
    }

    onChange(generated);
  };

  /** Agregar columna Zona con desplegable desde las zonas del evento */
  const addZonaColumn = () => {
    if (columns.some(c => c.key === 'zona')) return;
    onChange([
      ...columns,
      {
        key: 'zona',
        header: 'Zona',
        required: false,
        example: eventZonas[0] || '',
        width: 22,
        options: eventZonas,
      },
    ]);
  };

  /** Agregar columna rápida desde un form_field existente */
  const availableFields = formFields.filter(
    f => f.type !== 'file' && !columns.some(c => c.key === f.key)
  );

  const hasZonaColumn = columns.some(c => c.key === 'zona');

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
        <i className="fas fa-lightbulb mr-1.5 text-amber-500" />
        <strong>Template de carga masiva.</strong> Configura las columnas del Excel que el responsable descargará para subir acreditados en lote.
        Cada columna se mapea a un campo del formulario. La columna <strong>header</strong> es el nombre visible en el Excel.
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-body">
            Configura las columnas de la plantilla Excel para carga masiva.
            Los usuarios descargarán este template para completar sus datos.
          </p>
          <p className="text-xs text-body mt-1">
            Campos con <strong>*</strong> se marcarán como obligatorios en el template.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={generateFromFormFields}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
            title="Genera columnas automáticamente desde los campos del formulario"
          >
            <i className="fas fa-magic mr-1" /> Auto-generar desde formulario
          </button>
          {eventZonas.length > 0 && !hasZonaColumn && (
            <button
              type="button"
              onClick={addZonaColumn}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition"
              title="Agregar columna Zona con lista desplegable de las zonas del evento"
            >
              <i className="fas fa-map-marker-alt mr-1" /> + Zona ({eventZonas.length})
            </button>
          )}
          <button
            type="button"
            onClick={addColumn}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
          >
            <i className="fas fa-plus mr-1" /> Columna
          </button>
        </div>
      </div>

      {columns.length === 0 && (
        <div className="text-center py-8 text-body">
          <i className="fas fa-file-excel text-3xl mb-2 opacity-40" />
          <p className="text-sm">
            Sin columnas configuradas. Se usará la plantilla por defecto (Nombre, Apellido, RUT, Patente).
          </p>
          <button
            type="button"
            onClick={generateFromFormFields}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
          >
            <i className="fas fa-magic mr-1" /> Generar desde campos del formulario
          </button>
        </div>
      )}

      {columns.length > 0 && (
        <div className="space-y-2">
          {/* Header labels — hidden on mobile */}
          <div className="hidden sm:grid grid-cols-12 gap-2 px-4 text-xs font-semibold text-body uppercase">
            <span className="col-span-1">#</span>
            <span className="col-span-2">Key</span>
            <span className="col-span-3">Header Excel</span>
            <span className="col-span-2">Ejemplo</span>
            <span className="col-span-1">Ancho</span>
            <span className="col-span-1">Req.</span>
            <span className="col-span-2">Acciones</span>
          </div>

          {columns.map((col, i) => (
            <div key={i} className="bg-canvas rounded-lg p-3 border">
              {/* Desktop: grid-cols-12 */}
              <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                <span className="col-span-1 text-xs text-body font-mono">{i + 1}</span>
                <div className="col-span-2">
                  {availableFields.length > 0 ? (
                    <select
                      value={col.key}
                      onChange={(e) => {
                        const field = formFields.find(f => f.key === e.target.value);
                        let opts: string[] | undefined;
                        if (field?.type === 'select' && field.options && field.options.length > 0) {
                          opts = field.options.map((o: string | { value: string; label: string }) =>
                            typeof o === 'string' ? o : (o as { value: string }).value
                          );
                        }
                        updateColumn(i, {
                          key: e.target.value,
                          header: field?.label || e.target.value,
                          example: DEFAULT_EXAMPLES[e.target.value] || (opts ? opts[0] : ''),
                          options: opts,
                        });
                      }}
                      className="w-full px-2 py-1 rounded border text-xs font-mono text-label"
                    >
                      <option value={col.key}>{col.key || '— seleccionar —'}</option>
                      {availableFields.map(f => (
                        <option key={f.key} value={f.key}>{f.key}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={col.key}
                      onChange={(e) => updateColumn(i, { key: e.target.value })}
                      placeholder="key"
                      className="w-full px-2 py-1 rounded border text-xs font-mono text-label"
                    />
                  )}
                </div>
                <div className="col-span-3 flex items-center gap-1">
                  <input
                    type="text"
                    value={col.header}
                    onChange={(e) => updateColumn(i, { header: e.target.value })}
                    placeholder="Nombre de columna"
                    className="flex-1 px-2 py-1 rounded border text-sm text-label"
                  />
                  {col.options && col.options.length > 0 && (
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-semibold" title={`Desplegable: ${col.options.join(', ')}`}>
                      <i className="fas fa-list-ul mr-0.5" />{col.options.length}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={col.example || ''}
                  onChange={(e) => updateColumn(i, { example: e.target.value })}
                  placeholder="Ejemplo"
                  className="col-span-2 px-2 py-1 rounded border text-xs text-body"
                />
                <input
                  type="number"
                  value={col.width || 20}
                  onChange={(e) => updateColumn(i, { width: parseInt(e.target.value) || 20 })}
                  min={8}
                  max={50}
                  className="col-span-1 px-2 py-1 rounded border text-xs text-body"
                />
                <label className="col-span-1 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={col.required}
                    onChange={(e) => updateColumn(i, { required: e.target.checked })}
                    className="rounded"
                  />
                </label>
                <div className="col-span-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveColumn(i, -1)}
                    disabled={i === 0}
                    className="p-1 text-body hover:text-label disabled:opacity-30 transition"
                    title="Mover arriba"
                  >
                    <i className="fas fa-arrow-up text-xs" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveColumn(i, 1)}
                    disabled={i === columns.length - 1}
                    className="p-1 text-body hover:text-label disabled:opacity-30 transition"
                    title="Mover abajo"
                  >
                    <i className="fas fa-arrow-down text-xs" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeColumn(i)}
                    className="p-1 text-red-400 hover:text-red-600 transition"
                    title="Eliminar columna"
                  >
                    <i className="fas fa-trash text-xs" />
                  </button>
                </div>
              </div>
              {/* Options row — desktop */}
              {col.options && col.options.length > 0 && (
                <div className="hidden sm:block mt-2 ml-[8.33%] col-span-11">
                  <div className="flex items-start gap-2 p-2 rounded bg-purple-50 border border-purple-200">
                    <i className="fas fa-list-ul text-purple-500 mt-0.5 text-xs" />
                    <div className="flex-1">
                      <p className="text-[10px] text-purple-600 font-semibold uppercase mb-1">Opciones desplegable en Excel</p>
                      <input
                        type="text"
                        value={col.options.join(', ')}
                        onChange={(e) => {
                          const newOpts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          updateColumn(i, { options: newOpts.length > 0 ? newOpts : undefined });
                        }}
                        placeholder="Opción 1, Opción 2, Opción 3"
                        className="w-full px-2 py-1 rounded border text-xs text-label"
                      />
                      <p className="text-[10px] text-purple-400 mt-0.5">Separadas por coma. Estas aparecerán como lista desplegable en el Excel.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateColumn(i, { options: undefined })}
                      className="text-purple-400 hover:text-red-500 text-xs p-1"
                      title="Quitar desplegable"
                    >
                      <i className="fas fa-times" />
                    </button>
                  </div>
                </div>
              )}
              {/* Mobile: stacked layout */}
              <div className="sm:hidden space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-body font-mono">#{i + 1}</span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-body">
                      <input
                        type="checkbox"
                        checked={col.required}
                        onChange={(e) => updateColumn(i, { required: e.target.checked })}
                        className="rounded"
                      />
                      Req.
                    </label>
                    <button type="button" onClick={() => moveColumn(i, -1)} disabled={i === 0} className="p-1 text-body disabled:opacity-30"><i className="fas fa-arrow-up text-xs" /></button>
                    <button type="button" onClick={() => moveColumn(i, 1)} disabled={i === columns.length - 1} className="p-1 text-body disabled:opacity-30"><i className="fas fa-arrow-down text-xs" /></button>
                    <button type="button" onClick={() => removeColumn(i)} className="p-1 text-red-400"><i className="fas fa-trash text-xs" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted uppercase">Key</label>
                    {availableFields.length > 0 ? (
                      <select
                        value={col.key}
                        onChange={(e) => {
                          const field = formFields.find(f => f.key === e.target.value);
                          let opts: string[] | undefined;
                          if (field?.type === 'select' && field.options && field.options.length > 0) {
                            opts = field.options.map((o: string | { value: string; label: string }) =>
                              typeof o === 'string' ? o : (o as { value: string }).value
                            );
                          }
                          updateColumn(i, {
                            key: e.target.value,
                            header: field?.label || e.target.value,
                            example: DEFAULT_EXAMPLES[e.target.value] || (opts ? opts[0] : ''),
                            options: opts,
                          });
                        }}
                        className="w-full px-2 py-1.5 rounded border text-xs font-mono text-label"
                      >
                        <option value={col.key}>{col.key || '—'}</option>
                        {availableFields.map(f => (
                          <option key={f.key} value={f.key}>{f.key}</option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" value={col.key} onChange={(e) => updateColumn(i, { key: e.target.value })} placeholder="key" className="w-full px-2 py-1.5 rounded border text-xs font-mono text-label" />
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] text-muted uppercase">Header</label>
                    <input type="text" value={col.header} onChange={(e) => updateColumn(i, { header: e.target.value })} placeholder="Columna" className="w-full px-2 py-1.5 rounded border text-sm text-label" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted uppercase">Ejemplo</label>
                    <input type="text" value={col.example || ''} onChange={(e) => updateColumn(i, { example: e.target.value })} placeholder="Ej." className="w-full px-2 py-1.5 rounded border text-xs text-body" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted uppercase">Ancho</label>
                    <input type="number" value={col.width || 20} onChange={(e) => updateColumn(i, { width: parseInt(e.target.value) || 20 })} min={8} max={50} className="w-full px-2 py-1.5 rounded border text-xs text-body" />
                  </div>
                </div>
                {/* Mobile: options display */}
                {col.options && col.options.length > 0 && (
                  <div className="p-2 rounded bg-purple-50 border border-purple-200">
                    <p className="text-[10px] text-purple-600 font-semibold uppercase mb-1"><i className="fas fa-list-ul mr-0.5" /> Desplegable ({col.options.length})</p>
                    <input
                      type="text"
                      value={col.options.join(', ')}
                      onChange={(e) => {
                        const newOpts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        updateColumn(i, { options: newOpts.length > 0 ? newOpts : undefined });
                      }}
                      placeholder="Opción 1, Opción 2"
                      className="w-full px-2 py-1 rounded border text-xs text-label"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      {columns.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-body mb-2">
            <i className="fas fa-eye mr-1" /> Preview de la plantilla Excel:
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-gray-800 text-white">
                  {columns.map((col, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                      {col.header}{col.required ? ' *' : ''}
                      {col.options && col.options.length > 0 && (
                        <span className="ml-1 text-[10px] font-normal text-purple-300" title={col.options.join(', ')}>
                          <i className="fas fa-caret-down" /> {col.options.length}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-canvas">
                  {columns.map((col, i) => (
                    <td key={i} className="px-3 py-1.5 text-body whitespace-nowrap">
                      {col.example || <span className="italic opacity-40">—</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
