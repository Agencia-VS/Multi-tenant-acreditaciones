'use client';

import { useState } from 'react';
import { useAdmin } from './AdminContext';
import { EmptyState, useToast } from '@/components/shared/ui';
import type { Event } from '@/types';

interface EventListProps {
  onCreateNew: () => void;
  onEditEvent: (ev: Event) => void;
}

export default function EventList({ onCreateNew, onEditEvent }: EventListProps) {
  const { tenant, events, selectedEvent, selectEvent, showSuccess, showError, fetchData, refreshEvents } = useAdmin();
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getInviteLink = (ev: Event) => {
    if (!tenant || ev.visibility !== 'invite_only' || !ev.invite_token) return null;
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/${tenant.slug}/acreditacion?invite=${ev.invite_token}`;
  };

  const copyLink = async (link: string, eventId: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(eventId);
      showSuccess('Link copiado al portapapeles');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showError('Error al copiar');
    }
  };

  const handleToggleActive = async (ev: Event) => {
    try {
      if (ev.is_active) {
        const res = await fetch(`/api/events?id=${ev.id}`, { method: 'DELETE' });
        if (res.ok) { showSuccess('Evento desactivado'); await refreshEvents(); fetchData(); }
      } else {
        const res = await fetch(`/api/events?id=${ev.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true }),
        });
        if (res.ok) { showSuccess('Evento activado'); await refreshEvents(); fetchData(); }
      }
    } catch {
      showError('Error actualizando evento');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const res = await fetch(`/api/events?id=${eventId}&action=delete`, { method: 'DELETE' });
      if (res.ok) {
        showSuccess('Evento eliminado');
        setDeletingEventId(null);
        await refreshEvents();
        fetchData();
      } else {
        const d = await res.json();
        showError(d.error || 'Error eliminando evento');
      }
    } catch {
      showError('Error de conexión');
    }
  };

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-edge">
      <div className="px-6 py-4 border-b border-edge flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-heading">Eventos</h2>
          <p className="text-sm text-body">Gestiona los eventos de {tenant?.nombre}</p>
        </div>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 bg-brand text-on-brand rounded-xl text-sm font-medium hover:bg-brand-hover transition flex items-center gap-2"
        >
          <i className="fas fa-plus" /> Nuevo evento
        </button>
      </div>

      {events.length === 0 ? (
        <EmptyState
          message="No hay eventos creados"
          icon="fa-calendar-plus"
          action={{ label: 'Crear primer evento', onClick: onCreateNew }}
        />
      ) : (
        <div className="divide-y divide-edge/50">
          {events.map(ev => (
            <div
              key={ev.id}
              className={`px-6 py-4 hover:bg-canvas/50 transition ${
                selectedEvent?.id === ev.id ? 'bg-accent-light/30 border-l-4 border-l-brand' : ''
              }`}
            >
              <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${ev.is_active ? 'bg-success' : 'bg-edge'}`} />
                <div>
                  <p className="text-sm font-medium text-heading">
                    {ev.nombre}
                    {ev.visibility === 'invite_only' && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        <i className="fas fa-envelope mr-1" />Invitación
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-body">
                    {ev.fecha ? new Date(ev.fecha).toLocaleDateString('es-CL') : 'Sin fecha'}
                    {ev.venue && ` · ${ev.venue}`}
                    {ev.opponent_name && ` · vs ${ev.opponent_name}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(ev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    ev.is_active
                      ? 'bg-success-light text-success-dark hover:bg-success-light/80'
                      : 'bg-subtle text-body hover:bg-edge'
                  }`}
                >
                  {ev.is_active ? 'Activo' : 'Inactivo'}
                </button>

                <button
                  onClick={() => selectEvent(ev.id)}
                  className="px-3 py-1.5 bg-accent-light text-brand rounded-lg text-xs font-medium hover:bg-accent-light/80 transition"
                >
                  <i className="fas fa-eye mr-1" /> Ver registros
                </button>

                <button
                  onClick={() => onEditEvent(ev)}
                  className="p-1.5 text-muted hover:text-brand hover:bg-accent-light rounded-lg transition"
                  aria-label={`Editar evento ${ev.nombre}`}
                >
                  <i className="fas fa-pen text-sm" />
                </button>

                {deletingEventId === ev.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-danger font-medium">¿Eliminar?</span>
                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="px-2 py-1 bg-danger text-white rounded text-xs font-medium hover:bg-danger/90 transition"
                    >
                      Sí
                    </button>
                    <button
                      onClick={() => setDeletingEventId(null)}
                      className="px-2 py-1 text-body hover:text-label text-xs"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingEventId(ev.id)}
                    className="p-1.5 text-muted hover:text-danger hover:bg-red-50 rounded-lg transition"
                    title="Eliminar evento"
                  >
                    <i className="fas fa-trash text-sm" />
                  </button>
                )}
              </div>
              </div>

              {/* Link de invitación compartible */}
              {(() => {
                const link = getInviteLink(ev);
                if (!link) return null;
                const isCopied = copiedId === ev.id;
                return (
                  <div className="mt-3 ml-7 p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-1.5">
                      <i className="fas fa-link text-blue-500 text-xs" />
                      <span className="text-xs font-semibold text-blue-700">Link de invitación</span>
                      <span className="text-xs text-blue-500">— Comparte este link para que se acrediten</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white px-3 py-2 rounded-lg border border-blue-200 text-heading truncate block">
                        {link}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyLink(link, ev.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                          isCopied
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <i className={`fas ${isCopied ? 'fa-check' : 'fa-copy'}`} />
                        {isCopied ? 'Copiado' : 'Copiar'}
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Te invito a acreditarte: ${link}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition flex items-center gap-1.5"
                      >
                        <i className="fab fa-whatsapp" /> WhatsApp
                      </a>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
