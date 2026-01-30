"use client";

import { useTenantColors } from "../tenant/TenantContext";

interface Acreditado {
  nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  rut: string;
  email: string;
  cargo: string;
  tipo_credencial: string;
  numero_credencial: string;
}

interface AcreditadoRowProps {
  acreditado: Acreditado;
  index: number;
  total: number;
  onChange: (index: number, field: keyof Acreditado, value: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

const CARGOS = [
  "Periodista",
  "Periodista Pupitre",
  "Relator",
  "Comentarista",
  "Camarógrafo",
  "Reportero Gráfico Cancha",
  "Reportero Gráfico Tribuna",
  "Técnico",
];

// Componente de input reutilizable con colores dinámicos
function DynamicInput({ 
  colors, 
  ...props 
}: React.InputHTMLAttributes<HTMLInputElement> & { colors: { primario: string } }) {
  return (
    <input
      {...props}
      className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none"
      onFocus={(e) => e.target.style.borderColor = colors.primario}
      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
    />
  );
}

// Componente de select reutilizable con colores dinámicos
function DynamicSelect({ 
  colors, 
  children,
  ...props 
}: React.SelectHTMLAttributes<HTMLSelectElement> & { colors: { primario: string } }) {
  return (
    <select
      {...props}
      className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none"
      onFocus={(e) => e.target.style.borderColor = colors.primario}
      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
    >
      {children}
    </select>
  );
}

export default function AcreditadoRow({
  acreditado,
  index,
  total,
  onChange,
  onRemove,
  canRemove,
}: AcreditadoRowProps) {
  const colors = useTenantColors();

  return (
    <div className="border-2 border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50 relative">
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1"
          title="Quitar este cupo"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
      <h3 className="font-semibold text-gray-700 text-lg">
        Acreditado {index + 1} de {total}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DynamicInput
          colors={colors}
          type="text"
          placeholder="Nombre"
          value={acreditado.nombre}
          onChange={(e) => onChange(index, "nombre", e.target.value)}
          required
        />

        <DynamicInput
          colors={colors}
          type="text"
          placeholder="Primer Apellido"
          value={acreditado.primer_apellido}
          onChange={(e) => onChange(index, "primer_apellido", e.target.value)}
          required
        />

        <DynamicInput
          colors={colors}
          type="text"
          placeholder="Segundo Apellido"
          value={acreditado.segundo_apellido}
          onChange={(e) => onChange(index, "segundo_apellido", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DynamicInput
          colors={colors}
          type="text"
          placeholder="RUT"
          value={acreditado.rut}
          onChange={(e) => onChange(index, "rut", e.target.value)}
          required
        />

        <DynamicInput
          colors={colors}
          type="email"
          placeholder="Email"
          value={acreditado.email}
          onChange={(e) => onChange(index, "email", e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DynamicSelect
          colors={colors}
          value={acreditado.cargo}
          onChange={(e) => onChange(index, "cargo", e.target.value)}
          required
        >
          <option value="">Seleccionar Cargo</option>
          {CARGOS.map((cargo) => (
            <option key={cargo} value={cargo}>
              {cargo}
            </option>
          ))}
        </DynamicSelect>

        <DynamicInput
          colors={colors}
          type="text"
          placeholder="Tipo de Credencial"
          value={acreditado.tipo_credencial}
          onChange={(e) => onChange(index, "tipo_credencial", e.target.value)}
          required
        />

        <DynamicInput
          colors={colors}
          type="text"
          placeholder="Número de Credencial"
          value={acreditado.numero_credencial}
          onChange={(e) => onChange(index, "numero_credencial", e.target.value)}
          required
        />
      </div>
    </div>
  );
}