'use client';

/**
 * Acreditado Layout — Dashboard del acreditado/manager con sidebar
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const navItems = [
  { href: '/acreditado', label: 'Inicio', icon: 'fas fa-home' },
  { href: '/acreditado/dashboard', label: 'Mis Acreditaciones', icon: 'fas fa-ticket-alt' },
  { href: '/acreditado/nueva', label: 'Nueva Solicitud', icon: 'fas fa-plus-circle' },
  { href: '/acreditado/equipo', label: 'Mi Equipo', icon: 'fas fa-users' },
  { href: '/acreditado/perfil', label: 'Mi Perfil', icon: 'fas fa-user' },
];

export default function AcreditadoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push('/auth/acreditado');
  };

  return (
    <div className="min-h-screen bg-canvas flex">
      {/* Sidebar */}
      <aside className="w-64 bg-surface border-r border-edge flex flex-col fixed h-full">
        <div className="p-6 border-b border-edge">
          <Link href="/">
            <h1 className="text-xl font-bold text-heading">
              ACCR<span className="text-brand">EDIA</span>
            </h1>
          </Link>
          <p className="text-muted text-xs mt-1">Portal de Acreditados</p>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-accent-light text-brand border-r-4 border-brand'
                    : 'text-body hover:bg-canvas hover:text-heading'
                }`}
              >
                <i className={`${item.icon} w-5 text-center`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-edge">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 text-muted hover:text-danger text-sm transition w-full"
          >
            <i className="fas fa-sign-out-alt w-5 text-center" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}
