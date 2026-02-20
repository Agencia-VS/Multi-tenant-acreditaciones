'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/superadmin', label: 'Dashboard', icon: 'fas fa-chart-line' },
  { href: '/superadmin/tenants', label: 'Tenants', icon: 'fas fa-building' },
  { href: '/superadmin/eventos', label: 'Eventos', icon: 'fas fa-calendar' },
  { href: '/superadmin/admins', label: 'Admins', icon: 'fas fa-user-shield' },
  { href: '/superadmin/billing', label: 'Billing', icon: 'fas fa-credit-card' },
  { href: '/superadmin/configuracion', label: 'Configuración', icon: 'fas fa-cog' },
];

export default function SuperAdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/superadmin/login');
  };

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-dark-edge flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">
            <span className="text-accent">ACCR</span>EDIA
          </h1>
          <p className="text-dark-dimmed text-xs mt-1">Super Administración</p>
        </div>
        <button
          className="md:hidden text-dark-muted hover:text-white"
          onClick={() => setSidebarOpen(false)}
        >
          <i className="fas fa-times text-lg" />
        </button>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/superadmin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-brand text-white border-r-4 border-accent'
                  : 'text-dark-muted hover:bg-dark-subtle hover:text-white'
              }`}
            >
              <i className={`${item.icon} w-5 text-center`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-dark-edge">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 text-dark-muted hover:text-red-400 text-sm transition w-full"
        >
          <i className="fas fa-sign-out-alt w-5 text-center" />
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-canvas flex">
      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-dark-surface border-b border-dark-edge flex items-center justify-between px-4 py-3">
        <button onClick={() => setSidebarOpen(true)} className="text-white">
          <i className="fas fa-bars text-lg" />
        </button>
        <h1 className="text-sm font-bold text-white">
          <span className="text-accent">ACCR</span>EDIA
        </h1>
        <div className="w-7" /> {/* spacer */}
      </header>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed on desktop, slide-over on mobile */}
      <aside
        className={`
          bg-dark-surface text-white flex flex-col fixed h-full z-50 w-64
          transition-transform duration-200
          md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 md:ml-64 p-4 pt-16 md:p-8 md:pt-8 overflow-x-hidden">{children}</main>
    </div>
  );
}
