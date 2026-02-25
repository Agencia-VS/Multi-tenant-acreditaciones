'use client';

import { useState } from 'react';
import type { FormFieldDefinition, TeamMember } from '@/types';
import AcreditadoRow from '@/components/forms/AcreditadoRow';
import type { AcreditadoData } from '@/components/forms/AcreditadoRow';
import { validateDocumentByType, cleanRut } from '@/lib/validation';
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
  eventZonas?: string[];
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

/* ─── Bulk Summary — compact card with expandable table ─── */
function BulkSummary({
  bulkRows,
  setBulkRows,
  responsable,
  tipoMedio,
}: {
  bulkRows: BulkImportRow[];
  setBulkRows: React.Dispatch<React.SetStateAction<BulkImportRow[]>>;
  responsable: ResponsableData;
  tipoMedio: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const getBulkRowError = (row: BulkImportRow, index: number): string | null => {
    const fileLine = index + 2; // +1 por índice base 0 y +1 por header
    const docType = row.document_type || 'rut';
    const docNumber = row.document_number || row.rut;

    if (!row.nombre?.trim() || !row.apellido?.trim() || !docNumber?.trim()) {
      return `Línea ${fileLine}: faltan Nombre, Apellido o Documento`;
    }

    const docValidation = validateDocumentByType(docType, docNumber);
    if (!docValidation.valid) {
      return `Línea ${fileLine}: ${docType === 'rut' ? 'RUT' : 'Documento'} inválido`;
    }

    const email = row.extras?.email;
    if (email && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return `Línea ${fileLine}: email inválido`;
    }

    return null;
  };

  const bulkErrors = bulkRows.map((row, index) => getBulkRowError(row, index));
  const firstBulkError = bulkErrors.find(Boolean) || null;

  const invalidDocuments = bulkRows.filter((r) => {
    const docType = r.document_type || 'rut';
    const docNumber = r.document_number || r.rut;
    return docNumber && !validateDocumentByType(docType, docNumber).valid;
  }).length;
  const missingNames = bulkRows.filter(r => !r.nombre || !r.apellido).length;
  const previewRows = bulkRows.slice(0, 3);
  const PREVIEW_LIMIT = 20;

  // Collect all unique extra keys across all bulk rows for dynamic columns
  const extraKeys = (() => {
    const keySet = new Set<string>();
    for (const row of bulkRows) {
      if (row.extras) {
        for (const k of Object.keys(row.extras)) keySet.add(k);
      }
    }
    return [...keySet];
  })();

  // Human-readable labels for common extras
  const EXTRA_LABELS: Record<string, string> = {
    cargo: 'Cargo', email: 'Email', telefono: 'Teléfono', zona: 'Zona',
    empresa: 'Empresa', organizacion: 'Organización', tipo_medio: 'Tipo Medio',
    area: 'Área', segundo_apellido: 'Segundo Apellido', patente: 'Patente',
  };

  return (
    <div className="rounded-2xl border border-edge bg-surface/30 overflow-hidden animate-fade-in">
      {/* Header with summary stats */}
      <div className="px-4 sm:px-5 py-3 sm:py-4 bg-surface/60 border-b border-edge/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
              <i className="fas fa-file-upload text-brand" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-heading">
                Carga masiva · {bulkRows.length} persona{bulkRows.length !== 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                {invalidDocuments > 0 && (
                  <span className="text-xs text-danger font-medium flex items-center gap-1">
                    <i className="fas fa-exclamation-circle text-[10px]" /> {invalidDocuments} documento{invalidDocuments !== 1 ? 's' : ''} inválido{invalidDocuments !== 1 ? 's' : ''}
                  </span>
                )}
                {missingNames > 0 && (
                  <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                    <i className="fas fa-exclamation-triangle text-[10px]" /> {missingNames} sin nombre completo
                  </span>
                )}
                {invalidDocuments === 0 && missingNames === 0 && (
                  <span className="text-xs text-success font-medium flex items-center gap-1">
                    <i className="fas fa-check-circle text-[10px]" /> Datos validados
                  </span>
                )}
              </div>
              {firstBulkError && (
                <p className="mt-1 text-xs text-danger font-semibold truncate" title={firstBulkError}>
                  <i className="fas fa-bug mr-1" /> {firstBulkError}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBulkRows([])}
            className="text-xs text-danger font-semibold hover:underline flex items-center gap-1 shrink-0"
          >
            <i className="fas fa-trash-alt" /> Limpiar
          </button>
        </div>

        {/* Preview names (first 3) */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {previewRows.map((row, i) => {
            const rowError = bulkErrors[i];
            return (
              <span key={row.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${rowError ? 'bg-danger/5 border-danger/30 text-danger' : 'bg-surface border-edge text-heading'}`}>
                <span className="w-4 h-4 rounded-full bg-brand/10 text-brand text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                {row.nombre} {row.apellido}
                {rowError ? (
                  <>
                    <i className="fas fa-exclamation-circle text-danger text-[10px]" />
                    <span className="hidden sm:inline max-w-[220px] truncate">{rowError}</span>
                  </>
                ) : null}
              </span>
            );
          })}
          {bulkRows.length > 3 && (
            <span className="text-xs text-muted font-medium">y {bulkRows.length - 3} más...</span>
          )}
        </div>
      </div>

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 sm:px-5 py-2 flex items-center justify-center gap-2 text-xs font-semibold text-brand hover:bg-brand/5 transition-snappy"
      >
        <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-[10px]`} />
        {expanded ? 'Ocultar detalle' : 'Ver tabla completa'}
      </button>

      {/* Expandable table */}
      {expanded && (
        <div className="border-t border-edge/50">
          <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-surface/80 backdrop-blur-sm border-b border-edge/50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wide w-8">#</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wide">Nombre</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wide">Apellido</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wide">Tipo Doc.</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wide">Documento</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wide">Error</th>
                  {extraKeys.map(k => (
                    <th key={k} className="text-left px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap">
                      {EXTRA_LABELS[k] || k.replace(/_/g, ' ')}
                    </th>
                  ))}
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/30">
                {bulkRows.slice(0, PREVIEW_LIMIT).map((row, i) => {
                  const rowError = bulkErrors[i];
                  return (
                  <tr key={row.id} className={`hover:bg-surface/40 transition-snappy ${rowError ? 'bg-danger/5' : ''}`}>
                    <td className="px-3 py-2 text-xs text-muted font-mono">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-heading">{row.nombre || <span className="text-danger italic text-xs">Vacío</span>}</td>
                    <td className="px-3 py-2 font-medium text-heading">{row.apellido || <span className="text-danger italic text-xs">Vacío</span>}</td>
                    <td className="px-3 py-2 text-body text-xs whitespace-nowrap">{row.document_type === 'dni_extranjero' ? 'DNI/Pasaporte' : 'RUT'}</td>
                    <td className="px-3 py-2 text-body font-mono text-xs">
                      {(row.document_number || row.rut) || <span className="text-danger italic">Vacío</span>}
                      {rowError
                        ? <i className="fas fa-exclamation-circle text-danger ml-1" />
                        : null}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {rowError
                        ? <span className="text-danger font-medium">{rowError}</span>
                        : <span className="text-success">OK</span>}
                    </td>
                    {extraKeys.map(k => (
                      <td key={k} className="px-3 py-2 text-body text-xs whitespace-nowrap">
                        {row.extras?.[k] || '—'}
                      </td>
                    ))}
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
                  );
                })}
              </tbody>
            </table>
            {bulkRows.length > PREVIEW_LIMIT && (
              <div className="px-4 py-2 text-center text-xs text-muted border-t border-edge/50">
                Mostrando primeras {PREVIEW_LIMIT} de {bulkRows.length} filas
              </div>
            )}
          </div>
          <div className="px-4 py-2 bg-surface/40 border-t border-edge/50 text-xs text-muted flex items-center gap-2">
            <i className="fas fa-info-circle" />
            Empresa ({responsable.organizacion}) y tipo de medio ({tipoMedio}) se asignan automáticamente.
          </div>
        </div>
      )}
    </div>
  );
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
  eventZonas,
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
              const alreadyAdded = acreditados.some(a => (a.document_type || 'rut') === 'rut' && a.rut && cleanRut(a.rut) === cleanRut(p.rut));
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
                  eventZonas={eventZonas}
                />
              ))}
            </div>
          )}

          {/* ── Resumen de Carga Masiva (compacto + expandible) ── */}
          {bulkRows.length > 0 && <BulkSummary bulkRows={bulkRows} setBulkRows={setBulkRows} responsable={responsable} tipoMedio={tipoMedio} />}
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
          className="px-5 py-2.5 rounded-xl border border-edge text-body font-semibold hover:bg-surface transition-snappy text-sm"
        >
          <i className="fas fa-arrow-left mr-1.5" /> Volver
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || (acreditados.length === 0 && bulkRows.length === 0)}
          className="flex-1 py-2.5 rounded-xl text-white font-semibold transition-snappy hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          style={{ backgroundColor: tenantColors.primario }}
        >
          <i className="fas fa-paper-plane mr-1.5" /> Revisar y Enviar
        </button>
      </div>
    </div>
  );
}
