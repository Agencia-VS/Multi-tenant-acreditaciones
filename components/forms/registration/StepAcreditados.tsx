'use client';

import type { FormFieldDefinition, TeamMember } from '@/types';
import AcreditadoRow from '@/components/forms/AcreditadoRow';
import type { AcreditadoData } from '@/components/forms/AcreditadoRow';
import { validateRut, cleanRut } from '@/lib/validation';
import { LoadingSpinner } from '@/components/shared/ui';
import { TIPO_MEDIO_ICONS, type ResponsableData, type BulkImportRow } from './types';

interface QuotaResult {
  available: boolean;
  max_org: number;
  used_org: number;
}

interface StepAcreditadosProps {
  responsable: ResponsableData;
  tipoMedio: string;
  acreditados: AcreditadoData[];
  acreditadoErrors: Record<string, Record<string, string>>;
  bulkRows: BulkImportRow[];
  setBulkRows: React.Dispatch<React.SetStateAction<BulkImportRow[]>>;
  maxCupos: number;
  incluirmeDone: boolean;
  quotaResult: QuotaResult | null;
  teamMembers: TeamMember[];
  showTeamPicker: boolean;
  setShowTeamPicker: React.Dispatch<React.SetStateAction<boolean>>;
  bulkEnabled: boolean;
  formFields: FormFieldDefinition[];
  submitting: boolean;
  tenantColors: { primario: string; secundario: string };
  // Handlers
  handleIncluirme: () => void;
  handleAddAcreditado: () => void;
  handleRemoveAcreditado: (index: number) => void;
  handleAcreditadoChange: (index: number, field: string, value: string) => void;
  handleAcreditadoDynamicChange: (index: number, key: string, value: string) => void;
  handleAcreditadoBlur: (index: number, field: string) => void;
  handleAddFromTeam: (member: TeamMember) => void;
  handleAddAllTeam: () => void;
  handleFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  downloadTemplate: () => void;
  handleSubmit: () => void;
  goBack: () => void;
}

