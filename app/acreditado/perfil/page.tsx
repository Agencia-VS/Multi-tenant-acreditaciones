'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface Perfil {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  empresa: string | null;
  telefono: string | null;
  rut: string;
  nacionalidad: string | null;
  cargo: string | null;
}

export default function PerfilAcreditado() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    empresa: '',
    telefono: '',
    rut: '',
    nacionalidad: 'Chile',
    cargo: '',
  });

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth/acreditado');
        return;
      }

      setUser(session.user);

      // Cargar perfil
      const { data: perfilData } = await supabase
        .from('mt_perfiles_acreditados')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (perfilData) {
        setPerfil(perfilData);
        setFormData({
          nombre: perfilData.nombre || '',
          apellido: perfilData.apellido || '',
          email: perfilData.email || session.user.email || '',
          empresa: perfilData.empresa || '',
          telefono: perfilData.telefono || '',
          rut: perfilData.rut || '',
          nacionalidad: perfilData.nacionalidad || 'Chile',
          cargo: perfilData.cargo || '',
        });
      } else {
        // Pre-llenar con datos del usuario de auth
        const metadata = session.user.user_metadata;
        setFormData({
          nombre: metadata?.nombre || '',
          apellido: metadata?.apellido || '',
          email: session.user.email || '',
          empresa: metadata?.empresa || '',
          telefono: metadata?.telefono || '',
          rut: metadata?.rut || '',
          nacionalidad: 'Chile',
          cargo: '',
        });
      }

      setLoading(false);
    };

    loadData();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    if (!user) return;

    try {
      if (perfil) {
        // Actualizar perfil existente
        const { error: updateError } = await supabase
          .from('mt_perfiles_acreditados')
          .update({
            nombre: formData.nombre,
            apellido: formData.apellido,
            email: formData.email,
            empresa: formData.empresa || null,
            telefono: formData.telefono || null,
            nacionalidad: formData.nacionalidad,
            cargo: formData.cargo || null,
          })
          .eq('id', perfil.id);

        if (updateError) throw updateError;
      } else {
        // Crear nuevo perfil
        if (!formData.rut) {
          setError('El RUT es requerido para crear tu perfil');
          setSaving(false);
          return;
        }

        const { error: insertError } = await supabase
          .from('mt_perfiles_acreditados')
          .insert({
            user_id: user.id,
            rut: formData.rut,
            nombre: formData.nombre,
            apellido: formData.apellido,
            email: formData.email,
            empresa: formData.empresa || null,
            telefono: formData.telefono || null,
            nacionalidad: formData.nacionalidad,
            cargo: formData.cargo || null,
          });

        if (insertError) throw insertError;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <Link 
                href="/acreditado/dashboard"
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ← Volver
              </Link>
              <h1 className="text-lg font-semibold text-gray-900">Mi Perfil</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-8">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-8 pb-8 border-b">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white text-3xl font-bold">
              {formData.nombre?.charAt(0) || user?.email?.charAt(0) || 'A'}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {formData.nombre} {formData.apellido}
              </h2>
              <p className="text-gray-500">{formData.empresa || 'Sin empresa'}</p>
            </div>
          </div>

          {/* Mensajes */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm">
              ✅ Perfil actualizado correctamente
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre *</label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Apellido *</label>
                <input
                  type="text"
                  name="apellido"
                  value={formData.apellido}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">RUT {!perfil && '*'}</label>
              <input
                type="text"
                name="rut"
                value={formData.rut}
                onChange={handleChange}
                disabled={!!perfil}
                className={`w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors ${perfil ? 'bg-gray-50 text-gray-500' : ''}`}
                placeholder="12.345.678-9"
              />
              {perfil && (
                <p className="text-xs text-gray-400 mt-1">El RUT no puede ser modificado</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors"
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Empresa / Medio</label>
                <input
                  type="text"
                  name="empresa"
                  value={formData.empresa}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors"
                  placeholder="Nombre del medio"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cargo</label>
                <input
                  type="text"
                  name="cargo"
                  value={formData.cargo}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors"
                  placeholder="Ej: Periodista, Editor"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono</label>
                <input
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors"
                  placeholder="+56 9 1234 5678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nacionalidad</label>
                <select
                  name="nacionalidad"
                  value={formData.nacionalidad}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors bg-white"
                >
                  <option value="Chile">Chile</option>
                  <option value="Argentina">Argentina</option>
                  <option value="Brasil">Brasil</option>
                  <option value="Perú">Perú</option>
                  <option value="Colombia">Colombia</option>
                  <option value="México">México</option>
                  <option value="España">España</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Guardando...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
