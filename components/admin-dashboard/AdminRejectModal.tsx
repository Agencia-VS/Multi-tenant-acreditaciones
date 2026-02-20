'use client';

import { useState } from 'react';
import { Modal, ButtonSpinner } from '@/components/shared/ui';
import type { RegistrationFull } from '@/types';
import { useAdmin } from './AdminContext';

interface AdminRejectModalProps {
  reg: RegistrationFull | null;
  open: boolean;
  onClose: () => void;
}

const REJECTION_TEMPLATES = [
  'Documentación incompleta',
  'No cumple requisitos del evento',
  'Cupo máximo alcanzado para su medio',
  'Datos incorrectos o no verificables',
  'Fuera de plazo de acreditación',
  'Cupo agotado para su categoría',
] as const;

export default function AdminRejectModal({ reg, open, onClose }: AdminRejectModalProps) {
  const { handleStatusChange, processing } = useAdmin();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [additionalDetails, setAdditionalDetails] = useState('');
  const isProcessing = reg ? processing === reg.id : false;

  const motivo = selectedTemplate
    ? additionalDetails.trim()
      ? `${selectedTemplate} — ${additionalDetails.trim()}`
      : selectedTemplate
    : additionalDetails.trim();

  const handleSubmit = () => {
    if (!reg || !motivo) return;
    handleStatusChange(reg.id, 'rechazado', motivo);
    setSelectedTemplate(null);
    setAdditionalDetails('');
    onClose();
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setAdditionalDetails('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Rechazar Acreditación" maxWidth="max-w-md">
      {reg && (
        <div className="space-y-4">
          {/* Person info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white text-sm font-bold">
              {reg.profile_nombre?.[0]}{reg.profile_apellido?.[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{reg.profile_nombre} {reg.profile_apellido}</p>
              <p className="text-xs text-gray-500">{reg.organizacion} · {reg.tipo_medio}</p>
            </div>
          </div>

          {/* Quick reasons */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Motivos rápidos:</p>
            <div className="flex flex-wrap gap-2">
              {REJECTION_TEMPLATES.map(reason => (
                <button
                  key={reason}
                  onClick={() => setSelectedTemplate(prev => prev === reason ? null : reason)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                    selectedTemplate === reason
                      ? 'bg-red-50 border-red-300 text-red-700 ring-1 ring-red-200'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-600'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          {/* Additional details */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              {selectedTemplate ? 'Detalles adicionales (opcional)' : 'Motivo del rechazo *'}
            </label>
            <textarea
              value={additionalDetails}
              onChange={e => setAdditionalDetails(e.target.value)}
              placeholder={selectedTemplate ? 'Agregar detalles específicos...' : 'Escriba el motivo del rechazo...'}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
            />
            {motivo && (
              <p className="mt-1.5 text-xs text-gray-400 italic truncate">
                Se enviará: &ldquo;{motivo}&rdquo;
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={!motivo || isProcessing}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <ButtonSpinner />
              ) : (
                <i className="fas fa-times" />
              )}
              Rechazar
            </button>
            <button
              onClick={handleClose}
              className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
