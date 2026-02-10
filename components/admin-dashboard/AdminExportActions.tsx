'use client';

import { useAdmin } from './AdminContext';

export default function AdminExportActions() {
  const { selectedEvent, filters } = useAdmin();

  if (!selectedEvent?.id) return null;

  const baseParams = `event_id=${selectedEvent.id}`;
  
  const filteredParams = (() => {
    const p = new URLSearchParams({ event_id: selectedEvent.id });
    if (filters.status) p.set('status', filters.status);
    if (filters.tipo_medio) p.set('tipo_medio', filters.tipo_medio);
    if (filters.search) p.set('search', filters.search);
    return p.toString();
  })();

  const handleExport = (format: string, filtered = false) => {
    const params = filtered ? filteredParams : baseParams;
    window.open(`/api/admin/export?${params}&format=${format}`, '_blank');
  };

  return (
    <div className="flex flex-wrap gap-2">
      <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
        <button
          onClick={() => handleExport('xlsx')}
          className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm rounded-lg transition flex items-center gap-2"
          title="Exportar Excel completo"
        >
          <i className="fas fa-file-excel text-green-600" />
          <span className="hidden sm:inline">Excel</span>
        </button>
        
        <button
          onClick={() => handleExport('csv')}
          className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm rounded-lg transition flex items-center gap-2"
          title="CSV estándar"
        >
          <i className="fas fa-file-csv text-blue-600" />
          <span className="hidden sm:inline">CSV</span>
        </button>

        <button
          onClick={() => handleExport('puntoticket')}
          className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm rounded-lg transition flex items-center gap-2"
          title="CSV formato PuntoTicket (solo aprobados)"
        >
          <i className="fas fa-ticket-alt text-purple-600" />
          <span className="hidden sm:inline">PuntoTicket</span>
        </button>
      </div>

      {(filters.status || filters.tipo_medio || filters.search) && (
        <button
          onClick={() => handleExport('csv', true)}
          className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition flex items-center gap-2"
          title="Exportar solo lo filtrado"
        >
          <i className="fas fa-filter" />
          <span className="hidden sm:inline">Exportar filtrado</span>
        </button>
      )}
    </div>
  );
}
