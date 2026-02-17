'use client';

/**
 * Acreditado Shell — Dashboard sidebar + navigation (client component)
 * Mobile: bottom nav + hamburger drawer
 * Desktop: fixed sidebar
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/acreditado', label: 'Inicio', icon: 'fas fa-home' },
  { href: '/acreditado/dashboard', label: 'Mis Acreditaciones', icon: 'fas fa-ticket-alt' },
  { href: '/acreditado/nueva', label: 'Nueva Solicitud', icon: 'fas fa-plus-circle' },
  { href: '/acreditado/equipo', label: 'Mi Equipo', icon: 'fas fa-users' },
  { href: '/acreditado/perfil', label: 'Mi Perfil', icon: 'fas fa-user' },
];

export default function AcreditadoShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/auth/acreditado');
  };

  const SidebarContent = () => (
    <>
      <div className="p-5 md:p-6 border-b border-edge">
        <Link href="/">
          <h1 className="text-xl font-bold text-heading">
            ACCR<span className="text-brand">EDIA</span>
          </h1>
        </Link>
        <p className="text-muted text-xs mt-1">Portal de Acreditados</p>
      </div>

      <nav className="flex-1 py-3 md:py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-5 md:px-6 py-3.5 md:py-3 text-sm transition-colors ${
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
          className="flex items-center gap-3 text-muted hover:text-danger text-sm transition w-full py-2"
        >
          <i className="fas fa-sign-out-alt w-5 text-center" />
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-surface border-b border-edge px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 rounded-lg text-body hover:bg-canvas transition"
          aria-label="Abrir menú"
        >
          <i className="fas fa-bars text-lg" />
        </button>
        <Link href="/">
          <h1 className="text-lg font-bold text-heading">
            ACCR<span className="text-brand">EDIA</span>
          </h1>
        </Link>
        <div className="w-8" /> {/* spacer for centering */}
      </div>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            className="w-72 max-w-[85vw] h-full bg-surface flex flex-col sidebar-enter shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg text-muted hover:text-heading hover:bg-canvas transition"
                aria-label="Cerrar menú"
              >
                <i className="fas fa-times text-lg" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-64 bg-surface border-r border-edge flex-col fixed h-full z-30">
        <SidebarContent />
      </aside>

      {/* ── Main content ── */}
      <main className="md:ml-64 pt-14 md:pt-0 px-4 py-6 md:p-8 pb-24 md:pb-8 min-h-screen">
        {children}
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-edge pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch">
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[0.6rem] transition-colors ${
                  isActive ? 'text-brand' : 'text-muted'
                }`}
              >
                <i className={`${item.icon} text-base`} />
                <span className="truncate max-w-[60px]">{item.label.split(' ').pop()}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
