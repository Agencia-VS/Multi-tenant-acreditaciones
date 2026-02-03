import type { NextRequest } from 'next/server';

// Configura aquí tu dominio principal
const MAIN_DOMAIN = 'accredia.cl';
const LOCALHOSTS = ['localhost', '127.0.0.1'];

function isStaticOrApiPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    /\.(png|jpg|jpeg|ico|svg|webp|gif|css|js|map)$/i.test(pathname)
  );
}

/**
 * Proxy function for multi-tenant routing.
 * Replaces the deprecated middleware.ts convention in Next.js 16+.
 * 
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */
export function proxy(req: NextRequest): string | undefined {
  const { hostname, pathname, searchParams } = req.nextUrl;

  // Excepciones: rutas estáticas, api, archivos
  if (isStaticOrApiPath(pathname)) {
    return undefined;
  }

  // Si es localhost, permitir tenant por query param o subdominio local
  if (LOCALHOSTS.some((host) => hostname.startsWith(host))) {
    let tenant = searchParams.get('tenant') || '';
    
    // club.localhost:3000
    const match = hostname.match(/^([^.]+)\.localhost/);
    if (!tenant && match) {
      tenant = match[1];
    }
    
    if (tenant) {
      // Si pathname ya incluye el tenant, no reescribir
      if (pathname.startsWith(`/${tenant}`)) {
        return undefined;
      }
      // Retornar la nueva URL para rewrite
      return `/${tenant}${pathname}`;
    }
    return undefined;
  }

  // Si es dominio principal sin subdominio, no hacer nada
  if (hostname === MAIN_DOMAIN || !hostname.endsWith('.' + MAIN_DOMAIN)) {
    return undefined;
  }

  // Extraer subdominio
  const subdomain = hostname.replace('.' + MAIN_DOMAIN, '');
  if (!subdomain || subdomain === hostname) {
    return undefined;
  }

  // Rewrite al tenant correspondiente
  return `/${subdomain}${pathname}`;
}

export const config = {
  matcher: [
    '/((?!_next|api|static|.*\\.(?:png|jpg|jpeg|ico|svg|webp|gif|css|js|map)$).*)',
  ],
};
