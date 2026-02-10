'use client';

import { useState } from 'react';
import { Modal, StatusBadge } from '@/components/shared/ui';
import { useAdmin } from './AdminContext';
import type { RegistrationFull } from '@/types';

interface AdminDetailModalProps {
  reg: RegistrationFull | null;
  open: boolean;
  onClose: () => void;
}

export default function AdminDetailModal({ reg, open, onClose }: AdminDetailModalProps) {
  const { handleStatusChange, handleDelete, processing } = useAdmin();
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!reg) return null;
  const isProcessing = processing === reg.id;

  const handleReject = () => {
    if (!rejectMotivo.trim()) return;
    handleStatusChange(reg.id, 'rechazado', rejectMotivo);
    setRejectMotivo('');
    setShowRejectInput(false);
    onClose();
  };

  const handleApprove = () => {
    handleStatusChange(reg.id, 'aprobado');
    onClose();
  };

  const handleDeleteReg = () => {
    if (confirm('¿Eliminar este registro permanentemente?')) {
      handleDelete(reg.id);
      onClose();
    }
  };

  const infoPairs = [
    { label: 'RUT', value: reg.rut, icon: 'fa-id-card' },
    { label: 'Email', value: reg.profile_email || '—', icon: 'fa-envelope' },
    { label: 'Teléfono', value: reg.profile_telefono || '—', icon: 'fa-phone' },
    { label: 'Organización', value: reg.organizacion || '—', icon: 'fa-building' },
    { label: 'Tipo Medio', value: reg.tipo_medio || '—', icon: 'fa-broadcast-tower' },
    { label: 'Cargo', value: reg.cargo || '—', icon: 'fa-user-tie' },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Detalle de Acreditación" maxWidth="max-w-3xl">
      {/* Person header */}
      <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-100">
        {reg.profile_foto ? (
          <img src={reg.profile_foto} alt="" className="w-16 h-16 rounded-2xl object-cover shadow-sm" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-sm">
            {reg.profile_nombre?.[0]}{reg.profile_apellido?.[0]}
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900">
            {reg.profile_nombre} {reg.profile_apellido}
          </h3>
          <p className="text-sm text-gray-500">{reg.organizacion || 'Sin organización'} · {reg.cargo || 'Sin cargo'}</p>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={reg.status} />
            {reg.checked_in && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <i className="fas fa-qrcode" /> Check-in realizado
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {infoPairs.map(pair => (
          <div key={pair.label} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
              <i className={`fas ${pair.icon} text-gray-400 text-sm`} />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">{pair.label}</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{pair.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Event info */}
      <div className="mb-6 p-4 bg-blue-50 rounded-xl">
        <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">Evento</p>
        <p className="text-sm font-medium text-blue-900">{reg.event_nombre}</p>
        {reg.event_fecha && (
          <p className="text-xs text-blue-600 mt-1">
            <i className="fas fa-calendar mr-1" />
            {new Date(reg.event_fecha).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {reg.event_venue && <> · <i className="fas fa-map-marker-alt mr-1" />{reg.event_venue}</>}
          </p>
        )}
      </div>

      {/* Datos extra */}
      {reg.datos_extra && Object.keys(reg.datos_extra).length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Datos adicionales</h4>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            {Object.entries(reg.datos_extra).map(([key, val]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-gray-500">{key}</span>
                <span className="text-gray-900 font-medium">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Motivo rechazo */}
      {reg.status === 'rechazado' && reg.motivo_rechazo && (
        <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-100">
          <p className="text-xs text-red-500 uppercase tracking-wide mb-1">Motivo del rechazo</p>
          <p className="text-sm text-red-800">{reg.motivo_rechazo}</p>
        </div>
      )}

      {/* Timestamps */}
      <div className="mb-6 text-xs text-gray-400 space-y-1">
        <p><i className="fas fa-clock mr-1" /> Registrado: {new Date(reg.created_at).toLocaleString('es-CL')}</p>
        {reg.processed_at && (
          <p><i className="fas fa-user-check mr-1" /> Procesado: {new Date(reg.processed_at).toLocaleString('es-CL')}</p>
        )}
        {reg.checked_in_at && (
          <p><i className="fas fa-qrcode mr-1" /> Check-in: {new Date(reg.checked_in_at).toLocaleString('es-CL')}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
        {reg.status === 'pendiente' && (
          <>
            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              <i className="fas fa-check" /> Aprobar
            </button>

            {!showRejectInput ? (
              <button
                onClick={() => setShowRejectInput(true)}
                disabled={isProcessing}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                <i className="fas fa-times" /> Rechazar
              </button>
            ) : (
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={rejectMotivo}
                  onChange={e => setRejectMotivo(e.target.value)}
                  placeholder="Motivo del rechazo..."
                  className="w-full px-4 py-2.5 border border-red-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-red-500"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleReject()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleReject}
                    disabled={!rejectMotivo.trim() || isProcessing}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    Confirmar rechazo
                  </button>
                  <button
                    onClick={() => { setShowRejectInput(false); setRejectMotivo(''); }}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <button
          onClick={handleDeleteReg}
          className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition flex items-center gap-2"
        >
          <i className="fas fa-trash text-sm" /> Eliminar
        </button>
      </div>
    </Modal>
  );
}
