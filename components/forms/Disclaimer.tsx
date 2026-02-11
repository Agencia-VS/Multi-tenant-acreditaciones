'use client';

import { useState, useRef, useEffect } from 'react';

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

  return (
    <>
      {/* ─── Backdrop oscuro ─── */}
      <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* ─── Modal centrado ─── */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
          
          {/* ─── Header con degradado ─── */}
          <div
            className="px-4 py-4 text-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${tenantColors.primario}, ${tenantColors.primario}dd)`,
            }}
          >
            <h2 className="text-xl md:text-xl font-bold text-white">
              Términos y Condiciones de Acreditación
            </h2>
          </div>

          {/* ─── Contenido Scrollable ─── */}
          <div
            ref={contentRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-6 md:px-10 py-6 space-y-5"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: `${tenantColors.primario}40 transparent`,
            }}
          >
            {/* 📋 Proceso de Acreditación */}
            <section className="rounded-xl border-l-4 border-blue-500 bg-blue-50 p-4 md:p-5">
              <h3 className="font-bold text-blue-800 text-lg flex items-center gap-2 mb-2">
                <i className="fas fa-clipboard-list" />
                Proceso de Acreditación
              </h3>
              <p className="text-base text-blue-700 leading-relaxed">
                La solicitud de acreditación de prensa debe ser realizada por el editor o responsable
                del medio de comunicación correspondiente. Cada solicitud será revisada y aprobada
                por la organización según disponibilidad de cupos y criterios internos.
              </p>
              <p className="text-base text-blue-700 leading-relaxed mt-2">
                Una vez aprobada, recibirá una notificación por correo electrónico con los detalles
                de su acreditación y las instrucciones de acceso.
              </p>
            </section>

            {/* ⏰ Plazo de Acreditación */}
            <section className="rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4 md:p-5">
              <h3 className="font-bold text-amber-800 text-lg flex items-center gap-2 mb-2">
                <i className="fas fa-clock" />
                Plazo de Acreditación
              </h3>
              {fechaLimite ? (
                <div className="text-base text-amber-700 leading-relaxed">
                  <p>Las solicitudes de acreditación se recibirán hasta:</p>
                  <div className="mt-2 bg-white/60 rounded-lg p-3 border border-amber-200">
                    <p className="font-bold text-amber-900 text-xl">
                      <i className="fas fa-calendar-alt mr-2" />
                      {formatDateTime(fechaLimite)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-amber-600">
                    Pasada esta fecha, no se aceptarán nuevas solicitudes.
                  </p>
                </div>
              ) : (
                <p className="text-base text-amber-700 leading-relaxed">
                  Las solicitudes se recibirán según disponibilidad. Recomendamos enviar su
                  solicitud con la mayor anticipación posible.
                </p>
              )}

              {eventFecha && (
                <div className="mt-3 text-base text-amber-700">
                  <p>
                    <i className="fas fa-flag-checkered mr-1" />
                    <strong>Fecha del evento:</strong> {formatDate(eventFecha)}
                    {eventVenue && <span> — {eventVenue}</span>}
                  </p>
                </div>
              )}
            </section>

            {/* ⚠️ Restricciones de Cupos */}
            <section className="rounded-xl border-l-4 border-red-500 bg-red-50 p-4 md:p-5">
              <h3 className="font-bold text-red-800 text-lg flex items-center gap-2 mb-2">
                <i className="fas fa-exclamation-triangle" />
                Restricciones de Cupos
              </h3>
              <p className="text-base text-red-700 leading-relaxed">
                Existe un número limitado de acreditaciones disponibles según el tipo de medio
                de comunicación (TV, Radio, Prensa Escrita, Digital, Fotógrafo, etc.).
                La organización se reserva el derecho de limitar la cantidad de acreditados
                por medio.
              </p>
              <p className="text-base text-red-700 leading-relaxed mt-2">
                En caso de que los cupos se agoten para su categoría, la solicitud quedará
                en lista de espera.
              </p>
            </section>

            {/* 📞 Excepciones y Consultas */}
            <section className="rounded-xl border-l-4 border-green-500 bg-green-50 p-4 md:p-5">
              <h3 className="font-bold text-green-800 text-lg flex items-center gap-2 mb-2">
                <i className="fas fa-phone-alt" />
                Excepciones y Consultas
              </h3>
              <p className="text-base text-green-700 leading-relaxed">
                Para consultas sobre el proceso de acreditación, solicitar excepciones
                o resolver cualquier inconveniente, contacte directamente a:
              </p>
              {contactEmail ? (
                <a
                  href={`mailto:${contactEmail}`}
                  className="mt-2 inline-flex items-center gap-2 bg-white/60 rounded-lg px-4 py-2.5 border border-green-200 text-green-800 hover:bg-white transition text-base font-medium"
                >
                  <i className="fas fa-envelope" />
                  {contactEmail}
                </a>
              ) : (
                <p className="text-base text-green-700 mt-1">
                  Contacte al departamento de comunicaciones de{' '}
                  <strong>{tenantName || 'la organización'}</strong>.
                </p>
              )}
            </section>

            {/* 🔒 Protección de Datos */}
            <section className="rounded-xl border-l-4 border-purple-500 bg-purple-50 p-4 md:p-5">
              <h3 className="font-bold text-purple-800 text-lg flex items-center gap-2 mb-2">
                <i className="fas fa-user-shield" />
                Protección de Datos Personales
              </h3>
              <p className="text-base text-purple-700 leading-relaxed">
                Los datos proporcionados serán tratados de forma confidencial y utilizados
                exclusivamente para fines de acreditación de prensa, conforme a la
                Ley 19.628 sobre Protección de la Vida Privada. En caso de proporcionar
                información falsa, la acreditación podrá ser revocada sin previo aviso.
              </p>
            </section>
          </div>

          {/* ─── Footer: Botones ─── */}
          <div className="flex-shrink-0 border-t border-gray-200 px-6 md:px-10 py-4 bg-gray-50">
            <div className="flex gap-3">
              <button
                onClick={onBack}
                className="flex-1 py-3.5 rounded-xl border-2 border-gray-300 text-gray-600 font-semibold hover:bg-gray-100 transition text-base"
              >
                <i className="fas fa-arrow-left mr-2" />
                Volver
              </button>
              <button
                onClick={onAccept}
                disabled={!canAccept}
                className="flex-1 py-3.5 rounded-xl text-white font-bold transition-all text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  backgroundColor: canAccept ? tenantColors.primario : '#9ca3af',
                }}
              >
                {canAccept ? (
                  <>
                    <i className="fas fa-check-circle mr-2" />
                    Entiendo y acepto los términos
                  </>
                ) : (
                  <>
                    <i className="fas fa-scroll mr-2" />
                    Desliza y lee para continuar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
