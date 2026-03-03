'use client';

/**
 * Mis Acreditaciones — Dashboard del acreditado
 *
 * Dos secciones:
 * 1. Estado por Tenant: tarjetas con % de completitud del perfil por organización
 * 2. Historial: acreditaciones agrupadas por evento, secciones colapsables
 *
 * Implementa "Registros Contextuales":
 * - Muestra qué datos faltan para cada tenant activo
 * - Detecta cambios en formularios (campos nuevos/eliminados)
 * - Link directo para completar datos faltantes
 */
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LoadingSpinner } from '@/components/shared/ui';
import type { TenantProfileStatus } from '@/types';
import { STATUS_MAP, type RegistrationStatus } from '@/types';
import { cleanRut, formatRut } from '@/lib/validation';

// ─── Registration type (from API) ──────────────────────────────────────────

interface Registration {
  id: string;
  status: string;
  organizacion: string | null;
  tipo_medio: string | null;
  cargo: string | null;
  qr_token: string | null;
  motivo_rechazo: string | null;
  created_at: string;
  profile_id: string;
  submitted_by: string | null;
  profile_nombre: string;
  profile_apellido: string;
  document_type?: 'rut' | 'dni_extranjero' | null;
  document_number?: string | null;
  rut: string;
  event: { nombre: string; fecha: string | null; venue: string | null };
  tenant: { nombre: string; slug: string; color_primario: string };
  isSelf: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapReg = (r: any, isSelf: boolean): Registration => ({
  id: r.id,
  status: r.status,
  organizacion: r.organizacion ?? null,
  tipo_medio: r.tipo_medio ?? null,
  cargo: r.cargo ?? null,
  qr_token: r.qr_token ?? null,
  motivo_rechazo: r.motivo_rechazo ?? null,
  created_at: r.created_at,
  profile_id: r.profile_id,
  submitted_by: r.submitted_by ?? null,
  profile_nombre: r.profile_nombre,
  profile_apellido: r.profile_apellido,
  document_type: r.document_type ?? null,
  document_number: r.document_number ?? r.rut ?? null,
  rut: r.rut,
  event: {
    nombre: r.event_nombre,
    fecha: r.event_fecha ?? null,
    venue: r.event_venue ?? null,
  },
  tenant: {
    nombre: r.tenant_nombre,
    slug: r.tenant_slug,
    color_primario: r.tenant_color_primario || '#00C48C',
  },
  isSelf,
});

// ─── Status config (centralizado en @/types) ───────────────────────────────

const statusConfig = STATUS_MAP as Record<string, { label: string; bg: string; text: string; icon: string }>;

// ═════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [tenantStatuses, setTenantStatuses] = useState<TenantProfileStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [filter, setFilter] = useState<'all' | 'self' | 'team'>('all');
  const [activeView, setActiveView] = useState<'tenants' | 'history'>('tenants');

  useEffect(() => {
    loadRegistrations();
    loadTenantStatuses();
  }, []);

  const loadRegistrations = async () => {
    try {
      const res = await fetch('/api/acreditado/registrations');
      if (!res.ok) {
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!data.profile) {
        setLoading(false);
        return;
      }

      const own: Registration[] = (data.registrations.own || []).map((r: any) => mapReg(r, true));
      const managed: Registration[] = (data.registrations.managed || []).map((r: any) => mapReg(r, false));

      const all = [...own, ...managed]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const seen = new Set<string>();
      const deduped = all.filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });

