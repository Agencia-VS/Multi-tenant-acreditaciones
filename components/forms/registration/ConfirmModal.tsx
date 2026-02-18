'use client';

import { useState } from 'react';
import { Modal, LoadingSpinner } from '@/components/shared/ui';
import type { AcreditadoData } from '@/components/forms/AcreditadoRow';
import { TIPO_MEDIO_ICONS, type ResponsableData, type BulkImportRow } from './types';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  responsable: ResponsableData;
  tipoMedio: string;
  acreditados: AcreditadoData[];
  bulkRows: BulkImportRow[];
  submitting: boolean;
  tenantColors: { primario: string; secundario: string };
  onConfirm: () => void;
}

export default function ConfirmModal({
  open,
  onClose,
  responsable,
  tipoMedio,
  acreditados,
  bulkRows,
  submitting,
  tenantColors,
  onConfirm,
}: ConfirmModalProps) {
  const [showDetailList, setShowDetailList] = useState(false);
  const totalPersonas = acreditados.length + bulkRows.length;

  // Build a compact name list for preview (first 3)
  const allNames = [
    ...acreditados.map(a => ({ name: `${a.nombre} ${a.apellido}`, isResp: a.isResponsable })),
    ...bulkRows.map(r => ({ name: `${r.nombre} ${r.apellido}`, isResp: false })),
  ];
  const previewNames = allNames.slice(0, 3);
  const remaining = allNames.length - previewNames.length;

  return (
    <Modal open={open} onClose={onClose} title="Confirmar Solicitud" maxWidth="max-w-lg">
      <div className="space-y-4">
        {/* Icon + title */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${tenantColors.primario}15` }}>
            <i className="fas fa-clipboard-check text-2xl" style={{ color: tenantColors.primario }} />
          </div>
          <p className="text-sm text-muted">Revisa el resumen antes de enviar</p>
        </div>

        {/* Compact summary cards */}
        <div className="space-y-2">
          {/* Responsable */}
          <div className="bg-surface rounded-xl p-3 border border-edge">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <i className="fas fa-user text-brand text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-heading truncate">{responsable.nombre} {responsable.apellido}</p>
                <p className="text-xs text-muted truncate">{responsable.organizacion} · {responsable.email}</p>
              </div>
              <span className="text-xs text-muted font-mono shrink-0">{responsable.rut}</span>
            </div>
          </div>

          {/* Tipo medio + count */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface rounded-xl p-3 border border-edge">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Tipo de Medio</p>
              <div className="flex items-center gap-2">
                <i className={`fas ${TIPO_MEDIO_ICONS[tipoMedio] || 'fa-ellipsis-h'} text-brand text-sm`} />
                <span className="text-sm font-semibold text-heading truncate">{tipoMedio}</span>
              </div>
            </div>
            <div className="bg-surface rounded-xl p-3 border border-edge">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Acreditados</p>
              <div className="flex items-center gap-2">
                <i className="fas fa-users text-brand text-sm" />
                <span className="text-sm font-semibold text-heading">
                  {totalPersonas} persona{totalPersonas !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Personas — compact preview with expandable detail */}
          <div className="bg-surface rounded-xl border border-edge overflow-hidden">
            <div className="p-3">
              <div className="space-y-1.5">
                {previewNames.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="font-medium text-heading truncate">{p.name}</span>
                    {p.isResp && <span className="text-[10px] text-success font-semibold bg-success/10 px-1.5 py-0.5 rounded-full shrink-0">Tú</span>}
                  </div>
                ))}
              </div>

              {/* Show more / less toggle */}
              {allNames.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowDetailList(!showDetailList)}
                  className="mt-2 text-xs text-brand font-semibold hover:underline flex items-center gap-1"
                >
                  {showDetailList ? (
                    <><i className="fas fa-chevron-up text-[10px]" /> Ocultar detalle</>
                  ) : (
                    <><i className="fas fa-chevron-down text-[10px]" /> Ver {remaining > 0 ? `${remaining} más` : 'todos'}</>
                  )}
                </button>
              )}
            </div>

            {/* Expandable full list */}
            {showDetailList && allNames.length > 3 && (
              <div className="border-t border-edge/50 px-3 py-2 max-h-48 overflow-y-auto bg-surface/50">
                <div className="space-y-1.5">
                  {allNames.slice(3).map((p, i) => (
                    <div key={i + 3} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-[10px] font-bold flex items-center justify-center shrink-0">{i + 4}</span>
                      <span className="font-medium text-heading truncate">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bulk badge */}
            {bulkRows.length > 0 && (
              <div className="border-t border-edge/50 px-3 py-2 bg-surface/30">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <i className="fas fa-file-upload text-brand" />
                  {bulkRows.length} de carga masiva
                  {acreditados.length > 0 && <> · {acreditados.length} manual{acreditados.length !== 1 ? 'es' : ''}</>}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions — sticky at bottom so always visible */}
        <div className="flex gap-2 sm:gap-3 pt-3 border-t border-edge/50 mt-1 sticky bottom-0 bg-white pb-safe">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2 sm:py-2.5 rounded-xl border border-edge text-body font-semibold hover:bg-surface transition-snappy text-sm disabled:opacity-50"
          >
            <i className="fas fa-pen mr-1.5" /> Modificar
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 py-2 sm:py-2.5 rounded-xl text-white font-semibold transition-snappy hover:opacity-90 disabled:opacity-50 text-sm"
            style={{ backgroundColor: tenantColors.primario }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-1.5">
                <LoadingSpinner size="sm" /> Enviando…
              </span>
            ) : (
              <>
                <i className="fas fa-paper-plane mr-1.5" /> Confirmar
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
