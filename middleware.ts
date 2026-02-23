/**
 * middleware.ts — Punto de entrada que Next.js reconoce automáticamente.
 *
 * Toda la lógica vive en proxy.ts para mantener este archivo limpio.
 * Next.js (incluyendo v16) requiere que este archivo exista en la raíz
 * y exporte "middleware" + opcionalmente "config".
 */
import { tenantMiddleware } from './proxy';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  return tenantMiddleware(req);
}

/**
 * Matcher: rutas que pasan por el middleware.
 * Se excluyen archivos estáticos, API y assets para rendimiento.
 */
export const config = {
  matcher: [
    /*
     * Match todas las rutas EXCEPTO:
     * - _next (archivos internos de Next.js)
     * - api   (rutas de API — tienen su propia auth)
     * - static (archivos estáticos)
     * - archivos con extensión de imagen/css/js/etc.
     */
    '/((?!_next|api|static|.*\\.(?:png|jpg|jpeg|ico|svg|webp|gif|css|js|map)$).*)',
  ],
};
