/**
 * Página de Acreditados (SuperAdmin)
 * 
 * Vista global de todos los acreditados del sistema
 * con filtros por tenant y evento.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { useSuperAdmin } from "../../../components/superadmin";
import type { 
  TenantBasic, 
  EventoBasic, 
  AcreditadoGlobal, 
  AcreditadoFilters,
  AcreditadoStatus,
  UIMessage 
} from "../../../types";

export default function AcreditadosPage() {
  const [acreditados, setAcreditados] = useState<AcreditadoGlobal[]>([]);
  const [tenants, setTenants] = useState<TenantBasic[]>([]);
  const [eventos, setEventos] = useState<EventoBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<UIMessage | null>(null);

  // Filtros
  const [filters, setFilters] = useState<AcreditadoFilters>({
    tenant_id: "",
    evento_id: "",
    status: "",
    search: "",
  });

  const { isAuthenticated } = useSuperAdmin();
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('mt_tenants')
        .select('id, slug, nombre, color_primario')
        .order('nombre');
      
      if (tenantsError) {
        console.error('Error loading tenants:', tenantsError);
      }
      setTenants(tenantsData || []);

      // Cargar eventos
      const { data: eventosData, error: eventosError } = await supabase
        .from('mt_eventos')
        .select('id, tenant_id, nombre_evento, fecha')
        .order('fecha', { ascending: false });
      
      if (eventosError) {
        console.error('Error loading eventos:', eventosError);
      }
      setEventos(eventosData || []);

      // Cargar acreditados
      const { data: acreditadosData, error } = await supabase
        .from('mt_acreditados')
        .select('id, tenant_id, evento_id, nombre, apellido, rut, email, empresa, area, tipo_credencial, status, created_at, responsable_nombre, responsable_email')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      // Enriquecer con tenant y evento
      const enriched = (acreditadosData || []).map((acr: Omit<AcreditadoGlobal, 'tenant' | 'evento'>) => ({
        ...acr,
        tenant: tenantsData?.find((t: TenantBasic) => t.id === acr.tenant_id),
        evento: eventosData?.find((e: EventoBasic) => e.id === acr.evento_id),
      })) as AcreditadoGlobal[];

      setAcreditados(enriched);
    } catch (error) {
      console.error('Error loading data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar datos (posible problema de permisos RLS)';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // Filtrar acreditados
  const filteredAcreditados = acreditados.filter(acr => {
    if (filters.tenant_id && acr.tenant_id !== filters.tenant_id) return false;
    if (filters.evento_id && acr.evento_id !== Number(filters.evento_id)) return false;
    if (filters.status && acr.status !== filters.status) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const fullName = `${acr.nombre} ${acr.apellido || ''}`.toLowerCase();
      const email = (acr.email || '').toLowerCase();
      const empresa = (acr.empresa || '').toLowerCase();
      if (!fullName.includes(search) && !email.includes(search) && !empresa.includes(search)) {
        return false;
      }
    }
    return true;
  });

  // Stats
  const stats = {
    total: filteredAcreditados.length,
    pendientes: filteredAcreditados.filter(a => a.status === 'pendiente').length,
    aprobados: filteredAcreditados.filter(a => a.status === 'aprobado').length,
    rechazados: filteredAcreditados.filter(a => a.status === 'rechazado').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aprobado':
        return 'bg-green-100 text-green-700';
      case 'rechazado':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'aprobado': return 'Aprobado';
      case 'rechazado': return 'Rechazado';
      default: return 'Pendiente';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Acreditados</h1>
        <p className="mt-1 text-sm text-gray-500">
          Vista global de todas las solicitudes de acreditación
        </p>
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-semibold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-semibold text-yellow-600">{stats.pendientes}</div>
          <div className="text-sm text-gray-500">Pendientes</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-semibold text-green-600">{stats.aprobados}</div>
          <div className="text-sm text-gray-500">Aprobados</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-semibold text-red-600">{stats.rechazados}</div>
          <div className="text-sm text-gray-500">Rechazados</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
            />
          </div>

          {/* Tenant */}
          <select
            value={filters.tenant_id}
            onChange={(e) => setFilters(prev => ({ ...prev, tenant_id: e.target.value, evento_id: "" }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
          >
            <option value="">Todos los tenants</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>

          {/* Evento */}
          <select
            value={filters.evento_id}
            onChange={(e) => setFilters(prev => ({ ...prev, evento_id: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
          >
            <option value="">Todos los eventos</option>
            {eventos
              .filter(e => !filters.tenant_id || e.tenant_id === filters.tenant_id)
              .map(e => (
                <option key={e.id} value={e.id}>
                  {e.nombre_evento || new Date(e.fecha).toLocaleDateString('es-CL')}
                </option>
              ))}
          </select>

          {/* Status */}
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>

        {/* Clear filters */}
        {(filters.tenant_id || filters.evento_id || filters.status || filters.search) && (
          <button
            onClick={() => setFilters({ tenant_id: "", evento_id: "", status: "", search: "" })}
            className="mt-3 text-sm text-indigo-600 hover:text-indigo-700"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Cargando acreditados...</p>
          </div>
        ) : filteredAcreditados.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-500">
              {filters.search || filters.tenant_id || filters.evento_id || filters.status
                ? 'No se encontraron acreditados con estos filtros'
                : 'No hay acreditados registrados'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acreditado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tenant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Empresa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Área
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAcreditados.map((acr) => (
                  <tr key={acr.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {acr.nombre} {acr.apellido || ''}
                        </div>
                        <div className="text-sm text-gray-500">{acr.email || acr.rut || '-'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {acr.tenant && (
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded flex items-center justify-center"
                            style={{ backgroundColor: acr.tenant.color_primario || '#6366f1' }}
                          >
                            <span className="text-white text-xs font-medium">
                              {acr.tenant.nombre.charAt(0)}
                            </span>
                          </div>
                          <span className="text-sm text-gray-700">{acr.tenant.nombre}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {acr.empresa || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                      {acr.area || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(acr.status)}`}>
                        {getStatusText(acr.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(acr.created_at).toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        {acr.tenant && (
                          <Link
                            href={`/${acr.tenant.slug}/admin`}
                            target="_blank"
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Ver en panel de admin"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer info */}
      {!loading && filteredAcreditados.length > 0 && (
        <p className="text-sm text-gray-500 text-center">
          Mostrando {filteredAcreditados.length} acreditados
        </p>
      )}
    </div>
  );
}
