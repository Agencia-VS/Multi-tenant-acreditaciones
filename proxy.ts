import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

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
 * Resuelve el tenant a partir de subdominio o query param.
 * Retorna la ruta reescrita o undefined si no hay rewrite.
 */
function resolveTenantRewrite(req: NextRequest): string | undefined {
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

/**
 * Proxy — Next.js 16 (reemplaza middleware.ts)
 *
 * 1. Refresca la sesión de Supabase (evita "Refresh Token Not Found")
 * 2. Resuelve tenant por subdominio/query → rewrite de URL
 */
export async function proxy(req: NextRequest) {
  // 1. Refresh de sesión Supabase (actualiza cookies)
  const { supabaseResponse } = await updateSession(req);

  // 2. Resolver rewrite de tenant
  const rewrite = resolveTenantRewrite(req);

  if (rewrite) {
    // Aplicar rewrite preservando las cookies del refresh
    const url = req.nextUrl.clone();
    url.pathname = rewrite;
    const rewriteResponse = NextResponse.rewrite(url);

    // Copiar cookies de sesión al response reescrito
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      rewriteResponse.cookies.set(cookie.name, cookie.value, {
        ...cookie,
      });
    });

    return rewriteResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next|api|static|.*\\.(?:png|jpg|jpeg|ico|svg|webp|gif|css|js|map)$).*)',
  ],
};
