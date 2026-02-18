'use client';

/**
 * Gestión de Equipo / Frecuentes
 * 
 * El manager puede agregar, editar y eliminar miembros de su equipo.
 * Estos miembros aparecen como "frecuentes" al acreditar por equipo.
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TIPOS_MEDIO, CARGOS } from '@/types';
import type { TeamMember } from '@/types';
import { validateRut, cleanRut, formatRut } from '@/lib/validation';
import { isProfileComplete, getMissingProfileFields } from '@/lib/profile';
import { useToast, ConfirmDialog, ButtonSpinner } from '@/components/shared/ui';
import { useConfirmation } from '@/hooks';

interface MemberForm {
  rut: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  cargo: string;
  medio: string;
  tipo_medio: string;
  alias: string;
}

const emptyForm: MemberForm = {
  rut: '', nombre: '', apellido: '', email: '',
  telefono: '', cargo: '', medio: '', tipo_medio: '', alias: '',
};

export default function EquipoPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MemberForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();
  const { confirmation, confirm, cancel, execute } = useConfirmation();
  const [rutError, setRutError] = useState('');
  const [profileMedio, setProfileMedio] = useState('');
  const [profileTipoMedio, setProfileTipoMedio] = useState('');
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [missingFields, setMissingFields] = useState<Array<{ key: string; label: string }>>([]);

  // Cargar medio y tipo_medio del perfil del manager — se fuerzan en todos los miembros
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/profiles/lookup');
        const data = await res.json();
        if (data.found && data.profile) {
          if (data.profile.medio) setProfileMedio(data.profile.medio);
          if (data.profile.tipo_medio) setProfileTipoMedio(data.profile.tipo_medio);

          // Gate: verificar si el perfil está completo
          if (!isProfileComplete(data.profile)) {
            setProfileIncomplete(true);
            setMissingFields(getMissingProfileFields(data.profile));
          }
        } else {
          // No tiene perfil → bloquear
          setProfileIncomplete(true);
          setMissingFields(getMissingProfileFields(null));
        }
      } catch { /* ignore */ }
    };
    loadProfile();
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/teams');
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRutBlur = () => {
    if (!form.rut.trim()) {
      setRutError('');
      return;
    }
    const result = validateRut(form.rut);
    if (result.valid && result.formatted) {
      setForm(prev => ({ ...prev, rut: result.formatted! }));
      setRutError('');
    } else {
      // Intentar formatear de todas formas
      const cleaned = cleanRut(form.rut);
      setForm(prev => ({ ...prev, rut: formatRut(cleaned) }));
      setRutError(result.error || 'RUT inválido');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Validar RUT antes de enviar
    const rutResult = validateRut(form.rut);
    if (!rutResult.valid) {
      setRutError(rutResult.error || 'RUT inválido');
      setSaving(false);
      return;
    }

    try {
      const cleanedForm = {
        ...form,
        rut: rutResult.formatted || form.rut,
        medio: profileMedio || form.medio,
        tipo_medio: profileTipoMedio || form.tipo_medio,
      };
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedForm),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Error al agregar miembro');
        setSaving(false);
        return;
      }

      showSuccess(`${form.nombre} ${form.apellido} agregado al equipo`);
      setForm({ ...emptyForm, medio: profileMedio, tipo_medio: profileTipoMedio });
      setShowForm(false);
      setRutError('');
      await loadMembers();
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (memberId: string, memberName: string) => {
    confirm({
      title: '¿Eliminar miembro?',
      message: `${memberName} será eliminado de tu equipo. Podrás volver a agregarlo después.`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
      onConfirm: async () => {
        setDeletingId(memberId);
        try {
          const res = await fetch(`/api/teams?member_id=${memberId}`, { method: 'DELETE' });
          if (res.ok) {
            setMembers((prev) => prev.filter((m) => m.id !== memberId));
            showSuccess(`${memberName} eliminado del equipo`);
          } else {
            const data = await res.json();
            showError(data.error || 'Error al eliminar');
          }
        } catch {
          showError('Error de conexión');
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const inputClass = 'w-full px-4 py-3 rounded-lg border border-field-border text-heading transition';
  const labelClass = 'block text-sm font-semibold text-label mb-1';

  return (
    <div>
      {/* Gate: perfil incompleto → banner bloqueante */}
      {profileIncomplete && (
        <div className="max-w-2xl mx-auto mt-8">
          <div className="bg-warning-light border border-warning rounded-xl p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-warning/20 rounded-full flex items-center justify-center mx-auto">
              <i className="fas fa-exclamation-triangle text-warning text-2xl" />
            </div>
            <h2 className="text-xl font-bold text-heading">Completa tu perfil</h2>
            <p className="text-body">
              Para gestionar tu equipo necesitas completar los siguientes datos en tu perfil:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {missingFields.map(({ key, label }) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-warning/10 text-warning-dark rounded-full text-sm font-medium"
                >
                  <i className="fas fa-circle text-[6px]" />
                  {label}
                </span>
              ))}
            </div>
            <Link
              href="/acreditado/perfil?from=equipo"
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-on-brand rounded-lg font-semibold hover:bg-brand-hover transition"
            >
              <i className="fas fa-user-edit" />
              Completar Perfil
            </Link>
          </div>
        </div>
      )}

      {/* Contenido del equipo — oculto si perfil incompleto */}
      {!profileIncomplete && (<>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-heading">Mi Equipo</h1>
          <p className="text-body mt-1">
            Gestiona tus frecuentes para acreditarlos rápidamente
          </p>
        </div>
        <button
          onClick={() => {
            if (!showForm) {
              setForm(prev => ({
                ...prev,
                medio: profileMedio || prev.medio,
                tipo_medio: profileTipoMedio || prev.tipo_medio,
              }));
            }
            setShowForm(!showForm); setRutError('');
          }}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
            showForm
              ? 'bg-subtle text-label hover:bg-edge'
              : 'bg-brand text-on-brand hover:bg-brand-hover'
          }`}
        >
          {showForm ? (
            <><i className="fas fa-times mr-2" />Cancelar</>
          ) : (
            <><i className="fas fa-user-plus mr-2" />Agregar Miembro</>
          )}
        </button>
      </div>

      {/* ConfirmDialog para eliminar */}
      <ConfirmDialog {...confirmation} onConfirm={execute} onCancel={cancel} />

      {/* Add Member Form */}
      {showForm && (
        <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6 mb-6">
          <h3 className="text-lg font-bold text-heading mb-4">
            <i className="fas fa-user-plus mr-2 text-brand" />Nuevo Miembro
          </h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>RUT *</label>
                <input
                  type="text"
                  required
                  placeholder="12.345.678-9"
                  value={form.rut}
                  onChange={(e) => { setForm({ ...form, rut: e.target.value }); if (rutError) setRutError(''); }}
                  onBlur={handleRutBlur}
                  className={`${inputClass} ${rutError ? 'border-danger ring-1 ring-danger' : ''}`}
                />
                {rutError && (
                  <p className="text-danger text-xs mt-1"><i className="fas fa-exclamation-circle mr-1" />{rutError}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Nombre *</label>
                <input
                  type="text"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Apellido *</label>
                <input
                  type="text"
                  required
                  value={form.apellido}
                  onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Teléfono</label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Alias (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: camarógrafo principal"
                  value={form.alias}
                  onChange={(e) => setForm({ ...form, alias: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>
                  Medio / Organización
                  {profileMedio && <i className="fas fa-lock text-xs text-brand ml-2" title="Heredado de tu perfil" />}
                </label>
                {profileMedio ? (
                  <div className={`${inputClass} bg-canvas text-body cursor-not-allowed`}>
                    {profileMedio}
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Ej: Canal 13"
                    value={form.medio}
                    onChange={(e) => setForm({ ...form, medio: e.target.value })}
                    className={inputClass}
                  />
                )}
              </div>
              <div>
                <label className={labelClass}>
                  Tipo de Medio
                  {profileTipoMedio && <i className="fas fa-lock text-xs text-brand ml-2" title="Heredado de tu perfil" />}
                </label>
                {profileTipoMedio ? (
                  <div className={`${inputClass} bg-canvas text-body cursor-not-allowed`}>
                    {profileTipoMedio}
                  </div>
                ) : (
                  <select
                    value={form.tipo_medio}
                    onChange={(e) => setForm({ ...form, tipo_medio: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Selecciona...</option>
                    {TIPOS_MEDIO.map((tm) => (
                      <option key={tm} value={tm}>{tm}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className={labelClass}>Cargo</label>
                <select
                  value={form.cargo}
                  onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Selecciona...</option>
                  {CARGOS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm({ ...emptyForm, medio: profileMedio, tipo_medio: profileTipoMedio }); setRutError(''); }}
                className="px-4 py-2 text-body hover:text-heading transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-brand text-on-brand rounded-lg font-semibold hover:bg-brand-hover disabled:opacity-50 transition"
              >
                {saving ? 'Guardando...' : 'Agregar al Equipo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Members List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted mt-4">Cargando equipo...</p>
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <i className="fas fa-users text-5xl text-edge mb-4" />
          <p className="text-muted text-lg mb-2">Tu equipo está vacío</p>
          <p className="text-muted text-sm">
            Agrega miembros frecuentes para acreditarlos rápidamente en cualquier evento.
          </p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 px-6 py-2 bg-brand text-on-brand rounded-lg font-semibold hover:bg-brand-hover transition"
            >
              <i className="fas fa-user-plus mr-2" />Agregar Primer Miembro
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">{members.length} miembro{members.length !== 1 ? 's' : ''} en tu equipo</p>
          {members.map((member) => {
            const mp = member.member_profile;
            return (
              <div
                key={member.id}
                className="bg-white rounded-xl border p-5 hover:shadow-sm transition"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00C48C] to-[#00A676] flex items-center justify-center text-on-brand font-bold text-lg flex-shrink-0">
                    {mp?.nombre?.charAt(0)}{mp?.apellido?.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-heading">
                      {mp?.nombre} {mp?.apellido}
                      {member.alias && member.alias !== `${mp?.nombre} ${mp?.apellido}` && (
                        <span className="text-muted font-normal text-sm ml-2">({member.alias})</span>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-body mt-1">
                      <span><i className="fas fa-id-card mr-1 text-muted" />{mp?.rut}</span>
                      {mp?.email && <span><i className="fas fa-envelope mr-1 text-muted" />{mp.email}</span>}
                      {mp?.medio && <span><i className="fas fa-building mr-1 text-muted" />{mp.medio}</span>}
                      {mp?.cargo && <span><i className="fas fa-briefcase mr-1 text-muted" />{mp.cargo}</span>}
                    </div>
                  </div>

                  {/* Tags */}
                  {mp?.tipo_medio && (
                    <span className="px-3 py-1 bg-accent-light text-brand text-xs font-medium rounded-full flex-shrink-0">
                      {mp.tipo_medio}
                    </span>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(member.id, `${mp?.nombre} ${mp?.apellido}`)}
                    disabled={deletingId === member.id}
                    className="text-muted hover:text-danger transition flex-shrink-0 p-2"
                    title="Eliminar del equipo"
                  >
                    {deletingId === member.id ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <i className="fas fa-trash-alt" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>)}
    </div>
  );
}
