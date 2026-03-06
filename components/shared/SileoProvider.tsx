'use client';

import { Toaster } from 'sileo';

/**
 * Sileo Toaster Provider — monta el contenedor de toasts.
 * Se coloca en el root layout como componente cliente.
 */
export default function SileoProvider() {
  return (
    <>
      <Toaster
        position="top-right"
        offset={{ top: 16, right: 16 }}
        options={{
          duration: 4000,
          roundness: 12,
        }}
      />

      {/* Keep original casing from message strings (Spanish sentence case). */}
      <style jsx global>{`
        [data-sileo-title] {
          text-transform: none !important;
        }
      `}</style>
    </>
  );
}
