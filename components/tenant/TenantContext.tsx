"use client";

import React, { createContext, useContext, ReactNode, useEffect } from 'react';

// Colores por defecto neutros (gris) - se sobrescriben con los colores del tenant de la DB
const DEFAULT_COLORS = {
  primario: '#374151',
  secundario: '#6b7280',
  light: '#9ca3af',
  dark: '#1f2937',
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

  // Convertir hex a RGB para usar en rgba()
  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
    }
    return '55, 65, 81'; // fallback gris
  };

  // Establecer variables CSS en el documento para que estén disponibles globalmente
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--tenant-primario', colors.primario);
    root.style.setProperty('--tenant-secundario', colors.secundario);
    root.style.setProperty('--tenant-light', colors.light);
    root.style.setProperty('--tenant-dark', colors.dark);
    
    // Variables RGB para usar en rgba()
    root.style.setProperty('--tenant-primario-rgb', hexToRgb(colors.primario));
    root.style.setProperty('--tenant-secundario-rgb', hexToRgb(colors.secundario));

    // Cleanup al desmontar
    return () => {
      root.style.removeProperty('--tenant-primario');
      root.style.removeProperty('--tenant-secundario');
      root.style.removeProperty('--tenant-light');
      root.style.removeProperty('--tenant-dark');
      root.style.removeProperty('--tenant-primario-rgb');
      root.style.removeProperty('--tenant-secundario-rgb');
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