'use client';

/**
 * SuperAdmin — Configuración: Gestión de SuperAdmins + Info del sistema
 * CRUD completo: listar, crear, editar nombre, eliminar (con protección anti-auto-delete)
 */
import { useState, useEffect, useCallback } from 'react';
import { useToast, PageHeader, Modal, LoadingSpinner, EmptyState, FormActions, ConfirmDialog, ButtonSpinner } from '@/components/shared/ui';

interface SuperAdminRow {
  id: string;
  user_id: string;
  email: string;
  nombre: string | null;
  created_at: string | null;
}

export default function ConfiguracionPage() {
  const [superadmins, setSuperadmins] = useState<SuperAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', nombre: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<SuperAdminRow | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [deleting, setDeleting] = useState<SuperAdminRow | null>(null);
  const [deleteProcessing, setDeleteProcessing] = useState(false);
  const { showSuccess, showError } = useToast();

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin/admins');
      if (res.ok) {
        const data = await res.json();
        setSuperadmins(data.admins || []);
      }
    } catch {
      showError('Error cargando superadmins');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/superadmin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        showSuccess('SuperAdmin creado exitosamente');
        setShowForm(false);
        setForm({ email: '', nombre: '', password: '' });
        loadData();
      } else {
        const data = await res.json();
        showError(data.error || 'Error al crear SuperAdmin');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch('/api/superadmin/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, nombre: editNombre }),
      });
      if (res.ok) {
        showSuccess('SuperAdmin actualizado');
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

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteProcessing(true);
    try {
      const res = await fetch(`/api/superadmin/admins?id=${deleting.id}`, { method: 'DELETE' });
      if (res.ok) {
        showSuccess('SuperAdmin eliminado');
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
        title="Configuración"
        subtitle="Super Administradores y configuración de la plataforma"
        action={{
          label: 'Nuevo SuperAdmin',
          icon: 'fa-plus',
          onClick: () => {
            setForm({ email: '', nombre: '', password: '' });
            setShowForm(true);
          },
        }}
      />

      {/* ══════ SuperAdmins Table ══════ */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-heading mb-4">
          <i className="fas fa-user-shield mr-2 text-brand" />
          Super Administradores ({superadmins.length})
        </h2>

        {loading ? (
          <LoadingSpinner />
        ) : superadmins.length === 0 ? (
          <EmptyState message="No hay superadmins registrados" icon="fa-user-shield" />
        ) : (
          <div className="bg-surface rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="bg-canvas border-b text-left text-body">
                    <th className="p-4 font-medium">Nombre</th>
                    <th className="p-4 font-medium">Email</th>
                    <th className="p-4 font-medium">Creado</th>
                    <th className="p-4 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {superadmins.map((sa) => (
                    <tr key={sa.id} className="hover:bg-canvas transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(sa.nombre || sa.email)?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span className="font-medium text-heading">{sa.nombre || '—'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-body">{sa.email}</td>
                      <td className="p-4 text-body text-sm">
                        {sa.created_at ? new Date(sa.created_at).toLocaleDateString('es-CL') : '—'}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditing(sa); setEditNombre(sa.nombre || ''); }}
                            className="p-2 text-body hover:text-brand hover:bg-accent-light rounded-lg transition"
                            title="Editar nombre"
                          >
                            <i className="fas fa-pen text-sm" />
                          </button>
                          <button
                            onClick={() => setDeleting(sa)}
                            className="p-2 text-body hover:text-danger hover:bg-danger-light rounded-lg transition"
                            title="Eliminar"
                          >
                            <i className="fas fa-trash text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ══════ Sistema Info ══════ */}
      <div className="bg-surface rounded-xl border p-6">
        <h2 className="text-lg font-bold text-heading mb-4">
          <i className="fas fa-info-circle mr-2 text-muted" />
          Información del Sistema
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-canvas p-4 rounded-lg">
            <p className="text-body">Plataforma</p>
            <p className="font-bold text-heading">Accredia v2.0</p>
          </div>
          <div className="bg-canvas p-4 rounded-lg">
            <p className="text-body">Base de Datos</p>
            <p className="font-bold text-heading">Supabase PostgreSQL</p>
          </div>
          <div className="bg-canvas p-4 rounded-lg">
            <p className="text-body">Auth</p>
            <p className="font-bold text-heading">Supabase Auth (email + Google OAuth)</p>
          </div>
          <div className="bg-canvas p-4 rounded-lg">
            <p className="text-body">Emails</p>
            <p className="font-bold text-heading">Resend</p>
          </div>
        </div>
      </div>

      {/* ══════ Modal: Crear SuperAdmin ══════ */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo Super Administrador" maxWidth="max-w-lg">
        <form onSubmit={handleCreate} className="space-y-4">
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
            <label className="block text-sm font-medium text-label mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              placeholder="admin@accredia.cl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-label mb-1">Contraseña</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <FormActions saving={saving} onCancel={() => setShowForm(false)} submitLabel="Crear SuperAdmin" />
        </form>
      </Modal>

      {/* ══════ Modal: Editar Nombre ══════ */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar SuperAdmin" maxWidth="max-w-md">
        {editing && (
          <div className="space-y-4">
            <p className="text-sm text-body">
              <i className="fas fa-envelope mr-1" />{editing.email}
            </p>
            <div>
              <label className="block text-sm font-medium text-label mb-1">Nombre</label>
              <input
                type="text"
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="flex-1 py-2.5 bg-brand text-on-brand rounded-lg font-medium hover:bg-brand-hover disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {saving ? <ButtonSpinner /> : <i className="fas fa-check" />}
                Guardar
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

      {/* ══════ Confirm: Eliminar SuperAdmin ══════ */}
      <ConfirmDialog
        open={!!deleting}
        title="Eliminar Super Administrador"
        message={`¿Eliminar a ${deleting?.nombre || deleting?.email}? Se eliminará su acceso a la plataforma. Esta acción no se puede deshacer.`}
        confirmLabel={deleteProcessing ? 'Eliminando...' : 'Eliminar'}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
