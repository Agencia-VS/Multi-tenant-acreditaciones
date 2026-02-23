import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// ─── Dominios ────────────────────────────────────────────────
const MAIN_DOMAIN = 'accredia.cl';
const LOCALHOSTS = ['localhost', '127.0.0.1'];

/**
 * Rutas "compartidas" que viven en app/ raíz y NO deben
 * reescribirse con prefijo de tenant en subdominios.
 * (Las rutas /api, /_next, /static ya se excluyen en el matcher.)
 */
const SHARED_PATHS = ['/auth', '/acreditado', '/superadmin', '/qr'];

function isSharedPath(pathname: string): boolean {
  return SHARED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
}

// ─── Resolver tenant ─────────────────────────────────────────

/**
 * Resuelve el tenant a partir de subdominio o query param.
 * Retorna la ruta reescrita o undefined si no hay rewrite.
 */
function resolveTenantRewrite(req: NextRequest): string | undefined {
  const { hostname, pathname, searchParams } = req.nextUrl;

  // Rutas compartidas nunca se reescriben (auth, acreditado, etc.)
  if (isSharedPath(pathname)) {
    return undefined;
  }

  // ── Localhost / dev ──────────────────────────────────────────
  if (LOCALHOSTS.some((host) => hostname.startsWith(host))) {
    let tenant = searchParams.get('tenant') || '';

    // Subdominio local: club.localhost:3000
    const match = hostname.match(/^([^.]+)\.localhost/);
    if (!tenant && match) {
      tenant = match[1];
    }

    if (tenant) {
      // Si el pathname ya lleva el tenant, no reescribir
      if (pathname.startsWith(`/${tenant}`)) {
        return undefined;
      }
      return `/${tenant}${pathname}`;
    }
    return undefined;
  }

  // ── Dominio principal (accredia.cl / www.accredia.cl) ───────
  // Si es el dominio principal o www, dejar pasar → app/page.tsx (landing)
  if (
    hostname === MAIN_DOMAIN ||
    hostname === `www.${MAIN_DOMAIN}` ||
    !hostname.endsWith(`.${MAIN_DOMAIN}`)
  ) {
    return undefined;
  }

  // ── Subdominio → tenant ─────────────────────────────────────
  const subdomain = hostname.replace(`.${MAIN_DOMAIN}`, '');
  if (!subdomain || subdomain === 'www') {
    return undefined;
  }

  // Si el pathname ya incluye el tenant, no duplicar
  if (pathname.startsWith(`/${subdomain}`)) {
    return undefined;
  }

  // Rewrite: cruzados.accredia.cl/admin → /cruzados/admin
  return `/${subdomain}${pathname}`;
}

// ─── Middleware principal ─────────────────────────────────────

/**
 * Middleware de Next.js
 *
 * 1. Refresca la sesión de Supabase (evita "Refresh Token Not Found")
 * 2. Resuelve tenant por subdominio/query → rewrite de URL
 */
export async function tenantMiddleware(req: NextRequest) {
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
