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
  const { handleStatusChange, handleDelete, processing, tenant, updateRegistrationZona } = useAdmin();
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!reg) return null;
  const isProcessing = processing === reg.id;
  const zonaOptions = ((tenant?.config as Record<string, unknown>)?.zonas as string[]) || [];
  const currentZona = (reg.datos_extra as Record<string, unknown>)?.zona as string || '';

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
      <div className="flex items-start gap-4 mb-6 pb-6 border-b border-edge">
        {reg.profile_foto ? (
          <img src={reg.profile_foto} alt="" className="w-16 h-16 rounded-2xl object-cover shadow-sm" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center text-white text-xl font-bold shadow-sm">
            {reg.profile_nombre?.[0]}{reg.profile_apellido?.[0]}
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-xl font-bold text-heading">
            {reg.profile_nombre} {reg.profile_apellido}
          </h3>
          <p className="text-base text-body">{reg.organizacion || 'Sin organización'} · {reg.cargo || 'Sin cargo'}</p>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={reg.status} />
            {reg.checked_in && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium bg-success-light text-success-dark">
                <i className="fas fa-qrcode" /> Check-in realizado
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {infoPairs.map(pair => (
          <div key={pair.label} className="flex items-start gap-3 p-3 bg-canvas rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-surface shadow-sm flex items-center justify-center">
              <i className={`fas ${pair.icon} text-muted text-sm`} />
            </div>
            <div>
              <p className="text-sm text-muted uppercase tracking-wide">{pair.label}</p>
              <p className="text-base font-medium text-heading mt-0.5">{pair.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Zona Assignment */}
      <div className="mb-6 p-4 bg-purple-50 rounded-xl border border-purple-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fas fa-map-signs text-purple-600" />
            <span className="text-sm font-semibold text-purple-900">Zona de Acceso</span>
          </div>
          {zonaOptions.length > 0 ? (
            <select
              value={currentZona}
              onChange={(e) => updateRegistrationZona(reg.id, e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-purple-200 bg-white text-sm font-medium text-purple-700 cursor-pointer"
            >
              <option value="">Sin zona asignada</option>
              {zonaOptions.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          ) : (
            <span className="text-sm font-medium text-purple-700">{currentZona || '—'}</span>
          )}
        </div>
      </div>

      {/* Event info */}
      <div className="mb-6 p-4 bg-accent-light rounded-xl">
        <p className="text-sm text-accent uppercase tracking-wide mb-1">Evento</p>
        <p className="text-base font-medium text-brand">{reg.event_nombre}</p>
        {reg.event_fecha && (
          <p className="text-sm text-brand mt-1">
            <i className="fas fa-calendar mr-1" />
            {new Date(reg.event_fecha).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {reg.event_venue && <> · <i className="fas fa-map-marker-alt mr-1" />{reg.event_venue}</>}
          </p>
        )}
      </div>

      {/* Datos extra */}
      {reg.datos_extra && Object.keys(reg.datos_extra).length > 0 && (
        <div className="mb-6">
          <h4 className="text-base font-semibold text-label mb-3">Datos adicionales</h4>
          <div className="bg-canvas rounded-xl p-4 space-y-2">
            {Object.entries(reg.datos_extra).map(([key, val]) => (
              <div key={key} className="flex justify-between text-base">
                <span className="text-body">{key}</span>
                <span className="text-heading font-medium">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Motivo rechazo */}
      {reg.status === 'rechazado' && reg.motivo_rechazo && (
        <div className="mb-6 p-4 bg-danger-light rounded-xl border border-danger/20">
          <p className="text-sm text-danger uppercase tracking-wide mb-1">Motivo del rechazo</p>
          <p className="text-base text-danger-dark">{reg.motivo_rechazo}</p>
        </div>
      )}

      {/* Timestamps */}
      <div className="mb-6 text-sm text-muted space-y-1">
        <p><i className="fas fa-clock mr-1" /> Registrado: {new Date(reg.created_at).toLocaleString('es-CL')}</p>
        {reg.processed_at && (
          <p><i className="fas fa-user-check mr-1" /> Procesado: {new Date(reg.processed_at).toLocaleString('es-CL')}</p>
        )}
        {reg.checked_in_at && (
          <p><i className="fas fa-qrcode mr-1" /> Check-in: {new Date(reg.checked_in_at).toLocaleString('es-CL')}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-edge">
        {reg.status === 'pendiente' && (
          <>
            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className="flex-1 py-2.5 bg-success text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              <i className="fas fa-check" /> Aprobar
            </button>

            {!showRejectInput ? (
              <button
                onClick={() => setShowRejectInput(true)}
                disabled={isProcessing}
                className="flex-1 py-2.5 bg-danger text-white rounded-xl font-medium hover:bg-danger/90 disabled:opacity-50 transition flex items-center justify-center gap-2"
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
                  className="w-full px-4 py-2.5 border border-danger/30 rounded-xl text-base text-heading"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleReject()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleReject}
                    disabled={!rejectMotivo.trim() || isProcessing}
                    className="flex-1 py-2 bg-danger text-white rounded-lg text-base font-medium hover:bg-danger/90 disabled:opacity-50 transition"
                  >
                    Confirmar rechazo
                  </button>
                  <button
                    onClick={() => { setShowRejectInput(false); setRejectMotivo(''); }}
                    className="px-4 py-2 bg-subtle text-body rounded-lg text-base hover:bg-edge transition"
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
          className="px-4 py-2.5 bg-subtle text-body rounded-xl font-medium hover:bg-edge transition flex items-center gap-2"
        >
          <i className="fas fa-trash text-sm" /> Eliminar
        </button>
      </div>
    </Modal>
  );
}
