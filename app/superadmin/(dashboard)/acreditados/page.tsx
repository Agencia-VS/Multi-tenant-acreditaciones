'use client';

/**
 * SuperAdmin — Vista de Acreditados (Perfiles globales)
 */
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { PageHeader, LoadingSpinner } from '@/components/shared/ui';

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
  created_at: string;
  registrations_count?: number;
}

export default function AcreditadosPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (data) setProfiles(data);
    setLoading(false);
  };

  const filtered = profiles.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(q) ||
      p.apellido.toLowerCase().includes(q) ||
      p.rut.includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.medio?.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        title="Perfiles de Acreditados"
        subtitle={`${profiles.length} perfiles registrados`}
      />

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <i className="fas fa-search absolute left-4 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, RUT, email o medio..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-left text-gray-500">
                  <th className="p-4 font-medium">Foto</th>
                  <th className="p-4 font-medium">Nombre</th>
                  <th className="p-4 font-medium">RUT</th>
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Medio</th>
                  <th className="p-4 font-medium">Tipo/Cargo</th>
                  <th className="p-4 font-medium">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((profile) => (
                  <tr key={profile.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      {profile.foto_url ? (
                        <img src={profile.foto_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium">
                          {profile.nombre.charAt(0)}{profile.apellido.charAt(0)}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-gray-900">{profile.nombre} {profile.apellido}</p>
                      {profile.telefono && <p className="text-xs text-gray-400">{profile.telefono}</p>}
                    </td>
                    <td className="p-4 text-gray-600 font-mono text-xs">{profile.rut}</td>
                    <td className="p-4 text-gray-600">{profile.email || '—'}</td>
                    <td className="p-4 text-gray-600">{profile.medio || '—'}</td>
                    <td className="p-4">
                      {profile.tipo_medio && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full mr-1">
                          {profile.tipo_medio}
                        </span>
                      )}
                      {profile.cargo && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {profile.cargo}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-gray-500 text-xs">
                      {new Date(profile.created_at).toLocaleDateString('es-CL')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <i className="fas fa-search text-3xl mb-2" />
              <p>No se encontraron perfiles</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
