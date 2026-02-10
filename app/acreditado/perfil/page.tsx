'use client';

/**
 * Mi Perfil — Ver y editar datos personales del acreditado
 */
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { LoadingSpinner } from '@/components/shared/ui';

interface Profile {
  id: string;
  rut: string;
  nombre: string;
  apellido: string;
  email: string | null;
  telefono: string | null;
  medio: string | null;
  tipo_medio: string | null;
  cargo: string | null;
  foto_url: string | null;
  nacionalidad: string | null;
  datos_base: Record<string, unknown>;
}

export default function PerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) setProfile(data);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage('');

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase
      .from('profiles')
      .update({
        nombre: profile.nombre,
        apellido: profile.apellido,
        email: profile.email,
        telefono: profile.telefono,
        medio: profile.medio,
        tipo_medio: profile.tipo_medio,
        cargo: profile.cargo,
        nacionalidad: profile.nacionalidad,
      })
      .eq('id', profile.id);

    if (error) {
      setMessage('Error al guardar');
    } else {
      setMessage('Perfil actualizado correctamente');
    }
    setSaving(false);
  };

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No se encontró tu perfil. Contacta al administrador.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-gray-500 mt-1">Estos datos se usarán para pre-rellenar futuras acreditaciones</p>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm mb-6 ${
          message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-xl border p-8 space-y-6 max-w-2xl">
        {/* Avatar + RUT */}
        <div className="flex items-center gap-6 pb-6 border-b">
          {profile.foto_url ? (
            <img src={profile.foto_url} alt="" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
              {profile.nombre.charAt(0)}{profile.apellido.charAt(0)}
            </div>
          )}
          <div>
            <p className="text-lg font-bold text-gray-900">{profile.nombre} {profile.apellido}</p>
            <p className="text-gray-500 font-mono text-sm">RUT: {profile.rut}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              required
              value={profile.nombre}
              onChange={(e) => setProfile(prev => prev ? { ...prev, nombre: e.target.value } : null)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
            <input
              type="text"
              required
              value={profile.apellido}
              onChange={(e) => setProfile(prev => prev ? { ...prev, apellido: e.target.value } : null)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={profile.email || ''}
              onChange={(e) => setProfile(prev => prev ? { ...prev, email: e.target.value } : null)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              type="tel"
              value={profile.telefono || ''}
              onChange={(e) => setProfile(prev => prev ? { ...prev, telefono: e.target.value } : null)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Medio</label>
            <input
              type="text"
              value={profile.medio || ''}
              onChange={(e) => setProfile(prev => prev ? { ...prev, medio: e.target.value } : null)}
              placeholder="ej: Canal 13, Radio ADN"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Medio</label>
            <input
              type="text"
              value={profile.tipo_medio || ''}
              onChange={(e) => setProfile(prev => prev ? { ...prev, tipo_medio: e.target.value } : null)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
            <input
              type="text"
              value={profile.cargo || ''}
              onChange={(e) => setProfile(prev => prev ? { ...prev, cargo: e.target.value } : null)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nacionalidad</label>
            <input
              type="text"
              value={profile.nacionalidad || ''}
              onChange={(e) => setProfile(prev => prev ? { ...prev, nacionalidad: e.target.value } : null)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
