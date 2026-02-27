'use client';

/**
 * Gestión de Equipo / Frecuentes
 * 
 * El manager puede agregar, editar y eliminar miembros de su equipo.
 * Estos miembros aparecen como "frecuentes" al acreditar por equipo.
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CARGOS } from '@/types';
import type { TeamMember } from '@/types';
import { validateDocumentByType, cleanRut, formatRut } from '@/lib/validation';
import { isProfileComplete, getMissingProfileFields } from '@/lib/profile';
import { useToast, ConfirmDialog, ButtonSpinner, LoadingSpinner } from '@/components/shared/ui';
import { useConfirmation } from '@/hooks';

interface MemberForm {
  document_type: 'rut' | 'dni_extranjero';
  document_number: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  cargo: string;
  medio: string;
  alias: string;
}

const emptyForm: MemberForm = {
  document_type: 'rut', document_number: '', nombre: '', apellido: '', email: '',
  telefono: '', cargo: '', medio: '', alias: '',
};

export default function EquipoPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();
  const { confirmation, confirm, cancel, execute } = useConfirmation();
  const [documentError, setDocumentError] = useState('');
  const [cargoOtroMode, setCargoOtroMode] = useState(false);
  const [profileMedio, setProfileMedio] = useState('');
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [missingFields, setMissingFields] = useState<Array<{ key: string; label: string }>>([]);

  // Cargar medio del perfil del manager — se fuerza en todos los miembros
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/profiles/lookup');
        const data = await res.json();
        if (data.found && data.profile) {
          if (data.profile.medio) setProfileMedio(data.profile.medio);

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

  const handleDocumentBlur = () => {
    if (!form.document_number.trim()) {
      setDocumentError('');
      return;
    }
    const result = validateDocumentByType(form.document_type, form.document_number);
    if (result.valid) {
      if (form.document_type === 'rut') {
        const cleaned = cleanRut(form.document_number);
        setForm(prev => ({ ...prev, document_number: formatRut(cleaned) }));
      }
      setDocumentError('');
    } else {
      if (form.document_type === 'rut') {
        const cleaned = cleanRut(form.document_number);
        setForm(prev => ({ ...prev, document_number: formatRut(cleaned) }));
      }
      setDocumentError(result.error || 'Documento inválido');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Validar documento antes de enviar
    const documentResult = validateDocumentByType(form.document_type, form.document_number);
    if (!documentResult.valid) {
      setDocumentError(documentResult.error || 'Documento inválido');
      setSaving(false);
      return;
    }

    try {
      const cleanedForm = {
        ...form,
        document_number: form.document_type === 'rut'
          ? cleanRut(form.document_number)
          : form.document_number.trim(),
        rut: form.document_type === 'rut' ? cleanRut(form.document_number) : undefined,
        medio: profileMedio || form.medio,
      };
      const isEditing = Boolean(editingMemberId);
      const endpoint = isEditing
        ? `/api/teams?member_id=${editingMemberId}`
        : '/api/teams';

      const res = await fetch(endpoint, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedForm),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Error al agregar miembro');
        setSaving(false);
        return;
      }

      showSuccess(isEditing
        ? `${form.nombre} ${form.apellido} actualizado en tu equipo`
        : `${form.nombre} ${form.apellido} agregado al equipo`
      );
      setForm({ ...emptyForm, medio: profileMedio });
      setShowForm(false);
      setEditingMemberId(null);
      setDocumentError('');
      setCargoOtroMode(false);
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

  const handleEdit = (member: TeamMember) => {
    const mp = member.member_profile;
    if (!mp) return;

    setEditingMemberId(member.id);
    setForm({
      document_type: (mp.document_type || (mp.rut ? 'rut' : 'dni_extranjero')) as 'rut' | 'dni_extranjero',
      document_number: mp.document_number || mp.rut || '',
      nombre: mp.nombre || '',
      apellido: mp.apellido || '',
      email: mp.email || '',
      telefono: mp.telefono || '',
      cargo: mp.cargo || '',
      medio: profileMedio || mp.medio || '',
      alias: member.alias || '',
    });
    setCargoOtroMode(Boolean(mp.cargo && !CARGOS.includes(mp.cargo as typeof CARGOS[number])));
    setDocumentError('');
    setShowForm(true);
  };

  const inputClass = 'w-full px-4 py-3 rounded-lg border border-field-border text-heading transition';
  const labelClass = 'block text-sm font-semibold text-label mb-1';

  return (
    <div>
      {/* Gate: perfil incompleto → banner bloqueante */}
      {profileIncomplete && (
        <div className="min-h-[65vh] flex items-center justify-center px-4">
          <div className="w-full max-w-2xl bg-warning-light border border-warning rounded-xl p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-warning/20 rounded-full flex items-center justify-center mx-auto">
              <i className="fas fa-exclamation-triangle text-warning text-2xl" />
            </div>
            <h2 className="text-xl font-bold text-heading">Completa tu identidad y datos base</h2>
            <p className="text-body">
              Para usar Mi Equipo, primero completa estos datos en tu perfil de acreditado:
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
              }));
              setEditingMemberId(null);
            }
            setShowForm(!showForm); setDocumentError('');
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
            <i className={`fas ${editingMemberId ? 'fa-user-pen' : 'fa-user-plus'} mr-2 text-brand`} />
            {editingMemberId ? 'Editar Miembro' : 'Nuevo Miembro'}
          </h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Tipo de documento *</label>
                <select
                  value={form.document_type}
                  onChange={(e) => {
                    const newType = e.target.value as 'rut' | 'dni_extranjero';
                    setForm({ ...form, document_type: newType, document_number: '' });
                    setDocumentError('');
                  }}
                  className={inputClass}
                >
                  <option value="rut">RUT (Chile)</option>
                  <option value="dni_extranjero">DNI / Pasaporte (Extranjero)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Documento *</label>
                <input
                  type="text"
                  required
                  placeholder={form.document_type === 'rut' ? '12.345.678-9' : 'Ej: AB1234567'}
                  value={form.document_number}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    const value = form.document_type === 'rut'
                      ? rawValue
                        .replace(/[^0-9kK.-]/g, '')
                        .replace(/\./g, '')
                        .toUpperCase()
                      : rawValue;
                    setForm({ ...form, document_number: value });
                    if (documentError) setDocumentError('');
                  }}
                  onBlur={handleDocumentBlur}
                  className={`${inputClass} ${documentError ? 'border-danger ring-1 ring-danger' : ''}`}
                  maxLength={form.document_type === 'rut' ? 12 : 32}
                />
                {documentError && (
                  <p className="text-danger text-xs mt-1"><i className="fas fa-exclamation-circle mr-1" />{documentError}</p>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className={labelClass}>Cargo</label>
                {cargoOtroMode ? (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={form.cargo}
                      onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                      placeholder="Escribe el cargo..."
                      autoFocus
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => { setCargoOtroMode(false); setForm({ ...form, cargo: '' }); }}
                      className="px-2 py-1 text-xs text-muted hover:text-danger transition rounded-lg border border-edge hover:border-danger/30"
                      title="Volver a la lista"
                    >
                      <i className="fas fa-times" />
                    </button>
                  </div>
                ) : (
                  <select
                    value={form.cargo}
                    onChange={(e) => {
                      if (e.target.value === '__otro__') {
                        setCargoOtroMode(true);
                        setForm({ ...form, cargo: '' });
                      } else {
                        setForm({ ...form, cargo: e.target.value });
                      }
                    }}
                    className={inputClass}
                  >
                    <option value="">Selecciona...</option>
                    {CARGOS.filter(c => c !== 'Otro').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__otro__">Otro (especificar)</option>
                  </select>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingMemberId(null);
                  setForm({ ...emptyForm, medio: profileMedio });
                  setDocumentError('');
                  setCargoOtroMode(false);
                }}
                className="px-4 py-2 text-body hover:text-heading transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-brand text-on-brand rounded-lg font-semibold hover:bg-brand-hover disabled:opacity-50 transition"
              >
                {saving ? 'Guardando...' : editingMemberId ? 'Guardar Cambios' : 'Agregar al Equipo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Members List */}
      {loading ? (
        <div className="text-center py-12">
          <LoadingSpinner />
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
                      <span>
                        <i className="fas fa-id-card mr-1 text-muted" />
                        {(mp?.document_type || 'rut') === 'rut'
                          ? formatRut(cleanRut(mp?.document_number || mp?.rut || ''))
                          : (mp?.document_number || mp?.rut || '—')}
                      </span>
                      {mp?.email && <span><i className="fas fa-envelope mr-1 text-muted" />{mp.email}</span>}
                      {mp?.medio && <span><i className="fas fa-building mr-1 text-muted" />{mp.medio}</span>}
                      {mp?.cargo && <span><i className="fas fa-briefcase mr-1 text-muted" />{mp.cargo}</span>}
                    </div>
                  </div>
                  {/* Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(member)}
                      className="text-muted hover:text-brand transition flex-shrink-0 p-2"
                      title="Editar miembro"
                    >
                      <i className="fas fa-pen" />
                    </button>
                    <button
                      onClick={() => handleDelete(member.id, `${mp?.nombre} ${mp?.apellido}`)}
                      disabled={deletingId === member.id}
                      className="text-muted hover:text-danger transition flex-shrink-0 p-2"
                      title="Eliminar del equipo"
                    >
                      {deletingId === member.id ? (
                        <ButtonSpinner />
                      ) : (
                        <i className="fas fa-trash-alt" />
                      )}
                    </button>
                  </div>
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
