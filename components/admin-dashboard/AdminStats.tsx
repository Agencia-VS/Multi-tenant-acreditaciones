'use client';

import { useAdmin } from './AdminContext';

export default function AdminStats() {
  const { stats, loading } = useAdmin();

  const cards = [
    { label: 'Total', value: stats.total, icon: 'fa-users', gradient: 'from-brand to-brand-hover', bg: 'bg-accent-light' },
    { label: 'Pendientes', value: stats.pendientes, icon: 'fa-clock', gradient: 'from-warn to-warn-dark', bg: 'bg-warn-light' },
    { label: 'Aprobados', value: stats.aprobados, icon: 'fa-check-circle', gradient: 'from-success to-success-dark', bg: 'bg-success-light' },
    { label: 'Rechazados', value: stats.rechazados, icon: 'fa-times-circle', gradient: 'from-danger to-danger-dark', bg: 'bg-danger-light' },
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
              <p className="text-3xl font-bold text-heading mt-1">{card.value}</p>
            </div>
            <div className={`w-12 h-12 bg-gradient-to-br ${card.gradient} rounded-xl flex items-center justify-center shadow-sm`}>
              <i className={`fas ${card.icon} text-white text-lg`} />
            </div>
          </div>
          {card.label === 'Aprobados' && stats.checked_in > 0 && (
            <p className="text-sm text-muted mt-2">
              <i className="fas fa-qrcode mr-1" />
              {stats.checked_in} check-ins realizados
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
