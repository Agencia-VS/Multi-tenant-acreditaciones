"use client";

import { useTenantColors } from "../tenant/TenantContext";

interface AdminFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  estadoFilter: string;
  setEstadoFilter: (filter: string) => void;
  onRefresh: () => void;
}

export default function AdminFilters({
  searchTerm,
  setSearchTerm,
  estadoFilter,
  setEstadoFilter,
  onRefresh,
}: AdminFiltersProps) {
  const colors = useTenantColors();

  return (
    <div className="mb-6">
      {/* Encabezado del Panel */}
      <div className="bg-white/95 backdrop-blur-sm rounded-t-2xl px-6 py-4 shadow-lg">
        <h2 className="text-lg font-bold" style={{ color: colors.primario }}>
          Filtros y Búsqueda
        </h2>
      </div>

      {/* Contenido del Panel */}
      <div className="bg-white/90 backdrop-blur-sm p-6 rounded-b-2xl shadow-lg">
        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Nombre, email, RUT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none transition-all shadow-sm"
              onFocus={(e) => e.target.style.borderColor = colors.primario}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Estado
            </label>
            <select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none transition-all shadow-sm"
              onFocus={(e) => e.target.style.borderColor = colors.primario}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            >
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazada">Rechazada</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={onRefresh}
              className="w-full px-4 py-3 text-white rounded-xl font-semibold hover:shadow-xl transition-all hover:scale-105 active:scale-95"
              style={{ background: `linear-gradient(to right, ${colors.primario}, ${colors.dark})` }}
            >
              Actualizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}