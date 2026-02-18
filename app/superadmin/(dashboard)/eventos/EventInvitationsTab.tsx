'use client';

/**
 * EventInvitationsTab — Muestra el link compartible del evento invite_only.
 * El link usa el invite_token del evento (un token único por evento).
 */
import { useState, useEffect } from 'react';
import { useToast } from '@/components/shared/ui';

interface EventInvitationsTabProps {
  eventId: string;
  tenantSlug: string;
}

export default function EventInvitationsTab({ eventId, tenantSlug }: EventInvitationsTabProps) {
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { showSuccess, showError } = useToast();

  const getBaseUrl = () => typeof window !== 'undefined' ? window.location.origin : '';
  const inviteLink = inviteToken ? `${getBaseUrl()}/${tenantSlug}/acreditacion?invite=${inviteToken}` : '';

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/events?id=${eventId}`);
        if (res.ok) {
          const data = await res.json();
          const ev = data.event || data;
          setInviteToken(ev.invite_token || null);
        }
      } catch {
        showError('Error cargando datos del evento');
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId, showError]);

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      showSuccess('Link copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showError('Error al copiar');
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted"><i className="fas fa-spinner fa-spin mr-2" />Cargando...</div>;
  }

  if (!inviteToken) {
    return (
      <div className="text-center py-8">
        <i className="fas fa-exclamation-triangle text-3xl text-amber-400 mb-3" />
        <p className="text-body text-sm">Este evento no tiene token de invitación.</p>
        <p className="text-xs text-muted mt-1">Guarda el evento como &quot;Por Invitación&quot; para generar el link.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Link principal */}
      <div className="p-5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-4">
        <div className="flex items-center gap-2">
          <i className="fas fa-link text-blue-500" />
          <h3 className="text-sm font-bold text-blue-800">Link de Invitación</h3>
        </div>

        <p className="text-sm text-blue-700">
          Comparte este link por WhatsApp, email o cualquier medio. Cualquier persona con el link podrá acceder al formulario de acreditación.
        </p>

        <div className="flex gap-2">
          <code className="flex-1 text-sm bg-white px-4 py-3 rounded-xl border border-blue-200 text-heading truncate block font-mono">
            {inviteLink}
          </code>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={copyLink}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              copied
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
            {copied ? '¡Copiado!' : 'Copiar Link'}
          </button>

          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Te invito a acreditarte para el evento: ${inviteLink}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition flex items-center gap-2"
          >
            <i className="fab fa-whatsapp" /> Compartir por WhatsApp
          </a>

          <a
            href={`mailto:?subject=${encodeURIComponent('Invitación a acreditación')}&body=${encodeURIComponent(`Te invito a completar tu acreditación: ${inviteLink}`)}`}
            className="px-4 py-2.5 bg-gray-600 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition flex items-center gap-2"
          >
            <i className="fas fa-envelope" /> Enviar por Email
          </a>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 bg-canvas rounded-xl border border-edge text-sm text-body space-y-2">
        <p><i className="fas fa-info-circle mr-2 text-blue-400" />El link es único para este evento y no expira mientras el evento esté activo.</p>
        <p><i className="fas fa-shield-alt mr-2 text-green-400" />Solo personas con este link pueden acceder al formulario.</p>
        <p><i className="fas fa-users mr-2 text-purple-400" />No hay límite de personas — cualquiera con el link puede acreditarse.</p>
      </div>
    </div>
  );
}
