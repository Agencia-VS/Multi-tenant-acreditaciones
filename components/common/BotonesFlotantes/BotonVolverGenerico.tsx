"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface BotonVolverGenericoProps {
  href?: string;
  label?: string;
  variant?: 'light' | 'dark' | 'glass';
}

/**
 * Botón Volver genérico que no depende del contexto de tenant.
 * Útil para páginas como superadmin, acreditado, etc.
 */
export default function BotonVolverGenerico({ 
  href = "/", 
  label = "Volver",
  variant = 'dark'
}: BotonVolverGenericoProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setIsNavigating(true);
    router.push(href);
  };

  const variantStyles = {
    light: "bg-white text-gray-700 hover:bg-gray-100 border-gray-200",
    dark: "bg-gray-900 text-white hover:bg-gray-800 border-gray-700",
    glass: "bg-white/20 backdrop-blur-md text-white hover:bg-white/30 border-white/30",
  };

  return (
    <>
      {isNavigating && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            <p className="text-white font-medium">Cargando...</p>
          </div>
        </div>
      )}

      <Link
        href={href}
        onClick={handleClick}
        className={`fixed top-4 left-4 z-40 inline-flex items-center gap-2 font-medium transition-all px-4 py-2.5 rounded-xl border hover:scale-105 active:scale-95 text-sm shadow-lg ${variantStyles[variant]}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>{label}</span>
      </Link>
    </>
  );
}
