'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Alert } from '@/components/shared/ui';
import Disclaimer from '@/components/forms/Disclaimer';
import { useRegistrationForm } from './useRegistrationForm';
import StepIndicator from './StepIndicator';
import StepResponsable from './StepResponsable';
import StepTipoMedio from './StepTipoMedio';
import StepAcreditados from './StepAcreditados';
import ConfirmModal from './ConfirmModal';
import type { RegistrationFormProps, SubmitResult } from './types';

/* ═══════════════════════════════════════════════════════
   Success View — smart summary for bulk, detailed for ≤5
   ═══════════════════════════════════════════════════════ */

function SuccessView({
  submitResults,
  tenantSlug,
  tenantColors,
  resetForm,
}: {
  submitResults: readonly SubmitResult[];
  tenantSlug: string;
  tenantColors: { primario: string; secundario: string };
  resetForm: () => void;
}) {
  const [showAllErrors, setShowAllErrors] = useState(false);
  const okCount = submitResults.filter(r => r.ok).length;
  const failCount = submitResults.length - okCount;
  const allOk = failCount === 0;
  const isBulk = submitResults.length > 5;
  const failedResults = submitResults.filter(r => !r.ok);

  return (
    <div className="animate-fade-in text-center space-y-5 sm:space-y-6 px-2">
      {/* Hero icon */}
      <div className="flex justify-center">
        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center ${allOk ? 'bg-success/15' : 'bg-amber-100'}`}>
          <i className={`fas ${allOk ? 'fa-check' : 'fa-exclamation-triangle'} text-3xl sm:text-4xl ${allOk ? 'text-success' : 'text-amber-500'}`} />
        </div>
      </div>

      {/* Title + subtitle */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-heading">
          {allOk ? '¡Solicitud enviada!' : 'Solicitud enviada con observaciones'}
        </h2>
        <p className="text-muted mt-2 text-sm sm:text-base">
          {allOk
            ? `${okCount} acreditaci${okCount === 1 ? 'ón enviada' : 'ones enviadas'} correctamente`
            : `${okCount} de ${submitResults.length} enviadas — ${failCount} con error`}
        </p>
      </div>

      {/* Summary stats for bulk */}
      {isBulk ? (
        <div className="max-w-sm mx-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-success/5 border border-success/20 rounded-xl p-4">
              <p className="text-2xl font-bold text-success">{okCount}</p>
              <p className="text-xs text-success/80 font-medium mt-0.5">Exitosas</p>
            </div>
            {failCount > 0 && (
              <div className="bg-danger/5 border border-danger/20 rounded-xl p-4">
                <p className="text-2xl font-bold text-danger">{failCount}</p>
                <p className="text-xs text-danger/80 font-medium mt-0.5">Con errores</p>
              </div>
            )}
            {failCount === 0 && (
              <div className="bg-surface border border-edge rounded-xl p-4">
                <p className="text-2xl font-bold text-heading">{submitResults.length}</p>
                <p className="text-xs text-muted font-medium mt-0.5">Total enviadas</p>
              </div>
            )}
          </div>

          {/* Show failed items if any */}
          {failedResults.length > 0 && (
            <div className="mt-4 text-left">
              <button
                onClick={() => setShowAllErrors(!showAllErrors)}
                className="text-xs text-danger font-semibold hover:underline flex items-center gap-1 mx-auto"
              >
                <i className={`fas fa-chevron-${showAllErrors ? 'up' : 'down'} text-[10px]`} />
                {showAllErrors ? 'Ocultar errores' : `Ver ${failCount} error${failCount !== 1 ? 'es' : ''}`}
              </button>
              {showAllErrors && (
                <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                  {failedResults.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-danger/5 border border-danger/10 text-left">
                      <i className="fas fa-times-circle text-danger text-xs mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-danger truncate">{r.nombre}</p>
                        {r.error && <p className="text-xs text-danger/70 truncate">{r.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Detailed list for small sets (≤5) */
        submitResults.length > 0 && (
          <div className="max-w-md mx-auto space-y-2">
            {submitResults.map((r, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left ${r.ok ? 'bg-success/5 border border-success/20' : 'bg-danger/5 border border-danger/20'}`}
              >
                <i className={`fas ${r.ok ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'}`} />
                <div className="min-w-0 flex-1">
                  <p className={`font-medium truncate ${r.ok ? 'text-success' : 'text-danger'}`}>{r.nombre}</p>
                  {r.error && <p className="text-xs text-danger/80 truncate">{r.error}</p>}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
        <a
          href={`/${tenantSlug}`}
          className="flex-1 py-3 rounded-xl border border-edge text-body font-semibold text-center hover:bg-surface transition-snappy"
        >
          <i className="fas fa-home mr-2" /> Volver al Inicio
        </a>
        <button
          type="button"
          onClick={resetForm}
          className="flex-1 py-3 rounded-xl text-white font-bold transition-snappy hover:opacity-90"
          style={{ backgroundColor: tenantColors.primario }}
        >
          <i className="fas fa-plus mr-2" /> Nueva Solicitud
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Submit Progress Overlay — portaled to document.body
   ═══════════════════════════════════════════════════════ */

function SubmitProgressOverlay({
  progress,
  tenantColors,
}: {
  progress: { current: number; total: number };
  tenantColors: { primario: string; secundario: string };
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Lock body scroll while overlay is visible
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl p-6 shadow-xl max-w-xs w-full mx-4 text-center space-y-4">
        <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center animate-pulse" style={{ backgroundColor: `${tenantColors.primario}15` }}>
          <i className="fas fa-paper-plane text-xl" style={{ color: tenantColors.primario }} />
        </div>
        <div>
          <p className="font-bold text-heading text-base">Enviando solicitudes</p>
          <p className="text-sm text-muted mt-1">
            {progress.current + 1} de {progress.total}
          </p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.max(5, ((progress.current + 1) / progress.total) * 100)}%`,
              backgroundColor: tenantColors.primario,
            }}
          />
        </div>
        <p className="text-xs text-muted">No cierres esta ventana</p>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════
   Main Wizard Orchestrator
   ═══════════════════════════════════════════════════════ */

export default function RegistrationWizard(props: RegistrationFormProps) {
  const {
    tenantColors,
    tenantSlug,
    tenantName,
    userProfile,
    bulkEnabled = false,
    eventName,
    eventFecha,
    eventVenue,
    fechaLimite,
    contactEmail,
    eventType,
    eventDays,
  } = props;

  const form = useRegistrationForm(props);

  // Derive dynamic label for tipo_medio from form fields config
  const tipoMedioLabel = form.formFields.find(f => f.key === 'tipo_medio')?.label;

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      {/* Messages */}
      {form.message && (
        <Alert message={form.message} onClose={() => form.setMessage(null)} />
      )}

      {/* ═══════ DISCLAIMER ═══════ */}
      {form.step === 'disclaimer' && (
        <Disclaimer
          visible={true}
          onAccept={form.handleDisclaimerAccept}
          onBack={() => window.history.back()}
          tenantColors={tenantColors}
          tenantName={tenantName}
          eventName={eventName}
          eventFecha={eventFecha}
          eventVenue={eventVenue}
          fechaLimite={fechaLimite}
          contactEmail={contactEmail}
        />
      )}

      {/* ═══════ STEP INDICATOR ═══════ */}
      {form.disclaimerAccepted && form.step !== 'success' && (
        <>
          <StepIndicator currentStep={form.step} tipoMedioLabel={tipoMedioLabel} />
          {/* Multi-day event info banner */}
          {eventType === 'multidia' && eventDays && eventDays.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold mb-2">
                <i className="fas fa-calendar-week mr-1.5" />
                Evento multidía — {eventDays.length} jornadas
              </p>
              <div className="flex flex-wrap gap-2">
                {eventDays.map(d => (
                  <span key={d.id} className="inline-flex items-center gap-1.5 text-xs bg-amber-100 text-amber-800 rounded-full px-2.5 py-1 font-medium">
                    <i className="fas fa-circle text-[5px]" />
                    {d.label || new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                  </span>
                ))}
              </div>
              <p className="text-xs text-amber-600 mt-2">
                Al inscribirte quedarás registrado para todas las jornadas.
              </p>
            </div>
          )}
        </>
      )}

      {/* ═══════ PASO 1 — RESPONSABLE ═══════ */}
      {form.step === 'responsable' && (
        <StepResponsable
          responsable={form.responsable}
          respErrors={form.respErrors}
          respTouched={form.respTouched}
          getRespInputClass={form.getRespInputClass}
          handleRespChange={form.handleRespChange}
          handleRespBlur={form.handleRespBlur}
          handleResponsableSubmit={form.handleResponsableSubmit}
          goBack={() => form.goBack('disclaimer')}
          tenantColors={tenantColors}
          eventName={eventName}
          userProfile={userProfile}
        />
      )}

      {/* ═══════ PASO 2 — TIPO DE MEDIO ═══════ */}
      {form.step === 'medio' && (
        <StepTipoMedio
          tipoMedio={form.tipoMedio}
          tiposMedioOptions={form.tiposMedioOptions}
          quotaResult={form.quotaResult}
          responsable={form.responsable}
          handleMedioSelect={form.handleMedioSelect}
          handleMedioSubmit={form.handleMedioSubmit}
          goBack={() => form.goBack('responsable')}
          tenantColors={tenantColors}
          fieldLabel={tipoMedioLabel}
        />
      )}

      {/* ═══════ PASO 3 — ACREDITADOS ═══════ */}
      {form.step === 'acreditados' && (
        <StepAcreditados
          responsable={form.responsable}
          tipoMedio={form.tipoMedio}
          acreditados={form.acreditados}
          acreditadoErrors={form.acreditadoErrors}
          bulkRows={form.bulkRows}
          setBulkRows={form.setBulkRows}
          maxCupos={form.maxCupos}
          incluirmeDone={form.incluirmeDone}
          quotaResult={form.quotaResult}
          teamMembers={form.teamMembers}
          showTeamPicker={form.showTeamPicker}
          setShowTeamPicker={form.setShowTeamPicker}
          bulkEnabled={bulkEnabled}
          formFields={form.formFields}
          submitting={form.submitting}
          tenantColors={tenantColors}
          handleIncluirme={form.handleIncluirme}
          handleAddAcreditado={form.handleAddAcreditado}
          handleRemoveAcreditado={form.handleRemoveAcreditado}
          handleAcreditadoChange={form.handleAcreditadoChange}
          handleAcreditadoDynamicChange={form.handleAcreditadoDynamicChange}
          handleAcreditadoBlur={form.handleAcreditadoBlur}
          handleAddFromTeam={form.handleAddFromTeam}
          handleAddAllTeam={form.handleAddAllTeam}
          handleFileImport={form.handleFileImport}
          downloadTemplate={form.downloadTemplate}
          handleSubmit={form.handleSubmit}
          goBack={() => form.goBack('medio')}
        />
      )}

      {/* ═══════ SUCCESS ═══════ */}
      {form.step === 'success' && (
        <SuccessView
          submitResults={form.submitResults}
          tenantSlug={tenantSlug}
          tenantColors={tenantColors}
          resetForm={form.resetForm}
        />
      )}

      {/* ═══════ CONFIRM MODAL ═══════ */}
      <ConfirmModal
        open={form.showConfirmModal}
        onClose={() => form.setShowConfirmModal(false)}
        responsable={form.responsable}
        tipoMedio={form.tipoMedio}
        acreditados={form.acreditados}
        bulkRows={form.bulkRows}
        submitting={form.submitting}
        tenantColors={tenantColors}
        onConfirm={form.handleConfirmedSubmit}
        tipoMedioLabel={tipoMedioLabel}
      />

      {/* ═══════ SUBMIT PROGRESS OVERLAY (portal) ═══════ */}
      {form.submitting && form.submitProgress && <SubmitProgressOverlay progress={form.submitProgress} tenantColors={tenantColors} />}
    </div>
  );
}
