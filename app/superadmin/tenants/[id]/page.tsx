/**
 * Página de Edición de Tenant - Completa
 * 
 * Permite editar toda la configuración de un tenant:
 * - Información básica
 * - Branding (logos, colores, backgrounds)
 * - Arena/Estadio
 * - Redes sociales
 */

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../../../lib/supabase/client";
import { useSuperAdmin } from "../../../../components/superadmin";
import ImageUploader from "../../../../components/superadmin/ImageUploader";
import type { TenantFormData } from "../../../../types";

interface TenantDB {
  id: string;
  slug: string;
  nombre: string;
  logo_url: string | null;
  shield_url: string | null;
  background_url: string | null;
  color_primario: string | null;
  color_secundario: string | null;
  color_light: string | null;
  color_dark: string | null;
  arena_logo_url: string | null;
  arena_nombre: string | null;
  social_facebook: string | null;
  social_twitter: string | null;
  social_instagram: string | null;
  social_youtube: string | null;
  created_at: string;
}

export default function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isAuthenticated, refreshStats } = useSuperAdmin();
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"basico" | "branding" | "arena" | "social">("basico");

  // Form state con todos los campos
  const [formData, setFormData] = useState<TenantFormData>({
    nombre: "",
    slug: "",
    logo_url: "",
    shield_url: "",
    background_url: "",
    color_primario: "#1e40af",
    color_secundario: "#64748b",
    color_light: "#93c5fd",
    color_dark: "#1e3a8a",
    arena_logo_url: "",
    arena_nombre: "",
    social_facebook: "",
    social_twitter: "",
    social_instagram: "",
    social_youtube: "",
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

      const tenant = data as TenantDB;
      setOriginalSlug(tenant.slug);
      setFormData({
        nombre: tenant.nombre || "",
        slug: tenant.slug || "",
        logo_url: tenant.logo_url || "",
        shield_url: tenant.shield_url || "",
        background_url: tenant.background_url || "",
        color_primario: tenant.color_primario || "#1e40af",
        color_secundario: tenant.color_secundario || "#64748b",
        color_light: tenant.color_light || "#93c5fd",
        color_dark: tenant.color_dark || "#1e3a8a",
        arena_logo_url: tenant.arena_logo_url || "",
        arena_nombre: tenant.arena_nombre || "",
        social_facebook: tenant.social_facebook || "",
        social_twitter: tenant.social_twitter || "",
        social_instagram: tenant.social_instagram || "",
        social_youtube: tenant.social_youtube || "",
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

  const handleImageChange = (field: keyof TenantFormData) => (url: string) => {
    setFormData(prev => ({ ...prev, [field]: url }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      if (!formData.nombre.trim() || !formData.slug.trim()) {
        throw new Error("Nombre y slug son requeridos");
      }

      if (!/^[a-z0-9-]+$/.test(formData.slug)) {
        throw new Error("El slug solo puede contener letras minúsculas, números y guiones");
      }

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

      const { error: updateError } = await supabase
        .from('mt_tenants')
        .update({
          nombre: formData.nombre.trim(),
          slug: formData.slug.trim(),
          logo_url: formData.logo_url || null,
          shield_url: formData.shield_url || null,
          background_url: formData.background_url || null,
          color_primario: formData.color_primario,
          color_secundario: formData.color_secundario,
          color_light: formData.color_light,
          color_dark: formData.color_dark,
          arena_logo_url: formData.arena_logo_url || null,
          arena_nombre: formData.arena_nombre || null,
          social_facebook: formData.social_facebook || null,
          social_twitter: formData.social_twitter || null,
          social_instagram: formData.social_instagram || null,
          social_youtube: formData.social_youtube || null,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      setOriginalSlug(formData.slug);
      setSuccess(true);
      refreshStats();

      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      console.error('Error updating tenant:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar tenant');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "basico", label: "Básico", icon: "📋" },
    { id: "branding", label: "Branding", icon: "🎨" },
    { id: "arena", label: "Arena", icon: "🏟️" },
    { id: "social", label: "Redes", icon: "🔗" },
  ] as const;

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
    <div className="max-w-4xl mx-auto">
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
        
        <div className="flex items-center gap-4">
          {(formData.shield_url || formData.logo_url) && (
            <img 
              src={formData.shield_url || formData.logo_url} 
              alt={formData.nombre}
              className="w-16 h-16 object-contain"
            />
          )}
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{formData.nombre || 'Editar Tenant'}</h1>
            <p className="mt-1 text-sm text-gray-500">
              /{formData.slug}
            </p>
          </div>
        </div>
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

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tab: Básico */}
        {activeTab === "basico" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <span>📋</span> Información Básica
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  placeholder="Universidad Católica"
                />
              </div>

              <div>
                <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Slug (URL) *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm bg-gray-100 px-3 py-2.5 rounded-l-lg border border-r-0 border-gray-300">/</span>
                  <input
                    type="text"
                    id="slug"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    required
                    pattern="[a-z0-9-]+"
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-sm"
                    placeholder="cruzados"
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
        )}

        {/* Tab: Branding */}
        {activeTab === "branding" && (
          <div className="space-y-6">
            {/* Logos */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2 mb-6">
                <span>🖼️</span> Logos e Imágenes
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ImageUploader
                  value={formData.logo_url}
                  onChange={handleImageChange("logo_url")}
                  label="Logo Principal"
                  folder={`tenants/${formData.slug}`}
                  aspectRatio="square"
                  placeholder="Logo horizontal o cuadrado"
                />

                <ImageUploader
                  value={formData.shield_url}
                  onChange={handleImageChange("shield_url")}
                  label="Escudo"
                  folder={`tenants/${formData.slug}`}
                  aspectRatio="square"
                  placeholder="Escudo del equipo"
                />

                <ImageUploader
                  value={formData.background_url}
                  onChange={handleImageChange("background_url")}
                  label="Background"
                  folder={`tenants/${formData.slug}`}
                  aspectRatio="wide"
                  placeholder="Imagen de fondo"
                />
              </div>
            </div>

            {/* Colores */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2 mb-6">
                <span>🎨</span> Paleta de Colores
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { id: "color_primario", label: "Primario" },
                  { id: "color_secundario", label: "Secundario" },
                  { id: "color_light", label: "Claro" },
                  { id: "color_dark", label: "Oscuro" },
                ].map((color) => (
                  <div key={color.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {color.label}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        name={color.id}
                        value={formData[color.id as keyof TenantFormData]}
                        onChange={handleChange}
                        className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData[color.id as keyof TenantFormData]}
                        onChange={(e) => setFormData(prev => ({ ...prev, [color.id]: e.target.value }))}
                        className="flex-1 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Preview de colores */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">Vista previa</p>
                <div className="flex gap-2 flex-wrap">
                  {["color_primario", "color_secundario", "color_light", "color_dark"].map((colorKey) => (
                    <div 
                      key={colorKey}
                      className="px-6 py-3 rounded-lg text-sm font-medium"
                      style={{ 
                        backgroundColor: formData[colorKey as keyof TenantFormData],
                        color: colorKey === "color_light" ? "#1f2937" : "#ffffff"
                      }}
                    >
                      {colorKey.replace("color_", "").charAt(0).toUpperCase() + colorKey.replace("color_", "").slice(1)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Arena */}
        {activeTab === "arena" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <span>🏟️</span> Arena / Estadio
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="arena_nombre" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nombre del Estadio
                </label>
                <input
                  type="text"
                  id="arena_nombre"
                  name="arena_nombre"
                  value={formData.arena_nombre}
                  onChange={handleChange}
                  placeholder="Claro Arena"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>

              <ImageUploader
                value={formData.arena_logo_url}
                onChange={handleImageChange("arena_logo_url")}
                label="Logo del Estadio"
                folder={`tenants/${formData.slug}`}
                aspectRatio="wide"
                placeholder="Logo del estadio/arena"
              />
            </div>
          </div>
        )}

        {/* Tab: Redes Sociales */}
        {activeTab === "social" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <span>🔗</span> Redes Sociales
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { id: "social_facebook", label: "Facebook", icon: "📘", placeholder: "https://facebook.com/..." },
                { id: "social_twitter", label: "Twitter / X", icon: "🐦", placeholder: "https://twitter.com/..." },
                { id: "social_instagram", label: "Instagram", icon: "📸", placeholder: "https://instagram.com/..." },
                { id: "social_youtube", label: "YouTube", icon: "📺", placeholder: "https://youtube.com/..." },
              ].map((social) => (
                <div key={social.id}>
                  <label htmlFor={social.id} className="block text-sm font-medium text-gray-700 mb-1.5">
                    <span className="mr-1">{social.icon}</span> {social.label}
                  </label>
                  <input
                    type="url"
                    id={social.id}
                    name={social.id}
                    value={formData[social.id as keyof TenantFormData]}
                    onChange={handleChange}
                    placeholder={social.placeholder}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex items-center justify-between pt-4 border-t">
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
