/**
 * SuperAdmin Root Layout — Pass-through
 * La protección de auth está en (dashboard)/layout.tsx
 * para que /superadmin/login quede fuera del guard.
 */
export default function SuperAdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
