'use client';

/**
 * Mi Perfil — Ver y editar datos personales del acreditado
 * El campo "Medio / Empresa" se usa para auto-rellenar al agregar miembros de equipo.
 * Usa la API /api/profiles/lookup (admin client) para evitar problemas de RLS.
 */
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { LoadingSpinner, ButtonSpinner, useToast } from '@/components/shared/ui';
import { formatRut, cleanRut, validateEmail, validatePhone, sanitize } from '@/lib/validation';
import { isProfileComplete, getMissingProfileFields, REQUIRED_PROFILE_FIELDS, isReadyToAccredit, getMissingAccreditationFields, ACCREDITATION_REQUIRED_FIELDS } from '@/lib/profile';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Profile {
  id: string;
  rut: string;
  nombre: string;
  apellido: string;
  email: string | null;
  telefono: string | null;
  medio: string | null;
  tipo_medio: string | null;
  cargo: string | null;
  foto_url: string | null;
  nacionalidad: string | null;
  datos_base: Record<string, unknown>;
}

interface FieldErrors {
  email?: string;
  telefono?: string;
}

export default function PerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const { showSuccess, showError } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const fromEquipo = searchParams.get('from') === 'equipo';

  /** Campos requeridos que aún faltan */
  const missingRequired = profile ? getMissingProfileFields(profile) : [];
  const missingAccreditation = profile ? getMissingAccreditationFields(profile) : [];
  const requiredKeys = new Set<string>(ACCREDITATION_REQUIRED_FIELDS.map(f => f.key));

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/profiles/lookup');
      const data = await res.json();
      if (data.found && data.profile) {
        setProfile(data.profile);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleBlur = (field: 'email' | 'telefono') => {
    if (!profile) return;
    const errors = { ...fieldErrors };

    if (field === 'email' && profile.email) {
      const result = validateEmail(profile.email);
      errors.email = result.valid ? undefined : result.error;
    }

    if (field === 'telefono' && profile.telefono) {
      const result = validatePhone(profile.telefono);
      errors.telefono = result.valid ? undefined : result.error;
    }

    setFieldErrors(errors);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    // Validar campos antes de guardar
    const errors: FieldErrors = {};
    if (profile.email) {
      const emailResult = validateEmail(profile.email);
      if (!emailResult.valid) errors.email = emailResult.error;
    }
    if (profile.telefono) {
      const phoneResult = validatePhone(profile.telefono);
      if (!phoneResult.valid) errors.telefono = phoneResult.error;
    }

    if (errors.email || errors.telefono) {
      setFieldErrors(errors);
      setMessage('Corrige los errores antes de guardar');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/profiles/lookup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: sanitize(profile.nombre),
          apellido: sanitize(profile.apellido),
          email: profile.email ? sanitize(profile.email) : null,
          telefono: profile.telefono ? sanitize(profile.telefono) : null,
          medio: profile.medio ? sanitize(profile.medio) : null,
          nacionalidad: profile.nacionalidad ? sanitize(profile.nacionalidad) : null,
          ...(profile.rut ? { rut: sanitize(profile.rut) } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Error al guardar');
        showError(data.error || 'Error al guardar');
      } else {
        setMessage('Perfil actualizado correctamente');
        showSuccess('Perfil actualizado correctamente');

        // Si vino desde equipo y ahora el perfil está completo → redirigir
        if (fromEquipo && profile) {
          const updated = {
            ...profile,
            nombre: sanitize(profile.nombre),
            apellido: sanitize(profile.apellido),
            medio: profile.medio ? sanitize(profile.medio) : null,
          };
          if (isProfileComplete(updated)) {
            setTimeout(() => router.push('/acreditado/equipo'), 1200);
          }
        }
      }
    } catch {
      setMessage('Error de conexión');
      showError('Error de conexión');
    }
    setSaving(false);
  };

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  if (!profile) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border max-w-md mx-auto">
        <i className="fas fa-user-circle text-5xl text-edge mb-4" />
        <p className="text-muted text-lg mb-2">Aún no tienes un perfil</p>
        <p className="text-muted text-sm mb-6">
          Completa tu registro para crear tu perfil y poder acreditarte a eventos.
        </p>
        <a
          href="/acreditado"
          className="inline-block px-6 py-2 bg-brand text-on-brand rounded-lg font-semibold hover:bg-brand-hover transition"
        >
          Ir al Dashboard
        </a>
      </div>
    );
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-field-border text-heading transition';
  const errorInputClass = 'w-full px-3 py-2 rounded-lg border border-danger text-heading ring-1 ring-danger';
  const missingInputClass = 'w-full px-3 py-2 rounded-lg border border-warning text-heading ring-1 ring-warning bg-warning-light/20';

  /** True si el campo es requerido para acreditación y está vacío */
  const isMissing = (key: string) => requiredKeys.has(key) && missingAccreditation.some(f => f.key === key);

  /** Label con badge de requerido si el campo falta */
  const RequiredLabel = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <label className="block text-sm font-medium text-label mb-1">
      {children}
      {isMissing(field) && (
        <span className="ml-2 text-xs text-warning font-semibold">
          <i className="fas fa-exclamation-circle mr-0.5" />Requerido
        </span>
      )}
    </label>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-heading">Mi Perfil</h1>
        <p className="text-body mt-1">Estos datos se usarán para pre-rellenar futuras acreditaciones</p>
      </div>

      {/* Banner: viene desde equipo con perfil incompleto */}
      {fromEquipo && missingRequired.length > 0 && (
        <div className="bg-warning-light border border-warning rounded-lg p-4 mb-6 flex items-start gap-3">
          <i className="fas fa-exclamation-triangle text-warning mt-0.5" />
          <div>
            <p className="font-semibold text-heading text-sm">Completa los campos marcados para acceder a tu equipo</p>
            <p className="text-body text-xs mt-1">
              Campos faltantes: {missingRequired.map(f => f.label).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Banner: perfil incompleto para acreditación */}
      {!fromEquipo && missingAccreditation.length > 0 && (
        <div className="bg-info-light border border-info rounded-lg p-4 mb-6 flex items-start gap-3">
          <i className="fas fa-info-circle text-info mt-0.5" />
          <div>
            <p className="font-semibold text-heading text-sm">Completa tu perfil para poder acreditarte</p>
            <p className="text-body text-xs mt-1">
              Campos faltantes: {missingAccreditation.map(f => f.label).join(', ')}
            </p>
          </div>
        </div>
      )}

      {message && (
        <div className={`p-3 rounded-lg text-sm mb-6 ${
          message.includes('Error') || message.includes('Corrige') ? 'bg-danger-light text-danger-dark' : 'bg-success-light text-success-dark'
        }`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-xl border p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 max-w-2xl">
        {/* Avatar */}
        <div className="flex items-center gap-4 sm:gap-6 pb-4 sm:pb-6 border-b">
          {profile.foto_url ? (
            <Image src={profile.foto_url} alt="" width={80} height={80} className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-accent-light flex items-center justify-center text-brand text-2xl font-bold">
              {(profile.nombre || '?').charAt(0)}{(profile.apellido || '?').charAt(0)}
            </div>
          )}
          <div>
            <p className="text-lg font-bold text-heading">
              {profile.nombre || profile.apellido
                ? `${profile.nombre || ''} ${profile.apellido || ''}`.trim()
                : <span className="text-muted italic">Sin nombre</span>}
            </p>
            {profile.rut && <p className="text-body font-mono text-sm">RUT: {formatRut(cleanRut(profile.rut))}</p>}
            {profile.email && <p className="text-body text-sm">{profile.email}</p>}
          </div>
        </div>

        {/* Datos personales */}
        <div>
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Datos Personales</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <RequiredLabel field="nombre">Nombre</RequiredLabel>
              <input
                type="text"
                required
                value={profile.nombre || ''}
                onChange={(e) => setProfile(prev => prev ? { ...prev, nombre: e.target.value } : null)}
                className={isMissing('nombre') ? missingInputClass : inputClass}
              />
            </div>
            <div>
              <RequiredLabel field="apellido">Apellido</RequiredLabel>
              <input
                type="text"
                required
                value={profile.apellido || ''}
                onChange={(e) => setProfile(prev => prev ? { ...prev, apellido: e.target.value } : null)}
                className={isMissing('apellido') ? missingInputClass : inputClass}
              />
            </div>
          </div>

          <div className="mt-4">
            <RequiredLabel field="rut">RUT</RequiredLabel>
            <input
              type="text"
              value={profile.rut ? formatRut(cleanRut(profile.rut)) : ''}
              onChange={(e) => {
                const raw = cleanRut(e.target.value);
                setProfile(prev => prev ? { ...prev, rut: raw } : null);
              }}
              placeholder="12.345.678-9"
              className={isMissing('rut') ? missingInputClass : inputClass}
              maxLength={12}
            />
            <p className="text-xs text-muted mt-1">Requerido para acreditarse a eventos</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-label mb-1">Email</label>
            <input
              type="email"
              value={profile.email || ''}
              onChange={(e) => { setProfile(prev => prev ? { ...prev, email: e.target.value } : null); if (fieldErrors.email) setFieldErrors(fe => ({ ...fe, email: undefined })); }}
              onBlur={() => handleBlur('email')}
              className={fieldErrors.email ? errorInputClass : inputClass}
            />
            {fieldErrors.email && <p className="text-danger text-xs mt-1"><i className="fas fa-exclamation-circle mr-1" />{fieldErrors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-label mb-1">Teléfono</label>
            <input
              type="tel"
              value={profile.telefono || ''}
              onChange={(e) => { setProfile(prev => prev ? { ...prev, telefono: e.target.value } : null); if (fieldErrors.telefono) setFieldErrors(fe => ({ ...fe, telefono: undefined })); }}
              onBlur={() => handleBlur('telefono')}
              className={fieldErrors.telefono ? errorInputClass : inputClass}
            />
            {fieldErrors.telefono && <p className="text-danger text-xs mt-1"><i className="fas fa-exclamation-circle mr-1" />{fieldErrors.telefono}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-label mb-1">Nacionalidad</label>
          <input
            type="text"
            value={profile.nacionalidad || ''}
            onChange={(e) => setProfile(prev => prev ? { ...prev, nacionalidad: e.target.value } : null)}
            className={inputClass}
          />
        </div>

        {/* Datos profesionales - destacado */}
        <div className="bg-accent-light/30 rounded-lg border border-accent-light p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-brand uppercase tracking-wider mb-1">Datos Profesionales</h3>
            <p className="text-xs text-accent">Tu medio/empresa se usará para auto-rellenar al agregar miembros a tu equipo</p>
          </div>

          <div>
            <RequiredLabel field="medio">
              Medio / Empresa
              <span className="text-accent text-xs ml-2"><i className="fas fa-magic mr-1" />Auto-rellena en equipo</span>
            </RequiredLabel>
            <input
              type="text"
              value={profile.medio || ''}
              onChange={(e) => setProfile(prev => prev ? { ...prev, medio: e.target.value } : null)}
              placeholder="ej: Canal 13, Radio ADN, ESPN Chile"
              className={isMissing('medio') ? missingInputClass : `${inputClass} border-accent-light`}
            />
          </div>
        </div>

        {/* Cambiar contraseña */}
        <div className="border-t pt-5">
          <button
            type="button"
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className="flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-hover transition"
          >
            <i className={`fas fa-chevron-${showPasswordSection ? 'down' : 'right'} text-xs`} />
            <i className="fas fa-lock text-sm" />
            Cambiar contraseña
          </button>

          {showPasswordSection && (
            <div className="mt-4 p-4 bg-surface rounded-lg border space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-label mb-1">Nueva contraseña</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    minLength={8}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-label mb-1">Confirmar contraseña</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    className={inputClass}
                  />
                </div>
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-danger text-xs"><i className="fas fa-exclamation-circle mr-1" />Las contraseñas no coinciden</p>
              )}
              <button
                type="button"
                disabled={passwordSaving || !newPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                onClick={async () => {
                  setPasswordSaving(true);
                  const supabase = getSupabaseBrowserClient();
                  const { error } = await supabase.auth.updateUser({ password: newPassword });
                  if (error) {
                    showError(error.message);
                  } else {
                    showSuccess('Contraseña actualizada');
                    setNewPassword('');
                    setConfirmPassword('');
                    setShowPasswordSection(false);
                  }
                  setPasswordSaving(false);
                }}
                className="px-4 py-2 bg-brand text-on-brand rounded-lg text-sm font-semibold hover:bg-brand-hover disabled:opacity-50 transition flex items-center gap-2"
              >
                {passwordSaving ? <><ButtonSpinner /> Actualizando...</> : 'Actualizar contraseña'}
              </button>
            </div>
          )}
        </div>

        <div className="pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-brand text-on-brand rounded-lg font-semibold hover:bg-brand-hover disabled:opacity-50 transition text-sm sm:text-base"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