export default function StepAcreditados({
  responsable,
  tipoMedio,
  acreditados,
  acreditadoErrors,
  bulkRows,
  setBulkRows,
  maxCupos,
  incluirmeDone,
  quotaResult,
  teamMembers,
  showTeamPicker,
  setShowTeamPicker,
  bulkEnabled,
  formFields,
  submitting,
  tenantColors,
  handleIncluirme,
  handleAddAcreditado,
  handleRemoveAcreditado,
  handleAcreditadoChange,
  handleAcreditadoDynamicChange,
  handleAcreditadoBlur,
  handleAddFromTeam,
  handleAddAllTeam,
  handleFileImport,
  downloadTemplate,
  handleSubmit,
  goBack,
}: StepAcreditadosProps) {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Section Card Header */}
      <div className="rounded-2xl border border-edge bg-surface/30 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 bg-surface/60">
          <div className="flex items-center gap-3 sm:gap-4">
            <span
              className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl text-white font-bold text-base sm:text-lg shrink-0"
              style={{ backgroundColor: tenantColors.primario }}
            >
              3
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-heading">Acreditados</h2>
              <p className="text-xs sm:text-sm text-muted">Agrega las personas que asistirán al evento por <strong className="text-heading">{responsable.organizacion}</strong></p>
            </div>
          </div>

          {/* Context chips */}
          <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-4 ml-11 sm:ml-14">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-edge text-xs text-body">
              <i className={`fas ${TIPO_MEDIO_ICONS[tipoMedio] || 'fa-ellipsis-h'} text-brand`} /> {tipoMedio}
            </span>
            {quotaResult && quotaResult.max_org > 0 && (
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                (quotaResult.used_org + acreditados.length + bulkRows.length) >= quotaResult.max_org
                  ? 'bg-danger/10 border border-danger/30 text-danger'
                  : 'bg-success/10 border border-success/30 text-success'
              }`}>
                <i className="fas fa-users" /> {acreditados.length + bulkRows.length} / {quotaResult.max_org - quotaResult.used_org} cupos
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Incluirme card ── */}
      {!incluirmeDone && (
        <div className="rounded-2xl border-2 border-dashed border-brand/30 bg-brand/5 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-heading flex items-center gap-2 text-sm sm:text-base">
                <i className="fas fa-user-check text-brand" />
                ¿Asistirás tú también?
              </p>
              <p className="text-sm text-muted mt-0.5">
                Incluye tus datos como responsable directamente, sin volver a llenarlos.
              </p>
            </div>
            <button
              type="button"
              onClick={handleIncluirme}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-white font-semibold text-xs sm:text-sm transition-snappy hover:opacity-90 shrink-0 w-full sm:w-auto justify-center"
              style={{ backgroundColor: tenantColors.primario }}
            >
              <i className="fas fa-user-plus" /> Incluirme como acreditado
            </button>
          </div>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleAddAcreditado}
          disabled={acreditados.length >= maxCupos}
          className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-edge text-body font-semibold text-xs sm:text-sm hover:bg-surface transition-snappy disabled:opacity-40"
        >
          <i className="fas fa-user-plus" /> Agregar persona
        </button>
        {teamMembers.length > 0 && (
          <button
            type="button"
            onClick={() => setShowTeamPicker(!showTeamPicker)}
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-snappy ${
              showTeamPicker
                ? 'bg-brand/10 border-2 border-brand text-brand'
                : 'border border-edge text-body hover:bg-surface'
            }`}
          >
            <i className="fas fa-star" /> Frecuentes ({teamMembers.length})
          </button>
        )}
        {bulkEnabled && (
          <>
            <label className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border-2 border-dashed border-brand/40 text-brand font-semibold text-xs sm:text-sm hover:bg-brand/5 transition-snappy cursor-pointer">
              <i className="fas fa-file-upload" /> <span className="hidden sm:inline">Importar</span> Excel / CSV
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt,.tsv"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-edge text-muted font-semibold text-xs sm:text-sm hover:bg-surface hover:text-body transition-snappy"
              title="Descargar plantilla Excel con los campos del evento"
            >
              <i className="fas fa-download" /> Plantilla
            </button>
          </>
        )}
      </div>

      {/* ── Team picker (frecuentes) ── */}
      {showTeamPicker && teamMembers.length > 0 && (
        <div className="rounded-2xl border border-edge bg-surface/40 overflow-hidden animate-fade-in">
          <div className="px-5 py-3 border-b border-edge/50 bg-surface/60 flex items-center justify-between">
            <p className="text-sm font-semibold text-heading flex items-center gap-2">
              <i className="fas fa-star text-brand" /> Tu equipo frecuente
            </p>
            <button
              type="button"
              onClick={handleAddAllTeam}
              className="text-xs text-brand font-semibold hover:underline"
            >
              Agregar todos
            </button>
          </div>
          <div className="divide-y divide-edge/50 max-h-64 overflow-y-auto">
            {teamMembers.map((m) => {
              const p = m.member_profile;
              if (!p) return null;
              const alreadyAdded = acreditados.some(a => a.rut && cleanRut(a.rut) === cleanRut(p.rut));
              return (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface/60 transition-snappy">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand/10 text-brand text-xs font-bold shrink-0">
                    {p.nombre?.[0]}{p.apellido?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-heading truncate">
                      {p.nombre} {p.apellido}
                      {m.alias && <span className="text-muted font-normal ml-1">({m.alias})</span>}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {p.rut}{p.cargo ? ` · ${p.cargo}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => handleAddFromTeam(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-snappy shrink-0 ${
                      alreadyAdded
                        ? 'bg-success/10 text-success cursor-default'
                        : 'bg-brand/10 text-brand hover:bg-brand/20'
                    }`}
                  >
                    {alreadyAdded ? (
                      <><i className="fas fa-check mr-1" /> Agregado</>
                    ) : (
                      <><i className="fas fa-plus mr-1" /> Agregar</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Acreditados manuales list */}
      {acreditados.length === 0 && bulkRows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-edge bg-surface/30 py-12 text-center">
          <i className="fas fa-user-plus text-3xl text-muted mb-3 block" />
          <p className="text-body font-medium">Aún no has agregado acreditados</p>
          <p className="text-sm text-muted mt-1">Usa los botones de arriba para agregar personas</p>
        </div>
      ) : (
        <>
          {acreditados.length > 0 && (
            <div className="space-y-3">
              {acreditados.map((a, i) => (
                <AcreditadoRow
                  key={a.id}
                  index={i}
                  data={a}
                  errors={acreditadoErrors[a.id] || {}}
                  onChange={handleAcreditadoChange}
                  onDynamicChange={handleAcreditadoDynamicChange}
                  onBlur={handleAcreditadoBlur}
                  onRemove={handleRemoveAcreditado}
                  canRemove={true}
                  formFields={formFields}
                />
              ))}
            </div>
          )}

          {/* ── Tabla de Carga Masiva ── */}
          {bulkRows.length > 0 && (
            <div className="rounded-2xl border border-edge bg-surface/30 overflow-hidden">
              <div className="px-4 sm:px-5 py-3 bg-surface/60 border-b border-edge/50 flex items-center justify-between">
                <p className="text-sm font-semibold text-heading flex items-center gap-2">
                  <i className="fas fa-file-upload text-brand" /> Carga masiva ({bulkRows.length} persona{bulkRows.length !== 1 ? 's' : ''})
                </p>
                <button
                  type="button"
                  onClick={() => setBulkRows([])}
                  className="text-xs text-danger font-semibold hover:underline flex items-center gap-1"
                >
                  <i className="fas fa-trash-alt" /> Limpiar todo
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface/40 border-b border-edge/50">
                      <th className="text-left px-3 sm:px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide w-8">#</th>
                      <th className="text-left px-3 sm:px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide">Nombre</th>
                      <th className="text-left px-3 sm:px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide">Apellido</th>
                      <th className="text-left px-3 sm:px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide">RUT</th>
                      <th className="text-left px-3 sm:px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide">Patente</th>
                      <th className="text-left px-3 sm:px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide">Empresa</th>
                      <th className="text-left px-3 sm:px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide">Tipo Medio</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge/30">
                    {bulkRows.map((row, i) => (
                      <tr key={row.id} className="hover:bg-surface/40 transition-snappy">
                        <td className="px-3 sm:px-4 py-2 text-xs text-muted font-mono">{i + 1}</td>
                        <td className="px-3 sm:px-4 py-2 font-medium text-heading">{row.nombre || <span className="text-danger italic">Vacío</span>}</td>
                        <td className="px-3 sm:px-4 py-2 font-medium text-heading">{row.apellido || <span className="text-danger italic">Vacío</span>}</td>
                        <td className="px-3 sm:px-4 py-2 text-body font-mono text-xs">
                          {row.rut || <span className="text-danger italic">Vacío</span>}
                          {row.rut && !validateRut(row.rut) && (
                            <span className="ml-1 text-danger"><i className="fas fa-exclamation-circle" /></span>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-2 text-muted">{row.patente || '—'}</td>
                        <td className="px-3 sm:px-4 py-2 text-muted italic">{responsable.organizacion}</td>
                        <td className="px-3 sm:px-4 py-2 text-muted italic">{tipoMedio}</td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => setBulkRows(prev => prev.filter((_, idx) => idx !== i))}
                            className="p-1 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-snappy"
                            title="Eliminar fila"
                          >
                            <i className="fas fa-times text-xs" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 sm:px-5 py-2 bg-surface/40 border-t border-edge/50 text-xs text-muted flex items-center gap-2">
                <i className="fas fa-info-circle" />
                Empresa, tipo de medio y zona se asignan automáticamente desde los pasos 1 y 2.
              </div>
            </div>
          )}
        </>
      )}

      {/* Error summary */}
      {Object.values(acreditadoErrors).some(e => Object.keys(e).length > 0) && (
        <div className="p-3 rounded-xl bg-danger/5 border border-danger/20 text-sm text-danger">
          <i className="fas fa-exclamation-triangle mr-2" />
          Algunos acreditados tienen errores. Revisa los campos marcados en rojo.
        </div>
      )}

      {/* Nav */}
      <div className="flex gap-2 sm:gap-3">
        <button
          type="button"
          onClick={goBack}
          className="flex-1 py-3 sm:py-3.5 rounded-xl border border-edge text-body font-semibold hover:bg-surface transition-snappy text-sm sm:text-base"
        >
          <i className="fas fa-arrow-left mr-1.5 sm:mr-2" /> Volver
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || (acreditados.length === 0 && bulkRows.length === 0)}
          className="flex-1 py-3 sm:py-3.5 rounded-xl text-white font-bold transition-snappy hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed relative text-sm sm:text-base"
          style={{ backgroundColor: tenantColors.primario }}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" /> Enviando...
            </span>
          ) : (
            <>
              <i className="fas fa-paper-plane mr-2" /> Revisar y Enviar
            </>
          )}
        </button>
      </div>
    </div>
  );
}
