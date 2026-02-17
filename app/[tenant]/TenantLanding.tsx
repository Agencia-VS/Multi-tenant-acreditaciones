/**
 * TenantLanding — Wise Design Foundations
 *
 * Principios aplicados:
 *   - Intrepid: headline directo, "Acredítate" sin rodeos
 *   - Delightfully Simple: white space domina, color es estratégico
 *   - Motion: snappy (60%) para interacciones, fluid (30%) para transiciones
 *   - Palette: bright = face, forest = anchor, tint = warmth
 */
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Tenant, Event, EventType } from '@/types';
import { formatDeadlineChile } from '@/lib/dates';
import { generateTenantPalette } from '@/lib/colors';

interface TenantLandingProps {
  tenant: Tenant;
  event: Event | null;
  slug: string;
}

interface SocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  youtube?: string;
}

export default function TenantLanding({ tenant, event, slug }: TenantLandingProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();

  const p = useMemo(() => generateTenantPalette(
    tenant.color_primario,
    tenant.color_secundario,
    tenant.color_light,
    tenant.color_dark,
  ), [tenant.color_primario, tenant.color_secundario, tenant.color_light, tenant.color_dark]);

  const social: SocialLinks = ((tenant.config as Record<string, unknown>)?.social as SocialLinks) || {};
  const hasSocial = Object.values(social).some(Boolean);

  const formattedDate = useMemo(() => {
    if (!event?.fecha) return null;
    const d = new Date(event.fecha + 'T12:00:00');
    return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  }, [event?.fecha]);

  const handleNavigate = () => {
    setIsNavigating(true);
    router.push(`/${slug}/acreditacion`);
  };

  const isMatchEvent = Boolean(event?.opponent_name);
  const eventType: EventType = (event as Event & { event_type?: EventType })?.event_type || (isMatchEvent ? 'deportivo' : 'simple');
  const isMultidia = eventType === 'multidia';

  const formattedDateRange = useMemo(() => {
    const ev = event as Event & { fecha_inicio?: string; fecha_fin?: string } | null;
    if (!ev?.fecha_inicio || !ev?.fecha_fin) return null;
    const start = new Date(ev.fecha_inicio + 'T12:00:00');
    const end = new Date(ev.fecha_fin + 'T12:00:00');
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('es-CL', opts)} — ${end.toLocaleDateString('es-CL', { ...opts, year: 'numeric' })}`;
  }, [(event as Event & { fecha_inicio?: string })?.fecha_inicio, (event as Event & { fecha_fin?: string })?.fecha_fin]);

  /* ── Chip: info metadata ── */
  const Chip = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
    <span
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold tracking-wide backdrop-blur-md shadow-lg"
      style={{
        background: `${p.forest}B0`,
        border: `1px solid ${p.bright}40`,
        color: '#FFFFFFE6',
      }}
    >
      <i className={`fas ${icon} text-xs`} style={{ color: p.interactiveAccent }} />
      {children}
    </span>
  );

  /* ── Social icon ── */
  const SocialIcon = ({ href, icon }: { href: string; icon: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-8 h-8 rounded-full flex items-center justify-center transition-snappy hover:scale-110"
      style={{ background: `${p.bright}15`, color: `${p.bright}90` }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${p.bright}30`;
        e.currentTarget.style.color = p.bright;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${p.bright}15`;
        e.currentTarget.style.color = `${p.bright}90`;
      }}
    >
      <i className={`fab ${icon} text-sm`} />
    </a>
  );

  return (
    <main
      className="min-h-screen relative overflow-x-hidden flex flex-col dark-surface"
      style={{
        '--focus-color': p.focusBorderInverted,
        '--tenant-dark': p.forest,
        '--tenant-light': p.bright,
      } as React.CSSProperties}
    >
      {/* ── Loading overlay ── */}
      {isNavigating && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4"
          style={{ background: `${p.forest}E8` }}
        >
          <div
            className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: `${p.bright}40`, borderTopColor: 'transparent' }}
          />
          <p className="text-white text-sm font-medium tracking-wide">Cargando formulario...</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          BACKGROUND — Fullscreen image + overlay armónico
         ═══════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0">
        {tenant.background_url ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${tenant.background_url})` }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${p.forest}, ${tenant.color_primario})` }}
          />
        )}
        {/* Overlay: forest anchors, bright peeks */}
        <div className="absolute inset-0" style={{ background: p.heroGradient }} />
        {/* Subtle ambient glow */}
        <div
          className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full blur-[160px] pointer-events-none"
          style={{ background: `${p.bright}08` }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          NAVBAR — Glassmorphism, conciso
         ═══════════════════════════════════════════════════════════════ */}
      <nav
        className="relative z-30 flex items-center justify-between px-5 sm:px-8 py-3 backdrop-blur-md"
        style={{
          background: p.heroGlassBg,
          borderBottom: `1px solid ${p.heroGlassBorder}`,
        }}
      >
        {/* Left: Shield */}
        <div className="flex items-center gap-3">
          {(tenant.logo_url || tenant.shield_url) && (
            <img
              src={tenant.shield_url || tenant.logo_url!}
              alt={tenant.slug}
              className="h-8 sm:h-9 w-auto object-contain drop-shadow-lg"
            />
          )}
          <span className="text-sm font-bold text-white/80 hidden sm:inline tracking-tight">
            {tenant.slug.replace(/-/g, ' ').toUpperCase()}
          </span>
        </div>

        {/* Center: Social (desktop) */}
        {hasSocial && (
          <div className="hidden md:flex items-center gap-2">
            {social.facebook && <SocialIcon href={social.facebook} icon="fa-facebook-f" />}
            {social.twitter && <SocialIcon href={social.twitter} icon="fa-twitter" />}
            {social.instagram && <SocialIcon href={social.instagram} icon="fa-instagram" />}
            {social.youtube && <SocialIcon href={social.youtube} icon="fa-youtube" />}
          </div>
        )}

        {/* Right: Nav links */}
        <div className="flex items-center gap-1.5">
          {[
            { href: '/', label: 'Inicio', icon: 'fa-house' },
            { href: '/auth/acreditado', label: 'Mi cuenta', icon: 'fa-user' },
            { href: `/${slug}/admin`, label: 'Admin', icon: 'fa-shield-halved' },
          ].map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-snappy"
              style={{
                background: `${p.bright}12`,
                border: `1px solid ${p.bright}20`,
                color: `#FFFFFFA0`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${p.bright}25`;
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${p.bright}12`;
                e.currentTarget.style.color = '#FFFFFFA0';
              }}
            >
              <i className={`fas ${icon} text-[0.65rem]`} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════
          HERO CONTENT — "White space dominates, colour is strategic"
         ═══════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-5 sm:px-8 lg:px-16 py-12">
        {event ? (
          <div className="flex flex-col items-center gap-8 max-w-4xl w-full">

            {/* Metadata chips */}
            <div className="flex text-xl flex-wrap gap-2 justify-center opacity-0 animate-fade-in">
              {event.league && (
                <Chip icon={isMatchEvent ? 'fa-futbol' : 'fa-tag'}>{event.league}</Chip>
              )}
              {isMultidia && formattedDateRange && (
                <Chip icon="fa-calendar-week">{formattedDateRange}</Chip>
              )}
              {!isMultidia && formattedDate && <Chip icon="fa-calendar">{formattedDate}</Chip>}
              {event.hora && <Chip icon="fa-clock">{event.hora.substring(0, 5)} hrs</Chip>}
              {event.venue && <Chip icon="fa-location-dot">{event.venue}</Chip>}
            </div>

            {isMatchEvent ? (
              /* ── MODO DEPORTIVO ── */
              <div className="flex flex-col items-center gap-6 opacity-0 animate-fade-in">
                {/* Shields row — centered with VS */}
                <div className="flex items-center gap-6 sm:gap-12 md:gap-16">
                  {tenant.shield_url && (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={tenant.shield_url}
                        alt={tenant.nombre}
                        className="w-24 h-24 sm:w-32 sm:h-32 md:w-44 md:h-44 object-contain hover:scale-105 transition-fluid"
                        style={{ filter: `drop-shadow(0 0 24px ${p.interactiveAccent}30)` }}
                      />
                      <h1 className=" font-semibold text-white uppercase tracking-wider hidden sm:block">{tenant.nombre}</h1>
                    </div>
                  )}
                  <span
                    className="text-2xl sm:text-4xl md:text-5xl font-bold select-none"
                    style={{ color: `${p.bright}90` }}
                  >
                    VS
                  </span>
                  {event.opponent_logo_url ? (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={event.opponent_logo_url}
                        alt={event.opponent_name || 'Rival'}
                        className="w-24 h-24 sm:w-32 sm:h-32 md:w-44 md:h-44 object-contain hover:scale-105 transition-fluid drop-shadow-2xl"
                      />
                      <h1 className=" font-semibold text-white uppercase tracking-wider hidden sm:block">{event.opponent_name}</h1>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className="w-24 h-24 sm:w-32 sm:h-32 md:w-44 md:h-44 rounded-full flex items-center justify-center backdrop-blur-sm"
                        style={{ background: `${p.forest}50`, border: `2px solid ${p.bright}30` }}
                      >
                        <span className="text-white text-3xl sm:text-5xl font-bold drop-shadow-lg">
                          {event.opponent_name?.charAt(0)}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-white/60 uppercase tracking-wider hidden sm:block">{event.opponent_name}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : isMultidia ? (
              /* ── MODO MULTIDÍA ── */
              <div className="flex flex-col items-center gap-8 opacity-0 animate-fade-in">
                {/* Logos — grandes, identidad visual del evento */}
                <div className="flex items-center gap-6 sm:gap-10">
                  {(tenant.shield_url || tenant.logo_url) && (
                    <img
                      src={tenant.shield_url || tenant.logo_url!}
                      alt={tenant.nombre}
                      className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 object-contain hover:scale-105 transition-fluid"
                      style={{ filter: `drop-shadow(0 0 28px ${p.interactiveAccent}30)` }}
                    />
                  )}
                  {event.opponent_logo_url && (
                    <img
                      src={event.opponent_logo_url}
                      alt={event.nombre}
                      className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 object-contain hover:scale-105 transition-fluid drop-shadow-2xl rounded-xl"
                    />
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white drop-shadow-lg text-center leading-tight max-w-3xl">
                  {event.nombre}
                </h1>

                {event.descripcion && (
                  <p className="text-sm sm:text-base text-center max-w-xl leading-relaxed" style={{ color: '#FFFFFFB0' }}>
                    {event.descripcion}
                  </p>
                )}

                {/* Days preview card */}
                <div
                  className="rounded-2xl px-6 py-5 backdrop-blur-md max-w-md w-full"
                  style={{ background: `${p.forest}80`, border: `1px solid ${p.bright}20` }}
                >
                  <p className="text-xs uppercase tracking-widest font-semibold mb-3 text-center" style={{ color: `${p.bright}80` }}>
                    <i className="fas fa-calendar-week mr-1.5" />
                    Evento multidía
                  </p>
                  {formattedDateRange && (
                    <p className="text-lg font-bold text-white text-center mb-2">
                      <i className="fas fa-calendar-range mr-2 text-sm" style={{ color: p.interactiveAccent }} />
                      {formattedDateRange}
                    </p>
                  )}
                  <p className="text-sm text-white/60 text-center">
                    Las jornadas disponibles se mostrarán al momento de inscribirse.
                  </p>
                </div>
              </div>
            ) : (
              /* ── MODO GENÉRICO ── */
              <div className="flex flex-col items-center gap-8 opacity-0 animate-fade-in">
                {/* Logos — grandes, identidad visual del evento/organización */}
                <div className="flex items-center gap-6 sm:gap-10">
                  {(tenant.shield_url || tenant.logo_url) && (
                    <img
                      src={tenant.shield_url || tenant.logo_url!}
                      alt={tenant.nombre}
                      className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 object-contain hover:scale-105 transition-fluid"
                      style={{ filter: `drop-shadow(0 0 28px ${p.interactiveAccent}30)` }}
                    />
                  )}
                  {event.opponent_logo_url && (
                    <img
                      src={event.opponent_logo_url}
                      alt={event.nombre}
                      className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 object-contain hover:scale-105 transition-fluid drop-shadow-2xl rounded-xl"
                    />
                  )}
                </div>

                {/* <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white drop-shadow-lg text-center leading-tight max-w-3xl">
                  {event.nombre}
                </h1> */}

                {/* {event.descripcion && (
                  <p className="text-sm sm:text-base text-center max-w-xl leading-relaxed" style={{ color: '#FFFFFFB0' }}>
                    {event.descripcion}
                  </p>
                )} */}
              </div>
            )}

            {/* ── CTA Section ── */}
            <div className="flex flex-col items-center gap-4 opacity-0 animate-fade-in-delay-2">
              <button
                onClick={handleNavigate}
                disabled={isNavigating}
                className="group relative overflow-hidden rounded-2xl px-10 py-4 text-lg sm:text-xl font-bold transition-snappy hover:scale-[1.03] active:scale-[0.98] cursor-pointer shadow-2xl"
                style={{
                  background: p.ctaBg,
                  border: `1px solid ${p.ctaBorder}50`,
                  color: p.ctaText,
                  boxShadow: `0 8px 32px ${p.forest}60`,
                }}
              >
                {/* Hover fill layer */}
                <span
                  className="absolute inset-0 translate-y-full group-hover:translate-y-0 transition-fluid"
                  style={{ background: p.ctaHoverBg }}
                />
                <span className="relative flex items-center gap-3">
                  <i className="fas fa-id-badge" />
                  <span>Acredítate</span>
                  <svg className="w-5 h-5 group-hover:translate-x-1.5 transition-snappy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>


              {/* Sub-link for returning users */}
              <Link
                href="/auth/acreditado"
                className="text-xs font-medium transition-snappy"
                style={{ color: `${p.tint}80` }}
                onMouseEnter={(e) => { e.currentTarget.style.color = p.bright; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = `${p.tint}70`; }}
              >
                <i className="fas fa-user-circle mr-1" />
                ¿Ya tienes cuenta? Entra aquí
              </Link>
            </div>
          </div>
        ) : (
          /* ── Sin eventos activos ── */
          <div className="flex flex-col items-center gap-6 opacity-0 animate-fade-in">
            {tenant.shield_url && (
              <img
                src={tenant.shield_url}
                alt={tenant.nombre}
                className="w-28 h-28 sm:w-36 sm:h-36 object-contain"
                style={{ filter: `drop-shadow(0 0 24px ${p.interactiveAccent}25)` }}
              />
            )}
            <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg text-center tracking-tight">
              {tenant.nombre}
            </h1>

            {/* Empty state card */}
            <div
              className="rounded-2xl p-8 text-center max-w-sm backdrop-blur-md"
              style={{ background: p.cardBg, border: `1px solid ${p.cardBorder}` }}
            >
              <div
                className="w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center"
                style={{ background: `${p.bright}60` }}
              >
                <i className="fas fa-calendar-xmark text-xl" style={{ color: `${p.tint}80` }} />
              </div>
              <p className="text-base font-semibold text-white mb-1">Sin eventos activos</p>
              <p className="text-sm text-white leading-relaxed">
                Vuelve pronto para conocer los próximos eventos y solicitar tu acreditación.
              </p>
            </div>

            <Link
              href="/"
              className="text-xs font-medium transition-snappy mt-2"
              style={{ color: `${p.tint}60` }}
              onMouseEnter={(e) => { e.currentTarget.style.color = p.tint; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = `${p.tint}60`; }}
            >
              <i className="fas fa-arrow-left mr-1" />
              Volver al inicio
            </Link>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          FOOTER — Minimal, brand tint
         ═══════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 text-center py-4 px-4">
        <div className="flex items-center justify-center gap-4 text-[0.65rem]" style={{ color: `${p.tint}70` }}>
          <span>© {new Date().getFullYear()} {tenant.nombre}</span>
          <span className="hidden sm:inline">·</span>
          <Link
            href="/"
            className="hidden sm:inline transition-snappy"
            style={{ color: `${p.tint}90` }}
            onMouseEnter={(e) => { e.currentTarget.style.color = `${p.bright}70`; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = `${p.tint}90`; }}
          >
            Accredia
          </Link>
        </div>
      </div>
    </main>
  );
}
