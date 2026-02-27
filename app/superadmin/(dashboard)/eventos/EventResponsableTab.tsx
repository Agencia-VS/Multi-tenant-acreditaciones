"use client";

import type { ResponsableConfig } from '@/types';
import { RESPONSABLE_LINK_PREFIX } from '@/lib/responsableConfig';
import TagInput from '@/components/shared/TagInput';

interface EventResponsableTabProps {
  responsableConfig: ResponsableConfig;
  setResponsableConfig: (next: ResponsableConfig) => void;
}

export default function EventResponsableTab({ responsableConfig, setResponsableConfig }: EventResponsableTabProps) {
  const mode = responsableConfig.organization_mode === 'select' ? 'select' : 'text';

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-info-light border border-brand/20 text-sm text-body">
        <i className="fas fa-user-tie mr-1.5 text-brand" />
        <strong>Configuración del Responsable.</strong> Define cómo se captura la organización/medio en el primer paso del formulario.
      </div>

      <div>
        <label className="block text-sm font-medium text-label mb-2">Campo Organización / Medio</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { value: 'text', label: 'Texto libre', desc: 'El responsable escribe su organización manualmente.' },
            { value: 'select', label: 'Desplegable + Otros', desc: 'Selecciona del listado y habilita “Otros” con campos adicionales.' },
          ] as const).map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setResponsableConfig({
                ...responsableConfig,
                organization_mode: value,
                organization_options: value === 'select' ? (responsableConfig.organization_options || []) : [],
                other_link_prefix: RESPONSABLE_LINK_PREFIX,
              })}
              className={`p-3 rounded-lg border-2 text-left transition ${
                mode === value
                  ? 'border-brand bg-info-light'
                  : 'border-field-border hover:border-brand/40'
              }`}
            >
              <span className={`text-sm font-semibold ${mode === value ? 'text-brand' : 'text-heading'}`}>{label}</span>
              <p className="text-xs text-body mt-0.5">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {mode === 'select' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-label mb-1">Opciones del desplegable</label>
            <TagInput
              tags={responsableConfig.organization_options || []}
              onChange={(nextTags) => setResponsableConfig({
                ...responsableConfig,
                organization_mode: 'select',
                organization_options: nextTags,
                other_link_prefix: RESPONSABLE_LINK_PREFIX,
              })}
              placeholder="Ej: Canal 13, Radio ADN"
              addLabel="Agregar"
              helpText="Agrega opciones usando coma o Enter. “Otros” se agrega automáticamente en el formulario."
              normalizeTag={(raw) => {
                const value = raw.trim();
                if (!value) return null;
                if (value.toLowerCase() === 'otros') return null;
                return value;
              }}
            />
          </div>

          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <i className="fas fa-link mr-1.5" />
            Cuando el usuario selecciona <strong>Otros</strong>, se pedirán:
            <strong> nombre de organización</strong> (obligatorio) y <strong>link</strong> (opcional) con prefijo fijo
            <code className="ml-1">{RESPONSABLE_LINK_PREFIX}</code>.
          </div>
        </div>
      )}
    </div>
  );
}
