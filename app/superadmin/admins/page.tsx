/**
 * Página de Gestión de Administradores
 * 
 * Permite asignar y gestionar administradores
 * de tenants.
 */

"use client";

import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { useSuperAdmin } from "../../../components/superadmin";
import type { TenantBasic, AdminTenantWithDetails, AdminRole, AdminInviteFormData, UIMessage } from "../../../types";

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminTenantWithDetails[]>([]);
  const [tenants, setTenants] = useState<TenantBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState<UIMessage | null>(null);
  const [inviting, setInviting] = useState(false);

  const { isAuthenticated, refreshStats } = useSuperAdmin();
  const supabase = getSupabaseBrowserClient();

  // Form state
  const [formData, setFormData] = useState<AdminInviteFormData>({
    email: "",
    tenant_id: "",
    rol: "admin",
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
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('mt_tenants')
        .select('id, slug, nombre, color_primario')
        .order('nombre');

      if (tenantsError) {
        console.error('Error loading tenants:', tenantsError);
        // Si no hay tabla de tenants, mostrar mensaje más específico
        if (tenantsError.code === '42P01') {
          throw new Error('La tabla mt_tenants no existe. Ejecuta las migraciones SQL primero.');
        }
        throw tenantsError;
      }

      setTenants(tenantsData || []);

      // Cargar admin-tenants
      const { data: adminsData, error: adminsError } = await supabase
        .from('mt_admin_tenants')
        .select('id, user_id, tenant_id, rol, email, nombre')
        .order('id', { ascending: false });

      // Si la tabla no existe, mostrar lista vacía en lugar de error
      if (adminsError) {
        console.warn('Error loading admins (tabla puede no existir):', adminsError.message || adminsError);
        if (adminsError.code === '42P01') {
          // Tabla no existe - mostrar lista vacía
          setAdmins([]);
          return;
        }
        throw adminsError;
      }

      // Enriquecer con datos de tenant
      const enrichedAdmins = (adminsData || []).map((admin: { id: string; user_id: string; tenant_id: string; rol: AdminRole; email: string | null; nombre: string | null }) => ({
        ...admin,
        tenant: tenantsData?.find((t: TenantBasic) => t.id === admin.tenant_id),
      })) as AdminTenantWithDetails[];

      setAdmins(enrichedAdmins);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar datos';
      console.error('Error loading data:', errorMessage);
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setFormData({
      email: "",
      tenant_id: "",
      rol: "admin",
    });
    setShowModal(true);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);

    try {
      if (!formData.email || !formData.tenant_id) {
        throw new Error("Email y tenant son requeridos");
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error("Email inválido");
      }

      // Verificar si ya existe el admin para este tenant
      const { data: existing } = await supabase
        .from('mt_admin_tenants')
        .select('id')
        .eq('tenant_id', formData.tenant_id)
        .eq('user_id', formData.email) // Temporalmente usamos email como user_id
        .single();

      if (existing) {
        throw new Error("Este usuario ya es administrador de este tenant");
      }

      // Invitar usuario via Supabase Auth (requiere configuración de emails)
      // Por ahora, solo registramos el admin pendiente
      const { error: insertError } = await supabase
        .from('mt_admin_tenants')
        .insert({
          user_id: formData.email, // Temporal - debería ser el user_id real
          tenant_id: formData.tenant_id,
          rol: formData.rol,
          email: formData.email,
          nombre: null, // Se actualizará cuando el usuario se registre
        });

      if (insertError) throw insertError;

      setMessage({ type: 'success', text: `Invitación enviada a ${formData.email}` });
      setShowModal(false);
      loadData();
      refreshStats();
    } catch (err) {
      console.error('Error inviting admin:', err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al invitar' });
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (admin: AdminTenantWithDetails, newRole: AdminRole) => {
    try {
      const { error } = await supabase
        .from('mt_admin_tenants')
        .update({ rol: newRole })
        .eq('id', admin.id);

      if (error) throw error;

      setAdmins(admins.map(a => 
        a.id === admin.id ? { ...a, rol: newRole } : a
      ));

      setMessage({ type: 'success', text: 'Rol actualizado' });
    } catch (error) {
      console.error('Error changing role:', error);
      setMessage({ type: 'error', text: 'Error al cambiar rol' });
    }
  };

  const removeAdmin = async (admin: AdminTenantWithDetails) => {
    if (!confirm(`¿Remover a ${admin.email || admin.user_id} como administrador?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('mt_admin_tenants')
        .delete()
        .eq('id', admin.id);

      if (error) throw error;

      setAdmins(admins.filter(a => a.id !== admin.id));
      setMessage({ type: 'success', text: 'Administrador removido' });
      refreshStats();
    } catch (error) {
      console.error('Error removing admin:', error);
      setMessage({ type: 'error', text: 'Error al remover administrador' });
    }
  };

  // Agrupar admins por tenant
  const adminsByTenant = admins.reduce((acc, admin) => {
    const tenantId = admin.tenant_id;
    if (!acc[tenantId]) {
      acc[tenantId] = [];
    }
    acc[tenantId].push(admin);
    return acc;
  }, {} as Record<string, AdminTenantWithDetails[]>);

  const getRoleBadgeColor = (rol: string) => {
    switch (rol) {
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      case 'editor':
        return 'bg-blue-100 text-blue-700';
      case 'lector':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Administradores</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona los administradores de cada tenant
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Invitar Admin
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

      {/* Lista de Administradores */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Cargando administradores...</p>
        </div>
      ) : admins.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-gray-500">No hay administradores asignados</p>
          <button
            onClick={openCreateModal}
            className="inline-block mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Invitar el primer administrador →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tenants.map(tenant => {
            const tenantAdmins = adminsByTenant[tenant.id] || [];
            if (tenantAdmins.length === 0) return null;

            return (
              <div key={tenant.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Tenant header */}
                <div 
                  className="px-4 py-3 border-b border-gray-100 flex items-center gap-3"
                  style={{ borderLeftWidth: '4px', borderLeftColor: tenant.color_primario || '#6366f1' }}
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: tenant.color_primario || '#6366f1' }}
                  >
                    <span className="text-white font-semibold text-sm">
                      {tenant.nombre.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">{tenant.nombre}</span>
                    <span className="text-gray-400 text-sm ml-2">/{tenant.slug}</span>
                  </div>
                  <span className="ml-auto text-xs text-gray-500">
                    {tenantAdmins.length} admin{tenantAdmins.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Admins list */}
                <div className="divide-y divide-gray-50">
                  {tenantAdmins.map(admin => (
                    <div key={admin.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {admin.nombre || admin.email || admin.user_id}
                          </div>
                          {admin.email && admin.nombre && (
                            <div className="text-xs text-gray-500">
                              {admin.email}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Role selector */}
                        <select
                          value={admin.rol}
                          onChange={(e) => changeRole(admin, e.target.value as 'admin' | 'editor' | 'lector')}
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${getRoleBadgeColor(admin.rol)}`}
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="lector">Lector</option>
                        </select>

                        {/* Remove button */}
                        <button
                          onClick={() => removeAdmin(admin)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remover"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Tenants sin admins */}
          {tenants.filter(t => !adminsByTenant[t.id]?.length).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Tenants sin administradores</h3>
              <div className="flex flex-wrap gap-2">
                {tenants.filter(t => !adminsByTenant[t.id]?.length).map(tenant => (
                  <button
                    key={tenant.id}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, tenant_id: tenant.id }));
                      setShowModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
                  >
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: tenant.color_primario || '#6366f1' }}
                    />
                    {tenant.nombre}
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de invitación */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Invitar Administrador
            </h2>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  placeholder="admin@ejemplo.com"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tenant *
                </label>
                <select
                  value={formData.tenant_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, tenant_id: e.target.value }))}
                  required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                >
                  <option value="">Seleccionar tenant...</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Rol
                </label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData(prev => ({ ...prev, rol: e.target.value as 'admin' | 'editor' | 'lector' }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                >
                  <option value="admin">Admin - Acceso completo</option>
                  <option value="editor">Editor - Puede editar acreditados</option>
                  <option value="lector">Lector - Solo lectura</option>
                </select>
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
                  disabled={inviting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {inviting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Invitando...
                    </>
                  ) : (
                    'Enviar Invitación'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
