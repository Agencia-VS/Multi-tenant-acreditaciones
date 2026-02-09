/**
 * DynamicAcreditadoRow — Renderiza una fila de acreditado con campos dinámicos
 * 
 * Reemplaza al AcreditadoRow hardcodeado: los campos se generan
 * desde la configuración del formulario (FormFieldDefinition[]).
 */

'use client';

import React from 'react';
import type { FormFieldDefinition } from '../../types/form-config';
import DynamicField from './DynamicField';

interface DynamicAcreditadoRowProps {
  /** Definiciones de campos para cada acreditado */
  fields: FormFieldDefinition[];
  /** Valores actuales de este acreditado */
  values: Record<string, string>;
  /** Errores de validación */
  errors: Record<string, string>;
  /** Campos visibles (después de aplicar condiciones) */
  visibleFields: Set<string>;
  /** Índice del acreditado en la lista */
  index: number;
  /** Total de acreditados */
  total: number;
  /** Callback al cambiar un campo */
  onChange: (index: number, key: string, value: string) => void;
  /** Callback al eliminar */
  onRemove: (index: number) => void;
  /** Si se puede eliminar */
  canRemove: boolean;
  /** Colores del tenant */
  colors: { primario: string };
}

export default function DynamicAcreditadoRow({
  fields,
  values,
  errors,
  visibleFields,
  index,
  total,
  onChange,
  onRemove,
  canRemove,
  colors,
}: DynamicAcreditadoRowProps) {
  return (
    <div className="border-2 border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50 relative">
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1 transition-colors"
          title="Quitar este cupo"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      )}

      <h3 className="font-semibold text-gray-700 text-lg pr-8">
        Acreditado {index + 1} de {total}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {fields
          .filter((f) => visibleFields.has(f.key))
          .map((field) => (
            <DynamicField
              key={field.key}
              field={field}
              value={values[field.key] || ''}
              onChange={(key, val) => onChange(index, key, val)}
              error={errors[field.key]}
              colors={colors}
            />
          ))}
      </div>
    </div>
  );
}
