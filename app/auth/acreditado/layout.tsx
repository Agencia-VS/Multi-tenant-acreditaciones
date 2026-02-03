'use client';

import { AuthAcreditadoProvider } from '../../../components/auth';

interface LayoutProps {
  children: React.ReactNode;
}

export default function AuthAcreditadoLayout({ children }: LayoutProps) {
  return (
    <AuthAcreditadoProvider>
      {children}
    </AuthAcreditadoProvider>
  );
}
