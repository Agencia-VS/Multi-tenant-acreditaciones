'use client';

import type { Profile } from '@/types';
import type { ResponsableData } from './types';

interface StepResponsableProps {
  responsable: ResponsableData;
  respErrors: Record<string, string>;
  respTouched: Set<string>;
  getRespInputClass: (field: string) => string;
  handleRespChange: (field: string, value: string) => void;
  handleRespBlur: (field: string) => void;
  handleResponsableSubmit: (e: React.FormEvent) => void;
  goBack: () => void;
  tenantColors: { primario: string; secundario: string };
  eventName: string;
  userProfile: Partial<Profile> | null;
}

export default function StepResponsable({
  responsable,
  respErrors,
  respTouched,
  getRespInputClass,
  handleRespChange,
  handleRespBlur,
  handleResponsableSubmit,
  goBack,
  tenantColors,
  eventName,
  userProfile,
}: StepResponsableProps) {
  return (
    <form onSubmit={handleResponsableSubmit} className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Section Card */}
      <div className="rounded-2xl border border-edge bg-surface/30 overflow-hidden">
        {/* Section Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-edge/50 bg-surface/60">
          <div className="flex items-center gap-3 sm:gap-4">
            <span
              className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl text-white font-bold text-base sm:text-lg shrink-0"
              style={{ backgroundColor: tenantColors.primario }}
            >
              1
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-heading">Responsable de acreditación</h2>
              <p className="text-xs sm:text-sm text-muted">Persona que gestiona las solicitudes de prensa para este evento</p>
            </div>
          </div>
        </div>

        {/* Event badge */}
        <div className="flex items-center justify-center px-4 sm:px-6 pt-4 sm:pt-5">
          <span className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-surface border border-edge text-xs sm:text-sm text-body">
            <i className="fas fa-calendar-alt text-brand" />
            <span className="truncate max-w-[200px] sm:max-w-none">{eventName}</span>
          </span>
        </div>

        {/* Form fields */}
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tipo documento */}
            <div>
              <label className="field-label">Tipo documento *</label>
              <select
                value={responsable.document_type || 'rut'}
                onChange={(e) => handleRespChange('document_type', e.target.value)}
                onBlur={() => handleRespBlur('document_type')}
                className={getRespInputClass('document_type')}
              >
                <option value="rut">RUT (Chile)</option>
                <option value="dni_extranjero">DNI / Pasaporte (Extranjero)</option>
              </select>
            </div>

            {/* Documento */}
            <div>
              <label className="field-label">{(responsable.document_type || 'rut') === 'rut' ? 'RUT *' : 'Documento *'}</label>
              <div className="relative">
                <input
                  type="text"
                  value={responsable.rut}
                  onChange={(e) => handleRespChange('rut', e.target.value)}
                  onBlur={() => handleRespBlur('rut')}
                  placeholder={(responsable.document_type || 'rut') === 'rut' ? '12.345.678-9' : 'Ej: AB1234567'}
                  className={`${getRespInputClass('rut')} pr-10`}
                />
                {respTouched.has('rut') && responsable.rut && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {respErrors.rut
                      ? <i className="fas fa-times-circle text-danger" />
                      : <i className="fas fa-check-circle text-success" />}
                  </span>
                )}
              </div>
              {respErrors.rut && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {respErrors.rut}</p>}
            </div>

            {/* Nombre */}
            <div>
              <label className="field-label">Nombre *</label>
              <input
                type="text"
                value={responsable.nombre}
                onChange={(e) => handleRespChange('nombre', e.target.value)}
                onBlur={() => handleRespBlur('nombre')}
                placeholder="Juan"
                className={getRespInputClass('nombre')}
              />
              {respErrors.nombre && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {respErrors.nombre}</p>}
            </div>

            {/* Apellido */}
            <div>
              <label className="field-label">Primer Apellido *</label>
              <input
                type="text"
                value={responsable.apellido}
                onChange={(e) => handleRespChange('apellido', e.target.value)}
                onBlur={() => handleRespBlur('apellido')}
                placeholder="Pérez"
                className={getRespInputClass('apellido')}
              />
              {respErrors.apellido && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {respErrors.apellido}</p>}
            </div>

            {/* Segundo Apellido */}
            <div>
              <label className="field-label">Segundo Apellido</label>
              <input
                type="text"
                value={responsable.segundo_apellido}
                onChange={(e) => handleRespChange('segundo_apellido', e.target.value)}
                placeholder="González"
                className="field-input"
              />
            </div>

            {/* Email */}
            <div>
              <label className="field-label">Email *</label>
              <div className="relative">
                <input
                  type="email"
                  value={responsable.email}
                  onChange={(e) => handleRespChange('email', e.target.value)}
                  onBlur={() => handleRespBlur('email')}
                  placeholder="correo@ejemplo.cl"
                  className={`${getRespInputClass('email')} pr-10`}
                />
                {respTouched.has('email') && responsable.email && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {respErrors.email
                      ? <i className="fas fa-times-circle text-danger" />
                      : <i className="fas fa-check-circle text-success" />}
                  </span>
                )}
              </div>
              {respErrors.email && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {respErrors.email}</p>}
            </div>

            {/* Teléfono */}
            <div>
              <label className="field-label">Teléfono</label>
              <input
                type="tel"
                value={responsable.telefono}
                onChange={(e) => handleRespChange('telefono', e.target.value)}
                onBlur={() => handleRespBlur('telefono')}
                placeholder="+56 9 1234 5678"
                className="field-input"
              />
            </div>

            {/* Organización */}
            <div>
              <label className="field-label">Organización / Medio *</label>
              <input
                type="text"
                value={responsable.organizacion}
                onChange={(e) => handleRespChange('organizacion', e.target.value)}
                onBlur={() => handleRespBlur('organizacion')}
                placeholder="Ej: Canal 13, Radio ADN"
                className={getRespInputClass('organizacion')}
              />
              {respErrors.organizacion && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {respErrors.organizacion}</p>}
            </div>
          </div>
        </div>
      </div>{/* close section card */}

      {/* ── Profile linked / Account invitation ── */}
      {userProfile ? (
        <div className="rounded-xl border border-success/30 bg-success/5 px-5 py-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-success/15 shrink-0">
            <i className="fas fa-link text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-success">Perfil vinculado</p>
            <p className="text-xs text-muted">
              Tus acreditaciones quedarán asociadas a tu cuenta. Podrás ver su estado desde el <strong>Portal de Acreditados</strong>.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-brand/20 bg-brand/5 px-5 py-4 flex items-start sm:items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand/15 shrink-0 mt-0.5 sm:mt-0">
            <i className="fas fa-user-shield text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-heading">¿Acreditas frecuentemente?</p>
            <p className="text-xs text-muted mt-0.5">
              <a href="/auth/acreditado" className="text-brand font-semibold hover:underline">Crea una cuenta</a> para guardar tu equipo, reutilizar datos y hacer seguimiento de tus solicitudes.
            </p>
          </div>
        </div>
      )}

      {/* Navegación */}
      <div className="flex gap-2 sm:gap-3">
        <button
          type="button"
          onClick={goBack}
          className="flex-1 py-3 sm:py-3.5 rounded-xl border border-edge text-body font-semibold hover:bg-subtle active:scale-[0.98] transition-snappy text-sm sm:text-base"
        >
          <i className="fas fa-arrow-left mr-1.5 text-xs" /> Volver
        </button>
        <button
          type="submit"
          className="flex-1 py-3 sm:py-3.5 rounded-xl text-white font-bold transition-snappy hover:brightness-110 active:scale-[0.98] text-sm sm:text-base"
          style={{ backgroundColor: tenantColors.primario }}
        >
          Siguiente <i className="fas fa-arrow-right ml-1.5 text-xs" />
        </button>
      </div>
    </form>
  );
}
