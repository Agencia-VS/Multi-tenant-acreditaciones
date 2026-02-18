/**
 * Tests: ConfirmDialog component from shared/ui.tsx
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '@/components/shared/ui';

describe('ConfirmDialog', () => {
  const baseProps = {
    open: true,
    title: '¿Eliminar miembro?',
    message: 'Esta acción no se puede deshacer.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('no renderiza nada cuando open=false', () => {
    const { container } = render(
      <ConfirmDialog {...baseProps} open={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renderiza título y mensaje cuando open=true', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByText('¿Eliminar miembro?')).toBeDefined();
    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeDefined();
  });

  it('renderiza labels por defecto (Confirmar / Cancelar)', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByText('Confirmar')).toBeDefined();
    expect(screen.getByText('Cancelar')).toBeDefined();
  });

  it('renderiza labels personalizados', () => {
    render(
      <ConfirmDialog {...baseProps} confirmLabel="Sí, eliminar" cancelLabel="No, volver" />
    );
    expect(screen.getByText('Sí, eliminar')).toBeDefined();
    expect(screen.getByText('No, volver')).toBeDefined();
  });

  it('llama onConfirm al hacer clic en el botón de confirmar', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Confirmar'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('llama onCancel al hacer clic en Cancelar', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('cierra al presionar Escape', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('tiene role="dialog" y aria-modal', () => {
    render(<ConfirmDialog {...baseProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('muestra icono de danger por defecto', () => {
    const { container } = render(<ConfirmDialog {...baseProps} />);
    const icon = container.querySelector('.fa-trash-alt');
    expect(icon).toBeDefined();
  });

  it('muestra icono de warning cuando variant=warning', () => {
    const { container } = render(<ConfirmDialog {...baseProps} variant="warning" />);
    const icon = container.querySelector('.fa-exclamation-triangle');
    expect(icon).toBeDefined();
  });

  it('muestra icono de info cuando variant=info', () => {
    const { container } = render(<ConfirmDialog {...baseProps} variant="info" />);
    const icon = container.querySelector('.fa-info-circle');
    expect(icon).toBeDefined();
  });
});
