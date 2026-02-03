/**
 * Página de Listado de Tenants
 * 
 * Muestra todos los tenants con opciones de búsqueda,
 * filtros y acciones rápidas.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { useSuperAdmin } from "../../../components/superadmin";
import type { TenantWithCounts, TenantFull, UIMessage } from "../../../types";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<UIMessage | null>(null);
  
  const { isAuthenticated, refreshStats } = useSuperAdmin();
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (isAuthenticated) {
      loadTenants();
    }
  }, [isAuthenticated]);

  const loadTenants = async () => {
    try {
      setLoading(true);
      
      // Cargar tenants con conteos
      const { data: tenantsData, error } = await supabase
        .from('mt_tenants')
        .select('id, slug, nombre, logo_url, shield_url, color_primario, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Cargar conteos para cada tenant
      const tenantsWithCounts = await Promise.all(
        (tenantsData || []).map(async (tenant: TenantFull) => {
          const [eventosRes, adminsRes] = await Promise.all([
            supabase.from('mt_eventos').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
            supabase.from('mt_admin_tenants').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
          ]);
          
          return {
            ...tenant,
            _count: {
              eventos: eventosRes.count || 0,
              admins: adminsRes.count || 0,
            }
          };
        })
      );

      setTenants(tenantsWithCounts);
    } catch (error) {
      console.error('Error loading tenants:', error);
      setMessage({ type: 'error', text: 'Error al cargar tenants' });
    } finally {
      setLoading(false);
    }
  };

  const deleteTenant = async (tenant: TenantWithCounts) => {
    if (!confirm(`¿Estás seguro de eliminar "${tenant.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('mt_tenants')
        .delete()
        .eq('id', tenant.id);

      if (error) throw error;

      setTenants(tenants.filter(t => t.id !== tenant.id));
      setMessage({ type: 'success', text: `Tenant "${tenant.nombre}" eliminado correctamente` });
      refreshStats();
    } catch (error) {
      console.error('Error deleting tenant:', error);
      setMessage({ type: 'error', text: 'Error al eliminar tenant. Puede tener datos asociados.' });
    }
  };

  // Filtrar tenants por búsqueda
  const filteredTenants = tenants.filter(tenant =>
    tenant.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tenant.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tenants</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona los clientes de la plataforma
          </p>
        </div>
        <Link
          href="/superadmin/tenants/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nuevo Tenant
        </Link>
      </div>

      {/* Mensaje */}
      {message && (
        <div className={`px-4 py-3 rounded-lg flex items-center justify-between ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-current hover:opacity-70">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Barra de búsqueda */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre o slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Lista de Tenants */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Cargando tenants...</p>
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-gray-500">
              {searchQuery ? 'No se encontraron tenants' : 'No hay tenants registrados'}
            </p>
            {!searchQuery && (
              <Link
                href="/superadmin/tenants/new"
                className="inline-block mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Crear el primer tenant →
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Slug
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Eventos
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Admins
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden"
                        style={{ backgroundColor: tenant.color_primario || '#f3f4f6' }}
                      >
                        {tenant.shield_url || tenant.logo_url ? (
                          <img 
                            src={tenant.shield_url || tenant.logo_url || ''} 
                            alt={tenant.nombre}
                            className="w-8 h-8 object-contain"
                          />
                        ) : (
                          <span className="text-white font-semibold">
                            {tenant.nombre.charAt(0)}
                          </span>
                        )}
                      </div>
                      <span className="font-medium text-gray-900">{tenant.nombre}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      /{tenant.slug}
                    </code>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {tenant._count?.eventos || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {tenant._count?.admins || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(tenant.created_at).toLocaleDateString('es-CL')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/${tenant.slug}`}
                        target="_blank"
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Ver sitio"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </Link>
                      <Link
                        href={`/superadmin/tenants/${tenant.id}`}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                      <button
                        onClick={() => deleteTenant(tenant)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Resumen */}
      {!loading && filteredTenants.length > 0 && (
        <p className="text-sm text-gray-500 text-center">
          Mostrando {filteredTenants.length} de {tenants.length} tenants
        </p>
      )}
    </div>
  );
}
