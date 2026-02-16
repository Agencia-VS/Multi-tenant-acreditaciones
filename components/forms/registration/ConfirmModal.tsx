'use client';

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
  return (
    <Modal open={open} onClose={onClose} title="Confirmar Solicitud" maxWidth="max-w-xl">
      <div className="mb-6">
        <div className="text-center mb-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${tenantColors.primario}20` }}>
            <i className="fas fa-clipboard-check text-2xl" style={{ color: tenantColors.primario }} />
          </div>
          <p className="text-sm text-muted">Revisa los datos antes de enviar</p>
        </div>

        {/* Responsable summary */}
        <div className="space-y-3 mb-6">
          <div className="bg-surface rounded-xl p-3 sm:p-4 border border-edge">
            <p className="text-xs font-semibold text-muted uppercase mb-2">Responsable</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-sm">
              <div><span className="text-muted">Nombre:</span> <span className="font-medium text-heading">{responsable.nombre} {responsable.apellido}</span></div>
              <div><span className="text-muted">RUT:</span> <span className="font-medium text-heading">{responsable.rut}</span></div>
              <div><span className="text-muted">Email:</span> <span className="font-medium text-heading">{responsable.email}</span></div>
              <div><span className="text-muted">Medio:</span> <span className="font-medium text-heading">{responsable.organizacion}</span></div>
            </div>
          </div>

          <div className="bg-surface rounded-xl p-3 sm:p-4 border border-edge">
            <p className="text-xs font-semibold text-muted uppercase mb-2">Tipo de Medio</p>
            <div className="flex items-center gap-2">
              <i className={`fas ${TIPO_MEDIO_ICONS[tipoMedio] || 'fa-ellipsis-h'} text-brand`} />
              <span className="font-medium text-heading">{tipoMedio}</span>
            </div>
          </div>

          <div className="bg-surface rounded-xl p-3 sm:p-4 border border-edge">
            <p className="text-xs font-semibold text-muted uppercase mb-2">Acreditados ({acreditados.length + bulkRows.length})</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {acreditados.map((a, i) => (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="font-medium text-heading">{a.nombre} {a.apellido}</span>
                  <span className="text-muted">— {a.cargo || 'Sin cargo'}</span>
                  {a.isResponsable && <span className="text-xs text-success font-semibold">(Tú)</span>}
                </div>
              ))}
              {bulkRows.length > 0 && acreditados.length > 0 && (
                <div className="border-t border-edge/50 pt-2 mt-2">
                  <p className="text-xs font-semibold text-muted uppercase mb-1.5 flex items-center gap-1">
                    <i className="fas fa-file-upload" /> Carga masiva
                  </p>
                </div>
              )}
              {bulkRows.map((row, i) => (
                <div key={row.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center shrink-0">{acreditados.length + i + 1}</span>
                  <span className="font-medium text-heading">{row.nombre} {row.apellido}</span>
                  <span className="text-muted font-mono text-xs">— {row.rut}</span>
                  {row.patente && <span className="text-muted text-xs">· {row.patente}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 sm:py-3 rounded-xl border-2 border-edge text-body font-semibold hover:bg-surface transition-snappy text-sm sm:text-base"
          >
            <i className="fas fa-pen mr-1.5 sm:mr-2" /> Modificar
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 py-2.5 sm:py-3 rounded-xl text-white font-bold transition-snappy hover:opacity-90 disabled:opacity-50 text-sm sm:text-base"
            style={{ backgroundColor: tenantColors.primario }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner size="sm" /> Enviando...
              </span>
            ) : (
              <>
                <i className="fas fa-paper-plane mr-2" /> Confirmar y Enviar
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
