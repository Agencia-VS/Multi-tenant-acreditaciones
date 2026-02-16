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
      <div className="flex justify-between items-center">
        <p className="text-sm text-body">
          Define los campos que debe llenar el acreditado. Los campos con <code className="bg-subtle px-1 rounded">profile_field</code> se auto-rellenan.
        </p>
        <button type="button" onClick={addField} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">
          <i className="fas fa-plus mr-1" /> Campo
        </button>
      </div>

      <div className="space-y-2">
        {formFields.map((field, i) => (
          <div key={i} className="bg-canvas rounded-lg p-4 border">
            <div className="grid grid-cols-12 gap-3 items-center">
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
            {field.type === 'select' && (
              <SelectOptionsEditor
                options={field.options || []}
                onChange={(opts) => updateField(i, { options: opts })}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
