'use client';

/**
 * Gestión de Equipo / Frecuentes
 * 
 * El manager puede agregar, editar y eliminar miembros de su equipo.
 * Estos miembros aparecen como "frecuentes" al acreditar por equipo.
 */
import { useState, useEffect, useCallback } from 'react';
import { TIPOS_MEDIO, CARGOS } from '@/types';
import type { TeamMember } from '@/types';

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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al agregar miembro');
        setSaving(false);
        return;
      }

      setSuccess(`${form.nombre} ${form.apellido} agregado al equipo`);
      setForm({ ...emptyForm });
      setShowForm(false);
      await loadMembers();
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (memberId: string, memberName: string) => {
    if (!confirm(`¿Eliminar a ${memberName} de tu equipo?`)) return;
    
    setDeletingId(memberId);
    try {
      const res = await fetch(`/api/teams?member_id=${memberId}`, { method: 'DELETE' });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
        setSuccess(`${memberName} eliminado del equipo`);
      } else {
        const data = await res.json();
        setError(data.error || 'Error al eliminar');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setDeletingId(null);
    }
  };

  const inputClass = 'w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900';
  const labelClass = 'block text-sm font-semibold text-gray-700 mb-1';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mi Equipo</h1>
          <p className="text-gray-500 mt-1">
            Gestiona tus frecuentes para acreditarlos rápidamente
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); setSuccess(''); }}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
            showForm
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {showForm ? (
            <><i className="fas fa-times mr-2" />Cancelar</>
          ) : (
            <><i className="fas fa-user-plus mr-2" />Agregar Miembro</>
          )}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-800 text-sm rounded mb-4">
          <i className="fas fa-exclamation-triangle mr-2" />{error}
          <button onClick={() => setError('')} className="float-right text-red-400 hover:text-red-600">
            <i className="fas fa-times" />
          </button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-3 text-green-800 text-sm rounded mb-4">
          <i className="fas fa-check-circle mr-2" />{success}
          <button onClick={() => setSuccess('')} className="float-right text-green-400 hover:text-green-600">
            <i className="fas fa-times" />
          </button>
        </div>
      )}

      {/* Add Member Form */}
      {showForm && (
        <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            <i className="fas fa-user-plus mr-2 text-blue-500" />Nuevo Miembro
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
                  onChange={(e) => setForm({ ...form, rut: e.target.value })}
                  className={inputClass}
                />
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
                <label className={labelClass}>Medio / Organización</label>
                <input
                  type="text"
                  placeholder="Ej: Canal 13"
                  value={form.medio}
                  onChange={(e) => setForm({ ...form, medio: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Tipo de Medio</label>
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
                onClick={() => { setShowForm(false); setForm({ ...emptyForm }); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
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
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 mt-4">Cargando equipo...</p>
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <i className="fas fa-users text-5xl text-gray-200 mb-4" />
          <p className="text-gray-400 text-lg mb-2">Tu equipo está vacío</p>
          <p className="text-gray-400 text-sm">
            Agrega miembros frecuentes para acreditarlos rápidamente en cualquier evento.
          </p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              <i className="fas fa-user-plus mr-2" />Agregar Primer Miembro
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">{members.length} miembro{members.length !== 1 ? 's' : ''} en tu equipo</p>
          {members.map((member) => {
            const mp = member.member_profile;
            return (
              <div
                key={member.id}
                className="bg-white rounded-xl border p-5 hover:shadow-sm transition"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {mp?.nombre?.charAt(0)}{mp?.apellido?.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">
                      {mp?.nombre} {mp?.apellido}
                      {member.alias && member.alias !== `${mp?.nombre} ${mp?.apellido}` && (
                        <span className="text-gray-400 font-normal text-sm ml-2">({member.alias})</span>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                      <span><i className="fas fa-id-card mr-1 text-gray-300" />{mp?.rut}</span>
                      {mp?.email && <span><i className="fas fa-envelope mr-1 text-gray-300" />{mp.email}</span>}
                      {mp?.medio && <span><i className="fas fa-building mr-1 text-gray-300" />{mp.medio}</span>}
                      {mp?.cargo && <span><i className="fas fa-briefcase mr-1 text-gray-300" />{mp.cargo}</span>}
                    </div>
                  </div>

                  {/* Tags */}
                  {mp?.tipo_medio && (
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-full flex-shrink-0">
                      {mp.tipo_medio}
                    </span>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(member.id, `${mp?.nombre} ${mp?.apellido}`)}
                    disabled={deletingId === member.id}
                    className="text-gray-300 hover:text-red-500 transition flex-shrink-0 p-2"
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
    </div>
  );
}
