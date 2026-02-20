'use client';

/**
 * SuperAdmin — Gestión de Admins por Tenant
 * CRUD completo: listar, crear, editar (rol/nombre), eliminar
 * Filtros: búsqueda + filtro por tenant
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast, PageHeader, Modal, LoadingSpinner, EmptyState, FormActions, ConfirmDialog, ButtonSpinner } from '@/components/shared/ui';

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

const ROL_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  admin:  { label: 'Admin',  bg: 'bg-purple-50',  text: 'text-purple-700' },
  editor: { label: 'Editor', bg: 'bg-blue-50',    text: 'text-blue-700' },
  viewer: { label: 'Viewer', bg: 'bg-gray-100',   text: 'text-gray-600' },
};

export default function AdminsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [admins, setAdmins] = useState<TenantAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTenant, setFilterTenant] = useState('');

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tenant_id: '', email: '', nombre: '', password: '', rol: 'admin' });
  const [saving, setSaving] = useState(false);

  // Edit
  const [editing, setEditing] = useState<TenantAdmin | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', rol: 'admin' });

  // Delete
  const [deleting, setDeleting] = useState<TenantAdmin | null>(null);
  const [deleteProcessing, setDeleteProcessing] = useState(false);

  const { showSuccess, showError } = useToast();

  const loadData = useCallback(async () => {
    try {
      const tenantsRes = await fetch('/api/tenants');
      if (!tenantsRes.ok) return;

      const td = await tenantsRes.json();
      const tenantList: Tenant[] = td.tenants || td;
      setTenants(tenantList);

      // Load admins for all tenants in parallel
      const results = await Promise.all(
        tenantList.map(async (t) => {
          const res = await fetch(`/api/tenants/${t.id}/admins`);
          if (!res.ok) return [];
          const data = await res.json();
          return (data.admins || data).map((a: TenantAdmin) => ({ ...a, tenant: t }));
        })
      );
      setAdmins(results.flat());
    } catch {
      showError('Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtered admins
  const filtered = useMemo(() => {
    let result = admins;
    if (filterTenant) {
      result = result.filter(a => a.tenant_id === filterTenant);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        (a.nombre || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.tenant?.nombre || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [admins, filterTenant, search]);

  // ── Create ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
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
        showSuccess('Administrador creado. Se envió email con credenciales.');
        setShowForm(false);
        setForm({ tenant_id: tenants[0]?.id || '', email: '', nombre: '', password: '', rol: 'admin' });
        loadData();
      } else {
        const data = await res.json();
        showError(data.error || 'Error al crear admin');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Update ──
  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tenants/${editing.tenant_id}/admins`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: editing.id,
          nombre: editForm.nombre,
          rol: editForm.rol,
        }),
      });
      if (res.ok) {
        showSuccess('Admin actualizado');
        setEditing(null);
        loadData();
      } else {
        const data = await res.json();
        showError(data.error || 'Error al actualizar');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteProcessing(true);
    try {
      const res = await fetch(
        `/api/tenants/${deleting.tenant_id}/admins?admin_id=${deleting.id}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        showSuccess('Admin eliminado');
        setDeleting(null);
        loadData();
      } else {
        const data = await res.json();
        showError(data.error || 'Error al eliminar');
      }
    } finally {
      setDeleteProcessing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Administradores"
        subtitle={`${admins.length} admins en ${tenants.length} tenants`}
        action={{
          label: 'Nuevo Admin',
          icon: 'fa-plus',
          onClick: () => {
            setForm({ tenant_id: tenants[0]?.id || '', email: '', nombre: '', password: '', rol: 'admin' });
            setShowForm(true);
          },
        }}
      />

      {/* ══════ Filters ══════ */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o tenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-field-border text-heading text-sm"
          />
        </div>
        <select
          value={filterTenant}
          onChange={(e) => setFilterTenant(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-field-border text-heading text-sm min-w-[180px]"
        >
          <option value="">Todos los tenants</option>
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
      </div>

      {/* ══════ Table ══════ */}
      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          message={search || filterTenant ? 'No hay admins que coincidan con el filtro' : 'No hay administradores asignados'}
          icon="fa-user-shield"
        />
      ) : (
        <div className="bg-surface rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-canvas border-b text-left text-body">
                  <th className="p-4 font-medium">Admin</th>
                  <th className="p-4 font-medium">Tenant</th>
                  <th className="p-4 font-medium">Rol</th>
                  <th className="p-4 font-medium">Creado</th>
                  <th className="p-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((admin) => {
                  const rolCfg = ROL_CONFIG[admin.rol] || ROL_CONFIG.viewer;
                  return (
                    <tr key={admin.id} className="hover:bg-canvas transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(admin.nombre || admin.email || '?')[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-heading">{admin.nombre || '—'}</p>
                            <p className="text-xs text-muted">{admin.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-body">{admin.tenant?.nombre || admin.tenant_id}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${rolCfg.bg} ${rolCfg.text}`}>
                          {rolCfg.label}
                        </span>
                      </td>
                      <td className="p-4 text-body text-sm">
                        {new Date(admin.created_at).toLocaleDateString('es-CL')}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditing(admin);
                              setEditForm({ nombre: admin.nombre || '', rol: admin.rol || 'admin' });
                            }}
                            className="p-2 text-body hover:text-brand hover:bg-accent-light rounded-lg transition"
                            title="Editar"
                          >
                            <i className="fas fa-pen text-sm" />
                          </button>
                          <button
                            onClick={() => setDeleting(admin)}
                            className="p-2 text-body hover:text-danger hover:bg-danger-light rounded-lg transition"
                            title="Eliminar"
                          >
                            <i className="fas fa-trash text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════ Modal: Crear Admin ══════ */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo Administrador" maxWidth="max-w-lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-label mb-1">Tenant</label>
            <select
              required
              value={form.tenant_id}
              onChange={(e) => setForm(prev => ({ ...prev, tenant_id: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
            >
              {tenants.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-label mb-1">Nombre</label>
              <input
                type="text"
                required
                value={form.nombre}
                onChange={(e) => setForm(prev => ({ ...prev, nombre: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-label mb-1">Rol</label>
              <select
                value={form.rol}
                onChange={(e) => setForm(prev => ({ ...prev, rol: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              >
                <option value="admin">Admin — Control total</option>
                <option value="editor">Editor — Gestión sin config</option>
                <option value="viewer">Viewer — Solo lectura</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-label mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              placeholder="admin@empresa.cl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-label mb-1">
              Contraseña
              <span className="text-muted font-normal ml-1">(se envía por email si se deja vacía)</span>
            </label>
            <input
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              placeholder="Dejar vacío para generar temporal"
            />
          </div>
          <FormActions saving={saving} onCancel={() => setShowForm(false)} submitLabel="Crear Admin" />
        </form>
      </Modal>

      {/* ══════ Modal: Editar Admin ══════ */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar Administrador" maxWidth="max-w-md">
        {editing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-canvas rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                {(editing.nombre || editing.email || '?')[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-heading">{editing.email}</p>
                <p className="text-xs text-muted">{editing.tenant?.nombre}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-label mb-1">Nombre</label>
              <input
                type="text"
                value={editForm.nombre}
                onChange={(e) => setEditForm(prev => ({ ...prev, nombre: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-label mb-1">Rol</label>
              <select
                value={editForm.rol}
                onChange={(e) => setEditForm(prev => ({ ...prev, rol: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              >
                <option value="admin">Admin — Control total</option>
                <option value="editor">Editor — Gestión sin config</option>
                <option value="viewer">Viewer — Solo lectura</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="flex-1 py-2.5 bg-brand text-on-brand rounded-lg font-medium hover:bg-brand-hover disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {saving ? <ButtonSpinner /> : <i className="fas fa-check" />}
                Guardar cambios
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-6 py-2.5 bg-subtle text-body rounded-lg font-medium hover:bg-edge transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════ Confirm: Eliminar Admin ══════ */}
      <ConfirmDialog
        open={!!deleting}
        title="Eliminar Administrador"
        message={`¿Eliminar a ${deleting?.nombre || deleting?.email} del tenant ${deleting?.tenant?.nombre}? Se eliminará su acceso y su cuenta de usuario.`}
        confirmLabel={deleteProcessing ? 'Eliminando...' : 'Eliminar'}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
