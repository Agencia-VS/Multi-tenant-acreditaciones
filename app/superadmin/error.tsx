'use client';

import { useEffect } from 'react';

export default function SuperadminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[SuperadminError]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-md space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-danger/10 flex items-center justify-center">
          <i className="fas fa-shield-alt text-danger text-2xl" />
        </div>
        <h2 className="text-xl font-bold text-heading">Error en Superadmin</h2>
        <p className="text-muted text-sm">
          Ocurrió un error en el panel de administración. Por favor intenta de nuevo.
        </p>
        {error.digest && (
          <p className="text-xs text-muted/60 font-mono">Ref: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
