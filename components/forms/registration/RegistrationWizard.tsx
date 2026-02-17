'use client';

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
   Success View (inline — small enough to keep here)
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
  return (
    <div className="animate-fade-in text-center space-y-5 sm:space-y-6 px-2">
      <div className="flex justify-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center bg-success/15">
          <i className="fas fa-check text-3xl sm:text-4xl text-success" />
        </div>
      </div>
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-heading">¡Solicitud enviada!</h2>
        <p className="text-muted mt-2">
          {submitResults.filter(r => r.ok).length} de {submitResults.length} acreditaciones enviadas correctamente
        </p>
      </div>

      {submitResults.length > 0 && (
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
      )}

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
          <StepIndicator currentStep={form.step} />
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
      />
    </div>
  );
}
