'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { UIMessage } from '@/types';

/* ─────────────────────────── StatusBadge ─────────────────────────── */

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; icon: string }> = {
    pendiente: { bg: 'bg-[#fef3c7] text-[#92400e] border border-[#f59e0b]/40', icon: 'fa-clock' },
    aprobado:  { bg: 'bg-[#d1fae5] text-[#065f46] border border-[#059669]/40', icon: 'fa-check-circle' },
    rechazado: { bg: 'bg-[#fee2e2] text-[#991b1b] border border-[#dc2626]/40', icon: 'fa-times-circle' },
    revision:  { bg: 'bg-[#dbeafe] text-[#1e40af] border border-[#3b82f6]/40', icon: 'fa-search' },
  };

  const labels: Record<string, string> = {
    pendiente: 'Pendiente',
    aprobado: 'Aprobado',
    rechazado: 'Rechazado',
    revision: 'En Revisión',
  };

  const { bg, icon } = config[status] || { bg: 'bg-subtle text-body', icon: 'fa-question-circle' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold ${bg}`}>
      <i className={`fas ${icon} text-xs`} />
      {labels[status] || status}
    </span>
  );
}

/* ─────────────────────────── Alert (inline) ─────────────────────── */

export function Alert({ message, onClose }: { message: UIMessage; onClose?: () => void }) {
  const colors: Record<string, string> = {
    success: 'bg-success-light border-success text-success-dark',
    error: 'bg-danger-light border-danger text-danger-dark',
    warning: 'bg-warn-light border-warn text-warn-dark',
    info: 'bg-accent-light border-brand text-info-dark',
  };

  return (
    <div className={`border-l-4 p-3 rounded ${colors[message.type]}`}>
      <div className="flex justify-between items-center">
        <p className="text-base">{message.text}</p>
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
    blue: 'border-brand border-t-transparent',
    white: 'border-white border-t-transparent',
    red: 'border-danger border-t-transparent',
    gray: 'border-edge border-t-body',
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

/* ─────────────────────────── Toast + useToast (Sileo) ────────────── */

export type ToastMessage = { type: 'success' | 'error'; text: string } | null;

/**
 * Hook para manejar toasts — ahora usa Sileo como motor.
 * La API (showSuccess, showError, dismiss) se mantiene idéntica
 * para compatibilidad con todos los consumidores existentes.
 * El estado local `toast` se conserva para componentes que lo lean directamente.
 */
export function useToast(duration = 4000) {
  const [toast, setToast] = useState<ToastMessage>(null);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(t);
  }, [toast, duration]);

  const showSuccess = useCallback((text: string) => {
    setToast({ type: 'success', text });
    // defer Sileo call so it runs only in the browser
    if (typeof window !== 'undefined') {
      import('sileo').then(({ sileo }) => {
        lastId.current = sileo.success({ title: text, duration });
      });
    }
  }, [duration]);

  const showError = useCallback((text: string) => {
    setToast({ type: 'error', text });
    if (typeof window !== 'undefined') {
      import('sileo').then(({ sileo }) => {
        lastId.current = sileo.error({ title: text, duration });
      });
    }
  }, [duration]);

  const dismiss = useCallback(() => {
    setToast(null);
    if (lastId.current && typeof window !== 'undefined') {
      import('sileo').then(({ sileo }) => {
        if (lastId.current) sileo.dismiss(lastId.current);
      });
    }
  }, []);

  return { toast, setToast, showSuccess, showError, dismiss };
}

/**
 * Toast flotante legacy — se mantiene por retrocompatibilidad.
 * Si el <Toaster /> de Sileo está montado, éste es redundante
 * y puede omitirse. Pero no rompemos nada si sigue en el JSX.
 */
export function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  // When Sileo Toaster is mounted, hide the legacy toast to avoid duplicates
  if (typeof window !== 'undefined') return null;
  if (!toast) return null;
  return (
    <div
      className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-[100] sm:max-w-md px-4 py-3 rounded-xl shadow-lg border text-sm sm:text-base font-medium flex items-center gap-3 transition-all ${
        toast.type === 'success'
          ? 'bg-success-light text-success-dark border-success-light'
          : 'bg-danger-light text-danger-dark border-danger-light'
      }`}
    >
      <i
        className={`fas ${
          toast.type === 'success' ? 'fa-check-circle text-success' : 'fa-exclamation-circle text-danger'
        }`}
      />
      <span className="flex-1">{toast.text}</span>
      <button onClick={onDismiss} className="text-muted hover:text-body">
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
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-heading">{title}</h1>
        {subtitle && <p className="text-body text-sm sm:text-base mt-1">{subtitle}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-brand text-on-brand rounded-lg text-sm font-medium hover:bg-brand-hover transition flex items-center gap-2"
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
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  // Need to know we're client-side for createPortal
  useEffect(() => { setMounted(true); }, []);

  // Focus close button when modal opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => closeBtnRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Lock body scroll — save/restore original value
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Panel — stopPropagation so clicking inside doesn't trigger backdrop close */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className={`relative bg-surface rounded-t-2xl sm:rounded-2xl ${maxWidth} w-full max-h-[90vh] sm:max-h-[85vh] shadow-2xl flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-surface border-b border-edge px-4 sm:px-5 py-3 flex justify-between items-center rounded-t-2xl shrink-0">
          <h2 id="modal-title" className="text-lg sm:text-xl font-bold text-heading">{title}</h2>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="text-muted hover:text-body transition p-1"
            aria-label="Cerrar modal"
          >
            <i className="fas fa-times text-xl" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain flex-1 min-h-0 p-4 sm:p-5" style={{ WebkitOverflowScrolling: 'touch' }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────── ConfirmDialog ───────────────────────── */

/**
 * Modal de confirmación reutilizable con accesibilidad.
 * Se integra con el hook `useConfirmation()` de hooks/.
 *
 * Ejemplo:
 *   const { confirmation, confirm, cancel, execute } = useConfirmation();
 *   confirm({ title: '¿Eliminar?', message: '...', onConfirm: fn, variant: 'danger' });
 *   <ConfirmDialog {...confirmation} onConfirm={execute} onCancel={cancel} />
 */
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
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button (safer default) when dialog opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => cancelRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [open]);

  if (!open) return null;

  const icons = {
    danger: { icon: 'fa-trash-alt', bg: 'bg-danger-light', color: 'text-danger' },
    warning: { icon: 'fa-exclamation-triangle', bg: 'bg-warn-light', color: 'text-warn' },
    info: { icon: 'fa-info-circle', bg: 'bg-accent-light', color: 'text-brand' },
  };
  const btnColor = {
    danger: 'bg-danger hover:bg-danger/90 text-white',
    warning: 'bg-warn hover:bg-warn/90 text-white',
    info: 'bg-brand hover:bg-brand-hover text-on-brand',
  };
  const v = icons[variant];

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      onClick={onCancel}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className="relative bg-surface rounded-t-2xl sm:rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-edge"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className={`w-12 h-12 rounded-full ${v.bg} flex items-center justify-center`}>
            <i className={`fas ${v.icon} text-xl ${v.color}`} />
          </div>
        </div>

        <h3 id="confirm-dialog-title" className="text-lg font-bold text-heading text-center mb-2">{title}</h3>
        <p id="confirm-dialog-message" className="text-sm sm:text-base text-body text-center mb-5">{message}</p>

        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 py-2.5 bg-subtle text-body rounded-lg font-medium hover:bg-edge transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-lg font-medium transition ${btnColor[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────── BackButton ──────────────────────────── */

/**
 * BackButton — Botón glassmorphism consistente en toda la app.
 * Variantes:
 *  - glass (default): fondo blanco/10 con backdrop-blur, para fondos oscuros/coloreados
 *  - dark: fondo gris sólido, para fondos claros
 *  - ghost: texto sutil sin fondo
 *
 * `absolute` (default true): posición absoluta top-left con z-20
 * Responsive: ajusta padding y posición en móvil
 */
export function BackButton({
  href,
  label = 'Volver',
  variant = 'glass',
  absolute = true,
}: {
  href: string;
  label?: string;
  variant?: 'glass' | 'dark' | 'ghost';
  absolute?: boolean;
}) {
  const base = 'flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-all';
  const styles = {
    glass: 'bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 hover:bg-white/20 hover:text-white',
    dark: 'bg-subtle border border-edge text-body hover:bg-edge hover:text-heading',
    ghost: 'text-muted hover:text-body',
  };
  const position = absolute ? 'absolute top-3 left-3 sm:top-6 sm:left-6 z-20' : '';

  return (
    <Link href={href} className={`${base} ${styles[variant]} ${position}`}>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

/* ─────────────────────────── Card ────────────────────────────────── */

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface rounded-xl shadow-sm border border-edge overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

/* ─────────────────────────── StatCard ────────────────────────────── */

export function StatCard({ label, value, icon, color = 'blue' }: { label: string; value: number | string; icon?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'from-[#00C48C] to-[#00A676]',
    green: 'from-[#059669] to-[#065f46]',
    yellow: 'from-[#d97706] to-[#92400e]',
    red: 'from-[#dc2626] to-[#991b1b]',
    purple: 'from-[#9333ea] to-[#7e22ce]',
    gray: 'from-[#6b7280] to-[#374151]',
  };

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-edge p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base text-body uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-heading mt-1">{value}</p>
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
    <div className="text-center py-8 text-muted">
      <i className={`fas ${icon} text-4xl mb-3`} />
      <p className="text-lg">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-brand text-on-brand rounded-lg text-sm font-medium hover:bg-brand-hover transition"
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
        className="flex-1 py-3 bg-brand text-on-brand rounded-lg font-semibold hover:bg-brand-hover disabled:opacity-50 transition flex items-center justify-center gap-2"
      >
        {saving ? <><ButtonSpinner /> {savingLabel}</> : submitLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-6 py-3 bg-subtle text-body rounded-lg font-semibold hover:bg-edge transition"
      >
        Cancelar
      </button>
    </div>
  );
}
