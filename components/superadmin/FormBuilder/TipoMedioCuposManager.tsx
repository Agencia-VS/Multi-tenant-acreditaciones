/**
 * TipoMedioCuposManager — Gestión de cupos por tipo de medio
 * 
 * Permite configurar restricciones de cupos por tipo de medio por empresa.
 * Ejemplo: "Sitio Web" → 2 cupos por empresa, "Radiales con caseta" → 5
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface CupoTipoMedio {
  id: number;
  tenant_id: string;
  evento_id: number;
  tipo_medio: string;
  cupo_por_empresa: number;
  descripcion: string | null;
  created_at: string;
}

interface TipoMedioCuposManagerProps {
  tenantId: string;
  eventoId?: number | null;
}

export default function TipoMedioCuposManager({ tenantId, eventoId }: TipoMedioCuposManagerProps) {
  const [cupos, setCupos] = useState<CupoTipoMedio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form para agregar nuevo
  const [newTipoMedio, setNewTipoMedio] = useState('');
  const [newCupo, setNewCupo] = useState('2');
  const [newDesc, setNewDesc] = useState('');
  const [adding, setAdding] = useState(false);

  // Edición inline
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCupo, setEditCupo] = useState('');

  const fetchCupos = useCallback(async () => {
    if (!eventoId) {
      setCupos([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(
        `/api/cupos-tipo-medio?tenant_id=${encodeURIComponent(tenantId)}&evento_id=${eventoId}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCupos(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando cupos');
    } finally {
      setLoading(false);
    }
  }, [tenantId, eventoId]);

  useEffect(() => {
    fetchCupos();
  }, [fetchCupos]);

  const handleAdd = async () => {
    if (!newTipoMedio.trim() || !eventoId) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/cupos-tipo-medio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          evento_id: eventoId,
          tipo_medio: newTipoMedio.trim(),
          cupo_por_empresa: parseInt(newCupo) || 0,
          descripcion: newDesc.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setNewTipoMedio('');
      setNewCupo('2');
      setNewDesc('');
      setSuccess('Tipo de medio agregado');
      fetchCupos();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error agregando');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      const res = await fetch(`/api/cupos-tipo-medio?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cupo_por_empresa: parseInt(editCupo) || 0 }),
      });
      if (!res.ok) throw new Error('Error actualizando');

      setEditingId(null);
      setSuccess('Cupo actualizado');
      fetchCupos();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar tipo de medio "${name}"?`)) return;
    try {
      const res = await fetch(`/api/cupos-tipo-medio?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error eliminando');

      setSuccess('Tipo de medio eliminado');
      fetchCupos();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  if (!eventoId) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Restricciones de Cupos por Tipo de Medio</h3>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <p className="font-medium">Se requiere un evento activo</p>
          <p className="text-yellow-600 mt-1">
            Las restricciones de cupos se configuran por evento. Asegúrese de que este tenant tenga un evento activo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">Restricciones de Cupos por Tipo de Medio</h3>
        <p className="text-sm text-gray-500 mt-1">
          Cada tipo de medio limita cuántas acreditaciones puede enviar <strong>cada empresa</strong>.
          Por ejemplo: si &quot;Sitio Web&quot; tiene 2 cupos, cada empresa puede acreditar máximo 2 personas como Sitio Web.
        </p>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          {success}
        </div>
      )}

      {/* Tabla de cupos */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Cargando...</div>
      ) : (
        <div>
          {cupos.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-600 font-medium">Tipo de Medio</th>
                  <th className="text-center py-2 text-gray-600 font-medium w-40">Cupos / Empresa</th>
                  <th className="text-left py-2 text-gray-600 font-medium">Descripción</th>
                  <th className="text-right py-2 text-gray-600 font-medium w-24">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cupos.map((cupo) => (
                  <tr key={cupo.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 font-medium text-gray-900">{cupo.tipo_medio}</td>
                    <td className="py-2.5 text-center">
                      {editingId === cupo.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            value={editCupo}
                            onChange={(e) => setEditCupo(e.target.value)}
                            min="0"
                            className="w-16 px-2 py-1 border border-blue-300 rounded text-center text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdate(cupo.id)}
                            className="p-1 text-green-600 hover:text-green-800"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(cupo.id);
                            setEditCupo(cupo.cupo_por_empresa.toString());
                          }}
                          className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-semibold hover:bg-blue-100 transition-colors"
                        >
                          {cupo.cupo_por_empresa === 0 ? 'Sin límite' : cupo.cupo_por_empresa}
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 text-gray-500">{cupo.descripcion || '—'}</td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(cupo.id, cupo.tipo_medio)}
                        className="p-1 text-red-400 hover:text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p className="mb-1">No hay tipos de medio configurados</p>
              <p className="text-xs">Sin restricciones de cupos — cualquier empresa puede acreditar sin límite por tipo</p>
            </div>
          )}
        </div>
      )}

      {/* Formulario para agregar */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Agregar tipo de medio</h4>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Nombre del tipo *</label>
            <input
              type="text"
              value={newTipoMedio}
              onChange={(e) => setNewTipoMedio(e.target.value)}
              placeholder="Ej: Sitio Web, Radiales con caseta, Televisión..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs text-gray-500 mb-1">Cupos/Empresa</label>
            <input
              type="number"
              value={newCupo}
              onChange={(e) => setNewCupo(e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="w-48">
            <label className="block text-xs text-gray-500 mb-1">Descripción</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Opcional"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !newTipoMedio.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {adding ? 'Agregando...' : '+ Agregar'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Ingrese 0 como cupos para &quot;sin límite&quot;. El campo de tipo de medio en el formulario se llenará automáticamente con estas opciones.
        </p>
      </div>
    </div>
  );
}
