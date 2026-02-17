'use client';

import { useMemo } from 'react';
import { useAdmin } from './AdminContext';
import { StatusBadge } from '@/components/shared/ui';
import type { RegistrationFull } from '@/types';

const RECENT_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

interface AdminRowProps {
  reg: RegistrationFull;
  onViewDetail: (reg: RegistrationFull) => void;
  onReject: (reg: RegistrationFull) => void;
}

export default function AdminRow({ reg, onViewDetail, onReject }: AdminRowProps) {
  const { selectedIds, toggleSelect, handleStatusChange, sendEmail, processing, tenant, selectedEvent, updateRegistrationZona } = useAdmin();
  const isProcessing = processing === reg.id;

  // Highlight recently created registrations (last 5 min)
  const isRecent = useMemo(() => {
    const created = new Date(reg.created_at).getTime();
    return Date.now() - created < RECENT_THRESHOLD_MS;
  }, [reg.created_at]);

  // Get zone options: event config first, then tenant config fallback
  const zonaOptions =
    ((selectedEvent?.config as Record<string, unknown>)?.zonas as string[]) ||
    ((tenant?.config as Record<string, unknown>)?.zonas as string[]) ||
    [];

  return (
    <tr className={`border-b border-edge transition ${
      selectedIds.has(reg.id)
        ? 'bg-accent-light/50'
        : isRecent
          ? 'bg-amber-50/40 hover:bg-amber-50/60'
          : 'hover:bg-canvas/50'
    }`}>
      {/* Checkbox */}
      <td className="p-3 pl-4">
        <input
          type="checkbox"
          checked={selectedIds.has(reg.id)}
          onChange={() => toggleSelect(reg.id)}
          className="rounded border-field-border text-brand"
        />
      </td>

      {/* RUT */}
      <td className="p-3">
        <span className="font-mono text-base text-body">{reg.rut}</span>
      </td>

      {/* Nombre */}
      <td className="p-3">
        <div className="flex items-center gap-3">
          {reg.profile_foto ? (
            <img src={reg.profile_foto} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00C48C] to-[#00A676] flex items-center justify-center text-white text-xs font-bold">
              {reg.profile_nombre?.[0]}{reg.profile_apellido?.[0]}
            </div>
          )}
          <div>
            <p className="text-base font-medium text-heading flex items-center gap-1.5">
              {reg.profile_nombre} {reg.profile_apellido}
              {isRecent && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wide">
                  Nuevo
                </span>
              )}
            </p>
            <p className="text-sm text-muted">{reg.profile_email || 'Sin email'}</p>
          </div>
        </div>
      </td>

      {/* Organización */}
      <td className="p-3 text-base text-body">{reg.organizacion || <span className="text-muted">—</span>}</td>

      {/* Tipo Medio */}
      <td className="p-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-subtle text-sm font-medium text-body">
          {reg.tipo_medio || '—'}
        </span>
      </td>

      {/* Cargo */}
      <td className="p-3 text-base text-body">{reg.cargo || <span className="text-muted">—</span>}</td>

      {/* Zona — always a select dropdown */}
      <td className="p-3">
        {zonaOptions.length > 0 ? (
          <select
            value={String((reg.datos_extra as Record<string, unknown>)?.zona || '')}
            onChange={(e) => updateRegistrationZona(reg.id, e.target.value)}
            className={`px-2 py-1 rounded-md border text-sm font-medium transition cursor-pointer ${
              (reg.datos_extra as Record<string, unknown>)?.zona
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-subtle text-muted border-edge'
            }`}
          >
            <option value="">Sin zona</option>
            {zonaOptions.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        ) : (
          <span className="text-xs text-muted italic" title="Configura zonas en Configuración del evento">
            Sin zonas
          </span>
        )}
      </td>

      {/* Estado */}
      <td className="p-3">
        <StatusBadge status={reg.status} />
      </td>

      {/* Check-in */}
      <td className="p-3">
        {reg.checked_in ? (
          <span className="inline-flex items-center gap-1 text-success text-sm font-medium">
            <i className="fas fa-check-circle" /> Sí
          </span>
        ) : (
          <span className="text-muted text-sm">No</span>
        )}
      </td>

      {/* Acciones */}
      <td className="p-3 pr-4">
        <div className="flex items-center gap-1">
          {/* View detail */}
          <button
            onClick={() => onViewDetail(reg)}
            className="p-1.5 text-muted hover:text-brand hover:bg-accent-light rounded-lg transition"
            title="Ver detalle"
          >
            <i className="fas fa-eye text-sm" />
          </button>

          {/* Quick actions for pending */}
          {reg.status === 'pendiente' && (
            <>
              <button
                onClick={() => handleStatusChange(reg.id, 'aprobado')}
                disabled={isProcessing}
                className="p-1.5 text-muted hover:text-success hover:bg-success-light rounded-lg transition disabled:opacity-50"
                title="Aprobar"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-success border-t-transparent rounded-full animate-spin" />
                ) : (
                  <i className="fas fa-check text-sm" />
                )}
              </button>
              <button
                onClick={() => onReject(reg)}
                disabled={isProcessing}
                className="p-1.5 text-muted hover:text-danger hover:bg-danger-light rounded-lg transition disabled:opacity-50"
                title="Rechazar"
              >
                <i className="fas fa-times text-sm" />
              </button>
            </>
          )}

          {/* Send email for approved/rejected */}
          {(reg.status === 'aprobado' || reg.status === 'rechazado') && reg.profile_email && (
            <button
              onClick={() => sendEmail(reg.id)}
              disabled={isProcessing}
              className="p-1.5 text-muted hover:text-[#9333ea] hover:bg-[#faf5ff] rounded-lg transition disabled:opacity-50"
              title={`Enviar email de ${reg.status === 'aprobado' ? 'aprobación' : 'rechazo'}`}
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <i className="fas fa-envelope text-sm" />
              )}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
