'use client';

import { useState } from 'react';
import { useAdmin } from './AdminContext';
import { StatusBadge } from '@/components/shared/ui';
import type { RegistrationFull } from '@/types';

interface AdminRowProps {
  reg: RegistrationFull;
  onViewDetail: (reg: RegistrationFull) => void;
  onReject: (reg: RegistrationFull) => void;
}

export default function AdminRow({ reg, onViewDetail, onReject }: AdminRowProps) {
  const { selectedIds, toggleSelect, handleStatusChange, processing } = useAdmin();
  const isProcessing = processing === reg.id;

  return (
    <tr className={`border-b border-gray-50 transition ${selectedIds.has(reg.id) ? 'bg-blue-50/50' : 'hover:bg-gray-50/50'}`}>
      {/* Checkbox */}
      <td className="p-3 pl-4">
        <input
          type="checkbox"
          checked={selectedIds.has(reg.id)}
          onChange={() => toggleSelect(reg.id)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </td>

      {/* RUT */}
      <td className="p-3">
        <span className="font-mono text-sm text-gray-600">{reg.rut}</span>
      </td>

      {/* Nombre */}
      <td className="p-3">
        <div className="flex items-center gap-3">
          {reg.profile_foto ? (
            <img src={reg.profile_foto} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {reg.profile_nombre?.[0]}{reg.profile_apellido?.[0]}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">{reg.profile_nombre} {reg.profile_apellido}</p>
            <p className="text-xs text-gray-400">{reg.profile_email || 'Sin email'}</p>
          </div>
        </div>
      </td>

      {/* Organización */}
      <td className="p-3 text-sm text-gray-600">{reg.organizacion || <span className="text-gray-300">—</span>}</td>

      {/* Tipo Medio */}
      <td className="p-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-600">
          {reg.tipo_medio || '—'}
        </span>
      </td>

      {/* Cargo */}
      <td className="p-3 text-sm text-gray-600">{reg.cargo || <span className="text-gray-300">—</span>}</td>

      {/* Estado */}
      <td className="p-3">
        <StatusBadge status={reg.status} />
      </td>

      {/* Check-in */}
      <td className="p-3">
        {reg.checked_in ? (
          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
            <i className="fas fa-check-circle" /> Sí
          </span>
        ) : (
          <span className="text-gray-300 text-xs">No</span>
        )}
      </td>

      {/* Acciones */}
      <td className="p-3 pr-4">
        <div className="flex items-center gap-1">
          {/* View detail */}
          <button
            onClick={() => onViewDetail(reg)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
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
                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                title="Aprobar"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <i className="fas fa-check text-sm" />
                )}
              </button>
              <button
                onClick={() => onReject(reg)}
                disabled={isProcessing}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                title="Rechazar"
              >
                <i className="fas fa-times text-sm" />
              </button>
            </>
          )}

          {/* Resend email for approved */}
          {reg.status === 'aprobado' && reg.profile_email && (
            <button
              onClick={() => handleStatusChange(reg.id, 'aprobado')}
              disabled={isProcessing}
              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition disabled:opacity-50"
              title="Reenviar email"
            >
              <i className="fas fa-envelope text-sm" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
