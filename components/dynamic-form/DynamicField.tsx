/**
 * DynamicField — Componente que renderiza un campo según su tipo
 * 
 * Soporta: text, email, tel, rut, select, textarea, number, date, checkbox
 * con validación en tiempo real y colores dinámicos del tenant.
 */

'use client';

import React, { useCallback } from 'react';
import type { FormFieldDefinition } from '../../types/form-config';

interface DynamicFieldProps {
  field: FormFieldDefinition;
  value: string;
  onChange: (key: string, value: string) => void;
  error?: string;
  colors: { primario: string };
  disabled?: boolean;
}

/**
 * Renderiza un campo de formulario según su definición
 */
export default function DynamicField({
  field,
  value,
  onChange,
  error,
  colors,
  disabled = false,
}: DynamicFieldProps) {
  const handleChange = useCallback(
    (val: string) => {
      // Formateo especial para RUT
      if (field.type === 'rut') {
        val = val.replace(/\./g, '').replace(/[^0-9kK\-]/g, '');
      }
      onChange(field.key, val);
    },
    [field.key, field.type, onChange]
  );

  const baseInputClass =
    'w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors text-sm';
  const borderClass = error ? 'border-red-400' : 'border-gray-200';

  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      e.target.style.borderColor = error ? '#f87171' : colors.primario;
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      e.target.style.borderColor = error ? '#f87171' : '#e5e7eb';
    },
  };

  const renderInput = () => {
    switch (field.type) {
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className={`${baseInputClass} ${borderClass}`}
            required={field.required}
            disabled={disabled}
            {...focusHandlers}
          >
            <option value="">{field.placeholder || `Seleccionar ${field.label}`}</option>
            {(field.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            className={`${baseInputClass} ${borderClass} min-h-[80px]`}
            required={field.required}
            disabled={disabled}
            maxLength={field.validation?.maxLength}
            {...focusHandlers}
          />
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value === 'true'}
              onChange={(e) => handleChange(e.target.checked ? 'true' : 'false')}
              className="w-5 h-5 rounded border-gray-300"
              disabled={disabled}
              style={{ accentColor: colors.primario }}
            />
            <span className="text-sm text-gray-700">{field.label}</span>
          </label>
        );

      case 'rut':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder || 'Ej: 18274356-7'}
            className={`${baseInputClass} ${borderClass}`}
            required={field.required}
            disabled={disabled}
            pattern="^[0-9]{7,8}-[0-9kK]{1}$"
            title="RUT sin puntos, con guion. Ej: 18274356-7"
            {...focusHandlers}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder || 'correo@ejemplo.com'}
            className={`${baseInputClass} ${borderClass}`}
            required={field.required}
            disabled={disabled}
            {...focusHandlers}
          />
        );

      case 'tel':
        return (
          <input
            type="tel"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder || '+56 9 1234 5678'}
            className={`${baseInputClass} ${borderClass}`}
            required={field.required}
            disabled={disabled}
            {...focusHandlers}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            className={`${baseInputClass} ${borderClass}`}
            required={field.required}
            disabled={disabled}
            min={field.validation?.min}
            max={field.validation?.max}
            {...focusHandlers}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className={`${baseInputClass} ${borderClass}`}
            required={field.required}
            disabled={disabled}
            {...focusHandlers}
          />
        );

      case 'hidden':
        return <input type="hidden" value={value} />;

      // text y default
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            className={`${baseInputClass} ${borderClass}`}
            required={field.required}
            disabled={disabled}
            maxLength={field.validation?.maxLength}
            {...focusHandlers}
          />
        );
    }
  };

  if (field.type === 'hidden') {
    return renderInput();
  }

  if (field.type === 'checkbox') {
    return (
      <div className={getGridColClass(field.gridCol)}>
        {renderInput()}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {field.helpText && !error && (
          <p className="mt-1 text-xs text-gray-500">{field.helpText}</p>
        )}
      </div>
    );
  }

  return (
    <div className={getGridColClass(field.gridCol)}>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {renderInput()}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {field.helpText && !error && (
        <p className="mt-1 text-xs text-gray-500">{field.helpText}</p>
      )}
    </div>
  );
}

// Helper para clases de grid responsive
function getGridColClass(gridCol?: number): string {
  switch (gridCol) {
    case 1: return 'col-span-1';
    case 3: return 'col-span-1 sm:col-span-1';
    case 4: return 'col-span-full';
    default: return 'col-span-1 sm:col-span-1'; // default 2 = mitad de grilla
  }
}
