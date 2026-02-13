'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  shield_url: string | null;
  color_primario: string | null;
}

/* ── Wise Tone: intrepid, concise, energetic, delightfully-simple ── */

export default function LandingPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTenants = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data } = await supabase
        .from('tenants')
        .select('id, nombre, slug, shield_url, color_primario')
        .eq('activo', true)
        .limit(6);

      if (data) setTenants(data);
      setLoading(false);
    };
    loadTenants();
  }, []);

  return (
    <div className="min-h-screen bg-[#111111] dark-surface">
      {/* ════════════════════════════════════════════════════════════════
          HERO — "Write headlines as if it's illegal to write subcopy"
         ════════════════════════════════════════════════════════════════ */}
      <header className="relative overflow-hidden">
        {/* Ambient gradient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-40%] left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-brand/8 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/6 blur-[100px]" />
        </div>

        {/* Subtle dot grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }} />

        {/* Nav */}
        <nav className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-brand/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:bg-brand/30 transition-snappy">
                <i className="fas fa-id-badge text-accent text-lg" />
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">Accredia</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/auth/acreditado"
                className="hidden sm:inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium px-4 py-2 rounded-lg transition-snappy"
              >
                <i className="fas fa-user-circle text-xs" />
                Mi cuenta
              </Link>
              <Link
                href="/superadmin"
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold rounded-lg backdrop-blur-sm border border-white/10 transition-snappy"
              >
                Admin
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-8 pt-16 sm:pt-24 pb-24 sm:pb-32">
          <div className="text-center opacity-0 animate-fade-in">
            {/* Chip/badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-white/70 text-sm mb-8">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Plataforma activa — acreditaciones abiertas
            </div>

            <h1 className="text-5xl sm:text-7xl font-bold text-white mb-6 tracking-tight leading-[0.9]">
              Tu pase de prensa.
              <span className="block text-accent mt-3">Sin el papeleo.</span>
            </h1>

            <p className="text-lg sm:text-xl text-white/60 max-w-xl mx-auto mb-12 leading-relaxed">
              Solicita, gestiona y recibe acreditaciones para eventos deportivos en 2 minutos. Digital. Rápido. Sin vueltas.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center opacity-0 animate-fade-in-delay-1">
              <Link
                href="/auth/acreditado"
                className="group px-8 py-4 bg-brand hover:bg-brand-hover text-on-brand font-semibold rounded-xl transition-snappy shadow-lg shadow-brand/20 inline-flex items-center justify-center gap-2"
              >
                Acredítate ahora
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-snappy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a
                href="#clubes"
                className="px-8 py-4 bg-white/[0.06] hover:bg-white/[0.1] text-white font-semibold rounded-xl border border-white/10 backdrop-blur-sm transition-snappy"
              >
                Ver eventos
              </a>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 pb-20 opacity-0 animate-fade-in-delay-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-6 px-8 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
            {[
              { value: '50+', label: 'Eventos gestionados' },
              { value: '2,000+', label: 'Credenciales emitidas' },
              { value: '100+', label: 'Medios registrados' },
              { value: '<10 min', label: 'Tiempo promedio' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-white/40 text-xs mt-1 uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════
          CÓMO FUNCIONA — 3 pasos, visual y directo
         ════════════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-surface">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">Así de simple</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-heading tracking-tight">
              3 pasos. Nada más.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {[
              {
                step: '01',
                icon: 'fa-hand-pointer',
                title: 'Elige tu evento',
                desc: 'Selecciona el club o evento al que necesitas asistir.',
              },
              {
                step: '02',
                icon: 'fa-file-pen',
                title: 'Completa tu solicitud',
                desc: 'Rellena tus datos (o los importamos de tu perfil) y envía.',
              },
              {
                step: '03',
                icon: 'fa-circle-check',
                title: 'Recibe tu credencial',
                desc: 'El club aprueba y recibes tu acreditación digital al instante.',
              },
            ].map((item, i) => (
              <div key={i} className="relative text-center group">
                {/* Connector line (hidden on mobile, visible between steps on md+) */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-edge" />
                )}
                <div className="relative z-10 w-20 h-20 mx-auto mb-6 rounded-2xl bg-canvas border border-edge flex items-center justify-center group-hover:border-brand group-hover:bg-accent-light transition-snappy">
                  <i className={`fas ${item.icon} text-2xl text-brand`} />
                </div>
                <span className="text-xs font-bold text-muted uppercase tracking-widest">{item.step}</span>
                <h3 className="text-lg font-semibold text-heading mt-2 mb-2">{item.title}</h3>
                <p className="text-body text-sm leading-relaxed max-w-xs mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          CLUBES — Portal de acceso directo
         ════════════════════════════════════════════════════════════════ */}
      <section id="clubes" className="py-20 bg-canvas">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">Eventos activos</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-heading tracking-tight mb-3">
              Elige tu destino
            </h2>
            <p className="text-body max-w-lg mx-auto">
              Accede directo al portal de acreditación de cada organización.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-calendar-xmark text-4xl text-muted mb-4" />
              <p className="text-muted">No hay eventos activos en este momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {tenants.map((tenant) => (
                <Link
                  key={tenant.id}
                  href={`/${tenant.slug}`}
                  className="group relative bg-surface border border-edge hover:border-brand rounded-2xl p-6 text-center transition-snappy hover:shadow-lg hover:shadow-brand/5"
                >
                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-2xl bg-brand/[0.02] opacity-0 group-hover:opacity-100 transition-snappy pointer-events-none" />

                  {tenant.shield_url ? (
                    <img
                      src={tenant.shield_url}
                      alt={tenant.nombre}
                      className="w-20 h-20 object-contain mx-auto mb-4 group-hover:scale-105 transition-fluid"
                    />
                  ) : (
                    <div
                      className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold group-hover:scale-105 transition-fluid shadow-sm"
                      style={{ backgroundColor: tenant.color_primario || 'var(--color-brand)' }}
                    >
                      {tenant.nombre.charAt(0)}
                    </div>
                  )}
                  <h3 className="font-semibold text-heading group-hover:text-brand transition-snappy">
                    {tenant.nombre}
                  </h3>
                  <p className="text-xs text-muted mt-1 flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400/80" />
                    Acreditando
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          POR QUÉ ACCREDIA — Features con energía Wise
         ════════════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-surface">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">Ventajas</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-heading tracking-tight">
              Acreditaciones sin fricción
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: 'fa-bolt',
                color: 'text-amber-500',
                bg: 'bg-amber-50',
                title: '<10 minutos, no 2 días',
                desc: 'Completa tu solicitud más rápido que un café. Sin papeleos, sin filas, sin repetir datos.',
              },
              {
                icon: 'fa-users-gear',
                color: 'text-brand',
                bg: 'bg-accent-light',
                title: 'Tu equipo, un clic',
                desc: 'Registra tu equipo de prensa una vez. Acredítalos a todos en cualquier evento futuro.',
              },
              {
                icon: 'fa-mobile-screen',
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
                title: 'Credencial digital',
                desc: 'Recibe tu acreditación en el celular. Válida, verificable, sin impresiones.',
              },
              {
                icon: 'fa-shield-halved',
                color: 'text-violet-600',
                bg: 'bg-violet-50',
                title: 'Datos protegidos',
                desc: 'Cada club tiene su propio espacio. Tu información se maneja con cifrado de extremo a extremo.',
              },
              {
                icon: 'fa-chart-column',
                color: 'text-rose-500',
                bg: 'bg-rose-50',
                title: 'Panel de administración',
                desc: 'Los clubes aprueban, filtran y exportan acreditaciones desde un dashboard completo.',
              },
              {
                icon: 'fa-rotate',
                color: 'text-cyan-600',
                bg: 'bg-cyan-50',
                title: 'Perfil reutilizable',
                desc: 'Tus datos se guardan. En el próximo evento, solo confirmas y envías.',
              },
            ].map((f, i) => (
              <div
                key={i}
                className="group bg-surface rounded-2xl p-7 border border-edge hover:border-brand/30 hover:shadow-md transition-fluid"
              >
                <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center mb-5`}>
                  <i className={`fas ${f.icon} text-lg ${f.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-heading mb-2 group-hover:text-brand transition-snappy">
                  {f.title}
                </h3>
                <p className="text-body text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          CTA — Para organizadores
         ════════════════════════════════════════════════════════════════ */}
      <section className="py-20 relative overflow-hidden">
        {/* Background with gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#111111] via-[#1A1A1A] to-[#111111]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }} />

        <div className="relative z-10 max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-white/80 text-sm mb-8 border border-white/10">
            <i className="fas fa-building text-xs" />
            Para clubes y organizadores
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5 tracking-tight">
            ¿Organizas eventos?
            <span className="block mt-2 text-[#00C48C]">Digitaliza tu acreditación.</span>
          </h2>

          <p className="text-white/60 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
            Deja de gestionar acreditaciones por email. Control total, aprobaciones en tiempo real, exportación de datos.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/superadmin"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#00C48C] text-white font-semibold rounded-xl hover:bg-[#00A676] transition-snappy shadow-lg shadow-[#00C48C]/20"
            >
              Solicitar acceso
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-snappy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="mailto:contacto@accredia.cl"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white font-semibold rounded-xl border border-white/15 hover:bg-white/15 transition-snappy"
            >
              <i className="fas fa-envelope text-sm" />
              Contactar
            </a>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          FOOTER — Limpio y funcional
         ════════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#111111] border-t border-white/[0.06] text-white py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <i className="fas fa-id-badge text-accent text-lg" />
              <span className="text-lg font-bold tracking-tight">Accredia</span>
            </Link>

            <div className="flex gap-8 text-sm text-white/40">
              <Link href="/auth/acreditado" className="hover:text-white/80 transition-snappy">
                Mi cuenta
              </Link>
              <Link href="/superadmin" className="hover:text-white/80 transition-snappy">
                Administración
              </Link>
            </div>

            <p className="text-xs text-white/25">
              © {new Date().getFullYear()} Accredia
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

