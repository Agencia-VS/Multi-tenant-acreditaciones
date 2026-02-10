'use client';

import { useAdmin } from './AdminContext';
import { TIPOS_MEDIO } from '@/types';

export default function AdminFilters() {
  const { events, filters, setFilters, fetchData, registrations, selectedIds } = useAdmin();

  const updateFilter = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex flex-wrap gap-3 items-center">
        {/* Event selector */}
        {events.length > 1 && (
          <select
            value={filters.event_id}
            onChange={e => updateFilter('event_id', e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          >
            <option value="">Seleccionar evento</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.nombre} {ev.is_active ? '●' : ''}
              </option>
            ))}
          </select>
        )}

        {/* Search */}
        <div className="flex-1 min-w-[220px] relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            placeholder="Buscar por nombre, RUT, organización..."
            value={filters.search}
            onChange={e => updateFilter('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          />
          {filters.search && (
            <button
              onClick={() => updateFilter('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <i className="fas fa-times text-xs" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={filters.status}
          onChange={e => updateFilter('status', e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">⏳ Pendientes</option>
          <option value="aprobado">✅ Aprobados</option>
          <option value="rechazado">❌ Rechazados</option>
          <option value="revision">🔍 En Revisión</option>
        </select>

        {/* Tipo Medio filter */}
        <select
          value={filters.tipo_medio}
          onChange={e => updateFilter('tipo_medio', e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
        >
          <option value="">Todos los medios</option>
          {TIPOS_MEDIO.map(tm => (
            <option key={tm} value={tm}>{tm}</option>
          ))}
        </select>

        {/* Refresh */}
        <button
          onClick={fetchData}
          className="px-3 py-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
          title="Actualizar datos"
        >
          <i className="fas fa-sync-alt" />
        </button>
      </div>

      {/* Active filter pills */}
      {(filters.status || filters.tipo_medio || filters.search) && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-400">Filtros activos:</span>
          {filters.search && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
              Búsqueda: &quot;{filters.search}&quot;
              <button onClick={() => updateFilter('search', '')} className="hover:text-blue-900"><i className="fas fa-times text-[10px]" /></button>
            </span>
          )}
          {filters.status && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">
              Estado: {filters.status}
              <button onClick={() => updateFilter('status', '')} className="hover:text-purple-900"><i className="fas fa-times text-[10px]" /></button>
            </span>
          )}
          {filters.tipo_medio && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
              Medio: {filters.tipo_medio}
              <button onClick={() => updateFilter('tipo_medio', '')} className="hover:text-green-900"><i className="fas fa-times text-[10px]" /></button>
            </span>
          )}
          <button
            onClick={() => setFilters({ ...filters, search: '', status: '', tipo_medio: '' })}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Limpiar todos
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
        <span>{registrations.length} registros encontrados</span>
        {selectedIds.size > 0 && (
          <span className="text-blue-600 font-medium">{selectedIds.size} seleccionados</span>
        )}
      </div>
    </div>
  );
}
