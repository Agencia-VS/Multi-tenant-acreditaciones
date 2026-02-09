/**
 * Página de Gestión de Formularios de un Tenant
 * 
 * Permite a los SuperAdmin:
 * - Ver formularios configurados del tenant
 * - Crear nuevos formularios
 * - Editar campos, secciones y config
 * - Previsualizar el formulario
 * - Activar/desactivar formularios
 */

"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../../../../lib/supabase/client";
import { useSuperAdmin } from "../../../../../components/superadmin";
import type { FormConfigRecord, FormFieldDefinition, FormSectionDefinition, FormConfig } from "../../../../../types/form-config";
import { buildDefaultFormConfig, DEFAULT_SECTIONS, DEFAULT_RESPONSABLE_FIELDS, DEFAULT_SOLICITUD_FIELDS, DEFAULT_ACREDITADO_FIELDS, DEFAULT_FORM_CONFIG } from "../../../../../constants/form-defaults";

type Tab = 'list' | 'editor' | 'preview';

export default function TenantFormsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tenantId } = use(params);
  const router = useRouter();
  const { isAuthenticated } = useSuperAdmin();
  const supabase = getSupabaseBrowserClient();

  const [tab, setTab] = useState<Tab>('list');
  const [configs, setConfigs] = useState<FormConfigRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState('');

  // Estado del editor
  const [editingConfig, setEditingConfig] = useState<FormConfigRecord | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Cargar datos
  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar tenant
      const { data: tenant } = await supabase
        .from('mt_tenants')
        .select('nombre')
        .eq('id', tenantId)
        .single();
      if (tenant) setTenantName(tenant.nombre);

      // Cargar configs
      const { data, error: fetchError } = await supabase
        .from('mt_form_configs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('orden', { ascending: true });

      if (fetchError) throw fetchError;
      setConfigs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando configuraciones');
    } finally {
      setLoading(false);
    }
  }, [tenantId, supabase]);

  useEffect(() => {
    if (isAuthenticated) loadConfigs();
  }, [isAuthenticated, loadConfigs]);

  // Crear config por defecto para este tenant
  const handleCreateDefault = async () => {
    setSaving(true);
    setError(null);
    try {
      const defaultConfig = buildDefaultFormConfig(tenantId);
      const res = await fetch('/api/form-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultConfig),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSuccess('Formulario creado exitosamente');
      loadConfigs();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando formulario');
    } finally {
      setSaving(false);
    }
  };

  // Abrir editor
  const handleEdit = (config: FormConfigRecord) => {
    setEditingConfig(config);
    setJsonText(JSON.stringify({
      nombre: config.nombre,
      slug: config.slug,
      tipo: config.tipo,
      secciones: config.secciones,
      campos: config.campos,
      config: config.config,
    }, null, 2));
    setJsonError(null);
    setTab('editor');
  };

  // Validar JSON en el editor
  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      JSON.parse(text);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'JSON inválido');
    }
  };

  // Guardar cambios
  const handleSave = async () => {
    if (!editingConfig || jsonError) return;
    setSaving(true);
    setError(null);
    try {
      const parsed = JSON.parse(jsonText);
      const res = await fetch(`/api/form-configs?id=${editingConfig.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSuccess('Configuración guardada');
      setTab('list');
      loadConfigs();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  // Toggle activo
  const handleToggleActive = async (config: FormConfigRecord) => {
    try {
      const res = await fetch(`/api/form-configs?id=${config.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !config.activo }),
      });
      if (!res.ok) throw new Error('Error al cambiar estado');
      loadConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  // Eliminar
  const handleDelete = async (config: FormConfigRecord) => {
    if (!confirm(`¿Eliminar formulario "${config.nombre}"?`)) return;
    try {
      const res = await fetch(`/api/form-configs?id=${config.id}&hard=true`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error al eliminar');
      setSuccess('Formulario eliminado');
      loadConfigs();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Verificando autenticación...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/superadmin/tenants" className="hover:text-blue-600">
              Tenants
            </Link>
            <span>/</span>
            <Link href={`/superadmin/tenants/${tenantId}`} className="hover:text-blue-600">
              {tenantName || 'Cargando...'}
            </Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">Formularios</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Configuración de Formularios
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Define qué campos y secciones aparecen en los formularios de acreditación de este tenant.
          </p>
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(['list', 'editor', 'preview'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
            disabled={t === 'editor' && !editingConfig}
          >
            {t === 'list' ? 'Formularios' : t === 'editor' ? 'Editor JSON' : 'Preview'}
          </button>
        ))}
      </div>

      {/* Tab: Lista */}
      {tab === 'list' && (
        <div>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Cargando...</div>
          ) : configs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Sin formularios configurados
              </h3>
              <p className="text-gray-500 mb-4">
                Este tenant no tiene formularios personalizados. Se usa la configuración por defecto del sistema.
              </p>
              <button
                onClick={handleCreateDefault}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Creando...' : 'Crear Formulario Prensa Estándar'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={handleCreateDefault}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  + Nuevo Formulario
                </button>
              </div>

              {configs.map((config) => (
                <div
                  key={config.id}
                  className={`bg-white rounded-xl border p-5 ${
                    config.activo ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {config.nombre}
                        </h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          config.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {config.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                          {config.tipo}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Slug: <code className="bg-gray-100 px-1 rounded">{config.slug}</code>
                        {' · '}
                        {config.campos.length} campos
                        {' · '}
                        {config.secciones.length} secciones
                        {config.evento_id && ` · Evento #${config.evento_id}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(config)}
                        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggleActive(config)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          config.activo
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {config.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => handleDelete(config)}
                        className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {/* Resumen de campos */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {config.campos.slice(0, 8).map((campo) => (
                      <span
                        key={campo.key}
                        className={`px-2 py-1 text-xs rounded border ${
                          campo.required
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-gray-50 border-gray-200 text-gray-600'
                        } ${campo.custom ? 'ring-1 ring-purple-300' : ''}`}
                      >
                        {campo.label}
                        {campo.required && ' *'}
                        {campo.custom && ' 🔧'}
                      </span>
                    ))}
                    {config.campos.length > 8 && (
                      <span className="px-2 py-1 text-xs text-gray-500">
                        +{config.campos.length - 8} más
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Editor JSON */}
      {tab === 'editor' && editingConfig && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Editando: {editingConfig.nombre}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setTab('list')}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !!jsonError}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>

          {jsonError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              JSON inválido: {jsonError}
            </div>
          )}

          <div className="bg-gray-900 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-300 text-xs">
              <span>form-config.json</span>
              <span className={jsonError ? 'text-red-400' : 'text-green-400'}>
                {jsonError ? '✗ Error' : '✓ Válido'}
              </span>
            </div>
            <textarea
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="w-full h-[600px] p-4 bg-gray-900 text-gray-100 font-mono text-sm resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>

          {/* Referencia rápida */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Referencia rápida de tipos de campo</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {[
                { type: 'text', desc: 'Texto libre' },
                { type: 'email', desc: 'Email con validación' },
                { type: 'tel', desc: 'Teléfono' },
                { type: 'rut', desc: 'RUT chileno' },
                { type: 'select', desc: 'Desplegable' },
                { type: 'textarea', desc: 'Texto largo' },
                { type: 'number', desc: 'Numérico' },
                { type: 'date', desc: 'Fecha' },
                { type: 'checkbox', desc: 'Casilla' },
                { type: 'file', desc: 'Archivo' },
              ].map((t) => (
                <div key={t.type} className="bg-gray-50 rounded-lg p-2">
                  <code className="text-blue-600 text-xs">{t.type}</code>
                  <p className="text-gray-600 text-xs">{t.desc}</p>
                </div>
              ))}
            </div>

            <h4 className="font-semibold text-gray-900 mt-4 mb-2">Scopes</h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-blue-50 rounded-lg p-2">
                <code className="text-blue-600 text-xs">responsable</code>
                <p className="text-gray-600 text-xs">Datos del responsable (1 vez)</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2">
                <code className="text-green-600 text-xs">solicitud</code>
                <p className="text-gray-600 text-xs">Empresa, área (1 vez)</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-2">
                <code className="text-purple-600 text-xs">acreditado</code>
                <p className="text-gray-600 text-xs">Se repite por cada persona</p>
              </div>
            </div>

            <h4 className="font-semibold text-gray-900 mt-4 mb-2">Ejemplo de campo custom</h4>
            <pre className="bg-gray-900 text-green-300 p-3 rounded-lg text-xs overflow-x-auto">
{`{
  "key": "patente_vehiculo",
  "label": "Patente del Vehículo",
  "placeholder": "Ej: ABCD12",
  "type": "text",
  "required": false,
  "section": "acreditados",
  "scope": "acreditado",
  "order": 10,
  "custom": true,
  "helpText": "Solo si ingresará con vehículo"
}`}
            </pre>
          </div>
        </div>
      )}

      {/* Tab: Preview */}
      {tab === 'preview' && editingConfig && !jsonError && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Preview del formulario</h2>
          <p className="text-sm text-gray-500 mb-6">
            Vista previa de los campos configurados. Los campos con * son requeridos.
          </p>
          
          {(() => {
            try {
              const parsed = JSON.parse(jsonText);
              const sections = (parsed.secciones || []) as FormSectionDefinition[];
              const fields = (parsed.campos || []) as FormFieldDefinition[];

              return sections
                .sort((a: FormSectionDefinition, b: FormSectionDefinition) => a.order - b.order)
                .map((section: FormSectionDefinition) => {
                  const sectionFields = fields
                    .filter((f: FormFieldDefinition) => f.section === section.key)
                    .sort((a: FormFieldDefinition, b: FormFieldDefinition) => a.order - b.order);
                  
                  if (sectionFields.length === 0) return null;

                  return (
                    <div key={section.key} className="mb-8">
                      <h3 className="text-md font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs flex items-center justify-center font-bold">
                          {section.order}
                        </span>
                        {section.label}
                      </h3>
                      {section.description && (
                        <p className="text-sm text-gray-500 mb-3 ml-8">{section.description}</p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-8">
                        {sectionFields.map((field: FormFieldDefinition) => (
                          <div key={field.key} className="border border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-gray-700">
                                {field.label}
                                {field.required && <span className="text-red-500 ml-0.5">*</span>}
                              </span>
                              <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                                {field.type}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                field.scope === 'responsable' ? 'bg-blue-100 text-blue-600' :
                                field.scope === 'solicitud' ? 'bg-green-100 text-green-600' :
                                'bg-purple-100 text-purple-600'
                              }`}>
                                {field.scope}
                              </span>
                              {field.custom && (
                                <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">
                                  custom
                                </span>
                              )}
                            </div>
                            <code className="text-[10px] text-gray-400">{field.key}</code>
                            {field.options && field.options.length > 0 && (
                              <div className="mt-1 text-[10px] text-gray-500">
                                Opciones: {field.options.map(o => o.label).join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
            } catch {
              return <p className="text-red-500">Error al parsear el JSON</p>;
            }
          })()}
        </div>
      )}
    </div>
  );
}
