"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BotonFlotante from "../../../components/common/BotonesFlotantes/BotonFlotante";
import IconoFlotanteAdmin from "../../../components/common/BotonesFlotantes/IconoFlotanteAdmin";
import DisclaimerModal from "../../../components/acreditacion/Disclaimer";
import ProgressIndicator from "../../../components/common/ProgressIndicator";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import Modal from "../../../components/common/Modal";
import { DynamicFormRenderer } from "../../../components/dynamic-form";
import { useAcreditacion } from "../../../hooks/useAcreditacion";
import { useTenant, useTenantColors } from "../../../components/tenant/TenantContext";
import BotonVolver from "../../../components/common/BotonesFlotantes/BotonVolver";
import { useAcreditacionModals } from "../../../hooks/useAcreditacionModals";
import { useAutoFill } from "../../../hooks/useAutoFill";
import { useFormConfig } from "../../../hooks/useFormConfig";
import type { DynamicFormValues, FormConfigRecord } from "../../../types/form-config";
import type { Area } from "../../../types/acreditacion";

export default function AcreditacionPage() {
  const { tenant } = useTenant();
  const colors = useTenantColors();
  const pathname = usePathname();

  // Cargar áreas y lógica de submit existente
  const {
    areas,
    loading: areasLoading,
    cuposError,
    closeCuposError,
    submitAcreditacion,
    error: areasError,
  } = useAcreditacion({ tenantSlug: tenant.slug });

  // Cargar configuración del formulario dinámico
  const {
    formConfig,
    loading: configLoading,
    isDefault: isDefaultConfig,
  } = useFormConfig({ tenantSlug: tenant.slug });

  // Auto-fill para usuarios autenticados
  const {
    isLoggedIn,
    hasPerfil,
    datos: datosAutoFill,
    loading: autoFillLoading,
  } = useAutoFill();

  // Modales
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
    onSuccessClose: () => {
      // Recargar la página para resetear el form
      window.location.reload();
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingValues, setPendingValues] = useState<DynamicFormValues | null>(null);

  // ---- Construir datos de prefill desde autoFill ----
  const prefillData = React.useMemo(() => {
    if (!datosAutoFill || !hasPerfil) return undefined;
    return {
      responsable: {
        responsable_nombre: datosAutoFill.nombre || '',
        responsable_primer_apellido: datosAutoFill.apellido || '',
        responsable_rut: datosAutoFill.rut || '',
        responsable_email: datosAutoFill.email || '',
        responsable_telefono: datosAutoFill.telefono || '',
      },
      solicitud: {
        empresa: datosAutoFill.empresa || '',
      },
      acreditados: [],
    };
  }, [datosAutoFill, hasPerfil]);

  // ---- Handler de submit del formulario dinámico ----
  const handleFormSubmit = useCallback(
    async (values: DynamicFormValues) => {
      clearError();
      setPendingValues(values);
      openConfirmation();
    },
    [clearError, openConfirmation]
  );

  // ---- Confirmar envío ----
  const confirmSubmit = async () => {
    if (!pendingValues) return;
    closeConfirmation();
    setIsSubmitting(true);

    try {
      // Transformar DynamicFormValues al formato que espera la API existente
      const empresa = pendingValues.solicitud['empresa'] === 'Otros'
        ? `Otros: ${pendingValues.solicitud['empresa_personalizada'] || ''}`
        : pendingValues.solicitud['empresa'];

      // Separar campos estándar de custom para cada acreditado
      const standardKeys = new Set([
        'nombre', 'primer_apellido', 'segundo_apellido',
        'rut', 'email', 'cargo', 'tipo_credencial', 'numero_credencial'
      ]);

      const acreditados = pendingValues.acreditados.map((ac) => {
        const standard: Record<string, string> = {};
        const custom: Record<string, string> = {};

        for (const [key, value] of Object.entries(ac)) {
          if (standardKeys.has(key)) {
            standard[key] = value;
          } else if (value) {
            custom[key] = value;
          }
        }

        return {
          nombre: standard['nombre'] || '',
          primer_apellido: standard['primer_apellido'] || '',
          segundo_apellido: standard['segundo_apellido'] || '',
          rut: standard['rut'] || '',
          email: standard['email'] || '',
          cargo: standard['cargo'] || '',
          tipo_credencial: standard['tipo_credencial'] || '',
          numero_credencial: standard['numero_credencial'] || '',
          datos_custom: Object.keys(custom).length > 0 ? custom : undefined,
        };
      });

      const formDataToSend = {
        responsable_nombre: pendingValues.responsable['responsable_nombre'] || '',
        responsable_primer_apellido: pendingValues.responsable['responsable_primer_apellido'] || '',
        responsable_segundo_apellido: pendingValues.responsable['responsable_segundo_apellido'] || '',
        responsable_rut: pendingValues.responsable['responsable_rut'] || '',
        responsable_email: pendingValues.responsable['responsable_email'] || '',
        responsable_telefono: pendingValues.responsable['responsable_telefono'] || '',
        empresa,
        area: pendingValues.solicitud['area'] || '',
        acreditados,
        form_config_id: formConfig?.id !== 'default' ? formConfig?.id : undefined,
      };

      const result = await submitAcreditacion(formDataToSend);

      if (result.success) {
        openSuccess(pendingValues.acreditados.length);
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes('23505')
          ? 'Ya existe una acreditación para este RUT, empresa y área en este evento.'
          : 'Error al enviar la acreditación';
      setError(msg);
    } finally {
      setIsSubmitting(false);
      setPendingValues(null);
    }
  };

  // ---- Loading states ----
  if (areasLoading || configLoading) {
    return <LoadingSpinner message="Cargando formulario..." />;
  }

  if (areasError) {
    return <div className="text-center text-red-500">Error: {areasError}</div>;
  }

  // Obtener nombre del área seleccionada para el modal de éxito
  const selectedAreaName = pendingValues
    ? areas.find((a) => a.codigo === pendingValues.solicitud['area'])?.nombre || ''
    : '';
  const empresaDisplay = pendingValues
    ? pendingValues.solicitud['empresa'] === 'Otros'
      ? pendingValues.solicitud['empresa_personalizada'] || ''
      : pendingValues.solicitud['empresa']
    : '';

  return (
    <div
      className="min-h-screen py-8"
      style={{
        background: `linear-gradient(to bottom right, ${colors.primario}, ${colors.light})`,
      }}
    >
      {isSubmitting && <LoadingSpinner message="Enviando acreditación..." />}

      <BotonVolver />
      <IconoFlotanteAdmin />
      <BotonFlotante />

      <div className="container mx-auto px-4 max-w-4xl">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg">
            {formConfig?.nombre || 'Acreditación'}
          </h1>
          <p className="text-white/80 mt-2 text-lg">
            {tenant.nombre}
          </p>
          {isDefaultConfig && (
            <p className="text-yellow-300/70 mt-1 text-xs">
              Formulario estándar del sistema
            </p>
          )}
        </header>

        {/* Banner de login/perfil */}
        {!autoFillLoading && (
          <div className="mb-6">
            {isLoggedIn ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-green-800">
                      {hasPerfil
                        ? '¡Datos pre-llenados!'
                        : 'Sesión iniciada'}
                    </p>
                    <p className="text-sm text-green-600">
                      {hasPerfil
                        ? 'Tus datos de acreditaciones anteriores han sido cargados'
                        : 'Completa el formulario para guardar tu perfil'}
                    </p>
                  </div>
                </div>
                {datosAutoFill?.email && (
                  <span className="text-sm text-green-700 hidden sm:block">
                    {datosAutoFill.email}
                  </span>
                )}
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-blue-800">
                      ¿Ya te has acreditado antes?
                    </p>
                    <p className="text-sm text-blue-600">
                      Inicia sesión para pre-llenar tus datos automáticamente
                    </p>
                  </div>
                </div>
                <Link
                  href={`/auth/acreditado?returnTo=${encodeURIComponent(pathname)}`}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  Iniciar Sesión
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Formulario Dinámico */}
        {formConfig && (
          <DynamicFormRenderer
            formConfig={formConfig}
            areas={areas}
            prefillData={prefillData}
            tenantColors={colors}
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </div>

      {/* Modales */}
      <DisclaimerModal isVisible={showDisclaimer} onAccept={closeDisclaimer} />

      <ConfirmationModal
        isOpen={showConfirmation}
        onConfirm={confirmSubmit}
        onCancel={closeConfirmation}
        title="Confirmar Envío"
        message={`¿Desea enviar la acreditación para ${pendingValues?.acreditados.length || 0} persona(s)?`}
      />

      <Modal
        isOpen={showSuccess}
        type="success"
        title="¡Solicitud enviada exitosamente!"
        message="Su solicitud de acreditación ha sido registrada correctamente."
        buttons={[
          {
            label: 'Aceptar',
            onClick: closeSuccess,
            variant: 'primary',
          },
        ]}
        onClose={closeSuccess}
      >
        <div className="mt-4 space-y-3 text-lg md:text-xl text-gray-800">
          <p className="text-red-700 font-bold text-lg md:text-xl">
            La solicitud de acreditación no garantiza la obtención de la misma.
            La resolución será informada vía correo electrónico.
          </p>
          <p>
            <span className="font-semibold">Empresa:</span> {empresaDisplay}
          </p>
          <p>
            <span className="font-semibold">Área:</span> {selectedAreaName}
          </p>
          <p>
            <span className="font-semibold">Acreditados registrados:</span>{' '}
            {successCount}
          </p>
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
              label: 'Entendido',
              onClick: closeCuposError,
              variant: 'primary',
            },
          ]}
          onClose={closeCuposError}
        />
      )}
    </div>
  );
}
