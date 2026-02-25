'use client';

import { useMemo, useState } from 'react';
import { CARGOS } from '@/types';
import type { FormFieldDefinition } from '@/types';
import { validateEmail, validateDocumentByType, cleanRut, formatRut } from '@/lib/validation';

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

export interface AcreditadoData {
  id: string;
  document_type: 'rut' | 'dni_extranjero';
  rut: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  cargo: string;
  dynamicData: Record<string, string>;
  isResponsable: boolean;
}

export function createEmptyAcreditado(): AcreditadoData {
  return {
    id: crypto.randomUUID(),
    document_type: 'rut',
    rut: '',
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    cargo: '',
    dynamicData: {},
    isResponsable: false,
  };
}

export function validateAcreditado(
  a: AcreditadoData,
  formFields: FormFieldDefinition[] = [],
  eventZonas: string[] = [],
): Record<string, string> {
  const errors: Record<string, string> = {};
  const docValidation = validateDocumentByType(a.document_type || 'rut', a.rut);
  if (!a.rut.trim()) errors.rut = a.document_type === 'rut' ? 'RUT es requerido' : 'Documento es requerido';
  else if (!docValidation.valid) errors.rut = docValidation.error || 'Documento inválido';
  if (!a.nombre.trim()) errors.nombre = 'Nombre es requerido';
  if (!a.apellido.trim()) errors.apellido = 'Apellido es requerido';
  if (!a.email.trim()) errors.email = 'Email es requerido';
  else if (!validateEmail(a.email).valid) errors.email = 'Email inválido';

  // Cargo: solo validar si está configurado como requerido en form_fields
  const cargoField = formFields.find(f => f.key === 'cargo');
  if (cargoField?.required && !a.cargo) {
    errors.cargo = 'Cargo es requerido';
  }

  // Zona: requerida si el evento tiene zonas habilitadas en el formulario
  if (eventZonas.length > 0 && !a.dynamicData['zona']) {
    errors.zona = 'Zona es requerida';
  }

  return errors;
}

/* ═══════════════════════════════════════════════════════
   Constants — base field keys to filter from dynamic fields
   ═══════════════════════════════════════════════════════ */

const BASE_FIELD_KEYS = new Set([
  'document_type', 'document_number', 'tipo_documento', 'documento',
  'rut', 'nombre', 'apellido', 'email', 'telefono',
  'nombre_completo', 'name', 'first_name', 'last_name',
  'correo', 'mail', 'phone', 'celular', 'fono',
  'organizacion', 'medio', 'tipo_medio',
  // Nota: 'cargo' ya NO está aquí — se renderiza condicionalmente
  // según form_fields del evento, no hardcodeado.
]);

/* ═══════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════ */

