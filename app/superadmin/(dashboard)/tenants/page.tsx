'use client';

/**
 * SuperAdmin — Gestión de Tenants
 * CRUD completo: crear, editar, activar/desactivar tenants
 */
import { useState, useEffect, useCallback } from 'react';
import { Toast, useToast, PageHeader, Modal, LoadingSpinner, FormActions } from '@/components/shared/ui';

interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  shield_url: string | null;
  background_url: string | null;
  color_primario: string;
  color_secundario: string;
  color_light: string;
  color_dark: string;
  activo: boolean;
  created_at: string;
  stats?: { events: number; registrations: number };
}

const emptyTenant = {
  nombre: '',
  slug: '',
  logo_url: '',
  shield_url: '',
  background_url: '',
  color_primario: '#1a1a2e',
  color_secundario: '#e94560',
  color_light: '#f5f5f5',
  color_dark: '#0f0f1a',
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState(emptyTenant);
  const [saving, setSaving] = useState(false);
  const { toast, showSuccess, showError, dismiss } = useToast();

  const loadTenants = useCallback(async () => {
    const res = await fetch('/api/tenants?withStats=true');
    if (res.ok) {
      const data = await res.json();
      setTenants(data.tenants || data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  const handleEdit = (tenant: Tenant) => {
    setEditing(tenant);
    setForm({
      nombre: tenant.nombre,
      slug: tenant.slug,
      logo_url: tenant.logo_url || '',
      shield_url: tenant.shield_url || '',
      background_url: tenant.background_url || '',
      color_primario: tenant.color_primario,
      color_secundario: tenant.color_secundario,
      color_light: tenant.color_light || '#f5f5f5',
      color_dark: tenant.color_dark || '#0f0f1a',
    });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditing(null);
    setForm(emptyTenant);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editing ? 'PATCH' : 'POST';
      const url = editing ? `/api/tenants?id=${editing.id}` : '/api/tenants';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status}: ${res.statusText}`);
      }

      setShowForm(false);
      showSuccess(editing ? 'Tenant actualizado exitosamente' : 'Tenant creado exitosamente');
      loadTenants();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Error al guardar el tenant');
    } finally {
      setSaving(false);
    }
  };

  const generateSlug = (nombre: string) => {
    return nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  return (
    <div>
      <Toast toast={toast} onDismiss={dismiss} />
      <PageHeader
        title="Tenants"
        subtitle="Organizaciones registradas en la plataforma"
        action={{ label: 'Nuevo Tenant', icon: 'fa-plus', onClick: handleNew }}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Editar Tenant' : 'Nuevo Tenant'}
      >
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={form.nombre}
                    onChange={(e) => {
                      const nombre = e.target.value;
                      setForm(prev => ({
                        ...prev,
                        nombre,
                        slug: !editing ? generateSlug(nombre) : prev.slug,
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                  <input
                    type="text"
                    required
                    value={form.slug}
                    onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
                    disabled={!!editing}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                  <input
                    type="url"
                    value={form.logo_url}
                    onChange={(e) => setForm(prev => ({ ...prev, logo_url: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Escudo URL</label>
                  <input
                    type="url"
                    value={form.shield_url}
                    onChange={(e) => setForm(prev => ({ ...prev, shield_url: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Background URL</label>
                <input
                  type="url"
                  value={form.background_url}
                  onChange={(e) => setForm(prev => ({ ...prev, background_url: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                {(['color_primario', 'color_secundario', 'color_light', 'color_dark'] as const).map((key) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                      {key.replace('color_', '')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form[key]}
                        onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={form[key]}
                        onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                        className="flex-1 px-2 py-1 rounded border border-gray-300 text-xs font-mono text-gray-700"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: form.color_primario }}>
                <div className="flex items-center gap-3">
                  {form.shield_url && <img src={form.shield_url} alt="" className="w-10 h-10 object-contain" />}
                  <span className="font-bold" style={{ color: form.color_secundario }}>
                    {form.nombre || 'Preview'}
                  </span>
                </div>
              </div>

              <FormActions
                saving={saving}
                onCancel={() => setShowForm(false)}
                submitLabel={editing ? 'Actualizar' : 'Crear Tenant'}
              />
            </form>
      </Modal>

      {/* Tenants List */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid gap-4">
          {tenants.map((tenant) => (
            <div key={tenant.id} className="bg-white rounded-xl border p-6 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold"
                    style={{ backgroundColor: tenant.color_primario }}
                  >
                    {tenant.shield_url ? (
                      <img src={tenant.shield_url} alt="" className="w-10 h-10 object-contain" />
                    ) : (
                      tenant.nombre.charAt(0)
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{tenant.nombre}</h3>
                    <p className="text-gray-500 text-sm">/{tenant.slug}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right text-sm text-gray-500">
                    <p>{tenant.stats?.events || 0} eventos</p>
                    <p>{tenant.stats?.registrations || 0} acreditaciones</p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      tenant.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {tenant.activo ? 'Activo' : 'Inactivo'}
                  </span>

                  <div className="flex gap-2">
                    <a
                      href={`/${tenant.slug}`}
                      target="_blank"
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition"
                    >
                      <i className="fas fa-external-link-alt" />
                    </a>
                    <button
                      onClick={() => handleEdit(tenant)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 transition"
                    >
                      <i className="fas fa-edit" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
