'use client';

/**
 * Modal para cambio de contraseña del admin tenant.
 * Usa supabase.auth.updateUser() directamente desde el browser.
 */
import { useState } from 'react';
import { Modal, ButtonSpinner, useToast } from '@/components/shared/ui';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { validatePassword } from '@/lib/services/passwordPolicy';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ open, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const { showSuccess, showError } = useToast();

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswords(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      showError(validation.error!);
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('Las contraseñas no coinciden');
      return;
    }

    if (currentPassword === newPassword) {
      showError('La nueva contraseña debe ser diferente a la actual');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();

      // Verify current password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        showError('No se pudo obtener la sesión actual');
        return;
      }

      // Try signing in with current password to verify it
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (verifyError) {
        showError('La contraseña actual es incorrecta');
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      });

      if (error) {
        showError(error.message || 'Error al cambiar contraseña');
        return;
      }

      showSuccess('Contraseña actualizada correctamente');
      handleClose();
    } catch {
      showError('Error inesperado al cambiar contraseña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Cambiar Contraseña" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current password */}
        <div>
          <label className="block text-sm font-medium text-label mb-1">
            Contraseña actual
          </label>
          <div className="relative">
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 pr-10 rounded-lg border border-field-border text-heading"
              placeholder="Ingresa tu contraseña actual"
              autoComplete="current-password"
            />
          </div>
        </div>

        {/* New password */}
        <div>
          <label className="block text-sm font-medium text-label mb-1">
            Nueva contraseña
          </label>
          <input
            type={showPasswords ? 'text' : 'password'}
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
          />
          {newPassword && newPassword.length < 8 && (
            <p className="text-xs text-danger mt-1">
              <i className="fas fa-exclamation-circle mr-1" />
              Mínimo 8 caracteres ({8 - newPassword.length} faltan)
            </p>
          )}
          {newPassword.length >= 8 && (
            <p className="text-xs text-success mt-1">
              <i className="fas fa-check-circle mr-1" />
              Contraseña válida
            </p>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm font-medium text-label mb-1">
            Confirmar nueva contraseña
          </label>
          <input
            type={showPasswords ? 'text' : 'password'}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-field-border text-heading"
            placeholder="Repite la nueva contraseña"
            autoComplete="new-password"
          />
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-danger mt-1">
              <i className="fas fa-times-circle mr-1" />
              Las contraseñas no coinciden
            </p>
          )}
        </div>

        {/* Toggle visibility */}
        <label className="flex items-center gap-2 text-sm text-body cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showPasswords}
            onChange={(e) => setShowPasswords(e.target.checked)}
            className="rounded border-field-border"
          />
          Mostrar contraseñas
        </label>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 8}
            className="flex-1 py-2.5 bg-brand text-on-brand rounded-lg font-medium hover:bg-brand-hover disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {saving ? <ButtonSpinner /> : <i className="fas fa-lock" />}
            {saving ? 'Actualizando...' : 'Cambiar Contraseña'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2.5 bg-subtle text-body rounded-lg font-medium hover:bg-edge transition"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}
