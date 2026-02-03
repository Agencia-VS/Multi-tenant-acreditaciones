'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  shield_url: string | null;
  color_primario: string | null;
}

export default function LandingPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTenants = async () => {
      const { data } = await supabase
        .from('mt_tenants')
        .select('id, nombre, slug, shield_url, color_primario')
        .limit(6);
      
      if (data) setTenants(data);
      setLoading(false);
    };
    loadTenants();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <nav className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center">
                <span className="text-2xl">🎫</span>
              </div>
              <span className="text-2xl font-bold text-white">Accredia</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/auth/acreditado"
                className="text-white/80 hover:text-white transition-colors text-sm font-medium"
              >
                Portal Acreditados
              </Link>
              <Link
                href="/superadmin"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg backdrop-blur transition-colors"
              >
                Admin
              </Link>
            </div>
          </div>
        </nav>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl font-bold text-white mb-6">
              Acreditaciones de Prensa
              <span className="block text-blue-400 mt-2">Simplificadas</span>
            </h1>
            <p className="text-xl text-white/70 max-w-2xl mx-auto mb-10">
              Plataforma integral para gestionar acreditaciones de medios de comunicación 
              en eventos deportivos y espectáculos.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/acreditado"
                className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-500/25"
              >
                Soy Periodista / Medio
              </Link>
              <a
                href="#clubes"
                className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl backdrop-blur transition-colors"
              >
                Ver Clubes
              </a>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '50+', label: 'Eventos' },
              { value: '2,000+', label: 'Acreditaciones' },
              { value: '100+', label: 'Medios' },
              { value: '99%', label: 'Satisfacción' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-white">{stat.value}</p>
                <p className="text-white/60 text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Clubes Section */}
      <section id="clubes" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Clubes y Organizaciones
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Accede directamente al portal de acreditación de cada club
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {tenants.map((tenant) => (
                <Link
                  key={tenant.id}
                  href={`/${tenant.slug}`}
                  className="group bg-white border-2 border-gray-100 hover:border-blue-200 rounded-2xl p-6 text-center transition-all hover:shadow-lg"
                >
                  {tenant.shield_url ? (
                    <img
                      src={tenant.shield_url}
                      alt={tenant.nombre}
                      className="w-20 h-20 object-contain mx-auto mb-4 group-hover:scale-110 transition-transform"
                    />
                  ) : (
                    <div
                      className="w-20 h-20 rounded-xl mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold group-hover:scale-110 transition-transform"
                      style={{ backgroundColor: tenant.color_primario || '#3b82f6' }}
                    >
                      {tenant.nombre.charAt(0)}
                    </div>
                  )}
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {tenant.nombre}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {tenant.slug}.accredia.cl
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              ¿Por qué Accredia?
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '⚡',
                title: 'Rápido y Simple',
                description: 'Solicita tu acreditación en menos de 2 minutos. Sin papeleos.',
              },
              {
                icon: '👥',
                title: 'Equipo Frecuente',
                description: 'Guarda tu equipo de trabajo y acredítalos con un solo clic.',
              },
              {
                icon: '📱',
                title: 'Multi-plataforma',
                description: 'Accede desde cualquier dispositivo. Credenciales digitales.',
              },
            ].map((feature, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            ¿Eres un club o organizador de eventos?
          </h2>
          <p className="text-blue-100 text-lg mb-8">
            Digitaliza tu proceso de acreditación y ahorra tiempo en cada evento.
          </p>
          <Link
            href="/superadmin"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-colors"
          >
            Solicitar Demo
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎫</span>
              <span className="text-xl font-bold">Accredia</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-400">
              <Link href="/auth/acreditado" className="hover:text-white transition-colors">
                Portal Acreditados
              </Link>
              <Link href="/superadmin" className="hover:text-white transition-colors">
                Administración
              </Link>
            </div>
            <p className="text-sm text-gray-500">
              © 2026 Accredia. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

