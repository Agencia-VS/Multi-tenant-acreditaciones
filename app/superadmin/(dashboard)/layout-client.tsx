'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/superadmin', label: 'Dashboard', icon: 'fas fa-chart-line' },
  { href: '/superadmin/tenants', label: 'Tenants', icon: 'fas fa-building' },
  { href: '/superadmin/eventos', label: 'Eventos', icon: 'fas fa-calendar' },
  { href: '/superadmin/acreditados', label: 'Acreditados', icon: 'fas fa-users' },
  { href: '/superadmin/admins', label: 'Admins', icon: 'fas fa-user-shield' },
  { href: '/superadmin/configuracion', label: 'Configuración', icon: 'fas fa-cog' },
];

export default function SuperAdminLayoutClient({
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
    router.push('/superadmin/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col fixed h-full">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold">
            <span className="text-blue-400">ACCR</span>EDIA
          </h1>
          <p className="text-gray-500 text-xs mt-1">Super Administración</p>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/superadmin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white border-r-4 border-blue-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <i className={`${item.icon} w-5 text-center`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 text-gray-400 hover:text-red-400 text-sm transition w-full"
          >
            <i className="fas fa-sign-out-alt w-5 text-center" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}