      setRegistrations(deduped);
    } catch (err) {
      console.error('Error cargando acreditaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTenantStatuses = async () => {
    try {
      // Fetch tenant statuses and provider accesses in parallel
      const [statusRes, providerAccesses] = await Promise.all([
        fetch('/api/profiles/tenant-status'),
        fetch('/api/providers/my-access').then(r => r.ok ? r.json() : []).catch(() => []),
      ]);

      // Build set of approved provider tenant IDs
      const approvedTenantIds = new Set(
        (providerAccesses as { status: string; tenant_id: string }[])
          .filter(p => p.status === 'approved')
          .map(p => p.tenant_id)
      );

      if (!statusRes.ok) {
        setLoadingStatuses(false);
        return;
      }
      const data = await statusRes.json();
      // Exclude provider tenants (shown in Organizaciones tab)
      const allStatuses: TenantProfileStatus[] = data.tenants || [];
      setTenantStatuses(allStatuses.filter(t => !approvedTenantIds.has(t.tenantId)));
    } catch {
      // ignore
    } finally {
      setLoadingStatuses(false);
    }
  };

  const filtered = filter === 'all'
    ? registrations
    : filter === 'self'
      ? registrations.filter(r => r.isSelf)
      : registrations.filter(r => !r.isSelf);

  const selfCount = registrations.filter(r => r.isSelf).length;
  const teamCount = registrations.filter(r => !r.isSelf).length;

  if (loading && loadingStatuses) {
    return <LoadingSpinner fullPage />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-heading">Mis Acreditaciones</h1>
        <p className="text-body mt-1">
          {registrations.length} solicitudes · {tenantStatuses.length} organizaciones activas
        </p>
      </div>

      {/* ════════ Tab Switcher ════════ */}
      <div className="flex gap-1 mb-6 bg-subtle rounded-xl p-1">
        <button
          onClick={() => setActiveView('tenants')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
            activeView === 'tenants'
              ? 'bg-surface text-heading shadow-sm'
              : 'text-body hover:text-heading'
          }`}
        >
          <i className="fas fa-building mr-2" />
          Por Organización
          {tenantStatuses.some(t => t.completionPct < 100 && t.totalRequired > 0) && (
            <span className="ml-2 w-2 h-2 rounded-full bg-warn inline-block" />
          )}
        </button>
        <button
          onClick={() => setActiveView('history')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
            activeView === 'history'
              ? 'bg-surface text-heading shadow-sm'
              : 'text-body hover:text-heading'
          }`}
        >
          <i className="fas fa-list mr-2" />
          Historial ({registrations.length})
        </button>
      </div>

      {/* ════════ VISTA: Por Organización ════════ */}
      {activeView === 'tenants' && (
        <TenantStatusView
          statuses={tenantStatuses}
          loading={loadingStatuses}
          registrations={registrations}
        />
      )}

      {/* ════════ VISTA: Historial ════════ */}
      {activeView === 'history' && (
        <RegistrationHistoryView
          registrations={registrations}
          filtered={filtered}
          filter={filter}
          setFilter={setFilter}
          selfCount={selfCount}
          teamCount={teamCount}
          loading={loading}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tenant Status View — Tarjetas de completitud por organización
// ═════════════════════════════════════════════════════════════════════════════

function TenantStatusView({
  statuses,
  loading,
  registrations,
}: {
  statuses: TenantProfileStatus[];
  loading: boolean;
  registrations: Registration[];
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (statuses.length === 0) {
    return (
      <div className="text-center py-16 bg-surface rounded-xl border border-edge">
        <i className="fas fa-building text-4xl text-muted mb-4" />
        <p className="text-muted text-lg">No hay organizaciones con eventos activos</p>
        <Link href="/acreditado" className="text-brand hover:underline text-sm mt-2 inline-block">
          Ver eventos disponibles
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {statuses.map((tenant) => {
        // Contar registros del usuario para este tenant
        const tenantRegs = registrations.filter(
          r => r.tenant.slug === tenant.tenantSlug && r.isSelf
        );
        const latestReg = tenantRegs[0]; // ya ordenados por fecha desc

        return (
          <TenantCard
            key={tenant.tenantId}
            tenant={tenant}
            latestRegistration={latestReg}
          />
        );
      })}
    </div>
  );
}

function TenantCard({
  tenant,
  latestRegistration,
}: {
  tenant: TenantProfileStatus;
  latestRegistration?: Registration;
}) {
  const isComplete = tenant.completionPct === 100 || tenant.totalRequired === 0;
  const hasChanges = tenant.formChanged && tenant.newKeys.length > 0;

  return (
    <div className="bg-surface rounded-xl border border-edge overflow-hidden hover:shadow-md transition">
      {/* Header con color del tenant */}
      <div className="flex items-center gap-4 p-5">
        {/* Shield/avatar */}
        {tenant.tenantShield ? (
          <Image src={tenant.tenantShield} alt="" width={48} height={48} className="w-12 h-12 object-contain shrink-0" />
        ) : (
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
            style={{ backgroundColor: tenant.tenantColor }}
          >
            {tenant.tenantNombre.charAt(0)}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-heading truncate">{tenant.tenantNombre}</h3>
            {/* Status badges */}
            {isComplete && tenant.hasData && (
              <span className="px-2 py-0.5 bg-success-light text-success-dark text-xs rounded-full font-medium shrink-0">
                <i className="fas fa-check mr-1" />Completo
              </span>
            )}
            {!isComplete && tenant.totalRequired > 0 && (
              <span className="px-2 py-0.5 bg-warn-light text-warn-dark text-xs rounded-full font-medium shrink-0">
                <i className="fas fa-exclamation-triangle mr-1" />
                {tenant.missingFields.length} campo{tenant.missingFields.length !== 1 ? 's' : ''} faltante{tenant.missingFields.length !== 1 ? 's' : ''}
              </span>
            )}
            {hasChanges && (
              <span className="px-2 py-0.5 bg-info-light text-info-dark text-xs rounded-full font-medium shrink-0">
                <i className="fas fa-sync-alt mr-1" />Formulario actualizado
              </span>
            )}
          </div>

          {/* Evento activo */}
          {tenant.eventNombre && (
            <p className="text-sm text-body mt-0.5 truncate">
              <i className="fas fa-calendar-alt mr-1 text-muted" />
              {tenant.eventNombre}
              {tenant.eventFecha && (
                <span className="text-muted ml-2">
                  {new Date(tenant.eventFecha).toLocaleDateString('es-CL')}
                </span>
              )}
            </p>
          )}

          {/* Último registro */}
          {latestRegistration && (
            <div className="mt-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  statusConfig[latestRegistration.status]?.bg || 'bg-subtle'
                } ${statusConfig[latestRegistration.status]?.text || 'text-body'}`}>
                  <i className={`${statusConfig[latestRegistration.status]?.icon} mr-1`} />
                  {statusConfig[latestRegistration.status]?.label || latestRegistration.status}
                </span>
                <span className="text-xs text-muted">
                  {new Date(latestRegistration.created_at).toLocaleDateString('es-CL')}
                </span>
              </div>
              {latestRegistration.status === 'rechazado' && latestRegistration.motivo_rechazo && (
                <p className="text-xs text-danger mt-1">
                  <i className="fas fa-info-circle mr-1" />
                  {latestRegistration.motivo_rechazo}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Progress ring + CTA */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Completion ring */}
          {tenant.totalRequired > 0 && (
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18" cy="18" r="15.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-edge"
                />
                <circle
                  cx="18" cy="18" r="15.5"
                  fill="none"
                  stroke={isComplete ? 'var(--color-success)' : tenant.tenantColor}
                  strokeWidth="3"
                  strokeDasharray={`${tenant.completionPct * 0.975} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-heading">
                {tenant.completionPct}%
              </span>
            </div>
          )}

          {/* CTA */}
          <Link
            href={`/${tenant.tenantSlug}/acreditacion`}
            className="px-4 py-2 bg-brand text-on-brand rounded-lg text-sm font-medium hover:bg-brand-hover transition whitespace-nowrap"
          >
            {isComplete ? 'Acreditarme' : 'Completar'}
          </Link>
        </div>
      </div>

      {/* Missing fields detail */}
      {(!isComplete && tenant.missingFields.length > 0) && (
        <div className="px-5 pb-4 pt-0">
          <div className="bg-warn-light/50 rounded-lg p-3">
            <p className="text-xs font-medium text-warn-dark mb-2">
              <i className="fas fa-info-circle mr-1" />
              Campos requeridos que faltan:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tenant.missingFields.map(f => (
                <span key={f.key} className="px-2 py-0.5 bg-white/80 text-warn-dark text-xs rounded-md border border-warn/20">
                  {f.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New fields notification */}
      {hasChanges && (
        <div className="px-5 pb-4 pt-0">
          <div className="bg-info-light/50 rounded-lg p-3">
            <p className="text-xs font-medium text-info-dark mb-1">
              <i className="fas fa-bell mr-1" />
              Se agregaron {tenant.newKeys.length} campo{tenant.newKeys.length !== 1 ? 's' : ''} nuevo{tenant.newKeys.length !== 1 ? 's' : ''} al formulario
            </p>
            <p className="text-xs text-info-dark/70">
              Actualiza tu información para mantener tu acreditación vigente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Registration History View — Agrupado por evento, colapsable
// ═════════════════════════════════════════════════════════════════════════════

interface EventGroup {
  eventKey: string;
  eventName: string;
  tenantName: string;
  tenantSlug: string;
  tenantColor: string;
  eventDate: string | null;
  eventVenue: string | null;
  registrations: Registration[];
  selfCount: number;
  teamCount: number;
  statusSummary: Record<string, number>;
}

function RegistrationHistoryView({
  registrations,
  filtered,
  filter,
  setFilter,
  selfCount,
  teamCount,
  loading,
}: {
  registrations: Registration[];
  filtered: Registration[];
  filter: 'all' | 'self' | 'team';
  setFilter: (f: 'all' | 'self' | 'team') => void;
  selfCount: number;
  teamCount: number;
  loading: boolean;
}) {
  // Group filtered registrations by event
  const eventGroups = useMemo<EventGroup[]>(() => {
    const map = new Map<string, EventGroup>();
    for (const reg of filtered) {
      const key = `${reg.tenant.slug}__${reg.event.nombre}`;
      if (!map.has(key)) {
        map.set(key, {
          eventKey: key,
          eventName: reg.event.nombre,
          tenantName: reg.tenant.nombre,
          tenantSlug: reg.tenant.slug,
          tenantColor: reg.tenant.color_primario,
          eventDate: reg.event.fecha,
          eventVenue: reg.event.venue,
          registrations: [],
          selfCount: 0,
          teamCount: 0,
          statusSummary: {},
        });
      }
      const group = map.get(key)!;
      group.registrations.push(reg);
      if (reg.isSelf) group.selfCount++; else group.teamCount++;
      group.statusSummary[reg.status] = (group.statusSummary[reg.status] || 0) + 1;
    }
    // Sort: most recent event first
    return [...map.values()].sort((a, b) => {
      const da = a.eventDate ? new Date(a.eventDate).getTime() : 0;
      const db = b.eventDate ? new Date(b.eventDate).getTime() : 0;
      return db - da;
    });
  }, [filtered]);

  // Track collapsed state per group (default: first expanded, rest collapsed if >3 groups)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // When groups change (e.g. filter changes), auto-expand all if few, collapse if many
  useEffect(() => {
    if (eventGroups.length <= 3) {
      setCollapsed(new Set());
    } else {
      // Keep first expanded, collapse rest
      setCollapsed(new Set(eventGroups.slice(1).map(g => g.eventKey)));
    }
  }, [eventGroups.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(eventGroups.map(g => g.eventKey)));

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  return (
    <div>
      {/* Top bar: person filter + expand/collapse controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Self/Team filter */}
        {teamCount > 0 && (
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === 'all' ? 'bg-heading text-on-brand' : 'bg-subtle text-body hover:bg-edge'
              }`}
            >
              Todas ({registrations.length})
            </button>
            <button
              onClick={() => setFilter('self')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === 'self' ? 'bg-brand text-on-brand' : 'bg-accent-light text-brand hover:bg-accent-light/80'
              }`}
            >
              <i className="fas fa-user mr-1" />Propias ({selfCount})
            </button>
            <button
              onClick={() => setFilter('team')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === 'team' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
              }`}
            >
              <i className="fas fa-users mr-1" />Equipo ({teamCount})
            </button>
          </div>
        )}

        {/* Expand/Collapse all (only if multiple groups) */}
        {eventGroups.length > 1 && (
          <div className="ml-auto flex gap-1.5">
            <button onClick={expandAll} className="px-2.5 py-1.5 text-xs text-body hover:text-heading bg-subtle hover:bg-edge rounded-lg transition" title="Expandir todos">
              <i className="fas fa-expand-alt mr-1" />Expandir
            </button>
            <button onClick={collapseAll} className="px-2.5 py-1.5 text-xs text-body hover:text-heading bg-subtle hover:bg-edge rounded-lg transition" title="Colapsar todos">
              <i className="fas fa-compress-alt mr-1" />Colapsar
            </button>
          </div>
        )}
      </div>

      {/* Summary bar */}
      <div className="text-xs text-muted mb-4">
        {filtered.length} registro{filtered.length !== 1 ? 's' : ''} en {eventGroups.length} evento{eventGroups.length !== 1 ? 's' : ''}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-xl border border-edge">
          <i className="fas fa-ticket-alt text-4xl text-muted mb-4" />
          <p className="text-muted text-lg">
            {filter === 'all' ? 'No tienes acreditaciones aún' : `No hay acreditaciones de ${filter === 'self' ? 'tipo propio' : 'equipo'}`}
          </p>
          <Link href="/acreditado" className="text-brand hover:underline text-sm mt-2 inline-block">
            Ver eventos disponibles
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {eventGroups.map((group) => {
            const isCollapsed = collapsed.has(group.eventKey);
            return (
              <EventGroupCard
                key={group.eventKey}
                group={group}
                isCollapsed={isCollapsed}
                onToggle={() => toggleGroup(group.eventKey)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Event Group Card ──────────────────────────────────────────────────── */

function EventGroupCard({
  group,
  isCollapsed,
  onToggle,
}: {
  group: EventGroup;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const total = group.registrations.length;
  const approved = group.statusSummary['aprobado'] || 0;
  const pending = group.statusSummary['pendiente'] || 0;
  const rejected = group.statusSummary['rechazado'] || 0;

  return (
    <div className="bg-surface rounded-xl border border-edge overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4 hover:bg-subtle/50 transition text-left"
      >
        {/* Tenant color dot */}
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: group.tenantColor }}
        />

        {/* Event info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-heading text-sm sm:text-base truncate">{group.eventName}</h3>
            <span className="text-xs text-muted">{group.tenantName}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
            {group.eventDate && (
              <span><i className="fas fa-calendar mr-1" />{new Date(group.eventDate).toLocaleDateString('es-CL')}</span>
            )}
            {group.eventVenue && (
              <span className="hidden sm:inline"><i className="fas fa-map-marker-alt mr-1" />{group.eventVenue}</span>
            )}
          </div>
        </div>

        {/* Status mini-summary */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            {approved > 0 && (
              <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded-md font-medium">
                <i className="fas fa-check mr-0.5" />{approved}
              </span>
            )}
            {pending > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-md font-medium">
                <i className="fas fa-clock mr-0.5" />{pending}
              </span>
            )}
            {rejected > 0 && (
              <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded-md font-medium">
                <i className="fas fa-times mr-0.5" />{rejected}
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-body bg-subtle px-2 py-0.5 rounded-full">
            {total}
          </span>
          <i className={`fas fa-chevron-down text-muted text-xs transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
        </div>
      </button>

      {/* Expanded: registration list */}
      {!isCollapsed && (
        <div className="border-t border-edge divide-y divide-edge">
          {group.registrations.map((reg) => {
            const sCfg = statusConfig[reg.status] || statusConfig.pendiente;
            return (
              <div key={reg.id} className="px-4 py-3 sm:px-5 sm:py-4 hover:bg-subtle/30 transition">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Name (for team members) or "Mi acreditación" for self */}
                      {reg.isSelf ? (
                        <span className="text-sm font-medium text-heading">Mi acreditación</span>
                      ) : (
                        <span className="text-sm font-medium text-heading truncate">
                          {reg.profile_nombre} {reg.profile_apellido}
                        </span>
                      )}
                      {!reg.isSelf && (
                        <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[10px] rounded-full font-medium shrink-0">
                          <i className="fas fa-users mr-0.5" />Equipo
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted">
                      {!reg.isSelf && (
                        <span>
                          {(reg.document_type || 'rut') === 'rut'
                            ? formatRut(cleanRut(reg.document_number || reg.rut || ''))
                            : (reg.document_number || reg.rut || '—')}
                        </span>
                      )}
                      {reg.organizacion && <span><i className="fas fa-building mr-0.5" />{reg.organizacion}</span>}
                      {reg.tipo_medio && <span className="px-1.5 py-0.5 bg-subtle rounded-full">{reg.tipo_medio}</span>}
                      {reg.cargo && <span className="px-1.5 py-0.5 bg-subtle rounded-full">{reg.cargo}</span>}
                      <span>{new Date(reg.created_at).toLocaleDateString('es-CL')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sCfg.bg} ${sCfg.text}`}>
                      <i className={`${sCfg.icon} mr-1`} />
                      {sCfg.label}
                    </span>

                    {reg.status === 'aprobado' && reg.qr_token && (
                      <a
                        href={`/qr/${reg.qr_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-center group shrink-0"
                        title="Ver credencial digital"
                      >
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/qr/${reg.qr_token}`)}`}
                          alt="QR de acceso"
                          className="w-12 h-12 rounded-lg border border-edge group-hover:shadow-md transition"
                        />
                      </a>
                    )}
                  </div>
                </div>

                {/* Motivo rechazo */}
                {reg.status === 'rechazado' && reg.motivo_rechazo && (
                  <div className="mt-2 p-2 bg-danger-light rounded-lg border border-danger/10">
                    <p className="text-xs text-danger-dark">
                      <i className="fas fa-info-circle mr-1" />
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
