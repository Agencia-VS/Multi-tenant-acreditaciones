/**
 * DynamicFormRenderer — Componente principal del formulario dinámico
 * 
 * Renderiza un formulario completo a partir de un FormConfigRecord.
 * Maneja secciones, campos condicionales, acreditados múltiples,
 * validación y envío.
 */

'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type {
  FormConfigRecord,
  FormFieldDefinition,
  FormSectionDefinition,
  DynamicFormValues,
  DynamicFormErrors,
  DynamicFormProps,
} from '../../types/form-config';
import {
  validateDynamicForm,
  getVisibleFields,
  createInitialValues,
  validateFieldValue,
} from '../../hooks/useFormConfig';
import DynamicField from './DynamicField';
import DynamicAcreditadoRow from './DynamicAcreditadoRow';
import FormSection from '../acreditacion/FormSection';
import ProgressIndicator from '../common/ProgressIndicator';

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function DynamicFormRenderer({
  formConfig,
  areas = [],
  tiposMedio = [],
  prefillData,
  tenantColors,
  onSubmit,
  isSubmitting = false,
}: DynamicFormProps) {
  const { campos, secciones, config } = formConfig;

  // Campos filtrados por scope
  const responsableFields = useMemo(
    () => campos.filter((c) => c.scope === 'responsable').sort((a, b) => a.order - b.order),
    [campos]
  );
  const solicitudFields = useMemo(
    () => campos.filter((c) => c.scope === 'solicitud').sort((a, b) => a.order - b.order),
    [campos]
  );
  const acreditadoFields = useMemo(
    () => campos.filter((c) => c.scope === 'acreditado').sort((a, b) => a.order - b.order),
    [campos]
  );

  // Inyectar opciones de áreas dinámicas en el campo "area" si existe
  // Si hay áreas del tenant, inyectarlas como opciones del select.
  // Si no hay áreas configuradas, ocultar el campo "area" (el tenant no usa restricciones).
  // También inyectar opciones de tipo_medio si hay cupos configurados.
  const solicitudFieldsWithAreas = useMemo(() => {
    return solicitudFields
      .filter((field) => {
        // Si no hay áreas y el campo es "area", ocultarlo
        if (field.key === 'area' && areas.length === 0) return false;
        // Si no hay tipos de medio y el campo es "tipo_medio", ocultarlo
        if (field.key === 'tipo_medio' && tiposMedio.length === 0) return false;
        return true;
      })
      .map((field) => {
        if (field.key === 'area' && areas.length > 0) {
          return {
            ...field,
            options: areas.map((a) => ({
              value: a.codigo,
              label: a.cupos > 0
                ? `${a.nombre} (${a.cupos} ${a.cupos === 1 ? 'cupo' : 'cupos'})`
                : a.nombre,
            })),
          };
        }
        if (field.key === 'tipo_medio' && tiposMedio.length > 0) {
          return {
            ...field,
            type: 'select' as const,
            options: tiposMedio.map((t) => ({
              value: t.tipo_medio,
              label: t.cupo_por_empresa > 0
                ? `${t.tipo_medio} (${t.cupo_por_empresa} ${t.cupo_por_empresa === 1 ? 'cupo' : 'cupos'} por empresa)`
                : t.tipo_medio,
            })),
          };
        }
        return field;
      });
  }, [solicitudFields, areas, tiposMedio]);

  // ---- Estado del formulario ----
  const [values, setValues] = useState<DynamicFormValues>(() => {
    const initial = createInitialValues(campos, config.min_acreditados || 1);
    // Aplicar prefill si hay
    if (prefillData) {
      return {
        responsable: { ...initial.responsable, ...prefillData.responsable },
        solicitud: { ...initial.solicitud, ...prefillData.solicitud },
        acreditados: prefillData.acreditados?.length
          ? prefillData.acreditados
          : initial.acreditados,
      };
    }
    return initial;
  });

  const [errors, setErrors] = useState<DynamicFormErrors>({
    responsable: {},
    solicitud: {},
    acreditados: values.acreditados.map(() => ({})),
  });

  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // ---- Campos visibles (condiciones) ----
  const visibleFields = useMemo(() => {
    return getVisibleFields(campos, values);
  }, [campos, values]);

  // ---- Área seleccionada y cupos ----
  const selectedArea = useMemo(() => {
    const areaCode = values.solicitud['area'];
    return areas.find((a) => a.codigo === areaCode);
  }, [areas, values.solicitud]);

  // ---- Tipo de medio seleccionado y cupos por empresa ----
  const selectedTipoMedio = useMemo(() => {
    const tm = values.solicitud['tipo_medio'];
    return tiposMedio.find((t) => t.tipo_medio === tm);
  }, [tiposMedio, values.solicitud]);

  const hasTipoMedioCupo = selectedTipoMedio ? selectedTipoMedio.cupo_por_empresa > 0 : false;

  const maxAcreditados = useMemo(() => {
    // Si hay cupo por tipo_medio por empresa, usar ese límite
    if (selectedTipoMedio && selectedTipoMedio.cupo_por_empresa > 0) {
      return selectedTipoMedio.cupo_por_empresa;
    }
    // Si el área tiene cupos > 0, usar ese límite
    if (selectedArea && selectedArea.cupos > 0) return selectedArea.cupos;
    // Si no, usar límite global del form config (0 = sin límite)
    return config.max_acreditados_por_solicitud || 50;
  }, [selectedTipoMedio, selectedArea, config.max_acreditados_por_solicitud]);

  const hasCupoLimit = (selectedArea ? selectedArea.cupos > 0 : false) || hasTipoMedioCupo;
  const canAddAcreditado = values.acreditados.length < maxAcreditados;
  const canRemoveAcreditado = values.acreditados.length > (config.min_acreditados || 1);

  // ---- Paso actual del formulario (para ProgressIndicator) ----
  const currentStep = useMemo(() => {
    const hasResponsable = config.requiere_responsable
      ? responsableFields
          .filter((f) => f.required)
          .some((f) => values.responsable[f.key]?.trim())
      : true;

    const hasSolicitud = solicitudFields
      .filter((f) => f.required && visibleFields.has(f.key))
      .some((f) => values.solicitud[f.key]?.trim());

    if (!hasResponsable) return 1;
    if (!hasSolicitud) return 2;
    return 3;
  }, [responsableFields, solicitudFields, values, config, visibleFields]);

  // ---- Secciones ordenadas ----
  const sortedSections = useMemo(
    () => [...secciones].sort((a, b) => a.order - b.order),
    [secciones]
  );

  // ---- Handlers ----
  const updateResponsable = useCallback((key: string, value: string) => {
    setValues((prev) => ({
      ...prev,
      responsable: { ...prev.responsable, [key]: value },
    }));
    // Limpiar error del campo
    setErrors((prev) => ({
      ...prev,
      responsable: { ...prev.responsable, [key]: '' },
    }));
  }, []);

  const updateSolicitud = useCallback((key: string, value: string) => {
    setValues((prev) => ({
      ...prev,
      solicitud: { ...prev.solicitud, [key]: value },
    }));
    setErrors((prev) => ({
      ...prev,
      solicitud: { ...prev.solicitud, [key]: '' },
    }));
  }, []);

  const updateAcreditado = useCallback((index: number, key: string, value: string) => {
    setValues((prev) => {
      const newAcreditados = [...prev.acreditados];
      newAcreditados[index] = { ...newAcreditados[index], [key]: value };
      return { ...prev, acreditados: newAcreditados };
    });
    setErrors((prev) => {
      const newAcErrors = [...prev.acreditados];
      if (newAcErrors[index]) {
        newAcErrors[index] = { ...newAcErrors[index], [key]: '' };
      }
      return { ...prev, acreditados: newAcErrors };
    });
  }, []);

  const addAcreditado = useCallback(() => {
    const template: Record<string, string> = {};
    acreditadoFields.forEach((f) => {
      template[f.key] = f.defaultValue || '';
    });
    setValues((prev) => ({
      ...prev,
      acreditados: [...prev.acreditados, template],
    }));
    setErrors((prev) => ({
      ...prev,
      acreditados: [...prev.acreditados, {}],
    }));
  }, [acreditadoFields]);

  const removeAcreditado = useCallback(
    (index: number) => {
      if (!canRemoveAcreditado) return;
      setValues((prev) => ({
        ...prev,
        acreditados: prev.acreditados.filter((_, i) => i !== index),
      }));
      setErrors((prev) => ({
        ...prev,
        acreditados: prev.acreditados.filter((_, i) => i !== index),
      }));
    },
    [canRemoveAcreditado]
  );

  // Ajustar acreditados cuando cambia el área o tipo_medio (recortar si excede cupos)
  useEffect(() => {
    if (selectedArea && selectedArea.cupos > 0 && values.acreditados.length > selectedArea.cupos) {
      setValues((prev) => ({
        ...prev,
        acreditados: prev.acreditados.slice(0, selectedArea.cupos),
      }));
    }
  }, [selectedArea]);

  useEffect(() => {
    if (selectedTipoMedio && selectedTipoMedio.cupo_por_empresa > 0 && values.acreditados.length > selectedTipoMedio.cupo_por_empresa) {
      setValues((prev) => ({
        ...prev,
        acreditados: prev.acreditados.slice(0, selectedTipoMedio.cupo_por_empresa),
      }));
    }
  }, [selectedTipoMedio]);

  // ---- Submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);

    // Validar
    const allFields = [...responsableFields, ...solicitudFieldsWithAreas, ...acreditadoFields];
    const { valid, errors: newErrors } = validateDynamicForm(allFields, values, visibleFields);

    setErrors(newErrors);

    if (!valid) {
      // Encontrar primer error
      const firstError =
        Object.values(newErrors.responsable).find(Boolean) ||
        Object.values(newErrors.solicitud).find(Boolean) ||
        newErrors.acreditados.flatMap((a) => Object.values(a)).find(Boolean);
      setSubmissionError(firstError || 'Por favor revise los campos marcados en rojo');
      return;
    }

    try {
      await onSubmit(values);
    } catch (err) {
      setSubmissionError(err instanceof Error ? err.message : 'Error al enviar la acreditación');
    }
  };

  // ---- Generar step labels desde secciones ----
  const stepLabels = sortedSections.map((s) => s.label.replace('Datos del ', '').replace('Datos de ', ''));

  // ---- Render ----
  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/95 backdrop-blur-sm rounded-2xl border border-white/30 p-6 sm:p-8 shadow-2xl space-y-8"
    >
      <ProgressIndicator
        currentStep={currentStep}
        totalSteps={sortedSections.length}
        stepLabels={stepLabels}
      />

      {submissionError && (
        <div className="p-4 rounded-lg text-sm font-medium bg-red-100 text-red-800 border border-red-300">
          {submissionError}
        </div>
      )}

      {/* Renderizar secciones dinámicamente */}
      {sortedSections.map((section, sectionIdx) => {
        // Determinar qué campos van en esta sección
        if (section.key === 'responsable' || section.key === 'datos_responsable') {
          if (!config.requiere_responsable) return null;
          return (
            <FormSection
              key={section.key}
              stepNumber={sectionIdx + 1}
              title={section.label}
              description={section.description}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {responsableFields
                  .filter((f) => visibleFields.has(f.key))
                  .map((field) => (
                    <DynamicField
                      key={field.key}
                      field={field}
                      value={values.responsable[field.key] || ''}
                      onChange={updateResponsable}
                      error={errors.responsable[field.key]}
                      colors={tenantColors}
                    />
                  ))}
              </div>
            </FormSection>
          );
        }

        if (section.key === 'medio' || section.key === 'solicitud') {
          return (
            <FormSection
              key={section.key}
              stepNumber={sectionIdx + 1}
              title={section.label}
              description={section.description}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {solicitudFieldsWithAreas
                  .filter((f) => visibleFields.has(f.key))
                  .map((field) => (
                    <DynamicField
                      key={field.key}
                      field={field}
                      value={values.solicitud[field.key] || ''}
                      onChange={updateSolicitud}
                      error={errors.solicitud[field.key]}
                      colors={tenantColors}
                    />
                  ))}
              </div>

              {selectedArea && selectedArea.cupos > 0 && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Área seleccionada: {selectedArea.nombre} | Cupos disponibles:{' '}
                    {selectedArea.cupos} {selectedArea.cupos === 1 ? 'cupo' : 'cupos'}
                  </p>
                </div>
              )}

              {selectedTipoMedio && hasTipoMedioCupo && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    Tipo de medio: <strong>{selectedTipoMedio.tipo_medio}</strong> | Cupos por empresa:{' '}
                    {selectedTipoMedio.cupo_por_empresa} {selectedTipoMedio.cupo_por_empresa === 1 ? 'cupo' : 'cupos'}
                    {selectedTipoMedio.descripcion && (
                      <span className="text-amber-600 ml-2">— {selectedTipoMedio.descripcion}</span>
                    )}
                  </p>
                </div>
              )}
            </FormSection>
          );
        }

        if (section.key === 'acreditados' || section.key === 'datos_acreditados') {
          return (
            <FormSection
              key={section.key}
              stepNumber={sectionIdx + 1}
              title={section.label}
              description={`Complete los datos de los ${values.acreditados.length} acreditado(s)`}
            >
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  {hasCupoLimit
                    ? `Acreditaciones a registrar: ${values.acreditados.length} de ${maxAcreditados} disponibles.`
                    : `Acreditaciones a registrar: ${values.acreditados.length}`
                  }
                </p>
              </div>

              {canAddAcreditado && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={addAcreditado}
                    className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors"
                    style={{ backgroundColor: tenantColors.primario }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = tenantColors.secundario)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = tenantColors.primario)
                    }
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Agregar cupo
                  </button>
                </div>
              )}

              <div className="space-y-6">
                {values.acreditados.map((acreditado, index) => (
                  <DynamicAcreditadoRow
                    key={index}
                    fields={acreditadoFields}
                    values={acreditado}
                    errors={errors.acreditados[index] || {}}
                    visibleFields={visibleFields}
                    index={index}
                    total={values.acreditados.length}
                    onChange={updateAcreditado}
                    onRemove={removeAcreditado}
                    canRemove={canRemoveAcreditado}
                    colors={tenantColors}
                  />
                ))}
              </div>
            </FormSection>
          );
        }

        // Sección genérica (para secciones custom del tenant)
        const sectionFields = campos
          .filter((c) => c.section === section.key && visibleFields.has(c.key))
          .sort((a, b) => a.order - b.order);

        if (sectionFields.length === 0) return null;

        return (
          <FormSection
            key={section.key}
            stepNumber={sectionIdx + 1}
            title={section.label}
            description={section.description}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sectionFields.map((field) => {
                const scope = field.scope;
                const val =
                  scope === 'responsable'
                    ? values.responsable[field.key]
                    : values.solicitud[field.key];
                const err =
                  scope === 'responsable'
                    ? errors.responsable[field.key]
                    : errors.solicitud[field.key];
                const handler = scope === 'responsable' ? updateResponsable : updateSolicitud;

                return (
                  <DynamicField
                    key={field.key}
                    field={field}
                    value={val || ''}
                    onChange={handler}
                    error={err}
                    colors={tenantColors}
                  />
                );
              })}
            </div>
          </FormSection>
        );
      })}

      {/* Botón Submit */}
      <div className="flex justify-center">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-8 py-4 text-white font-bold rounded-xl transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: tenantColors.primario }}
          onMouseEnter={(e) => {
            if (!isSubmitting) e.currentTarget.style.backgroundColor = tenantColors.secundario;
          }}
          onMouseLeave={(e) => {
            if (!isSubmitting) e.currentTarget.style.backgroundColor = tenantColors.primario;
          }}
        >
          {isSubmitting ? 'Enviando...' : 'Enviar Acreditación'}
        </button>
      </div>
    </form>
  );
}
