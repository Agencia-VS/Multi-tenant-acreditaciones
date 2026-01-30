"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTenant, setNewTenant] = useState({ name: "", slug: "" });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('mt_tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error('Error loading tenants:', error);
      setMessage({ type: "error", text: "Error al cargar tenants" });
    } finally {
      setLoading(false);
    }
  };

  const createTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenant.name || !newTenant.slug) return;

    try {
      const { error } = await supabase
        .from('mt_tenants')
        .insert([{
          name: newTenant.name,
          slug: newTenant.slug.toLowerCase().replace(/\s+/g, '-')
        }]);

      if (error) throw error;

      setNewTenant({ name: "", slug: "" });
      setMessage({ type: "success", text: "Tenant creado exitosamente" });
      loadTenants();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error al crear tenant" });
    }
  };

  const deleteTenant = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este tenant?")) return;

    try {
      const { error } = await supabase
        .from('mt_tenants')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessage({ type: "success", text: "Tenant eliminado exitosamente" });
      loadTenants();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error al eliminar tenant" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando tenants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Administración de Tenants
          </h1>

          {message && (
            <div className={`mb-6 p-4 rounded-md ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}>
              {message.text}
              <button
                onClick={() => setMessage(null)}
                className="float-right ml-4 font-bold"
              >
                ×
              </button>
            </div>
          )}

          {/* Formulario para crear tenant */}
          <div className="bg-gray-50 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-4">Crear Nuevo Tenant</h2>
            <form onSubmit={createTenant} className="flex gap-4">
              <input
                type="text"
                placeholder="Nombre del club/equipo"
                value={newTenant.name}
                onChange={(e) => setNewTenant({...newTenant, name: e.target.value})}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="Slug (ej: cruzados)"
                value={newTenant.slug}
                onChange={(e) => setNewTenant({...newTenant, slug: e.target.value})}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Crear
              </button>
            </form>
          </div>

          {/* Lista de tenants */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Tenants Existentes</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {tenants.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  No hay tenants creados aún.
                </div>
              ) : (
                tenants.map((tenant) => (
                  <div key={tenant.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{tenant.name}</h3>
                      <p className="text-sm text-gray-500">Slug: {tenant.slug}</p>
                      <p className="text-xs text-gray-400">
                        Creado: {new Date(tenant.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <a
                        href={`/${tenant.slug}`}
                        target="_blank"
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Ver sitio →
                      </a>
                      <button
                        onClick={() => deleteTenant(tenant.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}