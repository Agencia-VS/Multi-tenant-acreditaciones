'use client';

/**
 * Mi Perfil — Ver y editar datos personales del acreditado
 * El campo "Medio / Empresa" se usa para auto-rellenar al agregar miembros de equipo.
 * Usa la API /api/profiles/lookup (admin client) para evitar problemas de RLS.
 */
import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/shared/ui';
import { TIPOS_MEDIO, CARGOS } from '@/types';
import { formatRut, cleanRut, validateEmail, validatePhone, sanitize } from '@/lib/validation';

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
          tipo_medio: profile.tipo_medio,
          cargo: profile.cargo,
          nacionalidad: profile.nacionalidad ? sanitize(profile.nacionalidad) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Error al guardar');
      } else {
        setMessage('Perfil actualizado correctamente');
      }
    } catch {
      setMessage('Error de conexión');
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
          Tu perfil se creará automáticamente al realizar tu primera acreditación,
          o puedes completar una solicitud desde el dashboard.
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-heading">Mi Perfil</h1>
        <p className="text-body mt-1">Estos datos se usarán para pre-rellenar futuras acreditaciones</p>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm mb-6 ${
          message.includes('Error') || message.includes('Corrige') ? 'bg-danger-light text-danger-dark' : 'bg-success-light text-success-dark'
        }`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-xl border p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 max-w-2xl">
        {/* Avatar + RUT */}
        <div className="flex items-center gap-4 sm:gap-6 pb-4 sm:pb-6 border-b">
          {profile.foto_url ? (
            <img src={profile.foto_url} alt="" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-accent-light flex items-center justify-center text-brand text-2xl font-bold">
              {profile.nombre.charAt(0)}{profile.apellido.charAt(0)}
            </div>
          )}
          <div>
            <p className="text-lg font-bold text-heading">{profile.nombre} {profile.apellido}</p>
            <p className="text-body font-mono text-sm">RUT: {formatRut(cleanRut(profile.rut))}</p>
          </div>
        </div>

        {/* Datos personales */}
        <div>
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Datos Personales</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-label mb-1">Nombre</label>
              <input
                type="text"
                required
                value={profile.nombre}
                onChange={(e) => setProfile(prev => prev ? { ...prev, nombre: e.target.value } : null)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-label mb-1">Apellido</label>
              <input
                type="text"
                required
                value={profile.apellido}
                onChange={(e) => setProfile(prev => prev ? { ...prev, apellido: e.target.value } : null)}
                className={inputClass}
              />
            </div>
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
            <label className="block text-sm font-medium text-label mb-1">
              Medio / Empresa
              <span className="text-accent text-xs ml-2"><i className="fas fa-magic mr-1" />Auto-rellena en equipo</span>
            </label>
            <input
              type="text"
              value={profile.medio || ''}
              onChange={(e) => setProfile(prev => prev ? { ...prev, medio: e.target.value } : null)}
              placeholder="ej: Canal 13, Radio ADN, ESPN Chile"
              className={`${inputClass} border-accent-light`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-label mb-1">Tipo de Medio</label>
              <select
                value={profile.tipo_medio || ''}
                onChange={(e) => setProfile(prev => prev ? { ...prev, tipo_medio: e.target.value || null } : null)}
                className={inputClass}
              >
                <option value="">Selecciona...</option>
                {TIPOS_MEDIO.map((tm) => (
                  <option key={tm} value={tm}>{tm}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-label mb-1">Cargo</label>
              <select
                value={profile.cargo || ''}
                onChange={(e) => setProfile(prev => prev ? { ...prev, cargo: e.target.value || null } : null)}
                className={inputClass}
              >
                <option value="">Selecciona...</option>
                {CARGOS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
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
