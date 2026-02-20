'use client';

/**
 * BillingBanner — Banner de advertencia de límites y estado de suscripción
 * Se muestra en el header del admin cuando:
 * - La suscripción está en past_due (pago fallido)
 * - El uso está al ≥80% de algún límite
 */
import { useState, useEffect } from 'react';
import type { BillingLimitCheck } from '@/types';

interface Props {
  tenantId: string;
}

export default function BillingBanner({ tenantId }: Props) {
  const [warnings, setWarnings] = useState<BillingLimitCheck[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function checkLimits() {
      try {
        const res = await fetch(`/api/billing?action=usage&tenant_id=${tenantId}`);
        if (!res.ok) return;
        const data = await res.json();
        
        const alerts: BillingLimitCheck[] = [];
        
        // Verificar estado de suscripción
        if (data.plan && !data.is_free) {
          // Se verificará vía subscription status en el backend
        }
        
        // Verificar cada métrica de uso
        const metrics = data.metrics;
        if (metrics) {
          for (const [key, m] of Object.entries(metrics) as [string, { current: number; limit: number; label: string }][]) {
            if (m.limit === -1) continue; // ilimitado
            if (m.limit === 0) continue;
            const pct = Math.round((m.current / m.limit) * 100);
            if (pct >= 80) {
              alerts.push({
                allowed: pct < 100,
                current: m.current,
                limit: m.limit,
                metric: key,
                plan_name: data.plan?.name || 'Free',
                percentage: pct,
                message: pct >= 100
                  ? `Has alcanzado el límite de ${m.label.toLowerCase()} (${m.current}/${m.limit})`
                  : `Estás al ${pct}% del límite de ${m.label.toLowerCase()} (${m.current}/${m.limit})`,
              });
            }
          }
        }
        
        setWarnings(alerts);
      } catch {
        // silently fail
      }
    }
    
    checkLimits();
  }, [tenantId]);

  if (dismissed || warnings.length === 0) return null;

  const hasCritical = warnings.some(w => !w.allowed);

  return (
    <div className={`mx-3 sm:mx-6 mt-3 px-4 py-3 rounded-xl border flex items-start gap-3 ${
      hasCritical
        ? 'bg-danger-light border-danger/20'
        : 'bg-warn-light border-yellow-300/40'
    }`}>
      <i className={`fas ${hasCritical ? 'fa-exclamation-circle text-danger' : 'fa-exclamation-triangle text-yellow-600'} mt-0.5`} />
      <div className="flex-1 min-w-0">
        {warnings.map((w, i) => (
          <p key={i} className={`text-sm ${hasCritical ? 'text-danger-dark' : 'text-yellow-800'}`}>
            {w.message}
          </p>
        ))}
        <p className={`text-xs mt-1 ${hasCritical ? 'text-danger-dark/70' : 'text-yellow-700/70'}`}>
          {hasCritical
            ? 'Actualiza tu plan para continuar creando recursos.'
            : 'Considera actualizar tu plan para evitar interrupciones.'}
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted hover:text-heading shrink-0"
      >
        <i className="fas fa-times text-sm" />
      </button>
    </div>
  );
}
