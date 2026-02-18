'use client';

/**
 * SuperAdmin — Configuración general de la plataforma
 */
import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/components/shared/ui';

export default function ConfiguracionPage() {
  const [newEmail, setNewEmail] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleCreateSuperadmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const supabase = getSupabaseBrowserClient();

      // Create user via auth admin (this requires service role)
      const res = await fetch('/api/superadmin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-superadmin',
          email: newEmail,
          nombre: newNombre,
          password: newPassword,
        }),
      });

      if (res.ok) {
        showSuccess('SuperAdmin creado exitosamente');
        setNewEmail('');
        setNewNombre('');
        setNewPassword('');
      } else {
        const data = await res.json();
        showError(data.error || 'Error al crear SuperAdmin');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-heading">Configuración</h1>
        <p className="text-body mt-1">Configuración global de la plataforma</p>
      </div>

      <div className="grid gap-6">
        {/* Crear SuperAdmin */}
        <div className="bg-surface rounded-xl border p-6">
          <h2 className="text-lg font-bold text-heading mb-4">
            <i className="fas fa-user-shield mr-2 text-brand" />
            Crear Super Administrador
          </h2>

          <form onSubmit={handleCreateSuperadmin} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-label mb-1">Nombre</label>
              <input
                type="text"
                required
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-label mb-1">Email</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-label mb-1">Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-brand text-white rounded-lg font-medium hover:bg-brand-hover disabled:opacity-50 transition"
            >
              {saving ? 'Creando...' : 'Crear SuperAdmin'}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="bg-surface rounded-xl border p-6">
          <h2 className="text-lg font-bold text-heading mb-4">
            <i className="fas fa-info-circle mr-2 text-muted" />
            Información del Sistema
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-canvas p-4 rounded-lg">
              <p className="text-body">Plataforma</p>
              <p className="font-bold text-heading">Accredia v2.0</p>
            </div>
            <div className="bg-canvas p-4 rounded-lg">
              <p className="text-body">Base de Datos</p>
              <p className="font-bold text-heading">Supabase PostgreSQL</p>
            </div>
            <div className="bg-canvas p-4 rounded-lg">
              <p className="text-body">Auth</p>
              <p className="font-bold text-heading">Supabase Auth (email/pwd)</p>
            </div>
            <div className="bg-canvas p-4 rounded-lg">
              <p className="text-body">Emails</p>
              <p className="font-bold text-heading">Resend</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
