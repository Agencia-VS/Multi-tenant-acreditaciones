"use client";

import React, { createContext, useContext, ReactNode, useEffect } from 'react';

// Colores por defecto (Universidad Católica como fallback)
const DEFAULT_COLORS = {
  primario: '#1e5799',
  secundario: '#207cca',
  light: '#7db9e8',
  dark: '#2989d8',
};

export interface TenantColors {
  primario: string;
  secundario: string;
  light: string;
  dark: string;
}

export interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  // Colores del equipo
  color_primario?: string | null;
  color_secundario?: string | null;
  color_light?: string | null;
  color_dark?: string | null;
  // Assets visuales
  logo_url?: string | null;
  shield_url?: string | null;
  background_url?: string | null;
  arena_logo_url?: string | null;
  arena_nombre?: string | null;
  // Redes sociales
  social_facebook?: string | null;
  social_twitter?: string | null;
  social_instagram?: string | null;
  social_youtube?: string | null;
}

interface TenantContextType {
  tenant: Tenant;
  colors: TenantColors;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

interface TenantProviderProps {
  children: ReactNode;
  tenant: Tenant;
}

/**
 * Extrae los colores del tenant, usando valores por defecto si no existen
 */
function extractColors(tenant: Tenant): TenantColors {
  return {
    primario: tenant.color_primario || DEFAULT_COLORS.primario,
    secundario: tenant.color_secundario || DEFAULT_COLORS.secundario,
    light: tenant.color_light || DEFAULT_COLORS.light,
    dark: tenant.color_dark || DEFAULT_COLORS.dark,
  };
}

export function TenantProvider({ children, tenant }: TenantProviderProps) {
  const colors = extractColors(tenant);

  // Establecer variables CSS en el documento para que estén disponibles globalmente
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--tenant-primario', colors.primario);
    root.style.setProperty('--tenant-secundario', colors.secundario);
    root.style.setProperty('--tenant-light', colors.light);
    root.style.setProperty('--tenant-dark', colors.dark);

    // Cleanup al desmontar
    return () => {
      root.style.removeProperty('--tenant-primario');
      root.style.removeProperty('--tenant-secundario');
      root.style.removeProperty('--tenant-light');
      root.style.removeProperty('--tenant-dark');
    };
  }, [colors]);

  return (
    <TenantContext.Provider value={{ tenant, colors }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

/**
 * Hook para obtener solo los colores del tenant (útil cuando solo necesitas los colores)
 */
export function useTenantColors(): TenantColors {
  const { colors } = useTenant();
  return colors;
}