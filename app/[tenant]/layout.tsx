/**
 * Tenant Layout — Carga datos del tenant y aplica branding
 * Sets CSS custom properties from the palette generator so all
 * design-system tokens (text-heading, bg-brand, etc.) are brand-tinted.
 */
import { notFound } from 'next/navigation';
import { getTenantBySlug } from '@/lib/services/tenants';
import { generateTenantPalette, paletteToCSS } from '@/lib/colors';

/** Cachear datos del tenant 1 hora — revalidado tras mutaciones en API */
export const revalidate = 3600;

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);

  if (!tenant) notFound();

  const palette = generateTenantPalette(
    tenant.color_primario,
    tenant.color_secundario,
    tenant.color_light,
    tenant.color_dark,
  );

  const cssVars = paletteToCSS(palette, {
    primario: tenant.color_primario,
    secundario: tenant.color_secundario,
    light: tenant.color_light,
    dark: tenant.color_dark,
  });

  return (
    <div style={cssVars as React.CSSProperties}>
      {children}
    </div>
  );
}
