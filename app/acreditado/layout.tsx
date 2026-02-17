/**
 * Acreditado Layout — Server Component
 * Verifica autenticación server-side y redirige si no hay sesión.
 * Delega UI (sidebar, nav) al client shell.
 */
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import AcreditadoShell from './AcreditadoShell';

export default async function AcreditadoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/acreditado');
  }

  return <AcreditadoShell>{children}</AcreditadoShell>;
}
