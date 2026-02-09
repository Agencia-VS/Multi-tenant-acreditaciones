/**
 * FieldEditorModal — Modal para editar las propiedades de un campo del formulario
 * 
 * Interfaz visual amigable para configurar: label, tipo, requerido,
 * opciones, validación, condiciones de visibilidad.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { FormFieldDefinition, FormSectionDefinition, FieldOption, FieldType } from '../../../types/form-config';

interface FieldEditorModalProps {
  field: FormFieldDefinition | null;
  sections: FormSectionDefinition[];
  allFields: FormFieldDefinition[];
  isOpen: boolean;
  onSave: (field: FormFieldDefinition) => void;
  onCancel: () => void;
}

const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
  { value: 'text', label: 'Texto', icon: '📝' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'tel', label: 'Teléfono', icon: '📞' },
  { value: 'rut', label: 'RUT', icon: '🪪' },
  { value: 'select', label: 'Desplegable', icon: '📋' },
  { value: 'textarea', label: 'Texto largo', icon: '📄' },
  { value: 'number', label: 'Numérico', icon: '🔢' },
  { value: 'date', label: 'Fecha', icon: '📅' },
  { value: 'checkbox', label: 'Casilla', icon: '☑️' },
];

const SCOPES: { value: string; label: string; desc: string }[] = [
  { value: 'responsable', label: 'Responsable', desc: 'Datos del responsable (una vez)' },
  { value: 'solicitud', label: 'Solicitud', desc: 'Empresa, tipo medio (una vez)' },
  { value: 'acreditado', label: 'Acreditado', desc: 'Se repite por cada persona' },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export default function FieldEditorModal({
  field,
  sections,
  allFields,
  isOpen,
  onSave,
  onCancel,
}: FieldEditorModalProps) {
  const isNew = !field;

  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [keyManual, setKeyManual] = useState(false);
  const [type, setType] = useState<FieldType>('text');
  const [required, setRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState('');
  const [helpText, setHelpText] = useState('');
  const [section, setSection] = useState('');
  const [scope, setScope] = useState<'responsable' | 'solicitud' | 'acreditado'>('solicitud');
  const [options, setOptions] = useState<FieldOption[]>([]);
  const [customOptionTrigger, setCustomOptionTrigger] = useState('');
  const [builtInValidation, setBuiltInValidation] = useState('');
  const [minLength, setMinLength] = useState('');
  const [maxLength, setMaxLength] = useState('');
  const [hasCondition, setHasCondition] = useState(false);
  const [condDependsOn, setCondDependsOn] = useState('');
  const [condOperator, setCondOperator] = useState<'equals' | 'notEquals' | 'contains' | 'notEmpty'>('equals');
  const [condValue, setCondValue] = useState('');
  const [custom, setCustom] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (field) {
      setLabel(field.label);
      setKey(field.key);
      setKeyManual(true);
      setType(field.type);
      setRequired(field.required);
      setPlaceholder(field.placeholder || '');
      setHelpText(field.helpText || '');
      setSection(field.section);
      setScope(field.scope);
      setOptions(field.options || []);
      setCustomOptionTrigger(field.customOptionTrigger || '');
      setBuiltInValidation(field.validation?.builtIn || '');
      setMinLength(field.validation?.minLength?.toString() || '');
      setMaxLength(field.validation?.maxLength?.toString() || '');
      setCustom(field.custom || false);
      if (field.condition) {
        setHasCondition(true);
        setCondDependsOn(field.condition.dependsOn);
        setCondOperator(field.condition.operator);
        setCondValue(field.condition.value || '');
      } else {
        setHasCondition(false);
        setCondDependsOn('');
        setCondOperator('equals');
        setCondValue('');
      }
    } else {
      setLabel('');
      setKey('');
      setKeyManual(false);
      setType('text');
      setRequired(false);
      setPlaceholder('');
      setHelpText('');
      setSection(sections[0]?.key || '');
      setScope('solicitud');
      setOptions([]);
      setCustomOptionTrigger('');
      setBuiltInValidation('');
      setMinLength('');
      setMaxLength('');
      setHasCondition(false);
      setCondDependsOn('');
      setCondOperator('equals');
      setCondValue('');
      setCustom(true);
    }
  }, [field, isOpen, sections]);

  useEffect(() => {
    if (!keyManual && label) {
      setKey(slugify(label));
    }
  }, [label, keyManual]);

  const handleSave = () => {
    if (!label.trim() || !key.trim() || !section) return;

    const result: FormFieldDefinition = {
      key: key.trim(),
      label: label.trim(),
      type,
      required,
      section,
      scope,
      order: field?.order || 999,
      placeholder: placeholder.trim() || undefined,
      helpText: helpText.trim() || undefined,
      custom,
      options: type === 'select' && options.length > 0 ? options : undefined,
      customOptionTrigger: type === 'select' && customOptionTrigger ? customOptionTrigger : undefined,
      validation: (builtInValidation || minLength || maxLength)
        ? {
            builtIn: builtInValidation as 'rut_chileno' | 'email' | 'telefono_cl' | undefined || undefined,
            minLength: minLength ? parseInt(minLength) : undefined,
            maxLength: maxLength ? parseInt(maxLength) : undefined,
          }
        : undefined,
      condition: hasCondition && condDependsOn
        ? { dependsOn: condDependsOn, operator: condOperator, value: condValue || undefined }
        : undefined,
    };

    onSave(result);
  };

  const addOption = () => {
    setOptions([...options, { value: '', label: '' }]);
  };

  const updateOption = (index: number, field: 'value' | 'label' | 'allowCustom', val: string | boolean) => {
    const updated = [...options];
    if (field === 'allowCustom') {
      updated[index] = { ...updated[index], allowCustom: val as boolean };
    } else {
      updated[index] = { ...updated[index], [field]: val as string };
      if (field === 'label' && !updated[index].value) {
        updated[index].value = val as string;
      }
    }
    setOptions(updated);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  const otherFieldsForCondition = allFields.filter(f => f.key !== key);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {isNew ? 'Agregar Campo' : 'Editar Campo'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* === INFORMACIÓN BÁSICA === */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs flex items-center justify-center">1</span>
              Información Básica
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Etiqueta del campo *</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ej: Nombre completo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Clave técnica
                  <button
                    type="button"
                    onClick={() => setKeyManual(!keyManual)}
                    className="ml-2 text-blue-500 text-[10px]"
                  >
                    {keyManual ? '(auto)' : '(manual)'}
                  </button>
                </label>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => { setKey(e.target.value); setKeyManual(true); }}
                  disabled={!keyManual && !!field}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de campo *</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {FIELD_TYPES.map((ft) => (
                    <button
                      key={ft.value}
                      type="button"
                      onClick={() => setType(ft.value)}
                      className={`px-2 py-1.5 text-xs rounded-lg border transition-colors text-left ${
                        type === ft.value
                          ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {ft.icon} {ft.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={placeholder}
                    onChange={(e) => setPlaceholder(e.target.value)}
                    placeholder="Texto de ejemplo..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={required}
                      onChange={(e) => setRequired(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Obligatorio</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={custom}
                      onChange={(e) => setCustom(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600"
                    />
                    <span className="text-sm text-gray-700">Campo custom</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Texto de ayuda</label>
              <input
                type="text"
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                placeholder="Aparece debajo del campo para guiar al usuario"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* === OPCIONES (solo para select) === */}
          {type === 'select' && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full text-xs flex items-center justify-center">2</span>
                Opciones del Desplegable
              </h3>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => updateOption(idx, 'label', e.target.value)}
                      placeholder="Texto visible"
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={opt.value}
                      onChange={(e) => updateOption(idx, 'value', e.target.value)}
                      placeholder="Valor"
                      className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="p-1 text-red-400 hover:text-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addOption}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Agregar opción
                </button>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Opción que permite texto libre (ej: &quot;Otros&quot;)
                </label>
                <input
                  type="text"
                  value={customOptionTrigger}
                  onChange={(e) => setCustomOptionTrigger(e.target.value)}
                  placeholder="Dejar vacío si no aplica"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* === UBICACIÓN === */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full text-xs flex items-center justify-center">
                {type === 'select' ? '3' : '2'}
              </span>
              Ubicación en el Formulario
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sección *</label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {sections.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ámbito *</label>
                <div className="space-y-1.5">
                  {SCOPES.map((s) => (
                    <label
                      key={s.value}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                        scope === s.value
                          ? 'bg-blue-50 border-blue-400 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="scope"
                        value={s.value}
                        checked={scope === s.value}
                        onChange={() => setScope(s.value as typeof scope)}
                        className="hidden"
                      />
                      <span className="font-medium">{s.label}</span>
                      <span className="text-[10px] text-gray-500">{s.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* === VALIDACIÓN === */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-yellow-100 text-yellow-600 rounded-full text-xs flex items-center justify-center">
                {type === 'select' ? '4' : '3'}
              </span>
              Validación
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Validación predefinida</label>
                <select
                  value={builtInValidation}
                  onChange={(e) => setBuiltInValidation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Ninguna</option>
                  <option value="rut_chileno">RUT chileno</option>
                  <option value="email">Email</option>
                  <option value="telefono_cl">Teléfono Chile</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mín. caracteres</label>
                <input
                  type="number"
                  value={minLength}
                  onChange={(e) => setMinLength(e.target.value)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Máx. caracteres</label>
                <input
                  type="number"
                  value={maxLength}
                  onChange={(e) => setMaxLength(e.target.value)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* === CONDICIONES === */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full text-xs flex items-center justify-center">
                {type === 'select' ? '5' : '4'}
              </span>
              Condición de visibilidad
            </h3>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={hasCondition}
                onChange={(e) => setHasCondition(e.target.checked)}
                className="w-4 h-4 rounded text-orange-600"
              />
              <span className="text-sm text-gray-700">Mostrar solo cuando se cumpla una condición</span>
            </label>
            {hasCondition && (
              <div className="grid grid-cols-3 gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Depende de</label>
                  <select
                    value={condDependsOn}
                    onChange={(e) => setCondDependsOn(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Seleccionar campo...</option>
                    {otherFieldsForCondition.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Operador</label>
                  <select
                    value={condOperator}
                    onChange={(e) => setCondOperator(e.target.value as typeof condOperator)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="equals">Es igual a</option>
                    <option value="notEquals">No es igual a</option>
                    <option value="contains">Contiene</option>
                    <option value="notEmpty">No está vacío</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor</label>
                  <input
                    type="text"
                    value={condValue}
                    onChange={(e) => setCondValue(e.target.value)}
                    placeholder="Valor a comparar"
                    disabled={condOperator === 'notEmpty'}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!label.trim() || !key.trim() || !section}
            className="px-6 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isNew ? 'Agregar Campo' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
