'use client';

import { useAdmin } from './AdminContext';

export default function AdminStats() {
  const { stats, loading } = useAdmin();

  const cards = [
    { label: 'Total', value: stats.total, icon: 'fa-users', gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-50' },
    { label: 'Pendientes', value: stats.pendientes, icon: 'fa-clock', gradient: 'from-yellow-500 to-orange-500', bg: 'bg-yellow-50' },
    { label: 'Aprobados', value: stats.aprobados, icon: 'fa-check-circle', gradient: 'from-green-500 to-emerald-600', bg: 'bg-green-50' },
    { label: 'Rechazados', value: stats.rechazados, icon: 'fa-times-circle', gradient: 'from-red-500 to-rose-600', bg: 'bg-red-50' },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-20 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-12" />
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
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
            </div>
            <div className={`w-12 h-12 bg-gradient-to-br ${card.gradient} rounded-xl flex items-center justify-center shadow-sm`}>
              <i className={`fas ${card.icon} text-white text-lg`} />
            </div>
          </div>
          {card.label === 'Aprobados' && stats.checked_in > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              <i className="fas fa-qrcode mr-1" />
              {stats.checked_in} check-ins realizados
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
