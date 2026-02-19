'use client';

import type { FormFieldDefinition } from '@/types';
import SelectOptionsEditor from './SelectOptionsEditor';

const FIELD_TYPES = ['text', 'email', 'tel', 'select', 'checkbox', 'file', 'textarea', 'number'] as const;

interface EventFormFieldsTabProps {
  formFields: FormFieldDefinition[];
  addField: () => void;
  updateField: (index: number, updates: Partial<FormFieldDefinition>) => void;
  removeField: (index: number) => void;
}

export default function EventFormFieldsTab({
  formFields,
  addField,
  updateField,
  removeField,
}: EventFormFieldsTabProps) {
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
        <i className="fas fa-lightbulb mr-1.5 text-amber-500" />
        <strong>Campos del formulario de registro.</strong> Estos son los campos que el acreditado verá al registrarse.
        Puedes cambiar el <strong>label</strong> (nombre visible), las <strong>options</strong> de los selects, y marcar campos como obligatorios.
        El campo <code className="bg-amber-100 px-1 rounded text-xs">tipo_medio</code> controla cupos y zonas — puedes renombrar su label (ej: “Área Empresa”) y cambiar sus opciones.
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-body">
          Define los campos que debe llenar el acreditado. Los campos con <code className="bg-subtle px-1 rounded">profile_field</code> se auto-rellenan.
        </p>
        <button type="button" onClick={addField} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">
          <i className="fas fa-plus mr-1" /> Campo
        </button>
      </div>

      {/* ── Column headers with hints (desktop only) ── */}
      <div className="hidden sm:block bg-subtle/50 rounded-lg p-3 border border-dashed border-edge">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-2">
            <p className="text-xs font-semibold text-heading">Key</p>
            <p className="text-[10px] text-muted leading-tight mt-0.5">Identificador interno único. Se usa en la base de datos y en el JSON. No lo ve el usuario. Ej: <code className="bg-subtle px-0.5 rounded">nombre</code>, <code className="bg-subtle px-0.5 rounded">tipo_medio</code>.</p>
          </div>
          <div className="col-span-3">
            <p className="text-xs font-semibold text-heading">Label</p>
            <p className="text-[10px] text-muted leading-tight mt-0.5">Nombre visible que ve el acreditado en el formulario. Puedes cambiarlo libremente. Ej: renombrar &quot;Tipo de medio&quot; a &quot;Área Empresa&quot;.</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs font-semibold text-heading">Tipo</p>
            <p className="text-[10px] text-muted leading-tight mt-0.5"><strong>text</strong> (libre), <strong>select</strong> (desplegable), <strong>email</strong>, <strong>tel</strong>, <strong>file</strong> (adjunto), <strong>checkbox</strong>, <strong>textarea</strong>, <strong>number</strong>.</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs font-semibold text-heading">Profile Field</p>
            <p className="text-[10px] text-muted leading-tight mt-0.5">Si coincide con un campo del perfil (<code className="bg-subtle px-0.5 rounded">nombre</code>, <code className="bg-subtle px-0.5 rounded">email</code>, etc.), se auto-rellena. Vacío si no aplica.</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs font-semibold text-heading">Obligatorio</p>
            <p className="text-[10px] text-muted leading-tight mt-0.5">Si está marcado, el acreditado no puede enviar sin completar este campo.</p>
          </div>
          <div className="col-span-1">
            <p className="text-xs font-semibold text-heading">Acción</p>
            <p className="text-[10px] text-muted leading-tight mt-0.5">Eliminar campo.</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {formFields.map((field, i) => (
          <div key={i} className="bg-canvas rounded-lg p-4 border">
            {/* Desktop: grid-cols-12. Mobile: stacked */}
            <div className="hidden sm:grid grid-cols-12 gap-3 items-center">
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
            {/* Mobile: stacked layout */}
            <div className="sm:hidden space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted">Campo #{i + 1}</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 text-xs text-body">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(i, { required: e.target.checked })}
                      className="rounded"
                    />
                    Req.
                  </label>
                  <button
                    type="button"
                    onClick={() => removeField(i)}
                    className="text-red-400 hover:text-red-600 transition text-sm"
                  >
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted font-medium mb-0.5 block">Key (interno)</label>
                  <input
                    type="text"
                    value={field.key}
                    onChange={(e) => updateField(i, { key: e.target.value })}
                    placeholder="key"
                    className="w-full px-2 py-1.5 rounded border text-xs font-mono text-label"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted font-medium mb-0.5 block">Label (visible)</label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                    placeholder="Label"
                    className="w-full px-2 py-1.5 rounded border text-sm text-label"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted font-medium mb-0.5 block">Tipo de input</label>
                  <select
                    value={field.type}
                    onChange={(e) => updateField(i, { type: e.target.value as FormFieldDefinition['type'] })}
                    className="w-full px-2 py-1.5 rounded border text-sm text-label"
                  >
                    {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted font-medium mb-0.5 block">Profile field (auto-relleno)</label>
                  <input
                    type="text"
                    value={field.profile_field || ''}
                    onChange={(e) => updateField(i, { profile_field: e.target.value || undefined })}
                    placeholder="profile_field"
                    className="w-full px-2 py-1.5 rounded border text-xs font-mono text-body"
                  />
                </div>
              </div>
            </div>
            {field.type === 'select' && (
              <div className="mt-2">
                <p className="text-[10px] text-muted mb-1">
                  <i className="fas fa-info-circle mr-0.5" />
                  Opciones del desplegable &mdash; el acreditado elige una de estas. Para <code className="bg-subtle px-0.5 rounded">tipo_medio</code>, estas opciones controlan cupos y reglas de zona.
                </p>
                <SelectOptionsEditor
                  options={field.options || []}
                  onChange={(opts) => updateField(i, { options: opts })}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
