import type { Tenant } from '@/types';

interface TenantConfigInfoProps {
  tenant: Tenant;
  eventCount: number;
}

export default function TenantConfigInfo({ tenant, eventCount }: TenantConfigInfoProps) {
  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-edge p-6">
      <h2 className="text-lg font-bold text-heading mb-4">Configuración del Tenant</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 bg-canvas rounded-xl">
          <p className="text-xs text-muted">Slug</p>
          <p className="text-sm font-mono text-label mt-1">{tenant.slug}</p>
        </div>
        <div className="p-3 bg-canvas rounded-xl">
          <p className="text-xs text-muted">Color primario</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-5 h-5 rounded-md" style={{ backgroundColor: tenant.color_primario }} />
            <span className="text-sm font-mono text-label">{tenant.color_primario}</span>
          </div>
        </div>
        <div className="p-3 bg-canvas rounded-xl">
          <p className="text-xs text-muted">Estado</p>
          <p className="text-sm text-label mt-1">{tenant.activo ? '✅ Activo' : '❌ Inactivo'}</p>
        </div>
        <div className="p-3 bg-canvas rounded-xl">
          <p className="text-xs text-muted">Total eventos</p>
          <p className="text-sm font-bold text-label mt-1">{eventCount}</p>
        </div>
      </div>
    </div>
  );
}
