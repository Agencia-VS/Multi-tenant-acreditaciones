'use client';

import { useState, useEffect, useCallback } from 'react';
import type { QuotaCheckResult } from '@/types';

/**
 * Hook: Verifica cupos en tiempo real mientras el usuario llena el formulario.
 * "Llevas 1/2 cupos de Sitio Web utilizados"
 */
export function useQuotaCheck(eventId: string | null) {
  const [quotaResult, setQuotaResult] = useState<QuotaCheckResult | null>(null);
  const [loading, setLoading] = useState(false);

  const checkQuota = useCallback(
    async (tipoMedio: string, organizacion: string) => {
      if (!eventId || !tipoMedio || !organizacion) {
        setQuotaResult(null);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/events/${eventId}/quotas?tipo_medio=${encodeURIComponent(tipoMedio)}&organizacion=${encodeURIComponent(organizacion)}`
        );
        const data = await res.json();
        setQuotaResult(data);
      } catch {
        setQuotaResult(null);
      } finally {
        setLoading(false);
      }
    },
    [eventId]
  );

  return { quotaResult, loading, checkQuota };
}
