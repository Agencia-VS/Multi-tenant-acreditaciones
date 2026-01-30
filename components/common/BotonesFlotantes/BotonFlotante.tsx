// components/common/BotonesFlotantes/BotonFlotante.tsx
"use client";

import { useTenant, useTenantColors } from "../../tenant/TenantContext";

export default function BotonFlotante() {
  const { tenant } = useTenant();
  const colors = useTenantColors();
  
  // Construir URL del sitio web del tenant si existe
  const websiteUrl = tenant.social_facebook || tenant.social_instagram || tenant.social_twitter || `https://www.google.com/search?q=${encodeURIComponent(tenant.nombre)}`;
  
  return (
    <a
      href={websiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-3 sm:bottom-6 right-3 sm:right-6 z-40 group active:scale-95"
    >
      <div 
        className="flex items-center gap-1 sm:gap-3 bg-white/95 backdrop-blur-sm px-2.5 sm:px-5 py-1.5 sm:py-3 rounded-full shadow-2xl hover:bg-white hover:scale-105 transition-all duration-300"
        style={{ borderColor: `${colors.primario}33`, borderWidth: '1px' }}
      >
        <span 
          className="font-semibold text-xs sm:text-sm hidden sm:inline"
          style={{ color: colors.primario }}
        >
          {tenant.nombre}
        </span>
        <svg 
          className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform flex-shrink-0" 
          style={{ color: colors.dark }}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </div>
    </a>
  );
}
