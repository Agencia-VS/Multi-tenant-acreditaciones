/**
 * VisualFormBuilder — Constructor visual de formularios
 * 
 * Permite a los SuperAdmin configurar formularios sin tocar JSON.
 * Muestra campos agrupados por sección con controles para:
 * - Agregar, editar, eliminar campos
 * - Reordenar campos (subir/bajar)
 * - Agregar/editar secciones
 * - Configuración general del formulario
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type {
  FormConfigRecord,
  FormFieldDefinition,
  FormSectionDefinition,
  FormConfig,
} from '../../../types/form-config';
import FieldEditorModal from './FieldEditorModal';

// ============================================================================
// TIPOS
// ============================================================================

interface VisualFormBuilderProps {
  config: FormConfigRecord;
  onSave: (data: {
    nombre: string;
    secciones: FormSectionDefinition[];
    campos: FormFieldDefinition[];
    config: FormConfig;
  }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

// ============================================================================
// SUB-COMPONENTES INLINE
// ============================================================================

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    text: 'bg-gray-100 text-gray-700',
    email: 'bg-blue-100 text-blue-700',
    tel: 'bg-green-100 text-green-700',
    rut: 'bg-yellow-100 text-yellow-700',
    select: 'bg-purple-100 text-purple-700',
    textarea: 'bg-indigo-100 text-indigo-700',
    number: 'bg-pink-100 text-pink-700',
    date: 'bg-cyan-100 text-cyan-700',
    checkbox: 'bg-orange-100 text-orange-700',
  };
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${colors[type] || 'bg-gray-100 text-gray-600'}`}>
      {type}
    </span>
  );
}

function ScopeBadge({ scope }: { scope: string }) {
  const colors: Record<string, string> = {
    responsable: 'bg-blue-50 text-blue-600 border-blue-200',
    solicitud: 'bg-green-50 text-green-600 border-green-200',
    acreditado: 'bg-purple-50 text-purple-600 border-purple-200',
  };
  return (
    <span className={`px-1.5 py-0.5 text-[10px] rounded border ${colors[scope] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {scope}
    </span>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function VisualFormBuilder({
  config,
  onSave,
  onCancel,
  saving,
}: VisualFormBuilderProps) {
  // Estado local (copia editable del config)
  const [nombre, setNombre] = useState(config.nombre);
  const [sections, setSections] = useState<FormSectionDefinition[]>([...config.secciones]);
  const [fields, setFields] = useState<FormFieldDefinition[]>([...config.campos]);
  const [formConfig, setFormConfig] = useState<FormConfig>({ ...config.config });

  // Editor de campo
  const [editingField, setEditingField] = useState<FormFieldDefinition | null>(null);
  const [isFieldEditorOpen, setIsFieldEditorOpen] = useState(false);
  const [addingToSection, setAddingToSection] = useState<string | null>(null);

  // Editor de sección
  const [editingSection, setEditingSection] = useState<FormSectionDefinition | null>(null);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [sectionLabel, setSectionLabel] = useState('');
  const [sectionDesc, setSectionDesc] = useState('');

  // Tab activo
  const [activeTab, setActiveTab] = useState<'campos' | 'config'>('campos');

  // Secciones ordenadas
  const sortedSections = useMemo(
    () => [...sections].sort((a, b) => a.order - b.order),
    [sections]
  );

  // Campos por sección
  const fieldsBySection = useMemo(() => {
    const map: Record<string, FormFieldDefinition[]> = {};
    for (const s of sections) {
      map[s.key] = fields
        .filter((f) => f.section === s.key)
        .sort((a, b) => a.order - b.order);
    }
    return map;
  }, [fields, sections]);

  // ---- Handlers de Campo ----

  const openFieldEditor = (field: FormFieldDefinition | null, sectionKey?: string) => {
    setEditingField(field);
    setAddingToSection(sectionKey || null);
    setIsFieldEditorOpen(true);
  };

  const handleSaveField = useCallback((updatedField: FormFieldDefinition) => {
    setFields((prev) => {
      const existingIdx = prev.findIndex((f) => f.key === updatedField.key);
      if (existingIdx >= 0 && editingField) {
        // Editar existente
        const updated = [...prev];
        updated[existingIdx] = { ...updatedField, order: prev[existingIdx].order };
        return updated;
      } else {
        // Agregar nuevo
        const sectionFields = prev.filter((f) => f.section === updatedField.section);
        const maxOrder = sectionFields.reduce((max, f) => Math.max(max, f.order), 0);
        return [...prev, { ...updatedField, order: maxOrder + 1 }];
      }
    });
    setIsFieldEditorOpen(false);
    setEditingField(null);
    setAddingToSection(null);
  }, [editingField]);

  const removeField = (key: string) => {
    if (!confirm('¿Eliminar este campo del formulario?')) return;
    setFields((prev) => prev.filter((f) => f.key !== key));
  };

  const moveField = (sectionKey: string, fieldKey: string, direction: 'up' | 'down') => {
    setFields((prev) => {
      const sectionFields = prev
        .filter((f) => f.section === sectionKey)
        .sort((a, b) => a.order - b.order);
      const idx = sectionFields.findIndex((f) => f.key === fieldKey);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sectionFields.length) return prev;

      // Swap orders
      const tempOrder = sectionFields[idx].order;
      const updated = prev.map((f) => {
        if (f.key === sectionFields[idx].key) return { ...f, order: sectionFields[swapIdx].order };
        if (f.key === sectionFields[swapIdx].key) return { ...f, order: tempOrder };
        return f;
      });
      return updated;
    });
  };

  // ---- Handlers de Sección ----

  const openSectionDialog = (section?: FormSectionDefinition) => {
    if (section) {
      setEditingSection(section);
      setSectionLabel(section.label);
      setSectionDesc(section.description || '');
    } else {
      setEditingSection(null);
      setSectionLabel('');
      setSectionDesc('');
    }
    setSectionDialogOpen(true);
  };

  const saveSectionDialog = () => {
    if (!sectionLabel.trim()) return;

    if (editingSection) {
      setSections((prev) =>
        prev.map((s) =>
          s.key === editingSection.key
            ? { ...s, label: sectionLabel.trim(), description: sectionDesc.trim() || undefined }
            : s
        )
      );
    } else {
      const key = sectionLabel
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      const maxOrder = sections.reduce((max, s) => Math.max(max, s.order), 0);
      setSections((prev) => [
        ...prev,
        {
          key,
          label: sectionLabel.trim(),
          description: sectionDesc.trim() || undefined,
          order: maxOrder + 1,
        },
      ]);
    }
    setSectionDialogOpen(false);
  };

  const removeSection = (sectionKey: string) => {
    const sectionFields = fields.filter((f) => f.section === sectionKey);
    if (sectionFields.length > 0) {
      alert(`No se puede eliminar: esta sección tiene ${sectionFields.length} campo(s). Muévalos o elimínelos primero.`);
      return;
    }
    if (!confirm('¿Eliminar esta sección?')) return;
    setSections((prev) => prev.filter((s) => s.key !== sectionKey));
  };

  const moveSection = (sectionKey: string, direction: 'up' | 'down') => {
    setSections((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.key === sectionKey);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const tempOrder = sorted[idx].order;
      return prev.map((s) => {
        if (s.key === sorted[idx].key) return { ...s, order: sorted[swapIdx].order };
        if (s.key === sorted[swapIdx].key) return { ...s, order: tempOrder };
        return s;
      });
    });
  };

  // ---- Handler de Guardar ----

  const handleSave = () => {
    onSave({
      nombre,
      secciones: sections,
      campos: fields,
      config: formConfig,
    });
  };

  // ---- Render ----

  return (
    <div className="space-y-4">
      {/* Header con nombre y acciones */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3 flex-1">
          <label className="text-sm font-medium text-gray-600">Nombre:</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? 'Guardando...' : 'Guardar Formulario'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('campos')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'campos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Campos del Formulario
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'config' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Configuración General
        </button>
      </div>

      {/* Tab: Campos */}
      {activeTab === 'campos' && (
        <div className="space-y-6">
          {/* Resumen */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{sections.length} secciones</span>
            <span>·</span>
            <span>{fields.length} campos</span>
            <span>·</span>
            <span>{fields.filter((f) => f.required).length} obligatorios</span>
          </div>

          {/* Secciones con campos */}
          {sortedSections.map((section, sIdx) => {
            const sectionFieldsList = fieldsBySection[section.key] || [];
            return (
              <div key={section.key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Section Header */}
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 bg-blue-600 text-white rounded-full text-xs font-bold flex items-center justify-center">
                      {section.order}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{section.label}</h3>
                      {section.description && (
                        <p className="text-xs text-gray-500">{section.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{sectionFieldsList.length} campos</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveSection(section.key, 'up')}
                      disabled={sIdx === 0}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      title="Mover sección arriba"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveSection(section.key, 'down')}
                      disabled={sIdx === sortedSections.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      title="Mover sección abajo"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openSectionDialog(section)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="Editar sección"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => removeSection(section.key)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Eliminar sección"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Field Cards */}
                <div className="p-3 space-y-2">
                  {sectionFieldsList.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-4">
                      No hay campos en esta sección
                    </p>
                  ) : (
                    sectionFieldsList.map((field, fIdx) => (
                      <div
                        key={field.key}
                        className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors group"
                      >
                        {/* Field info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-800 truncate">
                              {field.label}
                            </span>
                            {field.required && (
                              <span className="text-red-500 text-xs font-bold">*</span>
                            )}
                            <TypeBadge type={field.type} />
                            <ScopeBadge scope={field.scope} />
                            {field.custom && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-orange-100 text-orange-600 rounded">
                                custom
                              </span>
                            )}
                            {field.condition && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-yellow-100 text-yellow-600 rounded" title={`Depende de: ${field.condition.dependsOn}`}>
                                condicional
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                            {field.key}
                            {field.options && field.options.length > 0 && (
                              <span className="ml-2 text-gray-500">
                                {field.options.length} opciones
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => moveField(section.key, field.key, 'up')}
                            disabled={fIdx === 0}
                            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => moveField(section.key, field.key, 'down')}
                            disabled={fIdx === sectionFieldsList.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openFieldEditor(field)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeField(field.key)}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Add field button */}
                  <button
                    onClick={() => openFieldEditor(null, section.key)}
                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg border-2 border-dashed border-blue-200 transition-colors flex items-center justify-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Agregar campo
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add section */}
          <button
            onClick={() => openSectionDialog()}
            className="w-full py-3 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Agregar Sección
          </button>
        </div>
      )}

      {/* Tab: Configuración */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h3 className="font-semibold text-gray-900">Configuración General</h3>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Máx. acreditados por solicitud
              </label>
              <input
                type="number"
                value={formConfig.max_acreditados_por_solicitud}
                onChange={(e) =>
                  setFormConfig((prev) => ({
                    ...prev,
                    max_acreditados_por_solicitud: parseInt(e.target.value) || 10,
                  }))
                }
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Cuántas personas puede registrar una solicitud</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mín. acreditados por solicitud
              </label>
              <input
                type="number"
                value={formConfig.min_acreditados}
                onChange={(e) =>
                  setFormConfig((prev) => ({
                    ...prev,
                    min_acreditados: parseInt(e.target.value) || 1,
                  }))
                }
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formConfig.requiere_responsable}
                onChange={(e) =>
                  setFormConfig((prev) => ({
                    ...prev,
                    requiere_responsable: e.target.checked,
                  }))
                }
                className="w-5 h-5 rounded text-blue-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Requiere datos del responsable</span>
                <p className="text-xs text-gray-500">Muestra la sección de responsable antes de los acreditados</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formConfig.permite_masivo}
                onChange={(e) =>
                  setFormConfig((prev) => ({
                    ...prev,
                    permite_masivo: e.target.checked,
                  }))
                }
                className="w-5 h-5 rounded text-blue-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Permite carga masiva</span>
                <p className="text-xs text-gray-500">Habilita subir CSV/Excel con múltiples acreditados</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formConfig.auto_aprobacion}
                onChange={(e) =>
                  setFormConfig((prev) => ({
                    ...prev,
                    auto_aprobacion: e.target.checked,
                  }))
                }
                className="w-5 h-5 rounded text-blue-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Auto-aprobación</span>
                <p className="text-xs text-gray-500">Las acreditaciones se aprueban automáticamente sin revisión</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formConfig.email_confirmacion}
                onChange={(e) =>
                  setFormConfig((prev) => ({
                    ...prev,
                    email_confirmacion: e.target.checked,
                  }))
                }
                className="w-5 h-5 rounded text-blue-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Email de confirmación</span>
                <p className="text-xs text-gray-500">Envía un correo al responsable al recibir la solicitud</p>
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Disclaimer personalizado
            </label>
            <textarea
              value={formConfig.disclaimer || ''}
              onChange={(e) =>
                setFormConfig((prev) => ({
                  ...prev,
                  disclaimer: e.target.value || null,
                }))
              }
              placeholder="Dejar vacío para usar el disclaimer por defecto del sistema"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Modal: Editor de campo */}
      <FieldEditorModal
        field={editingField}
        sections={sections}
        allFields={fields}
        isOpen={isFieldEditorOpen}
        onSave={(f) => {
          if (addingToSection && !editingField) {
            handleSaveField({ ...f, section: addingToSection });
          } else {
            handleSaveField(f);
          }
        }}
        onCancel={() => {
          setIsFieldEditorOpen(false);
          setEditingField(null);
          setAddingToSection(null);
        }}
      />

      {/* Modal: Editor de sección */}
      {sectionDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingSection ? 'Editar Sección' : 'Nueva Sección'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la sección *</label>
                <input
                  type="text"
                  value={sectionLabel}
                  onChange={(e) => setSectionLabel(e.target.value)}
                  placeholder="Ej: Datos del Vehículo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={sectionDesc}
                  onChange={(e) => setSectionDesc(e.target.value)}
                  placeholder="Texto de ayuda debajo del título"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setSectionDialogOpen(false)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={saveSectionDialog}
                disabled={!sectionLabel.trim()}
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editingSection ? 'Guardar' : 'Crear Sección'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
