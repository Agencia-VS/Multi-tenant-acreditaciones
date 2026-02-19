'use client';

import { TIPO_MEDIO_ICONS, type ResponsableData } from './types';

interface QuotaResult {
  available: boolean;
  max_org: number;
  used_org: number;
}

interface StepTipoMedioProps {
  tipoMedio: string;
  tiposMedioOptions: string[];
  quotaResult: QuotaResult | null;
  responsable: ResponsableData;
  handleMedioSelect: (tipo: string) => void;
  handleMedioSubmit: () => void;
  goBack: () => void;
  tenantColors: { primario: string; secundario: string };
}

export default function StepTipoMedio({
  tipoMedio,
  tiposMedioOptions,
  quotaResult,
  responsable,
  handleMedioSelect,
  handleMedioSubmit,
  goBack,
  tenantColors,
}: StepTipoMedioProps) {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Section Card */}
      <div className="rounded-2xl border border-edge bg-surface/30 overflow-hidden">
        {/* Section Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-edge/50 bg-surface/60">
          <div className="flex items-center gap-3 sm:gap-4">
            <span
              className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl text-white font-bold text-base sm:text-lg shrink-0"
              style={{ backgroundColor: tenantColors.primario }}
            >
              2
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-heading">Tipo de medio</h2>
              <p className="text-xs sm:text-sm text-muted">Selecciona la categoría que mejor describe a <strong className="text-heading">{responsable.organizacion}</strong></p>
            </div>
          </div>
        </div>

        {/* Tipo de medio cards */}
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
            {tiposMedioOptions.map((tipo) => {
              const selected = tipoMedio === tipo;
              const icon = TIPO_MEDIO_ICONS[tipo] || 'fa-ellipsis-h';
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => handleMedioSelect(tipo)}
                  className={`
                    group relative flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl border-2 transition-snappy cursor-pointer
                    ${selected
                      ? 'border-brand bg-brand/10 shadow-md'
                      : 'border-edge bg-surface/40 hover:border-brand/40 hover:bg-surface/80'}
                  `}
                >
                  <i className={`fas ${icon} text-xl ${selected ? 'text-brand' : 'text-muted group-hover:text-brand/60'} transition-snappy`} />
                  <span className={`text-sm font-medium text-center ${selected ? 'text-brand' : 'text-body'} transition-snappy`}>
                    {tipo}
                  </span>
                  {selected && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                      <i className="fas fa-check text-white text-[0.6rem]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>{/* close grid */}

          {/* Quota info */}
          {tipoMedio && quotaResult && (
            <div className={`mt-4 rounded-xl p-4 border ${quotaResult.available ? 'bg-success/5 border-success/30' : 'bg-danger/5 border-danger/30'}`}>
              <div className="flex items-center gap-3">
                <i className={`fas ${quotaResult.available ? 'fa-check-circle text-success' : 'fa-exclamation-triangle text-danger'} text-lg`} />
                <div>
                  <p className={`font-semibold ${quotaResult.available ? 'text-success' : 'text-danger'}`}>
                    {quotaResult.available ? 'Cupos disponibles' : 'Sin cupos disponibles'}
                  </p>
                  <p className="text-sm text-muted">
                    {quotaResult.max_org > 0
                      ? `${quotaResult.used_org} de ${quotaResult.max_org} utilizados por ${responsable.organizacion}`
                      : 'Sin límite de cupos para este tipo de medio'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>{/* close p-6 */}
      </div>{/* close section card */}

      {/* Nav */}
      <div className="flex gap-2 sm:gap-3">
        <button
          type="button"
          onClick={goBack}
          className="flex-1 py-3 sm:py-3.5 rounded-xl border border-edge text-body font-semibold hover:bg-subtle active:scale-[0.98] transition-snappy text-sm sm:text-base"
        >
          <i className="fas fa-arrow-left mr-1.5 text-xs" /> Volver
        </button>
        <button
          type="button"
          onClick={handleMedioSubmit}
          disabled={!tipoMedio || (quotaResult !== null && !quotaResult.available)}
          className="flex-1 py-3 sm:py-3.5 rounded-xl text-white font-bold transition-snappy hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-sm sm:text-base"
          style={{ backgroundColor: tenantColors.primario }}
        >
          Siguiente <i className="fas fa-arrow-right ml-1.5 text-xs" />
        </button>
      </div>
    </div>
  );
}
