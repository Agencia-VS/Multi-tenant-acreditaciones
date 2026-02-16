'use client';

import type { FormFieldDefinition } from '@/types';
import { TIPOS_MEDIO } from '@/types';

interface QuotaRule {
  id?: string;
  tipo_medio: string;
  max_per_organization: number;
  max_global: number;
}

interface EventQuotasTabProps {
  quotaRules: QuotaRule[];
  formFields: FormFieldDefinition[];
  isEditing: boolean;
  addQuotaRule: () => void;
  updateQuotaRule: (index: number, updates: Partial<QuotaRule>) => void;
  removeQuotaRule: (index: number) => void;
}

export default function EventQuotasTab({
  quotaRules,
  formFields,
  isEditing,
  addQuotaRule,
  updateQuotaRule,
  removeQuotaRule,
}: EventQuotasTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-body">
            Limitar acreditaciones por tipo de medio y organización.
          </p>
          {isEditing && quotaRules.some(r => r.id) && (
            <p className="text-xs text-success mt-1">
              <i className="fas fa-check-circle mr-1" />
              {quotaRules.filter(r => r.id).length} regla(s) guardada(s) en base de datos
            </p>
          )}
        </div>
        <button type="button" onClick={addQuotaRule} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">
          <i className="fas fa-plus mr-1" /> Regla
        </button>
      </div>

      {quotaRules.length === 0 ? (
        <div className="text-center py-8 text-muted">
          <i className="fas fa-infinity text-3xl mb-2" />
          <p>Sin restricciones de cupo. Se permiten acreditaciones ilimitadas.</p>
          <p className="text-xs mt-2">Haz clic en &quot;+ Regla&quot; para agregar un límite.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-canvas text-left">
                  <th className="px-4 py-2 font-medium text-label">Tipo de Medio</th>
                  <th className="px-4 py-2 font-medium text-label text-center">Máx. por Org</th>
                  <th className="px-4 py-2 font-medium text-label text-center">Máx. Global</th>
                  <th className="px-4 py-2 font-medium text-label text-center">Estado</th>
                  <th className="px-4 py-2 font-medium text-label text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {quotaRules.map((rule, i) => {
                  const tipoField = formFields.find(f => f.key === 'tipo_medio');
                  const tipoOptions = tipoField?.options?.length ? tipoField.options : [...TIPOS_MEDIO];

                  return (
                    <tr key={i} className="hover:bg-canvas/50">
                      <td className="px-4 py-3">
                        <select
                          value={rule.tipo_medio}
                          onChange={(e) => updateQuotaRule(i, { tipo_medio: e.target.value })}
                          className="px-2 py-1 rounded border text-sm text-label bg-transparent"
                        >
                          {tipoOptions.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={rule.max_per_organization}
                          onChange={(e) => updateQuotaRule(i, { max_per_organization: parseInt(e.target.value) || 0 })}
                          className="w-20 px-2 py-1 rounded border text-sm text-label text-center"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={rule.max_global}
                          onChange={(e) => updateQuotaRule(i, { max_global: parseInt(e.target.value) || 0 })}
                          className="w-20 px-2 py-1 rounded border text-sm text-label text-center"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rule.id ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success-light text-success-dark rounded-full text-xs font-medium">
                            <i className="fas fa-check text-[10px]" /> Guardada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warn-light text-warn-dark rounded-full text-xs font-medium">
                            <i className="fas fa-clock text-[10px]" /> Nueva
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeQuotaRule(i)}
                          className="text-red-400 hover:text-red-600 transition"
                        >
                          <i className="fas fa-trash text-sm" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            <i className="fas fa-info-circle mr-1" />
            0 = sin límite. Los cambios se aplicarán al guardar el evento.
          </p>
        </div>
      )}
    </div>
  );
}
