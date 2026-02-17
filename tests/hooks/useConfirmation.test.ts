/**
 * Tests: useConfirmation hook
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfirmation } from '@/hooks/useConfirmation';

describe('useConfirmation', () => {
  it('starts with closed state', () => {
    const { result } = renderHook(() => useConfirmation());
    expect(result.current.confirmation.open).toBe(false);
    expect(result.current.confirmation.title).toBe('');
  });

  it('opens confirmation dialog', () => {
    const { result } = renderHook(() => useConfirmation());
    const onConfirm = vi.fn();

    act(() => {
      result.current.confirm({
        title: 'Eliminar',
        message: '¿Estás seguro?',
        confirmLabel: 'Sí, eliminar',
        variant: 'danger',
        onConfirm,
      });
    });

    expect(result.current.confirmation.open).toBe(true);
    expect(result.current.confirmation.title).toBe('Eliminar');
    expect(result.current.confirmation.variant).toBe('danger');
  });

  it('cancel closes the dialog', () => {
    const { result } = renderHook(() => useConfirmation());

    act(() => {
      result.current.confirm({
        title: 'Test',
        message: 'Test',
        confirmLabel: 'OK',
        variant: 'info',
        onConfirm: vi.fn(),
      });
    });
    expect(result.current.confirmation.open).toBe(true);

    act(() => {
      result.current.cancel();
    });
    expect(result.current.confirmation.open).toBe(false);
  });

  it('execute calls onConfirm and closes', () => {
    const { result } = renderHook(() => useConfirmation());
    const onConfirm = vi.fn();

    act(() => {
      result.current.confirm({
        title: 'Delete',
        message: '¿Seguro?',
        confirmLabel: 'OK',
        variant: 'warning',
        onConfirm,
      });
    });

    act(() => {
      result.current.execute();
    });

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(result.current.confirmation.open).toBe(false);
  });
});
