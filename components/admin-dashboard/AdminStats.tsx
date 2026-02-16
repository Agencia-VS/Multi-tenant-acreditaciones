'use client';

import { useMemo } from 'react';
import { useAdmin } from './AdminContext';

export default function AdminStats() {
  const { stats, loading, registrations } = useAdmin();

  // Zone breakdown for approved registrations
  const zoneCounts = useMemo(() => {
    const approved = registrations.filter(r => r.status === 'aprobado');
    const map: Record<string, number> = {};
    approved.forEach(r => {
      const zona = (r.datos_extra as Record<string, unknown>)?.zona as string || 'Sin zona';
      map[zona] = (map[zona] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [registrations]);

  const cards = [
    { label: 'Total', value: stats.total, icon: 'fa-users', gradient: 'from-[#00C48C] to-[#00A676]', bg: 'bg-[#e6faf3]' },
    { label: 'Pendientes', value: stats.pendientes, icon: 'fa-clock', gradient: 'from-[#d97706] to-[#92400e]', bg: 'bg-[#fef3c7]' },
    { label: 'Aprobados', value: stats.aprobados, icon: 'fa-check-circle', gradient: 'from-[#059669] to-[#065f46]', bg: 'bg-[#D4F5E9]' },
    { label: 'Rechazados', value: stats.rechazados, icon: 'fa-times-circle', gradient: 'from-[#dc2626] to-[#991b1b]', bg: 'bg-[#fee2e2]' },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((_, i) => (
          <div key={i} className="bg-surface rounded-2xl shadow-sm border border-edge p-4 animate-pulse">
            <div className="h-4 bg-edge rounded w-20 mb-3" />
            <div className="h-8 bg-edge rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <div
          key={card.label}
          className="bg-surface rounded-2xl shadow-sm border border-edge p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-medium text-body uppercase tracking-wide">{card.label}</p>
              <p className="text-2xl sm:text-3xl font-bold text-heading mt-1">{card.value}</p>
            </div>
            <div className={`w-12 h-12 bg-gradient-to-br ${card.gradient} rounded-xl flex items-center justify-center shadow-sm`}>
              <i className={`fas ${card.icon} text-white text-lg`} />
            </div>
          </div>

          {/* Zone breakdown for Aprobados */}
          {card.label === 'Aprobados' && zoneCounts.length > 0 && stats.aprobados > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {zoneCounts.map(([zona, count]) => (
                <span
                  key={zona}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#d1fae5] text-[#065f46] text-xs font-medium"
                >
                  {zona} <span className="font-bold">{count}</span>
                </span>
              ))}
            </div>
          )}

          {/* Check-in count */}
          {card.label === 'Aprobados' && stats.checked_in > 0 && (
            <p className="text-sm text-muted mt-1">
              <i className="fas fa-qrcode mr-1" />
              {stats.checked_in} check-ins
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
