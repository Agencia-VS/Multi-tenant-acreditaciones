'use client';

import { useEffect, useCallback, useState } from 'react';
import Link from 'next/link';
import type { UIMessage } from '@/types';

/* ─────────────────────────── StatusBadge ─────────────────────────── */

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pendiente: 'bg-yellow-100 text-yellow-800',
    aprobado: 'bg-green-100 text-green-800',
    rechazado: 'bg-red-100 text-red-800',
    revision: 'bg-blue-100 text-blue-800',
  };

  const labels: Record<string, string> = {
    pendiente: 'Pendiente',
    aprobado: 'Aprobado',
    rechazado: 'Rechazado',
    revision: 'En Revisión',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  );
}

/* ─────────────────────────── Alert (inline) ─────────────────────── */

export function Alert({ message, onClose }: { message: UIMessage; onClose?: () => void }) {
  const colors: Record<string, string> = {
    success: 'bg-green-50 border-green-500 text-green-800',
    error: 'bg-red-50 border-red-500 text-red-800',
    warning: 'bg-yellow-50 border-yellow-500 text-yellow-800',
    info: 'bg-blue-50 border-blue-500 text-blue-800',
  };

  return (
    <div className={`border-l-4 p-4 rounded ${colors[message.type]}`}>
      <div className="flex justify-between items-center">
        <p className="text-sm">{message.text}</p>
        {onClose && (
          <button onClick={onClose} className="ml-4 text-lg font-bold opacity-50 hover:opacity-100">&times;</button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── LoadingSpinner ──────────────────────── */

export function LoadingSpinner({
  size = 'md',
  color = 'blue',
  fullPage = false,
}: {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'white' | 'red' | 'gray';
  fullPage?: boolean;
}) {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-4', lg: 'w-12 h-12 border-4' };
  const colors = {
    blue: 'border-blue-500 border-t-transparent',
    white: 'border-white border-t-transparent',
    red: 'border-red-500 border-t-transparent',
    gray: 'border-gray-300 border-t-gray-600',
  };
  const wrapper = fullPage
    ? 'flex items-center justify-center min-h-[16rem]'
    : 'flex items-center justify-center py-12';

  return (
    <div className={wrapper}>
      <div className={`${sizes[size]} ${colors[color]} rounded-full animate-spin`} />
    </div>
  );
}

/** Inline spinner for buttons — uso: <ButtonSpinner /> dentro de un <button> */
export function ButtonSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} />
  );
}

/* ─────────────────────────── Toast + useToast ────────────────────── */

export type ToastMessage = { type: 'success' | 'error'; text: string } | null;

/** Hook para manejar toasts con auto-dismiss */
export function useToast(duration = 4000) {
  const [toast, setToast] = useState<ToastMessage>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(t);
  }, [toast, duration]);

  const showSuccess = useCallback((text: string) => setToast({ type: 'success', text }), []);
  const showError = useCallback((text: string) => setToast({ type: 'error', text }), []);
  const dismiss = useCallback(() => setToast(null), []);

  return { toast, setToast, showSuccess, showError, dismiss };
}

/** Toast flotante — se coloca en la raíz del componente de página */
export function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed top-4 right-4 z-[100] max-w-md px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-3 transition-all ${
        toast.type === 'success'
          ? 'bg-green-50 text-green-800 border-green-200'
          : 'bg-red-50 text-red-800 border-red-200'
      }`}
    >
      <i
        className={`fas ${
          toast.type === 'success' ? 'fa-check-circle text-green-500' : 'fa-exclamation-circle text-red-500'
        }`}
      />
      <span className="flex-1">{toast.text}</span>
      <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
        <i className="fas fa-times" />
      </button>
    </div>
  );
}

/* ─────────────────────────── PageHeader ──────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; icon?: string; onClick: () => void };
}) {
  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
        >
          {action.icon && <i className={`fas ${action.icon}`} />}
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────── Modal ───────────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  maxWidth = 'max-w-2xl',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl ${maxWidth} w-full max-h-[90vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-white border-b px-8 py-4 flex justify-between items-center z-10 rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <i className="fas fa-times text-xl" />
          </button>
        </div>
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────── ConfirmDialog ───────────────────────── */

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title = '¿Estás seguro?',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}) {
  if (!open) return null;
  const btnColor = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
    info: 'bg-blue-600 hover:bg-blue-700',
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 text-white rounded-lg font-medium transition ${btnColor[variant]}`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── BackButton ──────────────────────────── */

export function BackButton({
  href,
  label = 'Volver',
  variant = 'light',
}: {
  href: string;
  label?: string;
  variant?: 'light' | 'dark' | 'ghost';
}) {
  const styles = {
    light: 'text-white/40 hover:text-white/60',
    dark: 'text-gray-500 hover:text-gray-700',
    ghost: 'text-gray-400 hover:text-gray-600',
  };
  return (
    <Link href={href} className={`text-sm transition flex items-center gap-1 ${styles[variant]}`}>
      <i className="fas fa-arrow-left" />
      {label}
    </Link>
  );
}

/* ─────────────────────────── Card ────────────────────────────────── */

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

/* ─────────────────────────── StatCard ────────────────────────────── */

export function StatCard({ label, value, icon, color = 'blue' }: { label: string; value: number | string; icon?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-yellow-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
    gray: 'from-gray-500 to-gray-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        {icon && (
          <div className={`w-12 h-12 bg-gradient-to-r ${colors[color]} rounded-lg flex items-center justify-center`}>
            <i className={`fas ${icon} text-white`} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── EmptyState ──────────────────────────── */

export function EmptyState({ message, icon = 'fa-inbox', action }: {
  message: string;
  icon?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="text-center py-12 text-gray-400">
      <i className={`fas ${icon} text-4xl mb-3`} />
      <p className="text-lg">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────── FormActions ─────────────────────────── */

export function FormActions({
  saving,
  onCancel,
  submitLabel = 'Guardar',
  savingLabel = 'Guardando...',
}: {
  saving: boolean;
  onCancel: () => void;
  submitLabel?: string;
  savingLabel?: string;
}) {
  return (
    <div className="flex gap-3 pt-4">
      <button
        type="submit"
        disabled={saving}
        className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
      >
        {saving ? <><ButtonSpinner /> {savingLabel}</> : submitLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-6 py-3 bg-gray-100 text-gray-600 rounded-lg font-semibold hover:bg-gray-200 transition"
      >
        Cancelar
      </button>
    </div>
  );
}
