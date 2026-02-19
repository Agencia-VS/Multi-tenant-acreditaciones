'use client';

/**
 * SuperAdmin — Gestión de Tenants
 * CRUD completo: crear, editar, activar/desactivar tenants
 */
import { useState, useEffect, useCallback } from 'react';
import { useToast, PageHeader, Modal, LoadingSpinner, FormActions, ButtonSpinner } from '@/components/shared/ui';
import ImageUploadField from '@/components/shared/ImageUploadField';
import type { TenantConfig } from '@/types';

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
  config: Record<string, unknown>;
  created_at: string;
  total_events?: number;
  total_registrations?: number;
  total_admins?: number;
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
  config: {} as TenantConfig,
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState(emptyTenant);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Tenant | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { showSuccess, showError } = useToast();

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
      config: tenant.config || {},
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-label mb-1">Nombre</label>
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
                    className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-label mb-1">Slug (URL)</label>
                  <input
                    type="text"
                    required
                    value={form.slug}
                    onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
                    disabled={!!editing}
                    className="w-full px-3 py-2 rounded-lg border border-field-border text-heading disabled:bg-subtle"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ImageUploadField
                  label="Logo"
                  hint="Para fondos claros (admin, emails). PNG transparente, 512×512px sin padding."
                  value={form.logo_url}
                  onChange={(url) => setForm(prev => ({ ...prev, logo_url: url }))}
                  folder="tenants"
                  rounded
                  previewSize="md"
                />
                <ImageUploadField
                  label="Escudo"
                  hint="Para fondos oscuros (landing, hero). PNG transparente, 512×512px sin padding. Versión blanca o a color claro."
                  value={form.shield_url}
                  onChange={(url) => setForm(prev => ({ ...prev, shield_url: url }))}
                  folder="tenants"
                  rounded
                  previewSize="md"
                />
              </div>

              <ImageUploadField
                label="Background"
                hint="Imagen de fondo del landing. JPG/PNG, mínimo 1920×1080px. Si no se sube, se genera un fondo automático con los colores del tenant."
                value={form.background_url}
                onChange={(url) => setForm(prev => ({ ...prev, background_url: url }))}
                folder="tenants"
                previewSize="lg"
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {([
                  { key: 'color_primario' as const, label: 'Primario', hint: 'Color institucional (L: 25-45%)' },
                  { key: 'color_secundario' as const, label: 'Secundario', hint: 'Versión brillante (L: 40-60%)' },
                  { key: 'color_light' as const, label: 'Light', hint: 'Pastel / tint (L: 70-90%)' },
                  { key: 'color_dark' as const, label: 'Dark', hint: 'El más oscuro (L: 5-15%)' },
                ]).map(({ key, label, hint }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-label mb-0.5">
                      {label}
                    </label>
                    <p className="text-[10px] text-muted mb-1 leading-tight">{hint}</p>
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
                        className="flex-1 px-2 py-1 rounded border border-field-border text-xs font-mono text-label"
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

              {/* Feature Toggles */}
              <div className="mt-4 p-4 bg-canvas rounded-xl">
                <h4 className="text-sm font-semibold text-label mb-3">
                  <i className="fas fa-sliders-h mr-2 text-muted" />
                  Funcionalidades opcionales
                </h4>
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-label">Acreditación masiva (CSV)</p>
                    <p className="text-xs text-muted">Permite subir archivos CSV con cientos de personas para acreditar en lote</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!form.config?.acreditacion_masiva_enabled}
                    onClick={() => setForm(prev => ({
                      ...prev,
                      config: { ...prev.config, acreditacion_masiva_enabled: !prev.config?.acreditacion_masiva_enabled }
                    }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                      form.config?.acreditacion_masiva_enabled ? 'bg-success' : 'bg-edge'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition ${
                        form.config?.acreditacion_masiva_enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
              </div>

              {/* ═══ PuntoTicket Config ═══ */}
              <div className="mt-4 p-4 bg-canvas rounded-xl">
                <h4 className="text-sm font-semibold text-label mb-1">
                  <i className="fas fa-ticket-alt mr-2 text-purple-500" />
                  PuntoTicket — Acreditación fija
                </h4>
                <p className="text-xs text-muted mb-3">
                  Si se define, TODOS los registros exportados a PuntoTicket usarán este valor en la columna &quot;Acreditación&quot;.
                  Ej: &quot;Cruzados&quot;. Si se deja vacío, se usará la zona asignada de cada registro.
                </p>
                <input
                  type="text"
                  value={(form.config?.puntoticket_acreditacion_fija as string) || ''}
                  onChange={(e) => setForm(prev => ({
                    ...prev,
                    config: { ...prev.config, puntoticket_acreditacion_fija: e.target.value || undefined }
                  }))}
                  placeholder="Ej: Cruzados (vacío = usar zona del registro)"
                  className="w-full px-3 py-2 rounded-lg border border-field-border text-heading text-sm"
                />
              </div>

              <FormActions
                saving={saving}
                onCancel={() => setShowForm(false)}
                submitLabel={editing ? 'Actualizar' : 'Crear Tenant'}
              />
            </form>
      </Modal>

      {/* Modal de confirmación de eliminación */}
      <Modal
        open={!!deleting}
        onClose={() => { setDeleting(null); setDeleteConfirm(''); }}
        title="Eliminar Tenant"
      >
        {deleting && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger-light border border-danger/20 rounded-xl p-4">
              <i className="fas fa-exclamation-triangle text-danger text-lg mt-0.5" />
              <div>
                <p className="font-semibold text-danger-dark text-sm">Esta acción es irreversible</p>
                <p className="text-sm text-danger-dark/80 mt-1">
                  Se eliminarán permanentemente todos los datos del tenant:
                  eventos, acreditaciones, admins, configuraciones de email
                  y archivos de storage.
                </p>
              </div>
            </div>

            <div className="bg-canvas rounded-xl p-4 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: deleting.color_primario }}
              >
                {deleting.shield_url ? (
                  <img src={deleting.shield_url} alt="" className="w-7 h-7 object-contain" />
                ) : deleting.nombre.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-heading text-sm">{deleting.nombre}</p>
                <p className="text-xs text-muted">/{deleting.slug} · {deleting.total_events || 0} eventos · {deleting.total_registrations || 0} acreditaciones</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-label mb-1.5">
                Escribe <strong className="text-danger">{deleting.nombre}</strong> para confirmar:
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={deleting.nombre}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading text-sm"
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setDeleting(null); setDeleteConfirm(''); }}
                className="flex-1 px-4 py-2.5 bg-subtle text-body rounded-lg text-sm font-medium hover:bg-edge transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteConfirm !== deleting.nombre || deleteLoading}
                onClick={async () => {
                  setDeleteLoading(true);
                  try {
                    const res = await fetch(`/api/tenants/${deleting.id}`, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ confirmName: deleteConfirm }),
                    });
                    if (!res.ok) {
                      const errData = await res.json().catch(() => ({}));
                      throw new Error(errData.error || 'Error al eliminar');
                    }
                    setDeleting(null);
                    setDeleteConfirm('');
                    showSuccess(`Tenant "${deleting.nombre}" eliminado`);
                    loadTenants();
                  } catch (err) {
                    showError(err instanceof Error ? err.message : 'Error al eliminar');
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-danger text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                {deleteLoading ? <><ButtonSpinner /> Eliminando...</> : (
                  <><i className="fas fa-trash-alt" /> Eliminar permanentemente</>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Tenants List */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid gap-4">
          {tenants.map((tenant) => (
            <div key={tenant.id} className="bg-surface rounded-xl border p-6 hover:shadow-md transition">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                    <h3 className="font-bold text-heading text-lg">{tenant.nombre}</h3>
                    <p className="text-body text-sm">/{tenant.slug}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  <div className="text-right text-sm text-body">
                    <p>{tenant.total_events || 0} eventos</p>
                    <p>{tenant.total_registrations || 0} acreditaciones</p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      tenant.activo ? 'bg-success-light text-success-dark' : 'bg-subtle text-body'
                    }`}
                  >
                    {tenant.activo ? 'Activo' : 'Inactivo'}
                  </span>

                  <div className="flex gap-2">
                    <a
                      href={`/${tenant.slug}`}
                      target="_blank"
                      className="px-3 py-1.5 bg-subtle text-body rounded-lg text-sm hover:bg-edge transition"
                    >
                      <i className="fas fa-external-link-alt" />
                    </a>
                    <button
                      onClick={() => handleEdit(tenant)}
                      className="px-3 py-1.5 bg-accent-light text-brand rounded-lg text-sm hover:bg-info-light transition"
                    >
                      <i className="fas fa-edit" />
                    </button>
                    <button
                      onClick={() => { setDeleting(tenant); setDeleteConfirm(''); }}
                      className="px-3 py-1.5 bg-danger-light text-danger rounded-lg text-sm hover:bg-red-200 transition"
                      title="Eliminar tenant"
                    >
                      <i className="fas fa-trash-alt" />
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
