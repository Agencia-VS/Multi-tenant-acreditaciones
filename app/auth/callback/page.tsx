'use client';

/**
 * Auth Callback — Maneja el callback de Supabase Auth
 */
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingSpinner } from '@/components/shared/ui';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.auth.exchangeCodeForSession(
        searchParams.get('code') || ''
      );

      if (error) {
        router.push('/auth/acreditado?error=auth');
        return;
      }

      // Crear/vincular perfil con datos del metadata (guardados en signUp)
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.rut) {
        await fetch('/api/profiles/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rut: user.user_metadata.rut,
            nombre: user.user_metadata.nombre || '',
            apellido: user.user_metadata.apellido || '',
            email: user.email || '',
          }),
        });
      }

      const next = searchParams.get('next') || '/acreditado';
      router.push(next);
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="text-center">
        <LoadingSpinner />
        <p className="text-body mt-4">Verificando sesión...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <LoadingSpinner />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
