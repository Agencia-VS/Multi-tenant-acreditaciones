'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DisclaimerProps {
  visible: boolean;
  onAccept: () => void;
  onBack: () => void;
  tenantColors: {
    primario: string;
    secundario: string;
  };
  tenantName?: string;
  eventName?: string;
  eventFecha?: string | null;
  eventVenue?: string | null;
  fechaLimite?: string | null;
  contactEmail?: string;
}

function formatDateTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Santiago',
    });
  } catch {
    return dateStr;
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Santiago',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Disclaimer — Modal de términos y condiciones con scroll-to-accept.
 * Se muestra antes del formulario de acreditación.
 */
export default function Disclaimer({
  visible,
  onAccept,
  onBack,
  tenantColors,
  tenantName,
  eventName,
  eventFecha,
  eventVenue,
  fechaLimite,
  contactEmail,
}: DisclaimerProps) {
  const [canAccept, setCanAccept] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Reset al abrir
  useEffect(() => {
    if (visible) {
      setCanAccept(false);
      // Check if content is short enough that no scroll is needed
      requestAnimationFrame(() => {
        if (contentRef.current) {
          const { scrollHeight, clientHeight } = contentRef.current;
          if (scrollHeight <= clientHeight + 10) {
            setCanAccept(true);
          }
        }
      });
    }
  }, [visible]);

  const handleScroll = () => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      setCanAccept(true);
    }
  };

  if (!visible) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4">
      {/* Card — flexbox column, constrained to 85vh so it NEVER overflows */}
      <div
        className="bg-white rounded-2xl w-full flex flex-col overflow-hidden shadow-2xl"
        style={{ maxWidth: '42rem', maxHeight: '85vh' }}
      >
        {/* ── Header (fixed height) ── */}
        <div
          className="flex-shrink-0 px-5 py-3 sm:px-6 sm:py-4"
          style={{
            background: `linear-gradient(to right, ${tenantColors.primario}, ${tenantColors.primario}cc)`,
          }}
        >
          <h2 className="text-white font-bold" style={{ fontSize: '1.1rem' }}>
            Términos y Condiciones de Acreditación
          </h2>
        </div>

        {/* ── Scrollable body (takes all remaining space) ── */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{
            minHeight: 0, /* critical for flex scroll */
            scrollbarWidth: 'thin',
            scrollbarColor: `${tenantColors.primario}40 transparent`,
            padding: '1rem 1rem',
          }}
        >
          <p className="text-gray-500 mb-3" style={{ fontSize: '0.85rem' }}>
            Revise completamente los términos y condiciones antes de continuar.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            {/* 📋 Proceso */}
            <div className="bg-blue-50 rounded-xl border border-blue-200" style={{ padding: '0.875rem 1rem' }}>
              <p className="font-semibold text-blue-800 flex items-center gap-2 mb-1.5">
                <span>📋</span> Proceso de Acreditación
              </p>
              <p className="text-blue-700 leading-relaxed">
                La solicitud debe ser realizada por el editor o responsable
                del medio de comunicación. Cada solicitud será revisada y aprobada
                según disponibilidad de cupos y criterios internos.
              </p>
              <p className="text-blue-700 leading-relaxed mt-1.5">
                Una vez aprobada, recibirá una notificación por correo electrónico con los detalles
                de su acreditación.
              </p>
            </div>

            {/* ⏰ Plazo */}
            <div className="bg-yellow-50 rounded-xl border border-yellow-200" style={{ padding: '0.875rem 1rem' }}>
              <p className="font-semibold text-yellow-800 flex items-center gap-2 mb-1.5">
                <span>⏰</span> Plazo de Acreditación
              </p>
              {fechaLimite ? (
                <>
                  <p className="text-yellow-700 leading-relaxed">
                    Las solicitudes se recibirán hasta:
                  </p>
                  <div className="mt-1.5 bg-white/60 rounded-lg border border-yellow-200" style={{ padding: '0.5rem 0.75rem' }}>
                    <p className="font-bold text-yellow-900" style={{ fontSize: '0.95rem' }}>
                      📅 {formatDateTime(fechaLimite)}
                    </p>
                  </div>
                  <p className="mt-1.5 text-yellow-600" style={{ fontSize: '0.8rem' }}>
                    Pasada esta fecha, no se aceptarán nuevas solicitudes.
                  </p>
                </>
              ) : (
                <p className="text-yellow-700 leading-relaxed">
                  Las solicitudes se recibirán según disponibilidad. Recomendamos enviar su
                  solicitud con la mayor anticipación posible.
                </p>
              )}
              {eventFecha && (
                <p className="text-yellow-700 mt-1.5">
                  🏁 <strong>Fecha del evento:</strong> {formatDate(eventFecha)}
                  {eventVenue && <span> — {eventVenue}</span>}
                </p>
              )}
            </div>

            {/* ⚠️ Restricciones */}
            <div className="bg-red-50 rounded-xl border border-red-200" style={{ padding: '0.875rem 1rem' }}>
              <p className="font-semibold text-red-800 flex items-center gap-2 mb-1.5">
                <span>⚠️</span> Restricciones de Cupos
              </p>
              <p className="text-red-700 leading-relaxed">
                Existe un número limitado de acreditaciones según el tipo de medio.
                La organización se reserva el derecho de limitar la cantidad de acreditados
                por medio. Si los cupos se agotan, la solicitud quedará en lista de espera.
              </p>
            </div>

            {/* 📞 Excepciones */}
            <div className="bg-green-50 rounded-xl border border-green-200" style={{ padding: '0.875rem 1rem' }}>
              <p className="font-semibold text-green-800 flex items-center gap-2 mb-1.5">
                <span>📞</span> Excepciones y Consultas
              </p>
              <p className="text-green-700 leading-relaxed">
                Para consultas, solicitar excepciones o resolver inconvenientes, contacte a:
              </p>
              {contactEmail ? (
                <a
                  href={`mailto:${contactEmail}`}
                  className="mt-1.5 inline-flex items-center gap-2 bg-white/60 rounded-lg border border-green-200 text-green-800 hover:bg-white transition font-medium break-all"
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.85rem' }}
                >
                  ✉️ {contactEmail}
                </a>
              ) : (
                <p className="text-green-700 mt-1">
                  Contacte al departamento de comunicaciones de{' '}
                  <strong>{tenantName || 'la organización'}</strong>.
                </p>
              )}
            </div>

            {/* 🔒 Protección de Datos */}
            <div className="bg-purple-50 rounded-xl border border-purple-200" style={{ padding: '0.875rem 1rem' }}>
              <p className="font-semibold text-purple-800 flex items-center gap-2 mb-1.5">
                <span>🔒</span> Protección de Datos Personales
              </p>
              <p className="text-purple-700 leading-relaxed">
                Los datos serán tratados de forma confidencial y usados exclusivamente para
                acreditación de prensa, conforme a la Ley 19.628 sobre Protección de la Vida
                Privada. Información falsa puede resultar en revocación sin previo aviso.
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer buttons (fixed height, always at card bottom) ── */}
        <div
          className="flex-shrink-0 flex gap-2 border-t border-gray-200 bg-gray-50"
          style={{ padding: '0.75rem 1rem' }}
        >
          <button
            onClick={onBack}
            className="rounded-xl border-2 border-gray-300 text-gray-600 font-semibold hover:bg-gray-100 active:scale-95 transition"
            style={{ padding: '0.625rem 1rem', fontSize: '0.85rem' }}
          >
            ← Volver
          </button>
          <button
            onClick={onAccept}
            disabled={!canAccept}
            className={`flex-1 rounded-xl font-semibold transition-all ${
              canAccept
                ? 'text-white shadow-lg hover:shadow-xl active:scale-95'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            style={{
              padding: '0.625rem 1rem',
              fontSize: '0.85rem',
              ...(canAccept
                ? { background: `linear-gradient(to right, ${tenantColors.primario}, ${tenantColors.primario}cc)` }
                : {}),
            }}
          >
            {canAccept ? 'Entiendo y acepto los términos' : 'Desliza y lee para continuar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