interface AcreditadoRowProps {
  index: number;
  data: AcreditadoData;
  errors: Record<string, string>;
  onChange: (index: number, field: string, value: string) => void;
  onDynamicChange: (index: number, key: string, value: string) => void;
  onBlur: (index: number, field: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  formFields?: FormFieldDefinition[];
  eventZonas?: string[];
}

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */

export default function AcreditadoRow({
  index,
  data,
  errors,
  onChange,
  onDynamicChange,
  onBlur,
  onRemove,
  canRemove,
  formFields = [],
  eventZonas = [],
}: AcreditadoRowProps) {

  const handleChange = (field: string, value: string) => {
    onChange(index, field, value);
  };

  const handleBlur = (field: string) => {
    if (field === 'rut' && data.rut && (data.document_type || 'rut') === 'rut') {
      const cleaned = cleanRut(data.rut);
      onChange(index, 'rut', formatRut(cleaned));
    }
    onBlur(index, field);
  };

  const displayName = data.nombre && data.apellido
    ? `${data.nombre} ${data.apellido}`
    : data.nombre || `Persona ${index + 1}`;

  const hasErrors = Object.keys(errors).length > 0;
  const locked = data.isResponsable;

  // Filter dynamic fields that duplicate base fields
  // Also exclude 'cargo' and 'zona' from dynamic — they have their own conditional rendering below
  const extraFields = formFields.filter(
    f => !BASE_FIELD_KEYS.has(f.key.toLowerCase()) && f.key !== 'cargo' && f.key !== 'zona'
  );

  // Cargo field config from form_fields (null if not configured)
  const cargoFieldConfig = useMemo(
    () => formFields.find(f => f.key === 'cargo') ?? null,
    [formFields]
  );

  // Derive cargo options from event form config (fallback to hardcoded)
  const cargosOptions = useMemo(() => {
    if (cargoFieldConfig?.options && cargoFieldConfig.options.length > 0) {
      return cargoFieldConfig.options;
    }
    return [...CARGOS];
  }, [cargoFieldConfig]);

  // Track "Otro" free-text mode for cargo
  const [cargoOtroMode, setCargoOtroMode] = useState(() => {
    // Initialize: if current value exists but isn't in options, we're in "otro" mode
    return !!data.cargo && !([...CARGOS] as string[]).includes(data.cargo)
      && data.cargo !== '';
  });

  return (
    <div
      className={`
        rounded-xl border transition-snappy overflow-hidden
        ${locked
          ? 'border-success/30 bg-success/5'
          : hasErrors
            ? 'border-danger/40 bg-danger/5'
            : 'border-edge bg-surface/60'}
      `}
    >
      {/* ── Header ── */}
      <div className={`flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 ${locked ? 'bg-success/10' : 'bg-surface/40'}`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className={`flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-[0.65rem] sm:text-xs font-bold shrink-0 ${
            locked ? 'bg-success/20 text-success' : 'bg-brand/15 text-brand'
          }`}>
            {index + 1}
          </span>
          <span className="font-semibold text-heading truncate text-sm sm:text-base">{displayName}</span>
          {locked && (
            <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-success/15 text-success text-[0.6rem] sm:text-xs font-semibold shrink-0">
              <i className="fas fa-user-check text-[0.5rem] sm:text-[0.6rem]" /> <span className="hidden sm:inline">Responsable</span><span className="sm:hidden">Resp.</span>
            </span>
          )}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-snappy"
            title="Eliminar"
          >
            <i className="fas fa-times" />
          </button>
        )}
      </div>

      {/* ── Fields ── */}
      <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
          {/* Tipo documento */}
          <div>
            <label className="field-label">
              Tipo documento *
              {locked && <i className="fas fa-lock text-[0.55rem] text-success ml-1.5" />}
            </label>
            <select
              value={data.document_type || 'rut'}
              onChange={(e) => handleChange('document_type', e.target.value)}
              onBlur={() => handleBlur('document_type')}
              disabled={locked}
              className={`field-input ${locked ? 'bg-surface/80 text-heading cursor-default' : ''}`}
            >
              <option value="rut">RUT (Chile)</option>
              <option value="dni_extranjero">DNI / Pasaporte (Extranjero)</option>
            </select>
          </div>

          {/* Documento */}
          <div>
            <label className="field-label">
              {(data.document_type || 'rut') === 'rut' ? 'RUT *' : 'Documento *'}
              {locked && <i className="fas fa-lock text-[0.55rem] text-success ml-1.5" />}
            </label>
            <div className="relative">
              <input
                type="text"
                value={data.rut}
                onChange={(e) => handleChange('rut', e.target.value)}
                onBlur={() => handleBlur('rut')}
                placeholder={(data.document_type || 'rut') === 'rut' ? '12.345.678-9' : 'Ej: AB1234567'}
                readOnly={locked}
                className={`field-input pr-9 ${errors.rut ? 'field-input-error' : ''} ${locked ? 'bg-surface/80 text-heading cursor-default' : ''}`}
              />
              {data.rut && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {errors.rut
                    ? <i className="fas fa-times-circle text-danger" />
                    : <i className="fas fa-check-circle text-success" />}
                </span>
              )}
            </div>
            {errors.rut && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" />{errors.rut}</p>}
          </div>

          {/* Nombre */}
          <div>
            <label className="field-label">
              Nombre *
              {locked && <i className="fas fa-lock text-[0.55rem] text-success ml-1.5" />}
            </label>
            <input
              type="text"
              value={data.nombre}
              onChange={(e) => handleChange('nombre', e.target.value)}
              onBlur={() => handleBlur('nombre')}
              placeholder="Juan"
              readOnly={locked}
              className={`field-input ${errors.nombre ? 'field-input-error' : ''} ${locked ? 'bg-surface/80 text-heading cursor-default' : ''}`}
            />
            {errors.nombre && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" />{errors.nombre}</p>}
          </div>

          {/* Apellido */}
          <div>
            <label className="field-label">
              Apellido *
              {locked && <i className="fas fa-lock text-[0.55rem] text-success ml-1.5" />}
            </label>
            <input
              type="text"
              value={data.apellido}
              onChange={(e) => handleChange('apellido', e.target.value)}
              onBlur={() => handleBlur('apellido')}
              placeholder="Pérez"
              readOnly={locked}
              className={`field-input ${errors.apellido ? 'field-input-error' : ''} ${locked ? 'bg-surface/80 text-heading cursor-default' : ''}`}
            />
            {errors.apellido && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" />{errors.apellido}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="field-label">
              Email *
              {locked && <i className="fas fa-lock text-[0.55rem] text-success ml-1.5" />}
            </label>
            <div className="relative">
              <input
                type="email"
                value={data.email}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                placeholder="correo@ejemplo.cl"
                readOnly={locked}
                className={`field-input pr-9 ${errors.email ? 'field-input-error' : ''} ${locked ? 'bg-surface/80 text-heading cursor-default' : ''}`}
              />
              {data.email && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {errors.email
                    ? <i className="fas fa-times-circle text-danger" />
                    : <i className="fas fa-check-circle text-success" />}
                </span>
              )}
            </div>
            {errors.email && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" />{errors.email}</p>}
          </div>

          {/* Teléfono */}
          <div>
            <label className="field-label">
              Teléfono
              {locked && <i className="fas fa-lock text-[0.55rem] text-success ml-1.5" />}
            </label>
            <input
              type="tel"
              value={data.telefono}
              onChange={(e) => handleChange('telefono', e.target.value)}
              onBlur={() => handleBlur('telefono')}
              placeholder="+56 9 1234 5678"
              readOnly={locked}
              className={`field-input ${locked ? 'bg-surface/80 text-heading cursor-default' : ''}`}
            />
          </div>

          {/* Cargo — solo si está configurado en form_fields del evento */}
          {cargoFieldConfig && (
            <div>
              <label className="field-label">
                {cargoFieldConfig.label || 'Cargo'} {cargoFieldConfig.required && '*'}
              </label>
              {cargoOtroMode ? (
                /* Free-text input when "Otro" is selected */
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={data.cargo}
                    onChange={(e) => handleChange('cargo', e.target.value)}
                    onBlur={() => handleBlur('cargo')}
                    placeholder="Escribe el cargo..."
                    autoFocus
                    className={`field-input flex-1 ${errors.cargo ? 'field-input-error' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => { setCargoOtroMode(false); handleChange('cargo', ''); }}
                    className="px-2 py-1 text-xs text-muted hover:text-danger transition rounded-lg border border-edge hover:border-danger/30"
                    title="Volver a la lista"
                  >
                    <i className="fas fa-times" />
                  </button>
                </div>
              ) : (
                <select
                  value={data.cargo}
                  onChange={(e) => {
                    if (e.target.value === '__otro__') {
                      setCargoOtroMode(true);
                      handleChange('cargo', '');
                    } else {
                      handleChange('cargo', e.target.value);
                    }
                  }}
                  onBlur={() => handleBlur('cargo')}
                  className={`field-input ${errors.cargo ? 'field-input-error' : ''}`}
                >
                  <option value="">Selecciona...</option>
                  {cargosOptions.filter(c => c !== 'Otro').map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__otro__">Otro (especificar)</option>
                </select>
              )}
              {errors.cargo && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" />{errors.cargo}</p>}
            </div>
          )}

          {/* Zona — solo si el evento tiene zonas configuradas */}
          {eventZonas.length > 0 && (
            <div>
              <label className="field-label">
                <i className="fas fa-map-signs text-[0.65rem] text-purple-500 mr-1" />
                Zona *
              </label>
              <select
                value={data.dynamicData['zona'] || ''}
                onChange={(e) => onDynamicChange(index, 'zona', e.target.value)}
                className={`field-input ${errors.zona ? 'field-input-error' : ''}`}
              >
                <option value="">Selecciona zona... *</option>
                {eventZonas.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
              {errors.zona && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" />{errors.zona}</p>}
            </div>
          )}
        </div>

        {/* Dynamic Fields — only extras, never base-field duplicates */}
        {extraFields.length > 0 && (
          <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-edge/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {extraFields
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((field) => (
                  <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                    <label className="field-label">
                      {field.label} {field.required && '*'}
                    </label>
                    {field.help_text && <p className="text-xs text-muted mb-1">{field.help_text}</p>}

                    {field.type === 'select' && field.options ? (
                      <select
                        value={data.dynamicData[field.key] || ''}
                        onChange={(e) => onDynamicChange(index, field.key, e.target.value)}
                        className="field-input"
                      >
                        <option value="">Selecciona...</option>
                        {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={data.dynamicData[field.key] || ''}
                        onChange={(e) => onDynamicChange(index, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        rows={2}
                        className="field-input"
                      />
                    ) : field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={data.dynamicData[field.key] === 'true'}
                          onChange={(e) => onDynamicChange(index, field.key, e.target.checked ? 'true' : 'false')}
                          className="w-5 h-5 rounded"
                        />
                        <span className="text-sm text-body">{field.placeholder || field.label}</span>
                      </label>
                    ) : (
                      <input
                        type={field.type}
                        value={data.dynamicData[field.key] || ''}
                        onChange={(e) => onDynamicChange(index, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="field-input"
                      />
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
