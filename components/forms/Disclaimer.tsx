'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { DisclaimerConfig, DisclaimerSection } from '@/types';

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
  /** Custom disclaimer config from event.config.disclaimer */
  disclaimerConfig?: DisclaimerConfig;
}

/**
 * Parse date string safely.
 * Date-only strings like "2026-03-15" are parsed as UTC midnight by `new Date()`,
 * which shifts back one day in negative-offset timezones (e.g. America/Santiago).
 * Fix: append T12:00 so the local conversion stays on the correct day.
 */
function parseDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T12:00:00');
  }
  return new Date(dateStr);
}

function formatDateTime(dateStr: string): string {
  try {
    const date = parseDate(dateStr);
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
    const date = parseDate(dateStr);
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
 * Supports custom sections from event config or falls back to hardcoded defaults.
 */

const COLOR_MAP: Record<DisclaimerSection['color'], { bg: string; border: string; title: string; body: string }> = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   title: 'text-blue-800',   body: 'text-blue-700'   },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', title: 'text-yellow-800', body: 'text-yellow-700' },
  red:    { bg: 'bg-red-50',    border: 'border-red-200',    title: 'text-red-800',    body: 'text-red-700'    },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  title: 'text-green-800',  body: 'text-green-700'  },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', title: 'text-purple-800', body: 'text-purple-700' },
  gray:   { bg: 'bg-gray-50',   border: 'border-gray-200',   title: 'text-gray-700',   body: 'text-gray-600'  },
};

function renderCustomSection(section: DisclaimerSection) {
  const c = COLOR_MAP[section.color] || COLOR_MAP.blue;
  return (
    <div key={section.id} className={`${c.bg} rounded-xl border ${c.border}`} style={{ padding: '0.875rem 1rem' }}>
      <p className={`font-semibold ${c.title} flex items-center gap-2 mb-1.5`}>
        <span>{section.icon}</span> {section.title}
      </p>
      {section.body.split('\n\n').map((paragraph, i) => (
        <p key={i} className={`${c.body} leading-relaxed ${i > 0 ? 'mt-1.5' : ''}`}>
          {paragraph}
        </p>
      ))}
    </div>
  );
}

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
  disclaimerConfig,
}: DisclaimerProps) {
  const [canAccept, setCanAccept] = useState(false);
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Esperar al montaje en el cliente para evitar "document is not defined" en SSR
  useEffect(() => { setMounted(true); }, []);

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

  if (!visible || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4">
      {/* Card — flexbox column, constrained to 85vh so it NEVER overflows */}
      <div
        className="bg-white rounded-2xl w-full flex flex-col overflow-hidden shadow-2xl"
        style={{ maxWidth: '42rem', maxHeight: '85vh' }}
      >
        {/* ── Header (fixed height) ── */}
        <div
          className="flex-shrink-0 px-5 py-3.5 sm:px-6 sm:py-4 flex items-center gap-3"
          style={{ backgroundColor: tenantColors.primario }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/15 shrink-0">
            <i className="fas fa-file-contract text-white text-sm" />
          </div>
          <h2 className="text-white font-bold tracking-tight" style={{ fontSize: '1.05rem' }}>
            Términos y Condiciones
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
            Revise los términos antes de continuar.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            {/* Custom sections from config, or hardcoded defaults */}
            {disclaimerConfig?.sections && disclaimerConfig.sections.length > 0 ? (
              <>
                {disclaimerConfig.sections.map(section => renderCustomSection(section))}
              </>
            ) : (
              <>
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
              </>
            )}

            {/* ⏰ Plazo — ALWAYS rendered automatically from fechaLimite */}
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
          </div>
        </div>

        {/* ── Footer buttons (fixed height, always at card bottom) ── */}
        <div
          className="flex-shrink-0 flex gap-2 border-t border-edge bg-canvas"
          style={{ padding: '0.75rem 1rem' }}
        >
          <button
            onClick={onBack}
            className="rounded-xl border border-edge text-body font-semibold hover:bg-subtle active:scale-[0.98] transition-snappy"
            style={{ padding: '0.625rem 1.25rem', fontSize: '0.85rem' }}
          >
            <i className="fas fa-arrow-left mr-1.5 text-xs" /> Volver
          </button>
          <button
            onClick={onAccept}
            disabled={!canAccept}
            className={`flex-1 rounded-xl font-semibold transition-all active:scale-[0.98] ${
              canAccept
                ? 'text-white shadow-lg hover:shadow-xl'
                : 'bg-subtle text-muted cursor-not-allowed'
            }`}
            style={{
              padding: '0.625rem 1rem',
              fontSize: '0.85rem',
              ...(canAccept
                ? { backgroundColor: tenantColors.primario }
                : {}),
            }}
          >
            {canAccept ? (
              <>Acepto los términos <i className="fas fa-arrow-right ml-1.5 text-xs" /></>
            ) : (
              <>Lee para continuar <i className="fas fa-chevron-down ml-1 text-xs animate-bounce" /></>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
