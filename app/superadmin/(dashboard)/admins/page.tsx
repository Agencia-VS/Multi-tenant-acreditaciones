'use client';

/**
 * SuperAdmin — Gestión de Admins por Tenant
 */
import { useState, useEffect, useCallback } from 'react';
import { Toast, useToast, PageHeader, Modal, LoadingSpinner, EmptyState, FormActions } from '@/components/shared/ui';

interface Tenant { id: string; nombre: string; slug: string; }
interface TenantAdmin {
  id: string;
  user_id: string;
  tenant_id: string;
  rol: string;
  nombre: string | null;
  email: string | null;
  created_at: string;
  tenant?: Tenant;
}

export default function AdminsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [admins, setAdmins] = useState<TenantAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tenant_id: '', email: '', nombre: '', password: '', rol: 'admin' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { toast, showSuccess, showError, dismiss } = useToast();

  const loadData = useCallback(async () => {
    const [tenantsRes] = await Promise.all([fetch('/api/tenants')]);
    if (tenantsRes.ok) {
      const td = await tenantsRes.json();
      const tenantList = td.tenants || td;
      setTenants(tenantList);
      
      // Load admins for all tenants
      const allAdmins: TenantAdmin[] = [];
      for (const t of tenantList) {
        const res = await fetch(`/api/tenants/${t.id}/admins`);
        if (res.ok) {
          const data = await res.json();
          const items = (data.admins || data).map((a: TenantAdmin) => ({ ...a, tenant: t }));
          allAdmins.push(...items);
        }
      }
      setAdmins(allAdmins);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/tenants/${form.tenant_id}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          nombre: form.nombre,
          password: form.password,
          rol: form.rol,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        showSuccess('Administrador creado exitosamente');
        loadData();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al crear admin');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Toast toast={toast} onDismiss={dismiss} />
      <PageHeader
        title="Administradores"
        subtitle="Gestión de admins por tenant"
        action={{
          label: 'Nuevo Admin',
          icon: 'fa-plus',
          onClick: () => {
            setForm({ tenant_id: tenants[0]?.id || '', email: '', nombre: '', password: '', rol: 'admin' });
            setShowForm(true);
          },
        }}
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo Administrador" maxWidth="max-w-lg">

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-800 text-sm rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
                <select
                  required
                  value={form.tenant_id}
                  onChange={(e) => setForm(prev => ({ ...prev, tenant_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900"
                >
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={form.nombre}
                    onChange={(e) => setForm(prev => ({ ...prev, nombre: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                  <select
                    value={form.rol}
                    onChange={(e) => setForm(prev => ({ ...prev, rol: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900"
                  >
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900"
                />
              </div>
              <FormActions saving={saving} onCancel={() => setShowForm(false)} submitLabel="Crear Admin" />
            </form>
      </Modal>

      {/* Admins List */}
      {loading ? (
        <LoadingSpinner />
      ) : admins.length === 0 ? (
        <EmptyState message="No hay administradores asignados" icon="fa-user-shield" />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-left text-gray-500">
                <th className="p-4 font-medium">Nombre</th>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Tenant</th>
                <th className="p-4 font-medium">Rol</th>
                <th className="p-4 font-medium">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">{admin.nombre || '—'}</td>
                  <td className="p-4 text-gray-600">{admin.email}</td>
                  <td className="p-4 text-gray-600">{admin.tenant?.nombre || admin.tenant_id}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {admin.rol}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500">{new Date(admin.created_at).toLocaleDateString('es-CL')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
