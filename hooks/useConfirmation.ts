'use client';

import { useState, useCallback } from 'react';

export interface ConfirmationState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
}

const INITIAL: ConfirmationState = {
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirmar',
  variant: 'info',
  onConfirm: () => {},
};

/**
 * Hook para gestionar modales de confirmación de forma declarativa.
 *
 * Uso:
 *   const { confirmation, confirm, cancel } = useConfirmation();
 *   confirm({ title: '...', message: '...', onConfirm: () => doThing() });
 *   <ConfirmDialog {...confirmation} onConfirm={confirmation.onConfirm} onCancel={cancel} />
 */
export function useConfirmation() {
  const [confirmation, setConfirmation] = useState<ConfirmationState>(INITIAL);

  const confirm = useCallback(
    (opts: Omit<ConfirmationState, 'open'>) => {
      setConfirmation({ ...opts, open: true });
    },
    []
  );

  const cancel = useCallback(() => {
    setConfirmation(INITIAL);
  }, []);

  /** Ejecuta onConfirm y cierra */
  const execute = useCallback(() => {
    confirmation.onConfirm();
    setConfirmation(INITIAL);
  }, [confirmation]);

  return { confirmation, confirm, cancel, execute };
}
