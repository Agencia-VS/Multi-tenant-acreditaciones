/**
 * Página de Creación de Nuevo Tenant
 * 
 * Formulario completo para crear un nuevo tenant
 * con branding personalizado.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../../../lib/supabase/client";
import { useSuperAdmin } from "../../../../components/superadmin";
import ImageUploader from "../../../../components/superadmin/ImageUploader";
import type { TenantFormData } from "../../../../types";

export default function NewTenantPage() {
  const router = useRouter();
  const { refreshStats } = useSuperAdmin();
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleImageChange = (field: keyof TenantFormData) => (url: string) => {
    setFormData(prev => ({ ...prev, [field]: url }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Auto-generar slug desde nombre
      ...(name === 'nombre' && !formData.slug ? {
        slug: value.toLowerCase()
          .replace(/[áàäâ]/g, 'a')
          .replace(/[éèëê]/g, 'e')
          .replace(/[íìïî]/g, 'i')
          .replace(/[óòöô]/g, 'o')
          .replace(/[úùüû]/g, 'u')
          .replace(/ñ/g, 'n')
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
      } : {})
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validar campos requeridos
      if (!formData.nombre.trim() || !formData.slug.trim()) {
        throw new Error("Nombre y slug son requeridos");
      }

      // Validar formato de slug
      if (!/^[a-z0-9-]+$/.test(formData.slug)) {
        throw new Error("El slug solo puede contener letras minúsculas, números y guiones");
      }

      // Verificar si el slug ya existe
      const { data: existing } = await supabase
        .from('mt_tenants')
        .select('id')
        .eq('slug', formData.slug)
        .single();

      if (existing) {
        throw new Error("Ya existe un tenant con este slug");
      }

      // Crear tenant con todos los campos
      const { error: insertError } = await supabase
        .from('mt_tenants')
        .insert({
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
        });

      if (insertError) throw insertError;

      // Actualizar stats y redirigir
      refreshStats();
      router.push('/superadmin/tenants');

    } catch (err) {
      console.error('Error creating tenant:', err);
      setError(err instanceof Error ? err.message : 'Error al crear tenant');
    } finally {
      setLoading(false);
    }
  };

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
        <h1 className="text-2xl font-semibold text-gray-900">Nuevo Tenant</h1>
        <p className="mt-1 text-sm text-gray-500">
          Crea un nuevo cliente en la plataforma
        </p>
      </div>

      {/* Error */}
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
                placeholder="Ej: Universidad Católica"
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
                  placeholder="universidad-catolica"
                  required
                  pattern="[a-z0-9-]+"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-sm"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Solo letras minúsculas, números y guiones
              </p>
            </div>
          </div>
        </div>

        {/* Branding - Imágenes */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <span>🖼️</span> Logos e Imágenes
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ImageUploader
              value={formData.logo_url}
              onChange={handleImageChange("logo_url")}
              label="Logo Principal"
              folder={`tenants/${formData.slug || 'nuevo'}`}
              aspectRatio="square"
              placeholder="Logo horizontal o cuadrado"
            />

            <ImageUploader
              value={formData.shield_url}
              onChange={handleImageChange("shield_url")}
              label="Escudo"
              folder={`tenants/${formData.slug || 'nuevo'}`}
              aspectRatio="square"
              placeholder="Escudo del equipo"
            />

            <ImageUploader
              value={formData.background_url}
              onChange={handleImageChange("background_url")}
              label="Background"
              folder={`tenants/${formData.slug || 'nuevo'}`}
              aspectRatio="wide"
              placeholder="Imagen de fondo"
            />
          </div>
        </div>

        {/* Branding - Colores */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
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

          {/* Preview */}
          {(formData.nombre || formData.logo_url || formData.shield_url) && (
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
          )}
        </div>

        {/* Arena / Estadio */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
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
              folder={`tenants/${formData.slug || 'nuevo'}`}
              aspectRatio="wide"
              placeholder="Logo del estadio/arena"
            />
          </div>
        </div>

        {/* Redes Sociales */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
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

        {/* Botones */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/superadmin/tenants"
            className="px-4 py-2.5 text-gray-700 hover:text-gray-900 font-medium"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Crear Tenant
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
