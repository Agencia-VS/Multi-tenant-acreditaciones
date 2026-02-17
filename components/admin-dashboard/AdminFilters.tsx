'use client';

import { useAdmin } from './AdminContext';

export default function AdminFilters() {
  const { events, filters, setFilters, fetchData, registrations, selectedIds } = useAdmin();

  const updateFilter = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-edge p-4">
      <div className="flex flex-wrap gap-3 items-center">
        {/* Event selector */}
        {events.length > 1 && (
          <select
            value={filters.event_id}
            onChange={e => updateFilter('event_id', e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-edge text-base text-label bg-canvas focus:border-brand transition"
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
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-muted text-base" />
          <input
            type="text"
            placeholder="Buscar por nombre, RUT, organización..."
            value={filters.search}
            onChange={e => updateFilter('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-edge text-base text-label bg-canvas focus:border-brand transition"
          />
          {filters.search && (
            <button
              onClick={() => updateFilter('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-body"
            >
              <i className="fas fa-times text-xs" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={filters.status}
          onChange={e => updateFilter('status', e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-edge text-base text-label bg-canvas focus:border-brand transition"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">⏳ Pendientes</option>
          <option value="aprobado">✅ Aprobados</option>
          <option value="rechazado">❌ Rechazados</option>
          <option value="revision">🔍 En Revisión</option>
        </select> 

        {/* Refresh */}
        <button
          onClick={fetchData}
          className="px-3 py-2.5 text-body hover:text-brand hover:bg-accent-light rounded-xl transition"
          title="Actualizar datos"
        >
          <i className="fas fa-sync-alt" />
        </button>
      </div>

      {/* Active filter pills */}
      {(filters.status || filters.tipo_medio || filters.search) && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-edge">
          <span className="text-sm text-muted">Filtros activos:</span>
          {filters.search && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-accent-light text-brand text-sm rounded-full">
              Búsqueda: &quot;{filters.search}&quot;
              <button onClick={() => updateFilter('search', '')} className="hover:text-brand"><i className="fas fa-times text-[10px]" /></button>
            </span>
          )}
          {filters.status && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-sm rounded-full">
              Estado: {filters.status}
              <button onClick={() => updateFilter('status', '')} className="hover:text-purple-900"><i className="fas fa-times text-[10px]" /></button>
            </span>
          )}
          <button
            onClick={() => setFilters({ ...filters, search: '', status: '', tipo_medio: '' })}
            className="text-sm text-danger hover:text-danger-dark underline"
          >
            Limpiar todos
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-edge text-sm text-muted">
        <span>{registrations.length} registros encontrados</span>
        {selectedIds.size > 0 && (
          <span className="text-brand font-medium">{selectedIds.size} seleccionados</span>
        )}
      </div>
    </div>
  );
}
