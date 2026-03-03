/**
 * Rate Limiter — In-memory token-bucket por IP
 *
 * Uso en API routes:
 *   import { rateLimit } from '@/lib/rateLimit';
 *   const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 500 });
 *
 *   // En el handler:
 *   const limited = limiter.check(request, 10); // 10 requests por minuto por IP
 *   if (limited) return limited; // NextResponse 429
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitOptions {
  /** Ventana de tiempo en ms (default: 60_000 = 1 min) */
  interval?: number;
  /** Máximo de tokens únicos rastreados (default: 500) */
  uniqueTokenPerInterval?: number;
}

interface TokenBucket {
  count: number;
  expiresAt: number;
}

export function rateLimit(options: RateLimitOptions = {}) {
  const { interval = 60_000, uniqueTokenPerInterval = 500 } = options;
  const tokenCache = new Map<string, TokenBucket>();

  // Limpieza periódica para evitar memory leaks
  const cleanup = () => {
    const now = Date.now();
    for (const [key, bucket] of tokenCache) {
      if (bucket.expiresAt < now) {
        tokenCache.delete(key);
      }
    }
    // Si tenemos demasiados tokens, limpiar los más antiguos
    if (tokenCache.size > uniqueTokenPerInterval) {
      const entries = [...tokenCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      const toDelete = entries.slice(0, entries.length - uniqueTokenPerInterval);
      for (const [key] of toDelete) {
        tokenCache.delete(key);
      }
    }
  };

  return {
    /**
     * Verifica el rate limit para una request.
     * @returns null si OK, NextResponse 429 si excedido
     */
    check(request: NextRequest, limit: number): NextResponse | null {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';

      const now = Date.now();
      const existing = tokenCache.get(ip);

      if (!existing || existing.expiresAt < now) {
        tokenCache.set(ip, { count: 1, expiresAt: now + interval });
        cleanup();
        return null;
      }

      existing.count++;
      if (existing.count > limit) {
        const retryAfter = Math.ceil((existing.expiresAt - now) / 1000);
        return NextResponse.json(
          { error: 'Demasiadas solicitudes. Intenta de nuevo en unos momentos.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Limit': String(limit),
              'X-RateLimit-Remaining': '0',
            },
          }
        );
      }

      return null;
    },
  };
}

// ─── Pre-built limiters para rutas comunes ──────────────
/** Auth: 10 req/min por IP */
export const authLimiter = rateLimit({ interval: 60_000 });

/** API general: 60 req/min por IP */
export const apiLimiter = rateLimit({ interval: 60_000 });

/** Upload/bulk: 5 req/min por IP */
export const heavyLimiter = rateLimit({ interval: 60_000 });
