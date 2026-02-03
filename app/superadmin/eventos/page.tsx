/**
 * Página de Gestión de Eventos
 * 
 * Permite crear y gestionar eventos/partidos
 * entre tenants.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { useSuperAdmin } from "../../../components/superadmin";
import type { TenantBasic, EventoWithTenants, EventoFull, EventoFormData, UIMessage } from "../../../types";

export default function EventosPage() {
  const [eventos, setEventos] = useState<EventoWithTenants[]>([]);
  const [tenants, setTenants] = useState<TenantBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvento, setEditingEvento] = useState<EventoWithTenants | null>(null);
  const [message, setMessage] = useState<UIMessage | null>(null);

  const { isAuthenticated, refreshStats } = useSuperAdmin();
  const supabase = getSupabaseBrowserClient();

  // Form state
  const [formData, setFormData] = useState<EventoFormData>({
    tenant_id: "",
    opponent_tenant_id: "",
    nombre_evento: "",
    fecha: "",
    is_active: true,
  });

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar tenants
      const { data: tenantsData } = await supabase
        .from('mt_tenants')
        .select('id, slug, nombre, shield_url, color_primario')
        .order('nombre');

      setTenants(tenantsData || []);

      // Cargar eventos
      const { data: eventosData, error } = await supabase
        .from('mt_eventos')
        .select('*')
        .order('fecha', { ascending: false });

      if (error) throw error;

      // Cargar conteos y datos de tenants
      const eventosWithDetails = await Promise.all(
        (eventosData || []).map(async (evento: EventoFull) => {
          const [acreditadosRes] = await Promise.all([
            supabase.from('mt_acreditados').select('id', { count: 'exact', head: true }).eq('evento_id', evento.id),
          ]);

          const tenant = tenantsData?.find((t: TenantBasic) => t.id === evento.tenant_id);
          const opponentTenant = evento.opponent_tenant_id 
            ? tenantsData?.find((t: TenantBasic) => t.id === evento.opponent_tenant_id)
            : null;

          return {
            ...evento,
            tenant,
            opponent_tenant: opponentTenant,
            _count: {
              acreditados: acreditadosRes.count || 0,
            }
          };
        })
      );

      setEventos(eventosWithDetails);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Error al cargar datos' });
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingEvento(null);
    setFormData({
      tenant_id: "",
      opponent_tenant_id: "",
      nombre_evento: "",
      fecha: new Date().toISOString().split('T')[0],
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (evento: EventoWithTenants) => {
    setEditingEvento(evento);
    setFormData({
      tenant_id: evento.tenant_id,
      opponent_tenant_id: evento.opponent_tenant_id || "",
      nombre_evento: evento.nombre_evento || "",
      fecha: evento.fecha.split('T')[0],
      is_active: evento.is_active,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!formData.tenant_id || !formData.fecha) {
        throw new Error("Tenant local y fecha son requeridos");
      }

      const eventoData = {
        tenant_id: formData.tenant_id,
        opponent_tenant_id: formData.opponent_tenant_id || null,
        nombre_evento: formData.nombre_evento || null,
        fecha: formData.fecha,
        is_active: formData.is_active,
      };

      if (editingEvento) {
        // Actualizar
        const { error } = await supabase
          .from('mt_eventos')
          .update(eventoData)
          .eq('id', editingEvento.id);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Evento actualizado correctamente' });
      } else {
        // Crear
        const { error } = await supabase
          .from('mt_eventos')
          .insert(eventoData);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Evento creado correctamente' });
      }

      setShowModal(false);
      loadData();
      refreshStats();
    } catch (err) {
      console.error('Error saving evento:', err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al guardar' });
    }
  };

  const toggleActive = async (evento: EventoWithTenants) => {
    try {
      const { error } = await supabase
        .from('mt_eventos')
        .update({ is_active: !evento.is_active })
        .eq('id', evento.id);

      if (error) throw error;

      setEventos(eventos.map(e => 
        e.id === evento.id ? { ...e, is_active: !e.is_active } : e
      ));
    } catch (error) {
      console.error('Error toggling evento:', error);
      setMessage({ type: 'error', text: 'Error al cambiar estado' });
    }
  };

  const deleteEvento = async (evento: EventoWithTenants) => {
    if (!confirm(`¿Eliminar este evento? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('mt_eventos')
        .delete()
        .eq('id', evento.id);

      if (error) throw error;

      setEventos(eventos.filter(e => e.id !== evento.id));
      setMessage({ type: 'success', text: 'Evento eliminado' });
      refreshStats();
    } catch (error) {
      console.error('Error deleting evento:', error);
      setMessage({ type: 'error', text: 'Error al eliminar. Puede tener acreditados asociados.' });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Eventos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona los partidos y eventos de acreditación
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nuevo Evento
        </button>
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

      {/* Lista de Eventos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Cargando eventos...</p>
          </div>
        ) : eventos.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500">No hay eventos registrados</p>
            <button
              onClick={openCreateModal}
              className="inline-block mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Crear el primer evento →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {eventos.map((evento) => (
              <div key={evento.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  {/* Info del evento */}
                  <div className="flex items-center gap-4">
                    {/* Equipos */}
                    <div className="flex items-center gap-2">
                      {/* Local */}
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden"
                        style={{ backgroundColor: evento.tenant?.color_primario || '#f3f4f6' }}
                        title={evento.tenant?.nombre}
                      >
                        {evento.tenant?.shield_url ? (
                          <img src={evento.tenant.shield_url} alt="" className="w-8 h-8 object-contain" />
                        ) : (
                          <span className="text-white font-semibold text-sm">
                            {evento.tenant?.nombre?.charAt(0) || '?'}
                          </span>
                        )}
                      </div>

                      <span className="text-gray-400 text-sm font-medium">vs</span>

                      {/* Visitante */}
                      {evento.opponent_tenant ? (
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden"
                          style={{ backgroundColor: evento.opponent_tenant?.color_primario || '#f3f4f6' }}
                          title={evento.opponent_tenant?.nombre}
                        >
                          {evento.opponent_tenant?.shield_url ? (
                            <img src={evento.opponent_tenant.shield_url} alt="" className="w-8 h-8 object-contain" />
                          ) : (
                            <span className="text-white font-semibold text-sm">
                              {evento.opponent_tenant?.nombre?.charAt(0) || '?'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-400 text-xs">TBD</span>
                        </div>
                      )}
                    </div>

                    {/* Detalles */}
                    <div>
                      <div className="font-medium text-gray-900">
                        {evento.tenant?.nombre || 'Sin equipo'} vs {evento.opponent_tenant?.nombre || 'Por definir'}
                      </div>
                      {evento.nombre_evento && (
                        <div className="text-sm text-gray-500">{evento.nombre_evento}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatDate(evento.fecha)}
                      </div>
                    </div>
                  </div>

                  {/* Stats y acciones */}
                  <div className="flex items-center gap-4">
                    {/* Badge de acreditados */}
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {evento._count?.acreditados || 0}
                      </div>
                      <div className="text-xs text-gray-500">Acreditados</div>
                    </div>

                    {/* Estado */}
                    <button
                      onClick={() => toggleActive(evento)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        evento.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {evento.is_active ? 'Activo' : 'Inactivo'}
                    </button>

                    {/* Acciones */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(evento)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteEvento(evento)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingEvento ? 'Editar Evento' : 'Nuevo Evento'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Equipo Local *
                  </label>
                  <select
                    value={formData.tenant_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, tenant_id: e.target.value }))}
                    required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Equipo Visitante
                  </label>
                  <select
                    value={formData.opponent_tenant_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, opponent_tenant_id: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  >
                    <option value="">Sin definir</option>
                    {tenants.filter(t => t.id !== formData.tenant_id).map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nombre del Evento (opcional)
                </label>
                <input
                  type="text"
                  value={formData.nombre_evento}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre_evento: e.target.value }))}
                  placeholder="Ej: Final Copa Chile"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Fecha *
                </label>
                <input
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
                  required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Evento activo (visible para acreditaciones)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  {editingEvento ? 'Guardar Cambios' : 'Crear Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
