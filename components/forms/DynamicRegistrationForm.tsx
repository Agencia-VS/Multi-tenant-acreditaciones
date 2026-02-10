'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FormFieldDefinition, Profile, TeamMember } from '@/types';
import { TIPOS_MEDIO, CARGOS } from '@/types';
import { useQuotaCheck } from '@/hooks/useQuotaCheck';
import { Alert, LoadingSpinner } from '@/components/shared/ui';

interface DynamicRegistrationFormProps {
  eventId: string;
  eventName: string;
  formFields: FormFieldDefinition[];
  tenantColors: {
    primario: string;
    secundario: string;
  };
  tenantSlug: string;
  userProfile: Partial<Profile> | null;
  onSuccess?: () => void;
}

type AccreditationTarget = 'self' | 'team' | 'new';
type Step = 'choose' | 'team-select' | 'form' | 'success';

/**
 * Formulario Dinámico de Inscripción v2
 * 
 * Flujo seguro post-login:
 * 1. ¿A quién acreditar? → "A mí mismo" / "A mi equipo" / "A alguien nuevo"
 * 2. Formulario con datos precargados según la opción
 * 3. Verificación de cupos en tiempo real
 * 4. Confirmación
 */
export default function DynamicRegistrationForm({
  eventId,
  eventName,
  formFields,
  tenantColors,
  tenantSlug,
  userProfile,
  onSuccess,
}: DynamicRegistrationFormProps) {
  const { quotaResult, checkQuota } = useQuotaCheck(eventId);

  const [step, setStep] = useState<Step>('choose');
  const [target, setTarget] = useState<AccreditationTarget | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({
    rut: '',
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    cargo: '',
    organizacion: '',
    tipo_medio: '',
  });
  const [dynamicData, setDynamicData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ─── Team state ───
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ name: string; ok: boolean; msg: string }[]>([]);

  // Pre-fill formData from profile helper
  const prefillFromProfile = useCallback((profile: Partial<Profile>) => {
    setFormData((prev) => ({
      ...prev,
      rut: (profile.rut as string) || prev.rut,
      nombre: (profile.nombre as string) || prev.nombre,
      apellido: (profile.apellido as string) || prev.apellido,
      email: (profile.email as string) || prev.email,
      telefono: (profile.telefono as string) || prev.telefono,
      cargo: (profile.cargo as string) || prev.cargo,
      organizacion: (profile.medio as string) || prev.organizacion,
      tipo_medio: (profile.tipo_medio as string) || prev.tipo_medio,
    }));

    if (profile.datos_base && typeof profile.datos_base === 'object') {
      const db = profile.datos_base as Record<string, string>;
      const newDynamic: Record<string, string> = {};
      formFields.forEach((field) => {
        if (field.profile_field?.startsWith('datos_base.')) {
          const key = field.profile_field.split('.')[1];
          if (db[key]) newDynamic[field.key] = db[key];
        }
      });
      setDynamicData((prev) => ({ ...prev, ...newDynamic }));
    }
  }, [formFields]);

  // Verificar cupos al cambiar tipo_medio u organización
  useEffect(() => {
    if (formData.tipo_medio && formData.organizacion) {
      checkQuota(formData.tipo_medio, formData.organizacion);
    }
  }, [formData.tipo_medio, formData.organizacion, checkQuota]);

  // ─── Handlers ───

  const handleChoose = (choice: AccreditationTarget) => {
    setTarget(choice);
    setMessage(null);

    if (choice === 'self') {
      // Auto-fill from user's own profile
      if (userProfile) {
        prefillFromProfile(userProfile);
      }
      setStep('form');
    } else if (choice === 'team') {
      // Load team members
      loadTeamMembers();
      setStep('team-select');
    } else {
      // New person — empty form
      setFormData({ rut: '', nombre: '', apellido: '', email: '', telefono: '', cargo: '', organizacion: '', tipo_medio: '' });
      setDynamicData({});
      setStep('form');
    }
  };

  const loadTeamMembers = async () => {
    setTeamLoading(true);
    try {
      const res = await fetch('/api/teams');
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data);
      }
    } catch { /* ignore */ } finally {
      setTeamLoading(false);
    }
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTeamSubmit = async () => {
    if (selectedMembers.size === 0) return;
    setBulkSubmitting(true);
    setBulkResults([]);
    const results: { name: string; ok: boolean; msg: string }[] = [];

    for (const memberId of selectedMembers) {
      const member = teamMembers.find((m) => m.id === memberId);
      if (!member?.member_profile) continue;

      const mp = member.member_profile;
      try {
        const res = await fetch('/api/registrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventId,
            rut: mp.rut,
            nombre: mp.nombre,
            apellido: mp.apellido,
            email: mp.email || '',
            telefono: mp.telefono || '',
            cargo: mp.cargo || '',
            organizacion: mp.medio || '',
            tipo_medio: mp.tipo_medio || '',
            datos_extra: {},
            submitted_by: userProfile?.id || undefined,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          results.push({ name: `${mp.nombre} ${mp.apellido}`, ok: true, msg: 'Registrado' });
        } else {
          results.push({ name: `${mp.nombre} ${mp.apellido}`, ok: false, msg: data.error || 'Error' });
        }
      } catch {
        results.push({ name: `${mp.nombre} ${mp.apellido}`, ok: false, msg: 'Error de conexión' });
      }
    }

    setBulkResults(results);
    setBulkSubmitting(false);
    if (results.every((r) => r.ok)) {
      setStep('success');
      onSuccess?.();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          rut: formData.rut,
          nombre: formData.nombre,
          apellido: formData.apellido,
          email: formData.email,
          telefono: formData.telefono,
          cargo: formData.cargo,
          organizacion: formData.organizacion,
          tipo_medio: formData.tipo_medio,
          datos_extra: dynamicData,
          submitted_by: userProfile?.id || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Error al enviar solicitud' });
        return;
      }

      setStep('success');
      onSuccess?.();
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  const getMissingFields = (fields: FormFieldDefinition[]): FormFieldDefinition[] => {
    const profileToCheck = target === 'self' ? userProfile : null;
    if (!profileToCheck) return fields;

    return fields.filter((field) => {
      if (!field.profile_field) return true;
      const parts = field.profile_field.split('.');
      let value: unknown = profileToCheck;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[part];
        } else {
          value = undefined;
          break;
        }
      }
      return !value || value === '' || value === null;
    });
  };

  const resetForm = () => {
    setStep('choose');
    setTarget(null);
    setFormData({ rut: '', nombre: '', apellido: '', email: '', telefono: '', cargo: '', organizacion: '', tipo_medio: '' });
    setDynamicData({});
    setMessage(null);
    setSelectedMembers(new Set());
    setBulkResults([]);
  };

  const missingFields = getMissingFields(formFields);
  const inputClass = 'w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 text-base';
  const labelClass = 'block text-sm font-semibold text-gray-700 mb-1';

  // ═══════════════════════════════════════════════════════════════════════
  // STEP: CHOOSE — ¿A quién deseas acreditar?
  // ═══════════════════════════════════════════════════════════════════════
  if (step === 'choose') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">¿A quién deseas acreditar?</h2>
          <p className="text-gray-500 mt-1">{eventName}</p>
          {userProfile && (
            <p className="text-sm text-gray-400 mt-2">
              Conectado como <strong className="text-gray-600">{userProfile.nombre} {userProfile.apellido}</strong>
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Opción 1: A mí mismo */}
          <button
            onClick={() => handleChoose('self')}
            className="bg-white rounded-xl shadow-md border-2 border-transparent hover:border-blue-400 hover:shadow-lg transition-all p-6 text-left group"
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${tenantColors.primario}20` }}
            >
              <i className="fas fa-user text-xl" style={{ color: tenantColors.primario }} />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">A mí mismo</h3>
            <p className="text-gray-400 text-sm mt-1">
              Tus datos se precargan automáticamente
            </p>
          </button>

          {/* Opción 2: A mi equipo */}
          <button
            onClick={() => handleChoose('team')}
            className="bg-white rounded-xl shadow-md border-2 border-transparent hover:border-purple-400 hover:shadow-lg transition-all p-6 text-left group"
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 bg-purple-50"
            >
              <i className="fas fa-users text-xl text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">A mi equipo</h3>
            <p className="text-gray-400 text-sm mt-1">
              Selecciona miembros de tus frecuentes
            </p>
          </button>

          {/* Opción 3: A alguien nuevo */}
          <button
            onClick={() => handleChoose('new')}
            className="bg-white rounded-xl shadow-md border-2 border-transparent hover:border-green-400 hover:shadow-lg transition-all p-6 text-left group"
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 bg-green-50"
            >
              <i className="fas fa-user-plus text-xl text-green-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">A alguien nuevo</h3>
            <p className="text-gray-400 text-sm mt-1">
              Ingresa los datos manualmente
            </p>
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP: TEAM-SELECT — Seleccionar miembros del equipo
  // ═══════════════════════════════════════════════════════════════════════
  if (step === 'team-select') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Selecciona tu equipo</h2>
            <p className="text-gray-500 text-sm mt-1">{eventName}</p>
          </div>
          <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-sm">
            <i className="fas fa-arrow-left mr-1" /> Volver
          </button>
        </div>

        {teamLoading ? (
          <div className="text-center py-12">
            <LoadingSpinner size="lg" />
            <p className="text-gray-400 mt-4">Cargando equipo...</p>
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <i className="fas fa-users text-4xl text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg mb-2">No tienes miembros en tu equipo</p>
            <p className="text-gray-400 text-sm mb-4">
              Agrega frecuentes desde tu{' '}
              <a href="/acreditado/equipo" className="text-blue-600 hover:underline">panel de equipo</a>
            </p>
            <button onClick={resetForm} className="text-blue-600 hover:underline text-sm">
              <i className="fas fa-arrow-left mr-1" /> Elegir otra opción
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {teamMembers.map((member) => {
                const mp = member.member_profile;
                const isSelected = selectedMembers.has(member.id);
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-purple-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                          isSelected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {isSelected ? (
                          <i className="fas fa-check" />
                        ) : (
                          mp?.nombre?.charAt(0) || '?'
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">
                          {mp?.nombre} {mp?.apellido}
                          {member.alias && member.alias !== `${mp?.nombre} ${mp?.apellido}` && (
                            <span className="text-gray-400 font-normal ml-2">({member.alias})</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {mp?.rut} · {mp?.medio || 'Sin medio'} · {mp?.cargo || 'Sin cargo'}
                        </p>
                      </div>
                      {mp?.tipo_medio && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {mp.tipo_medio}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bulk results */}
            {bulkResults.length > 0 && (
              <div className="mb-4 space-y-2">
                {bulkResults.map((r, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg text-sm ${r.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                  >
                    <i className={`fas ${r.ok ? 'fa-check-circle' : 'fa-times-circle'} mr-2`} />
                    <strong>{r.name}:</strong> {r.msg}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleTeamSubmit}
              disabled={selectedMembers.size === 0 || bulkSubmitting}
              className="w-full py-4 rounded-lg text-white font-bold text-lg transition disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: tenantColors.primario }}
            >
              {bulkSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" /> Enviando {selectedMembers.size} solicitudes...
                </span>
              ) : (
                <>
                  <i className="fas fa-paper-plane mr-2" />
                  Acreditar {selectedMembers.size} persona{selectedMembers.size !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP: SUCCESS
  // ═══════════════════════════════════════════════════════════════════════
  if (step === 'success') {
    return (
      <div className="max-w-md mx-auto text-center">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-check text-green-600 text-2xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {target === 'team' ? 'Equipo Acreditado' : 'Solicitud Enviada'}
          </h2>
          <p className="text-gray-500">
            {target === 'team'
              ? 'Las solicitudes de acreditación de tu equipo han sido enviadas.'
              : 'Tu solicitud de acreditación ha sido recibida. Te notificaremos por email cuando sea procesada.'}
          </p>
          <div className="flex flex-col gap-3 mt-6">
            <a
              href="/acreditado/dashboard"
              className="px-6 py-2 rounded-lg text-white font-semibold text-center"
              style={{ backgroundColor: tenantColors.primario }}
            >
              <i className="fas fa-list-check mr-2" />
              Ver Mis Acreditaciones
            </a>
            <div className="flex gap-3 justify-center">
              <button
                onClick={resetForm}
                className="px-6 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold hover:bg-gray-50 transition"
              >
                Nueva Solicitud
              </button>
              <a
                href={`/${tenantSlug}`}
                className="px-6 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold hover:bg-gray-50 transition"
              >
                Volver al Inicio
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP: FORM — Formulario individual (self o new)
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="text-center flex-1">
          <h2 className="text-2xl font-bold text-gray-900">Formulario de Acreditación</h2>
          <p className="text-gray-500">{eventName}</p>
          {target === 'self' && userProfile && (
            <div className="mt-2 inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
              <i className="fas fa-user-check mr-2" />
              Datos precargados desde tu perfil
            </div>
          )}
          {target === 'new' && (
            <div className="mt-2 inline-flex items-center px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
              <i className="fas fa-user-plus mr-2" />
              Registro para una persona nueva
            </div>
          )}
        </div>
        <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-sm ml-4">
          <i className="fas fa-arrow-left mr-1" /> Volver
        </button>
      </div>

      {message && <Alert message={message} onClose={() => setMessage(null)} />}

      {/* Indicador de cupo */}
      {quotaResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${quotaResult.available ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <i className={`fas ${quotaResult.available ? 'fa-check-circle' : 'fa-exclamation-triangle'} mr-2`} />
          {quotaResult.message}
          {quotaResult.max_org > 0 && (
            <span className="ml-2 font-semibold">
              ({quotaResult.used_org}/{quotaResult.max_org} por organización)
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 space-y-6">
        {/* Sección: Datos Personales */}
        <fieldset>
          <legend className="text-lg font-bold text-gray-900 mb-3 flex items-center">
            <i className="fas fa-user mr-2 text-blue-500" /> Datos Personales
          </legend>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>RUT *</label>
              <input
                type="text"
                value={formData.rut}
                onChange={(e) => setFormData({...formData, rut: e.target.value})}
                readOnly={target === 'self' && !!userProfile?.rut}
                required
                placeholder="12.345.678-9"
                className={`${inputClass} ${target === 'self' && !!userProfile?.rut ? 'bg-gray-50 cursor-not-allowed' : ''}`}
              />
              {target === 'self' && !userProfile?.rut && (
                <p className="text-xs text-amber-600 mt-1"><i className="fas fa-info-circle mr-1" />Tu perfil no tiene RUT, ingrésalo manualmente</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Nombre *</label>
              <input type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Apellido *</label>
              <input type="text" value={formData.apellido} onChange={(e) => setFormData({...formData, apellido: e.target.value})} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input type="tel" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} className={inputClass} />
            </div>
          </div>
        </fieldset>

        {/* Sección: Datos Profesionales */}
        <fieldset>
          <legend className="text-lg font-bold text-gray-900 mb-3 flex items-center">
            <i className="fas fa-briefcase mr-2 text-purple-500" /> Datos Profesionales
          </legend>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Organización / Medio *</label>
              <input type="text" value={formData.organizacion} onChange={(e) => setFormData({...formData, organizacion: e.target.value})} required placeholder="Ej: Canal 13, Radio ADN" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Tipo de Medio *</label>
              <select value={formData.tipo_medio} onChange={(e) => setFormData({...formData, tipo_medio: e.target.value})} required className={inputClass}>
                <option value="">Selecciona...</option>
                {TIPOS_MEDIO.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Cargo *</label>
              <select value={formData.cargo} onChange={(e) => setFormData({...formData, cargo: e.target.value})} required className={inputClass}>
                <option value="">Selecciona...</option>
                {CARGOS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </fieldset>

        {/* Sección: Campos Dinámicos (solo los faltantes) */}
        {missingFields.length > 0 && (
          <fieldset>
            <legend className="text-lg font-bold text-gray-900 mb-3 flex items-center">
              <i className="fas fa-clipboard-list mr-2 text-orange-500" /> Información Adicional
              {target === 'self' && <span className="ml-2 text-sm font-normal text-gray-400">(solo campos pendientes)</span>}
            </legend>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {missingFields
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((field) => (
                  <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <label className={labelClass}>
                      {field.label} {field.required && '*'}
                    </label>
                    {field.help_text && <p className="text-xs text-gray-400 mb-1">{field.help_text}</p>}
                    
                    {field.type === 'select' && field.options ? (
                      <select
                        value={dynamicData[field.key] || ''}
                        onChange={(e) => setDynamicData({...dynamicData, [field.key]: e.target.value})}
                        required={field.required}
                        className={inputClass}
                      >
                        <option value="">Selecciona...</option>
                        {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={dynamicData[field.key] || ''}
                        onChange={(e) => setDynamicData({...dynamicData, [field.key]: e.target.value})}
                        required={field.required}
                        placeholder={field.placeholder}
                        rows={3}
                        className={inputClass}
                      />
                    ) : field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={dynamicData[field.key] === 'true'}
                          onChange={(e) => setDynamicData({...dynamicData, [field.key]: e.target.checked ? 'true' : 'false'})}
                          className="w-5 h-5 rounded"
                        />
                        <span className="text-sm text-gray-600">{field.placeholder || field.label}</span>
                      </label>
                    ) : (
                      <input
                        type={field.type}
                        value={dynamicData[field.key] || ''}
                        onChange={(e) => setDynamicData({...dynamicData, [field.key]: e.target.value})}
                        required={field.required}
                        placeholder={field.placeholder}
                        className={inputClass}
                      />
                    )}
                  </div>
                ))}
            </div>
          </fieldset>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || (quotaResult !== null && !quotaResult.available)}
          className="w-full py-4 rounded-lg text-white font-bold text-lg transition disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: tenantColors.primario }}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" /> Enviando...
            </span>
          ) : (
            'Enviar Solicitud de Acreditación'
          )}
        </button>
      </form>
    </div>
  );
}
