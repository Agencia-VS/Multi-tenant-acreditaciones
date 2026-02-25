'use client';

import { useMemo } from 'react';
import { useAdmin } from './AdminContext';
import type { RegistrationStatus } from '@/types';

export default function AdminStats() {
  const { stats, loading, registrations, filters, setFilters } = useAdmin();

  // Zone breakdown for approved registrations
  const zoneCounts = useMemo(() => {
    const approved = registrations.filter(r => r.status === 'aprobado');
    const map: Record<string, number> = {};
    approved.forEach(r => {
      const zona = r.datos_extra?.zona || 'Sin zona';
      map[zona] = (map[zona] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [registrations]);

  const cards: { label: string; value: number; filterValue: RegistrationStatus | ''; icon: string; gradient: string; ring: string }[] = [
    { label: 'Total', value: stats.total, filterValue: '', icon: 'fa-users', gradient: 'from-[#00C48C] to-[#00A676]', ring: 'ring-[#00C48C]/30' },
    { label: 'Pendientes', value: stats.pendientes, filterValue: 'pendiente', icon: 'fa-clock', gradient: 'from-[#d97706] to-[#92400e]', ring: 'ring-[#d97706]/30' },
    { label: 'Aprobados', value: stats.aprobados, filterValue: 'aprobado', icon: 'fa-check-circle', gradient: 'from-[#059669] to-[#065f46]', ring: 'ring-[#059669]/30' },
    { label: 'Rechazados', value: stats.rechazados, filterValue: 'rechazado', icon: 'fa-times-circle', gradient: 'from-[#dc2626] to-[#991b1b]', ring: 'ring-[#dc2626]/30' },
  ];

  // Click stat to filter by status (toggle off if already active)
  const handleCardClick = (filterValue: RegistrationStatus | '') => {
    setFilters({
      ...filters,
      status: filters.status === filterValue ? '' : filterValue,
    });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((_, i) => (
          <div key={i} className="bg-surface rounded-2xl shadow-sm border border-edge p-5 animate-pulse">
            <div className="h-4 bg-edge rounded w-24 mb-3" />
            <div className="h-8 bg-edge rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  // Progress ratio: pendientes / total (visual urgency indicator)
  const progressPct = stats.total > 0 ? Math.round((stats.aprobados / stats.total) * 100) : 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {cards.map(card => {
          const isActive = card.filterValue !== '' && filters.status === card.filterValue;
          return (
            <button
              key={card.label}
              onClick={() => handleCardClick(card.filterValue)}
              className={`bg-surface rounded-2xl shadow-sm border p-5 sm:p-6 text-left transition-all duration-200 group min-h-[128px] ${
                isActive
                  ? `ring-2 ${card.ring} border-transparent shadow-md scale-[1.02]`
                  : 'border-edge hover:shadow-md hover:scale-[1.01]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] sm:text-xs font-semibold text-body uppercase tracking-wide flex items-center gap-1.5">
                    {card.label}
                    {isActive && <i className="fas fa-filter text-[8px] text-brand" />}
                  </p>
                  <p className="text-3xl sm:text-4xl font-bold text-heading mt-1">{card.value}</p>
                </div>
                <div className={`w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br ${card.gradient} rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110`}>
                  <i className={`fas ${card.icon} text-white text-base sm:text-lg`} />
                </div>
              </div>

              {/* Zone breakdown for Aprobados */}
              {card.label === 'Aprobados' && zoneCounts.length > 0 && stats.aprobados > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {zoneCounts.map(([zona, count]) => (
                    <span
                      key={zona}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#d1fae5] text-[#065f46] text-[11px] font-medium"
                    >
                      {zona} <span className="font-bold">{count}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Check-in count */}
              {card.label === 'Aprobados' && stats.checked_in > 0 && (
                <p className="text-sm text-muted mt-1.5">
                  <i className="fas fa-qrcode mr-1" />
                  {stats.checked_in} check-ins
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Progress bar: approval rate */}
      {stats.total > 0 && (
        <div className="flex items-center gap-3 px-1 sm:px-2">
          <div className="flex-1 h-3 bg-edge rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#059669] to-[#00C48C] rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-body whitespace-nowrap">
            {progressPct}% aprobado
          </span>
        </div>
      )}
    </div>
  );
}
