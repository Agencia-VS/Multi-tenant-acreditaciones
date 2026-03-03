'use client';

import { useEffect } from 'react';

export default function AcreditadoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AcreditadoError]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-md space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
          <i className="fas fa-exclamation-circle text-amber-500 text-2xl" />
        </div>
        <h2 className="text-xl font-bold text-heading">Error al cargar</h2>
        <p className="text-muted text-sm">
          No pudimos cargar tu panel. Por favor intenta de nuevo o vuelve a iniciar sesión.
        </p>
        {error.digest && (
          <p className="text-xs text-muted/60 font-mono">Ref: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Reintentar
          </button>
          <a
            href="/auth/login"
            className="px-5 py-2.5 border border-edge text-muted rounded-xl font-medium hover:bg-surface transition-colors"
          >
            Iniciar sesión
          </a>
        </div>
      </div>
    </div>
  );
}
