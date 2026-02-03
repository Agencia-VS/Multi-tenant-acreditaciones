/**
 * Página de Edición de Tenant
 * 
 * Permite editar la configuración y branding
 * de un tenant existente.
 */

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../../../lib/supabase/client";
import { useSuperAdmin } from "../../../../components/superadmin";
import type { TenantFull, TenantFormData } from "../../../../types";

export default function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isAuthenticated, refreshStats } = useSuperAdmin();
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [formData, setFormData] = useState<TenantFormData>({
    nombre: "",
    slug: "",
    logo_url: "",
    shield_url: "",
    color_primario: "#1e40af",
    color_secundario: "#64748b",
    instagram_url: "",
    twitter_url: "",
    youtube_url: "",
    website_url: "",
  });

  const [originalSlug, setOriginalSlug] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      loadTenant();
    }
  }, [isAuthenticated, id]);

  const loadTenant = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('mt_tenants')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Tenant no encontrado');

      const tenant = data as TenantFull;
      setOriginalSlug(tenant.slug);
      setFormData({
        nombre: tenant.nombre,
        slug: tenant.slug,
        logo_url: tenant.logo_url || "",
        shield_url: tenant.shield_url || "",
        color_primario: tenant.color_primario || "#1e40af",
        color_secundario: tenant.color_secundario || "#64748b",
        instagram_url: tenant.instagram_url || "",
        twitter_url: tenant.twitter_url || "",
        youtube_url: tenant.youtube_url || "",
        website_url: tenant.website_url || "",
      });
    } catch (err) {
      console.error('Error loading tenant:', err);
      setError('Error al cargar el tenant');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Validar campos requeridos
      if (!formData.nombre.trim() || !formData.slug.trim()) {
        throw new Error("Nombre y slug son requeridos");
      }

      // Validar formato de slug
      if (!/^[a-z0-9-]+$/.test(formData.slug)) {
        throw new Error("El slug solo puede contener letras minúsculas, números y guiones");
      }

      // Si cambió el slug, verificar que no exista
      if (formData.slug !== originalSlug) {
        const { data: existing } = await supabase
          .from('mt_tenants')
          .select('id')
          .eq('slug', formData.slug)
          .single();

        if (existing) {
          throw new Error("Ya existe un tenant con este slug");
        }
      }

      // Actualizar tenant
      const { error: updateError } = await supabase
        .from('mt_tenants')
        .update({
          nombre: formData.nombre.trim(),
          slug: formData.slug.trim(),
          logo_url: formData.logo_url || null,
          shield_url: formData.shield_url || null,
          color_primario: formData.color_primario,
          color_secundario: formData.color_secundario,
          instagram_url: formData.instagram_url || null,
          twitter_url: formData.twitter_url || null,
          youtube_url: formData.youtube_url || null,
          website_url: formData.website_url || null,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      setOriginalSlug(formData.slug);
      setSuccess(true);
      refreshStats();

      // Auto-ocultar mensaje de éxito
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      console.error('Error updating tenant:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar tenant');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Cargando tenant...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/superadmin/tenants"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Tenants
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Editar Tenant</h1>
        <p className="mt-1 text-sm text-gray-500">
          Modifica la configuración de {formData.nombre || 'este tenant'}
        </p>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-700 hover:opacity-70">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Cambios guardados correctamente
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información Básica */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Información Básica
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre del Tenant *
              </label>
              <input
                type="text"
                id="nombre"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1.5">
                Slug (URL) *
              </label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">/</span>
                <input
                  type="text"
                  id="slug"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  required
                  pattern="[a-z0-9-]+"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-sm"
                />
              </div>
              {formData.slug !== originalSlug && (
                <p className="mt-1 text-xs text-amber-600">
                  ⚠️ Cambiar el slug afectará las URLs existentes
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Branding
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="logo_url" className="block text-sm font-medium text-gray-700 mb-1.5">
                Logo URL
              </label>
              <input
                type="url"
                id="logo_url"
                name="logo_url"
                value={formData.logo_url}
                onChange={handleChange}
                placeholder="https://..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label htmlFor="shield_url" className="block text-sm font-medium text-gray-700 mb-1.5">
                Escudo URL
              </label>
              <input
                type="url"
                id="shield_url"
                name="shield_url"
                value={formData.shield_url}
                onChange={handleChange}
                placeholder="https://..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label htmlFor="color_primario" className="block text-sm font-medium text-gray-700 mb-1.5">
                Color Primario
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="color_primario"
                  name="color_primario"
                  value={formData.color_primario}
                  onChange={handleChange}
                  className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.color_primario}
                  onChange={(e) => setFormData(prev => ({ ...prev, color_primario: e.target.value }))}
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="color_secundario" className="block text-sm font-medium text-gray-700 mb-1.5">
                Color Secundario
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="color_secundario"
                  name="color_secundario"
                  value={formData.color_secundario}
                  onChange={handleChange}
                  className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.color_secundario}
                  onChange={(e) => setFormData(prev => ({ ...prev, color_secundario: e.target.value }))}
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-3">Vista previa</p>
            <div 
              className="p-4 rounded-lg flex items-center gap-4"
              style={{ backgroundColor: formData.color_primario }}
            >
              {(formData.shield_url || formData.logo_url) && (
                <img 
                  src={formData.shield_url || formData.logo_url} 
                  alt="Logo"
                  className="w-12 h-12 object-contain"
                  onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                />
              )}
              <span className="text-white font-semibold text-lg">
                {formData.nombre || 'Nombre del Tenant'}
              </span>
            </div>
          </div>
        </div>

        {/* Redes Sociales */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Redes Sociales
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="instagram_url" className="block text-sm font-medium text-gray-700 mb-1.5">
                Instagram
              </label>
              <input
                type="url"
                id="instagram_url"
                name="instagram_url"
                value={formData.instagram_url}
                onChange={handleChange}
                placeholder="https://instagram.com/..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label htmlFor="twitter_url" className="block text-sm font-medium text-gray-700 mb-1.5">
                Twitter / X
              </label>
              <input
                type="url"
                id="twitter_url"
                name="twitter_url"
                value={formData.twitter_url}
                onChange={handleChange}
                placeholder="https://twitter.com/..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label htmlFor="youtube_url" className="block text-sm font-medium text-gray-700 mb-1.5">
                YouTube
              </label>
              <input
                type="url"
                id="youtube_url"
                name="youtube_url"
                value={formData.youtube_url}
                onChange={handleChange}
                placeholder="https://youtube.com/..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label htmlFor="website_url" className="block text-sm font-medium text-gray-700 mb-1.5">
                Sitio Web
              </label>
              <input
                type="url"
                id="website_url"
                name="website_url"
                value={formData.website_url}
                onChange={handleChange}
                placeholder="https://..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex items-center justify-between">
          <Link
            href={`/${formData.slug}`}
            target="_blank"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Ver sitio
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/superadmin/tenants"
              className="px-4 py-2.5 text-gray-700 hover:text-gray-900 font-medium"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
