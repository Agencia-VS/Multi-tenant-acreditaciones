"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import BotonFlotante from "../../components/common/BotonesFlotantes/BotonFlotante";
import IconoFlotanteAdmin from "../../components/common/BotonesFlotantes/IconoFlotanteAdmin";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useTenant } from "../../components/tenant/TenantContext";
import { useEventoActivo } from "../../hooks/useEventoActivo";

export default function LandingPage() {
    const [isNavigating, setIsNavigating] = useState(false);
    const router = useRouter();
    const { tenant } = useTenant();
    const { evento, loading, error, isAccreditationOpen } = useEventoActivo(tenant.slug);

    const handleBack = () => {
        setIsNavigating(true);
        router.push('/');
    };

    if (loading) {
        return <LoadingSpinner message="Cargando evento..." />;
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-800 mb-4">Error</h1>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    if (!evento) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-800 mb-4">Tenant no encontrado</h1>
                    <p className="text-gray-600">El tenant "{tenant.slug}" no existe.</p>
                </div>
            </div>
        );
    }

    // Verificar si hay evento activo
    const hasActiveEvent = evento.is_active && evento.evento_id !== 0;

    // Colores del tenant desde la DB (sin fallbacks azules hardcodeados)
    const colors = {
        primary: evento.color_primario || '#374151',
        secondary: evento.color_secundario || '#6b7280',
        light: evento.color_light || '#9ca3af',
        dark: evento.color_dark || '#1f2937',
    };

    // Formatear fecha
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Fecha por confirmar';
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-CL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
        });
    };

    // Formatear hora
    const formatTime = (timeStr: string | null) => {
        if (!timeStr) return 'Hora por confirmar';
        // timeStr viene como "20:30:00"
        const [hours, minutes] = timeStr.split(':');
        return `${hours}:${minutes} hrs`;
    };

    const handleNavigate = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        if (!isAccreditationOpen) {
            alert('El período de acreditación ha finalizado.');
            return;
        }
        setIsNavigating(true);
        router.push(`/${tenant.slug}/acreditacion`);
    };

    return (
        <>
            <style>
                {`@import url("https://fonts.googleapis.com/css2?family=Lobster+Two:ital,wght@0,400;0,700;1,400;1,700&family=Special+Gothic+Condensed+One&display=swap");`}
            </style>
            <div className="relative min-h-screen">
                {isNavigating && <LoadingSpinner message="Cargando..." />}

                {/* Botón Volver al inicio */}
                <button
                    onClick={handleBack}
                    className="fixed top-3 sm:top-4 left-3 sm:left-4 z-50 inline-flex items-center gap-1.5 sm:gap-2 bg-white/20 backdrop-blur-md text-white hover:bg-white/30 font-medium transition-all px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-white/30 hover:scale-105 active:scale-95 text-xs sm:text-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span className="hidden sm:inline">Inicio</span>
                </button>

                <IconoFlotanteAdmin />
                <BotonFlotante />

                {/* Hero Section con Background */}
                <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
                    {/* Background Image */}
                    <div
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                        style={{
                            backgroundImage: `url(${evento.background_url || '/default-background.jpg'})`,
                            backgroundPosition: 'center',
                            backgroundSize: 'cover'
                        }}
                    ></div>

                    {/* Overlay oscuro */}
                    <div className="absolute inset-0 hero-overlay"></div>

                    {/* Content - Layout con centro libre */}
                    <div className="relative z-10 container mx-auto px-4 min-h-screen max-w-screen-xl flex flex-col flex-grow justify-around gap-y-8 py-6 sm:py-8 md:py-12 lg:py-16 xl:py-20">

                        {/* Top Section - Título con badge e info del evento */}
                        <div className="text-left text-white pt-4 pl-2 sm:pl-4 md:pl-8">
                            {/* Badge Superior e Info del Evento en línea */}
                            {hasActiveEvent && (
                            <div className="flex flex-wrap items-center gap-3 sm:gap-6 mb-3 sm:mb-6">
                                {/* Grupo de badge e info del evento */}
                                <div className="flex flex-col sm:flex-row flex-wrap items-center gap-2 sm:gap-4 text-sm sm:text-base md:text-lg lg:text-xl">
                                    {/* Badge Superior - Liga */}
                                    {evento.league && (
                                        <div className="inline-block px-4 py-1.5 rounded-full font-bold uppercase tracking-widest shadow-lg border-2"
                                            style={{
                                                background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                                                border: `2px solid ${colors.dark}`
                                            }}>
                                            <i className="fas fa-futbol mr-3" style={{ color: 'white', fontSize: '1.4em' }}></i>
                                            {evento.league}
                                        </div>
                                    )}

                                    {/* Fecha */}
                                    <div className="inline-block px-4 py-1.5 rounded-full font-bold uppercase tracking-widest shadow-lg border-2"
                                        style={{
                                            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                                            border: `2px solid ${colors.dark}`
                                        }}>
                                        <i className="fas fa-calendar-alt mr-3" style={{ color: 'white', fontSize: '1.3em' }}></i>
                                        <span className="font-semibold">{formatDate(evento.fecha)}</span>
                                    </div>

                                    {/* Hora */}
                                    <div className="inline-block px-4 py-1.5 rounded-full font-bold uppercase tracking-widest shadow-lg border-2"
                                        style={{
                                            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                                            border: `2px solid ${colors.dark}`
                                        }}>
                                        <i className="fas fa-clock mr-3" style={{ color: 'white', fontSize: '1.3em' }}></i>
                                        <span className="font-semibold">{formatTime(evento.hora)}</span>
                                    </div>

                                    {/* Estadio */}
                                    <div className="inline-block px-4 py-1.5 rounded-full font-bold uppercase tracking-widest shadow-lg border-2"
                                        style={{
                                            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                                            border: `2px solid ${colors.dark}`
                                        }}>
                                        <i className="fas fa-map-marker-alt mr-3" style={{ color: 'white', fontSize: '1.3em' }}></i>
                                        <span className="font-semibold">{evento.venue || evento.arena_nombre || 'Por confirmar'}</span>
                                    </div>
                                </div>
                            </div>
                            )}

                            {/* Título compacto */}
                            <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-2 leading-tight">
                                <span className="block text-white drop-shadow-2xl">{evento.tenant_nombre}</span>
                            </h1>

                            {/* VS y rival en una línea */}
                            {hasActiveEvent && evento.opponent_nombre && (
                            <div className="flex items-center gap-2 sm:gap-3">
                                <span className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-light tracking-wide" style={{ color: colors.light }}>vs</span>
                                <h2 className="text-base sm:text-lg md:text-2xl lg:text-3xl xl:text-4xl font-bold text-white opacity-90">
                                    {evento.opponent_nombre}
                                </h2>
                            </div>
                            )}

                            {/* Mensaje si no hay evento activo */}
                            {!hasActiveEvent && (
                                <div className="mt-4 inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg font-semibold">
                                    <i className="fas fa-info-circle mr-2"></i>
                                    No hay eventos activos en este momento
                                </div>
                            )}

                            {/* Alerta si acreditación está cerrada (solo si hay evento activo) */}
                            {hasActiveEvent && !isAccreditationOpen && (
                                <div className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-lg font-semibold">
                                    <i className="fas fa-exclamation-triangle mr-2"></i>
                                    Período de acreditación cerrado
                                </div>
                            )}
                        </div>

                        {/* Centro completamente vacío - aquí está la cara del jugador */}

                        {/* Bottom Section - Todo el evento abajo */}
                        <div className="text-white pb-6 flex flex-col items-center w-full">

                            {/* Shields Section - Solo mostrar VS si hay evento activo con oponente */}
                            <div className="flex items-center justify-center gap-2 sm:gap-6 md:gap-12 lg:gap-16 xl:gap-20 mb-4 sm:mb-8 w-full">
                                {/* Tenant */}
                                <div className="flex flex-col items-center transform hover:scale-110 transition-transform duration-300">
                                    {evento.shield_url ? (
                                        <Image
                                            src={evento.shield_url}
                                            alt={`Escudo ${evento.tenant_nombre}`}
                                            width={300}
                                            height={300}
                                            className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 xl:w-40 xl:h-40 object-contain max-w-xs min-w-[64px] min-h-[64px]"
                                        />
                                    ) : (
                                        <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-white/20 rounded-full flex items-center justify-center">
                                            <span className="text-2xl font-bold">{evento.tenant_nombre?.charAt(0)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* VS y Opponent - Solo si hay evento activo */}
                                {hasActiveEvent && evento.opponent_nombre && (
                                    <>
                                        <div className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white drop-shadow-lg">
                                            VS
                                        </div>
                                        <div className="flex flex-col items-center transform hover:scale-110 transition-transform duration-300">
                                            {evento.opponent_shield_url ? (
                                                <Image
                                                    src={evento.opponent_shield_url}
                                                    alt={`Escudo ${evento.opponent_nombre}`}
                                                    width={300}
                                                    height={300}
                                                    className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 xl:w-40 xl:h-40 object-contain max-w-xs min-w-[64px] min-h-[64px]"
                                                />
                                            ) : (
                                                <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-white/20 rounded-full flex items-center justify-center">
                                                    <span className="text-2xl font-bold">{evento.opponent_nombre?.charAt(0) || '?'}</span>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* CTA Principal - Solo si hay evento activo */}
                            {hasActiveEvent ? (
                            <div className="text-center mb-6">
                                <Link
                                    href={`/${tenant.slug}/acreditacion`}
                                    prefetch={true}
                                    onClick={handleNavigate}
                                    className={`group relative inline-flex items-center gap-2 px-6 sm:px-8 py-2 sm:py-3 text-white text-sm sm:text-base md:text-xl font-semibold rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 btn-glow overflow-hidden ${!isAccreditationOpen ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    style={{
                                        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                                        border: `1px solid ${colors.dark}`
                                    }}>
                                    <span className="absolute inset-0 w-full h-full transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"
                                        style={{ background: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.dark} 100%)` }}>
                                    </span>
                                    <i className="fas fa-ticket-alt relative z-10 text-lg sm:text-xl md:text-2xl group-hover:translate-x-1 transition-transform duration-300"></i>
                                    <span className="relative z-10 text-lg sm:text-xl md:text-2xl">
                                        {isAccreditationOpen ? 'Acredítate: haz clic aquí' : 'Acreditación cerrada'}
                                    </span>
                                    <i className="fas fa-arrow-right relative z-10 text-lg sm:text-xl md:text-2xl group-hover:translate-x-2 transition-transform duration-300"></i>
                                </Link>
                            </div>
                            ) : (
                            <div className="text-center mb-6">
                                <p className="text-white/80 text-lg">
                                    Próximamente se habilitará la acreditación para el siguiente evento.
                                </p>
                            </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Footer Minimalista */}
                <footer className="relative text-white py-6"
                    style={{ background: `linear-gradient(180deg, ${colors.dark} 0%, ${colors.primary} 100%)` }}>
                    <div className="container mx-auto px-4">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            {/* Logos y unión */}
                            <div className="flex items-center gap-4">
                                {evento.tenant_logo && (
                                    <Image src={evento.tenant_logo} alt={`Logo ${evento.tenant_nombre}`} width={80} height={40} className="h-10 w-auto object-contain" />
                                )}
                                {evento.arena_logo_url && (
                                    <>
                                        <span className="text-md font-extrabold select-none drop-shadow-lg" style={{ fontFamily: "Special Gothic Condensed One", color: colors.light }}>&</span>
                                        <Image src={evento.arena_logo_url} alt={evento.arena_nombre || 'Arena'} width={80} height={40} className="h-10 w-auto object-contain" />
                                    </>
                                )}
                            </div>

                            {/* Copyright dinámico */}
                            <div className="text-center md:text-right">
                                <span className="text-sm text-white opacity-80">
                                    © {new Date().getFullYear()} Desarrollado por Accredia para {evento.tenant_nombre}. © Todos los derechos reservados.
                                </span>
                            </div>
                        </div>

                        {/* Separador - Redes sociales */}
                        {(evento.social_facebook || evento.social_twitter || evento.social_instagram || evento.social_youtube) && (
                            <div className="mt-4 pt-4 border-t border-white border-opacity-20 text-center">
                                <div className="flex justify-center gap-5 text-white">
                                    {evento.social_facebook && (
                                        <a href={evento.social_facebook} target="_blank" rel="noopener noreferrer" className="transition-all duration-300 hover:scale-110"
                                            style={{ color: colors.light }}>
                                            <i className="fab fa-facebook text-xl"></i>
                                        </a>
                                    )}
                                    {evento.social_twitter && (
                                        <a href={evento.social_twitter} target="_blank" rel="noopener noreferrer" className="transition-all duration-300 hover:scale-110"
                                            style={{ color: colors.light }}>
                                            <i className="fab fa-twitter text-xl"></i>
                                        </a>
                                    )}
                                    {evento.social_instagram && (
                                        <a href={evento.social_instagram} target="_blank" rel="noopener noreferrer" className="transition-all duration-300 hover:scale-110"
                                            style={{ color: colors.light }}>
                                            <i className="fab fa-instagram text-lg"></i>
                                        </a>
                                    )}
                                    {evento.social_youtube && (
                                        <a href={evento.social_youtube} target="_blank" rel="noopener noreferrer" className="transition-all duration-300 hover:scale-110"
                                            style={{ color: colors.light }}>
                                            <i className="fab fa-youtube text-lg"></i>
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </footer>
            </div>
        </>
    );
}
