'use client';

/**
 * Auth Callback — Maneja el callback de Supabase Auth
 */
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

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

      // Link profile if RUT exists in user metadata
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.rut) {
        await fetch('/api/profiles/lookup?rut=' + user.user_metadata.rut);
      }

      const next = searchParams.get('next') || '/acreditado';
      router.push(next);
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-body">Verificando sesión...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
