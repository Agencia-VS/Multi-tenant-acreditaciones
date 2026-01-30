"use client";

import React, { useState } from "react";
import BotonFlotante from "../../../components/common/BotonesFlotantes/BotonFlotante";
import IconoFlotanteAdmin from "../../../components/common/BotonesFlotantes/IconoFlotanteAdmin";
import DisclaimerModal from "../../../components/acreditacion/Disclaimer";
import FormSection from "../../../components/acreditacion/FormSection";
import ProgressIndicator from "../../../components/common/ProgressIndicator";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import Modal from "../../../components/common/Modal";
import AcreditadoRow from "../../../components/acreditacion/AcreditadoRow";
import { useAcreditacion } from "../../../hooks/useAcreditacion";
import { useTenant, useTenantColors } from "../../../components/tenant/TenantContext";
import BotonVolver from "../../../components/common/BotonesFlotantes/BotonVolver";
import { useAcreditacionForm } from "../../../hooks/useAcreditacionForm";
import { useAcreditacionModals } from "../../../hooks/useAcreditacionModals";
import { CANALES } from "../../../constants/acreditacion";
import { validateForm } from "../../../lib/services/acreditacion";
import type { FormDataAcreditacion, AcreditadoFormulario } from "../../../types/acreditacion";

export default function AcreditacionPage() {
  const { tenant } = useTenant();
  const colors = useTenantColors();
  const { areas, loading: areasLoading, cuposError, closeCuposError, submitAcreditacion, error: areasError } = useAcreditacion();
  
  // Hook de formulario con áreas
  const {
    formData,
    acreditados,
    currentStep,
    selectedArea,
    canAddAcreditado,
    canRemoveAcreditado,
    empresaDisplay,
    setField,
    setEmpresa,
    setEmpresaPersonalizada,
    setArea,
    addAcreditado,
    removeAcreditado,
    updateAcreditado,
    reset: resetForm,
  } = useAcreditacionForm({ areas });

  // Hook de modales
  const {
    showDisclaimer,
    showConfirmation,
    showSuccess,
    successCount,
    submissionError,
    closeDisclaimer,
    openConfirmation,
    closeConfirmation,
    openSuccess,
    closeSuccess,
    setError,
    clearError,
  } = useAcreditacionModals({
    showDisclaimerOnMount: true,
    onSuccessClose: resetForm,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validar y mostrar confirmación
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const validation = validateForm(formData as FormDataAcreditacion);
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }

    openConfirmation();
  };

  // Enviar acreditación
  const confirmSubmit = async () => {
    closeConfirmation();
    setIsSubmitting(true);

    try {
      // Preparar datos para envío (asegurar campos requeridos)
      const formDataToSend = {
        responsable_nombre: formData.responsable_nombre,
        responsable_primer_apellido: formData.responsable_primer_apellido,
        responsable_segundo_apellido: formData.responsable_segundo_apellido || "",
        responsable_rut: formData.responsable_rut,
        responsable_email: formData.responsable_email,
        responsable_telefono: formData.responsable_telefono || "",
        empresa: formData.empresa === "Otros" 
          ? `Otros: ${formData.empresa_personalizada}` 
          : formData.empresa,
        area: formData.area,
        acreditados: acreditados,
      };

      const result = await submitAcreditacion(formDataToSend);
      
      if (result.success) {
        openSuccess(acreditados.length);
      }
      // cuposError modal is handled by useAcreditacion hook

    } catch (err) {
      const msg = err instanceof Error && err.message.includes("23505")
        ? "Ya existe una acreditación para este RUT, empresa y área en este evento."
        : "Error al enviar la acreditación";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (areasLoading) {
    return <LoadingSpinner message="Cargando..." />;
  }

  if (areasError) {
    return <div className="text-center text-red-500">Error: {areasError}</div>;
  }

  return (
    <div 
      className="min-h-screen py-8"
      style={{ background: `linear-gradient(to bottom right, ${colors.primario}, ${colors.light})` }}
    >
      {isSubmitting && <LoadingSpinner message="Enviando acreditación..." />}

      <BotonVolver />
      <IconoFlotanteAdmin />
      <BotonFlotante />

      <div className="container mx-auto px-4 max-w-4xl">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg">
            Acreditación Prensa
          </h1>
          <p className="text-white/80 mt-2 text-lg">
            Universidad Católica vs Deportes Concepción - Domingo 8 de Febrero 2026, Claro Arena
          </p>
          <p className="text-yellow-300 mt-1 text-sm font-semibold">
            Tenant: {tenant.nombre} ({tenant.slug})
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="bg-white/95 backdrop-blur-sm rounded-2xl border border-white/30 p-6 sm:p-8 shadow-2xl space-y-8"
        >
          <ProgressIndicator
            currentStep={currentStep}
            totalSteps={3}
            stepLabels={["Responsable", "Cupos", "Acreditados"]}
          />

          {submissionError && (
            <div className="p-4 rounded-lg text-sm font-medium bg-red-100 text-red-800 border border-red-300">
              {submissionError.message}
            </div>
          )}

          {/* Sección Responsable */}
          <FormSection
            stepNumber={1}
            title="Datos del Responsable"
            description="Información de contacto del responsable de la acreditación"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Nombre"
                value={formData.responsable_nombre}
                onChange={(e) => setField("responsable_nombre", e.target.value)}
                className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none"
                style={{ '--tw-ring-color': colors.primario } as React.CSSProperties}
                onFocus={(e) => e.target.style.borderColor = colors.primario}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                required
              />
              <input
                type="text"
                placeholder="Primer Apellido"
                value={formData.responsable_primer_apellido}
                onChange={(e) => setField("responsable_primer_apellido", e.target.value)}
                className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none"
                onFocus={(e) => e.target.style.borderColor = colors.primario}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                required
              />
              <input
                type="text"
                placeholder="Segundo Apellido"
                value={formData.responsable_segundo_apellido}
                onChange={(e) => setField("responsable_segundo_apellido", e.target.value)}
                className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none"
                onFocus={(e) => e.target.style.borderColor = colors.primario}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
              <input
                type="text"
                placeholder="RUT (sin puntos, con guion. Ej: 18274356-7)"
                value={formData.responsable_rut}
                pattern="^[0-9]{7,8}-[0-9kK]{1}$"
                title="RUT sin puntos, con guion. Ej: 18274356-7"
                onChange={(e) => {
                  let value = e.target.value.replace(/\./g, "");
                  value = value.replace(/[^0-9kK\-]/g, "");
                  setField("responsable_rut", value);
                }}
                className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none"
                onFocus={(e) => e.target.style.borderColor = colors.primario}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.responsable_email}
                onChange={(e) => setField("responsable_email", e.target.value)}
                className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none"
                onFocus={(e) => e.target.style.borderColor = colors.primario}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                required
              />
              <input
                type="tel"
                placeholder="Teléfono"
                value={formData.responsable_telefono}
                onChange={(e) => setField("responsable_telefono", e.target.value)}
                className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none"
                onFocus={(e) => e.target.style.borderColor = colors.primario}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
              <select
                value={formData.empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none"
                onFocus={(e) => e.target.style.borderColor = colors.primario}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                required
              >
                <option value="">Seleccionar Medio/Empresa</option>
                {CANALES.map((canal) => (
                  <option key={canal} value={canal}>
                    {canal}
                  </option>
                ))}
              </select>
              {formData.empresa === "Otros" && (
                <input
                  type="text"
                  placeholder="Nombre del Medio/Empresa"
                  value={formData.empresa_personalizada}
                  onChange={(e) => setEmpresaPersonalizada(e.target.value)}
                  className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none"
                  onFocus={(e) => e.target.style.borderColor = colors.primario}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  required
                />
              )}
            </div>
          </FormSection>

          {/* Sección Cupos por área del medio */}
          <FormSection
            stepNumber={2}
            title="Seleccione la categoría a la que corresponde su medio"
            description="Esta elección le asignará la cantidad de cupos que puede solicitar"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <select
                value={formData.area}
                onChange={(e) => setArea(e.target.value)}
                className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none"
                onFocus={(e) => e.target.style.borderColor = colors.primario}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                required
              >
                <option value="">Seleccionar Área</option>
                {areas.map((area) => (
                  <option key={area.codigo} value={area.codigo}>
                    {area.codigo === 'H'
                      ? area.nombre
                      : `${area.nombre} (${area.cupos} ${area.cupos === 1 ? 'cupo' : 'cupos'})`}
                  </option>
                ))}
              </select>
            </div>

            {selectedArea && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  Área seleccionada: {selectedArea.nombre} | Cupos disponibles: {selectedArea.cupos} {selectedArea.cupos === 1 ? 'cupo' : 'cupos'}
                </p>
              </div>
            )}
          </FormSection>

          {/* Sección Acreditados */}
          <FormSection
            stepNumber={3}
            title="Datos de Acreditados"
            description={`Complete los datos de los ${acreditados.length} acreditado(s)`}
          >
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Acreditaciones a registrar: {acreditados.length} de {selectedArea?.cupos || 0} disponibles.
              </p>
            </div>
            {canAddAcreditado && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={addAcreditado}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors"
                  style={{ backgroundColor: colors.primario }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.secundario}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primario}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Agregar cupo
                </button>
              </div>
            )}
            <div className="space-y-6">
              {acreditados.map((acreditado, index) => (
                <AcreditadoRow
                  key={index}
                  acreditado={acreditado}
                  index={index}
                  total={acreditados.length}
                  onChange={updateAcreditado}
                  onRemove={removeAcreditado}
                  canRemove={canRemoveAcreditado}
                />
              ))}
            </div>
          </FormSection>

          <div className="flex justify-center">
            <button
              type="submit"
              className="px-8 py-4 text-white font-bold rounded-xl transition-colors shadow-lg"
              style={{ backgroundColor: colors.primario }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.secundario}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primario}
            >
              Enviar Acreditación
            </button>
          </div>
        </form>
      </div>

      <DisclaimerModal
        isVisible={showDisclaimer}
        onAccept={closeDisclaimer}
      />

      <ConfirmationModal
        isOpen={showConfirmation}
        onConfirm={confirmSubmit}
        onCancel={closeConfirmation}
        title="Confirmar Envío"
        message={`¿Desea enviar la acreditación para ${acreditados.length} persona(s)?`}
      />

      <Modal
        isOpen={showSuccess}
        type="success"
        title="¡Solicitud enviada exitosamente!"
        message="Su solicitud de acreditación ha sido registrada correctamente."
        buttons={[
          {
            label: "Aceptar",
            onClick: closeSuccess,
            variant: "primary",
          },
        ]}
        onClose={closeSuccess}
      >
        <div className="mt-4 space-y-3 text-lg md:text-xl text-gray-800">
          <p className="text-red-700 font-bold text-lg md:text-xl">
            La solicitud de acreditación no garantiza la obtención de la misma. La resolución será informada vía correo electrónico.
          </p>
          <p><span className="font-semibold">Empresa:</span> {empresaDisplay}</p>
          <p><span className="font-semibold">Área:</span> {selectedArea?.nombre}</p>
          <p><span className="font-semibold">Acreditados registrados:</span> {successCount}</p>
        </div>
      </Modal>

      {cuposError?.show && (
        <Modal
          isOpen={cuposError.show}
          type="error"
          title="Cupos Agotados"
          message={`No hay cupos disponibles.\n\nEmpresa: ${cuposError.empresa}\nÁrea: ${cuposError.area}\nCupos máximos: ${cuposError.maximo}\nYa acreditados: ${cuposError.existentes}\nIntentó registrar: ${cuposError.solicitados}\nTotal resultante: ${cuposError.existentes + cuposError.solicitados} (excede el límite)`}
          buttons={[
            {
              label: "Entendido",
              onClick: closeCuposError,
              variant: "primary",
            },
          ]}
          onClose={closeCuposError}
        />
      )}
    </div>
  );
}