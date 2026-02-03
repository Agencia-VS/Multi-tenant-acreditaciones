'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { ForgotPasswordModal } from '../../../components/auth/ForgotPasswordModal';

type AuthMode = 'login' | 'register';

export default function AuthAcreditadoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/acreditado/dashboard';
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nombre: '',
    apellido: '',
    rut: '',
    empresa: '',
    telefono: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (error) throw error;
      router.push(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    if (!formData.nombre || !formData.apellido || !formData.empresa) {
      setError('Nombre, apellido y empresa son requeridos');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            nombre: formData.nombre,
            apellido: formData.apellido,
            rut: formData.rut,
            empresa: formData.empresa,
            telefono: formData.telefono,
          },
        },
      });

      if (error) throw error;

      // Crear perfil directamente en mt_perfiles_acreditados
      if (data.user) {
        // Generar un RUT temporal si no se proporciona (requerido por la BD)
        const rutValue = formData.rut || `TEMP-${data.user.id.substring(0, 8)}`;
        
        const { error: perfilError } = await supabase
          .from('mt_perfiles_acreditados')
          .insert({
            user_id: data.user.id,
            rut: rutValue,
            nombre: formData.nombre,
            apellido: formData.apellido,
            email: formData.email,
            empresa: formData.empresa || null,
            telefono: formData.telefono || null,
            nacionalidad: 'Chile',
          });
        
        if (perfilError) {
          console.warn('Error creando perfil:', perfilError.message);
        }
      }

      setSuccess('¡Cuenta creada! Ya puedes iniciar sesión.');
      setTimeout(() => {
        setMode('login');
        setSuccess(null);
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setMode(mode === 'login' ? 'register' : 'login');
      setError(null);
      setSuccess(null);
    }, 300);
    setTimeout(() => setIsAnimating(false), 600);
  };

  return (
    <div className="min-h-screen flex overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Botón Volver al inicio */}
      <Link
        href="/"
        className="fixed top-4 left-4 z-50 inline-flex items-center gap-2 bg-white/90 backdrop-blur text-gray-700 hover:bg-white font-medium transition-all px-4 py-2.5 rounded-xl border border-gray-200 hover:scale-105 active:scale-95 text-sm shadow-lg"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span>Inicio</span>
      </Link>

      <div className="relative w-full flex">
        
        {/* Panel de Branding */}
        <div 
          className="hidden lg:flex absolute top-0 h-full w-1/2 flex-col items-center justify-center p-12 z-20"
          style={{ 
            background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 50%, #172554 100%)',
            left: mode === 'login' ? '0' : '50%',
            transition: 'left 0.6s cubic-bezier(0.68, -0.15, 0.32, 1.15)',
            borderRadius: mode === 'login' ? '0 0 100px 0' : '0 0 0 100px',
          }}
        >
          {/* Decoración */}
          <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit' }}>
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-20 left-20 w-32 h-32 bg-blue-400 rounded-full blur-3xl"></div>
              <div className="absolute bottom-32 right-16 w-40 h-40 bg-indigo-400 rounded-full blur-3xl"></div>
              <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-cyan-400 rounded-full blur-2xl"></div>
            </div>
          </div>

          {/* Contenido */}
          <div 
            className="relative z-10 text-center max-w-md"
            style={{
              opacity: isAnimating ? 0 : 1,
              transform: isAnimating ? 'scale(0.95)' : 'scale(1)',
              transition: 'all 0.3s ease',
            }}
          >
            {/* Icono */}
            <div className="w-20 h-20 mx-auto mb-8 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center border border-white/20">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
              </svg>
            </div>
            
            <h1 className="text-4xl font-bold mb-4 text-white">
              {mode === 'login' ? '¡Bienvenido!' : 'Únete ahora'}
            </h1>
            
            <p className="text-lg mb-10 leading-relaxed text-blue-100">
              {mode === 'login' 
                ? 'Gestiona las acreditaciones de tu equipo de prensa de manera fácil y rápida.'
                : 'Crea tu cuenta para gestionar acreditaciones en múltiples eventos deportivos.'
              }
            </p>

            <button
              onClick={toggleMode}
              disabled={isAnimating}
              className="px-8 py-3.5 rounded-full font-semibold transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:opacity-50 bg-white text-blue-700 hover:bg-blue-50"
            >
              {mode === 'login' ? 'Crear una cuenta' : 'Ya tengo cuenta'}
            </button>
          </div>
        </div>

        {/* Formulario Login */}
        <div 
          className={`w-full lg:w-1/2 min-h-screen flex items-center justify-center p-6 lg:p-12 transition-all duration-500 ${
            mode === 'login' ? 'lg:ml-[50%]' : 'lg:ml-0 hidden'
          }`}
        >
          <div className="w-full max-w-md">
            {/* Header Mobile */}
            <div className="lg:hidden text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Iniciar Sesión</h2>
              <p className="text-gray-500 mt-1">Accede a tu panel de acreditaciones</p>
            </div>

            {/* Header Desktop */}
            <div className="hidden lg:block mb-8">
              <h2 className="text-3xl font-bold text-gray-800">Iniciar Sesión</h2>
              <p className="text-gray-500 mt-2">Accede a tu panel de acreditaciones</p>
            </div>

            {error && mode === 'login' && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm flex items-center gap-3">
                <span className="text-lg">⚠️</span>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Correo electrónico</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="tu@email.com"
                  className="w-full px-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl transition-all outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl transition-all outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  required
                />
                <div className="text-right mt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-semibold text-white transition-all duration-300 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Entrando...
                  </>
                ) : (
                  <>
                    Iniciar Sesión
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Mobile toggle */}
            <div className="lg:hidden mt-8 text-center">
              <p className="text-gray-500">
                ¿No tienes cuenta?{' '}
                <button onClick={toggleMode} className="font-semibold text-blue-600 hover:text-blue-700">
                  Regístrate aquí
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Formulario Registro */}
        <div 
          className={`w-full lg:w-1/2 min-h-screen flex items-center justify-center p-4 lg:p-8 transition-all duration-500 ${
            mode === 'register' ? 'lg:ml-0' : 'lg:ml-[50%] hidden'
          }`}
        >
          <div className="w-full max-w-md">
            {/* Header Mobile */}
            <div className="lg:hidden text-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Crear Cuenta</h2>
              <p className="text-gray-500 text-sm">Registra tu medio de comunicación</p>
            </div>

            {/* Header Desktop */}
            <div className="hidden lg:block mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Crear Cuenta</h2>
              <p className="text-gray-500 mt-1">Registra tu medio para gestionar acreditaciones</p>
            </div>

            {error && mode === 'register' && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm flex items-center gap-3">
                <span className="text-lg">⚠️</span>
                {error}
              </div>
            )}
            {success && mode === 'register' && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-2xl text-green-600 text-sm flex items-center gap-3">
                <span className="text-lg">✅</span>
                {success}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-3">
              {/* Nombre y Apellido */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    placeholder="Juan"
                    className="w-full px-3 py-2.5 bg-white border-2 border-gray-200 rounded-lg transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Apellido *</label>
                  <input
                    type="text"
                    name="apellido"
                    value={formData.apellido}
                    onChange={handleChange}
                    placeholder="Pérez"
                    className="w-full px-3 py-2.5 bg-white border-2 border-gray-200 rounded-lg transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-sm"
                    required
                  />
                </div>
              </div>

              {/* Empresa */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Empresa / Medio *</label>
                <input
                  type="text"
                  name="empresa"
                  value={formData.empresa}
                  onChange={handleChange}
                  placeholder="Nombre del medio de comunicación"
                  className="w-full px-3 py-2.5 bg-white border-2 border-gray-200 rounded-lg transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-sm"
                  required
                />
              </div>

              {/* RUT y Teléfono */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">RUT</label>
                  <input
                    type="text"
                    name="rut"
                    value={formData.rut}
                    onChange={handleChange}
                    placeholder="12.345.678-9"
                    className="w-full px-3 py-2.5 bg-white border-2 border-gray-200 rounded-lg transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    placeholder="+56 9 1234 5678"
                    className="w-full px-3 py-2.5 bg-white border-2 border-gray-200 rounded-lg transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-sm"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Correo electrónico *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="tu@email.com"
                  className="w-full px-3 py-2.5 bg-white border-2 border-gray-200 rounded-lg transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-sm"
                  required
                />
              </div>

              {/* Contraseñas */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña *</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Mín. 6 caracteres"
                    className="w-full px-3 py-2.5 bg-white border-2 border-gray-200 rounded-lg transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-sm"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Confirmar *</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repetir"
                    className="w-full px-3 py-2.5 bg-white border-2 border-gray-200 rounded-lg transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-sm"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all duration-300 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 mt-1"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creando cuenta...
                  </>
                ) : (
                  <>
                    Crear Cuenta
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>

            </form>

            {/* Mobile toggle */}
            <div className="lg:hidden mt-4 text-center">
              <p className="text-gray-500">
                ¿Ya tienes cuenta?{' '}
                <button onClick={toggleMode} className="font-semibold text-blue-600 hover:text-blue-700">
                  Inicia Sesión
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de recuperación de contraseña */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        defaultEmail={formData.email}
      />
    </div>
  );
}
