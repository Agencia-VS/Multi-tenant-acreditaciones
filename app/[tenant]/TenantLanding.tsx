/**
 * TenantLanding — Hero Fullscreen con estructura de 3 capas
 * Capa 1: Background (imagen 95% visible, overlay mínimo)
 * Capa 2: Contenido (3 secciones verticales)
 * Capa 3: Footer + Componentes Flotantes
 */
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Tenant, Event } from '@/types';
import { formatDeadlineChile } from '@/lib/dates';

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

  // Social links desde tenant.config
  const social: SocialLinks = ((tenant.config as Record<string, unknown>)?.social as SocialLinks) || {};
  const hasSocial = Object.values(social).some(Boolean);

  // Formateo de fecha con locale es-CL
  const formattedDate = useMemo(() => {
    if (!event?.fecha) return null;
    const d = new Date(event.fecha + 'T12:00:00');
    return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  }, [event?.fecha]);

  // Navegación programática con spinner
  const handleNavigate = () => {
    setIsNavigating(true);
    router.push(`/${slug}/acreditacion`);
  };

  // ¿Es evento deportivo? (tiene rival)
  const isMatchEvent = Boolean(event?.opponent_name);

  // Badge reutilizable
  const Badge = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
    <div
      className="flex items-center gap-2 px-4 py-1.5 rounded-full shadow-lg"
      style={{
        background: `linear-gradient(135deg, ${tenant.color_dark}, ${tenant.color_primario})`,
        border: `2px solid ${tenant.color_light}`,
      }}
    >
      <i className={`fas ${icon} text-sm`} style={{ color: tenant.color_light }} />
      <span className="text-white text-xs font-bold uppercase tracking-widest">{children}</span>
    </div>
  );

  return (
    <main className="min-h-screen relative overflow-hidden flex flex-col">

      {/* ═══════════════════════════════════════════════════════════════════
          LOADING SPINNER — Cubre toda la pantalla durante navegación
      ═══════════════════════════════════════════════════════════════════ */}
      {isNavigating && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex flex-col items-center justify-center gap-4">
          <i className="fas fa-spinner fa-spin text-5xl text-white" />
          <p className="text-white text-lg font-semibold tracking-wide">Cargando...</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          CAPA 1: BACKGROUND — Imagen al 95%, poco difuminado
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0">
        {tenant.background_url ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${tenant.background_url})` }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${tenant.color_dark}, ${tenant.color_primario})` }}
          />
        )}
        {/* Overlay semitransparente — sutil degradado diagonal */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, 
              ${tenant.color_dark}22 0%, 
              ${tenant.color_primario}12 40%, 
              ${tenant.color_dark}28 100%)`
          }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CAPA 2: CONTENIDO HERO — 3 Secciones con justify-around
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 flex-1 flex flex-col justify-around min-h-screen px-4 sm:px-8 lg:px-16 py-8">
        
        {event ? (
          <>
            {/* ─── 🔝 TOP SECTION: Badges + Título del Evento ─── */}
            <section className={`flex flex-col opacity-0 animate-fade-in ${isMatchEvent ? 'items-center sm:items-start' : 'items-center'}`}>
              
              {/* Badges de Información */}
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6 sm:mb-8 justify-center sm:justify-start">
                {event.league && (
                  <Badge icon={isMatchEvent ? 'fa-futbol' : 'fa-tag'}>{event.league}</Badge>
                )}
                {formattedDate && (
                  <Badge icon="fa-calendar-alt">{formattedDate}</Badge>
                )}
                {event.hora && (
                  <Badge icon="fa-clock">{event.hora.substring(0, 5)} hrs</Badge>
                )}
                {event.venue && (
                  <Badge icon="fa-map-marker-alt">{event.venue}</Badge>
                )}
              </div>

              {isMatchEvent ? (
                /* ── MODO DEPORTIVO: Nombre Tenant + vs Rival ── */
                <>
                  <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white drop-shadow-2xl text-center sm:text-left leading-tight">
                    {tenant.nombre}
                  </h1>
                  <h2 className="text-lg sm:text-xl md:text-3xl lg:text-4xl xl:text-5xl mt-2 sm:mt-3 text-center sm:text-left">
                    <span className="font-light" style={{ color: tenant.color_light }}>vs </span>
                    <span className="text-white/90 font-bold">{event.opponent_name}</span>
                  </h2>
                </>
              ) : (
                /* ── MODO GENÉRICO: Nombre del Evento como protagonista ── */
                <>
                  <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white drop-shadow-2xl text-center leading-tight max-w-4xl">
                    {event.nombre}
                  </h1>
                  {event.descripcion && (
                    <p className="text-white/80 text-base sm:text-lg md:text-xl mt-3 sm:mt-4 text-center max-w-2xl leading-relaxed opacity-0 animate-fade-in-delay-1">
                      {event.descripcion}
                    </p>
                  )}
                  {/* Organizado por */}
                  <p className="text-white/50 text-sm mt-3 opacity-0 animate-fade-in-delay-2">
                    <i className="fas fa-building mr-1.5" />
                    Organizado por <span className="text-white/70 font-semibold">{tenant.nombre}</span>
                  </p>
                </>
              )}
            </section>

            {/* ─── 🎯 CENTRO: Espacio Vacío Estratégico ─── */}
            {/* Permite que la imagen de fondo sea protagonista */}
            <section className="py-4 sm:py-8 lg:py-12" aria-hidden="true" />

            {/* ─── 🔽 BOTTOM SECTION ─── */}
            <section className="flex flex-col items-center gap-6 sm:gap-8 opacity-0 animate-fade-in-delay-3">

              {isMatchEvent ? (
                /* ── MODO DEPORTIVO: Escudos enfrentados ── */
                <div className="flex items-center gap-2 sm:gap-8 md:gap-12 lg:gap-16 xl:gap-20">
                  {/* Escudo Local */}
                  {tenant.shield_url && (
                    <img
                      src={tenant.shield_url}
                      alt={tenant.nombre}
                      className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 xl:w-40 xl:h-40 object-contain hover:scale-110 transition-transform duration-300 drop-shadow-2xl"
                      style={{ minWidth: 64, minHeight: 64 }}
                    />
                  )}
                  {/* VS Central */}
                  <span className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white drop-shadow-lg select-none">
                    VS
                  </span>
                  {/* Escudo Rival */}
                  {event.opponent_logo_url ? (
                    <img
                      src={event.opponent_logo_url}
                      alt={event.opponent_name || 'Rival'}
                      className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 xl:w-40 xl:h-40 object-contain hover:scale-110 transition-transform duration-300 drop-shadow-2xl"
                      style={{ minWidth: 64, minHeight: 64 }}
                    />
                  ) : (
                    <div
                      className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 xl:w-40 xl:h-40 rounded-full flex items-center justify-center backdrop-blur-sm hover:scale-110 transition-transform duration-300"
                      style={{
                        background: `${tenant.color_dark}40`,
                        border: `2px solid ${tenant.color_light}60`,
                        minWidth: 64,
                        minHeight: 64,
                      }}
                    >
                      <span className="text-white text-2xl sm:text-4xl md:text-5xl font-bold drop-shadow-lg">
                        {event.opponent_name?.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* ── MODO GENÉRICO: Logo/escudo centrado + poster del evento ── */
                <div className="flex flex-col items-center gap-6">
                  <div className="flex items-center gap-6 sm:gap-10">
                    {/* Logo del tenant centrado */}
                    {(tenant.shield_url || tenant.logo_url) && (
                      <img
                        src={tenant.shield_url || tenant.logo_url!}
                        alt={tenant.nombre}
                        className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-40 lg:h-40 object-contain hover:scale-105 transition-transform duration-300 drop-shadow-2xl"
                      />
                    )}
                    {/* Poster/imagen del evento si está disponible (usa opponent_logo_url como poster) */}
                    {event.opponent_logo_url && (
                      <img
                        src={event.opponent_logo_url}
                        alt={event.nombre}
                        className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-40 lg:h-40 object-contain hover:scale-105 transition-transform duration-300 drop-shadow-2xl rounded-xl"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* CTA Principal — "Acredítate" */}
              <button
                onClick={handleNavigate}
                disabled={isNavigating}
                className="group relative overflow-hidden rounded-full shadow-2xl px-6 py-2.5 sm:px-8 sm:py-3 text-sm sm:text-xl font-bold text-white transition-all duration-300 hover:scale-105 active:scale-95 btn-glow cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, ${tenant.color_dark}, ${tenant.color_primario})`,
                  border: `1px solid ${tenant.color_light}`,
                }}
              >
                {/* Highlight animation — sube desde abajo en hover */}
                <span
                  className="absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"
                  style={{
                    background: `linear-gradient(135deg, ${tenant.color_primario}, ${tenant.color_secundario})`,
                  }}
                />
                <span className="relative flex items-center gap-3">
                  <i className="fas fa-ticket-alt transition-transform duration-300 group-hover:translate-x-1" />
                  <span>Acredítate</span>
                  <i className="fas fa-arrow-right transition-transform duration-300 group-hover:translate-x-2" />
                </span>
              </button>

              {/* Fecha límite */}
              {event.fecha_limite_acreditacion && (
                <p className="text-white/60 text-xs sm:text-sm opacity-0 animate-fade-in-delay-4">
                  <i className="fas fa-info-circle mr-1" />
                  Plazo hasta: {formatDeadlineChile(event.fecha_limite_acreditacion)}
                </p>
              )}
            </section>
          </>
        ) : (
          /* ─── Sin eventos activos ─── */
          <section className="flex flex-col items-center justify-center flex-1 gap-6 opacity-0 animate-fade-in">
            {tenant.shield_url && (
              <img
                src={tenant.shield_url}
                alt={tenant.nombre}
                className="w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-2xl"
              />
            )}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-lg text-center">
              {tenant.nombre}
            </h1>
            <div
              className="rounded-2xl p-8 text-center max-w-md"
              style={{
                background: `${tenant.color_dark}60`,
                border: `1px solid ${tenant.color_light}30`,
                backdropFilter: 'blur(8px)',
              }}
            >
              <i className="fas fa-calendar-times text-4xl text-white/60 mb-4 block" />
              <p className="text-white/80 text-lg">No hay eventos activos en este momento</p>
              <p className="text-white/50 text-sm mt-2">Vuelve pronto para conocer los próximos eventos</p>
            </div>
          </section>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          🦶 FOOTER COMPLETO
      ═══════════════════════════════════════════════════════════════════ */}
      <footer
        className="relative z-10 py-6 px-4 sm:px-8"
        style={{
          background: `linear-gradient(180deg, ${tenant.color_primario}F0 0%, ${tenant.color_dark} 100%)`,
        }}
      >
        {/* Sección 1: Logos y Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            {tenant.logo_url && (
              <img src={tenant.logo_url} alt={tenant.nombre} className="h-10 w-auto opacity-90" />
            )}
            {tenant.shield_url && tenant.logo_url !== tenant.shield_url && (
              <img src={tenant.shield_url} alt={`${tenant.nombre} escudo`} className="h-10 w-auto opacity-90" />
            )}
          </div>
          <p className="text-white text-sm opacity-80">
            © {new Date().getFullYear()} {tenant.nombre}. Todos los derechos reservados.
          </p>
        </div>

        {/* Sección 2: Redes Sociales */}
        {hasSocial && (
          <div className="border-t border-white/20 mt-4 pt-4 flex justify-center gap-6 max-w-6xl mx-auto">
            {social.facebook && (
              <a
                href={social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-transform duration-300 hover:scale-110"
                style={{ color: tenant.color_light }}
              >
                <i className="fab fa-facebook text-xl" />
              </a>
            )}
            {social.twitter && (
              <a
                href={social.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-transform duration-300 hover:scale-110"
                style={{ color: tenant.color_light }}
              >
                <i className="fab fa-twitter text-xl" />
              </a>
            )}
            {social.instagram && (
              <a
                href={social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-transform duration-300 hover:scale-110"
                style={{ color: tenant.color_light }}
              >
                <i className="fab fa-instagram text-xl" />
              </a>
            )}
            {social.youtube && (
              <a
                href={social.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-transform duration-300 hover:scale-110"
                style={{ color: tenant.color_light }}
              >
                <i className="fab fa-youtube text-xl" />
              </a>
            )}
          </div>
        )}

        {/* Links de navegación */}
        <div className="flex justify-center gap-6 mt-4 max-w-6xl mx-auto">
          <Link href="/" className="text-white/40 text-sm hover:text-white/70 transition flex items-center gap-1.5">
            <i className="fas fa-arrow-left text-xs" /> Inicio
          </Link>
          <Link href="/auth/acreditado" className="text-white/40 text-sm hover:text-white/70 transition flex items-center gap-1.5">
            <i className="fas fa-user text-xs" /> Portal Acreditado
          </Link>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════════════════════════
          🎯 COMPONENTES FLOTANTES
      ═══════════════════════════════════════════════════════════════════ */}

      {/* IconoFlotanteAdmin — Acceso rápido al panel admin (esquina inferior derecha) */}
      <Link
        href={`/${slug}/admin`}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 group"
        style={{
          background: `${tenant.color_dark}CC`,
          border: `1px solid ${tenant.color_light}40`,
          backdropFilter: 'blur(8px)',
        }}
        title="Panel de Administración"
      >
        <i className="fas fa-shield-alt text-white/80 group-hover:text-white transition-colors text-lg" />
      </Link>

      {/* BotonFlotante — Botón de info/acreditación (esquina inferior izquierda) */}
      <button
        onClick={handleNavigate}
        className="fixed bottom-6 left-6 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 group cursor-pointer"
        style={{
          background: `${tenant.color_primario}CC`,
          border: `1px solid ${tenant.color_light}40`,
          backdropFilter: 'blur(8px)',
        }}
        title="Solicitar Acreditación"
      >
        <i className="fas fa-id-badge text-white/80 group-hover:text-white transition-colors text-lg" />
      </button>
    </main>
  );
}
