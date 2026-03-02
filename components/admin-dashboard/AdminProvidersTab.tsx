'use client';

/**
 * AdminProvidersTab — Gestión de proveedores autorizados
 * Lista, aprueba, rechaza, suspende, asigna zonas y elimina proveedores.
 * Solo visible cuando tenant.config.provider_mode === 'approved_only'.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from './AdminContext';
import { LoadingSpinner, Modal, useToast, ButtonSpinner } from '@/components/shared/ui';
import type { TenantProviderFull, ProviderStatus, TenantConfig } from '@/types';

type ProviderAction = 'approve' | 'reject' | 'suspend' | 'update_zones';

interface ProviderStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  suspended: number;
}

export default function AdminProvidersTab() {
  const { tenant, showSuccess, showError } = useAdmin();
  const [providers, setProviders] = useState<TenantProviderFull[]>([]);
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ProviderStatus | ''>('');
  const [processing, setProcessing] = useState<string | null>(null);

  // Modal states
  const [approveTarget, setApproveTarget] = useState<TenantProviderFull | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TenantProviderFull | null>(null);
  const [zonesTarget, setZonesTarget] = useState<TenantProviderFull | null>(null);

  // Form states
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [approveNotas, setApproveNotas] = useState('');
  const [rejectMotivo, setRejectMotivo] = useState('');

  // Invite code states
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [providerDescription, setProviderDescription] = useState<string>(
    (tenant?.config as TenantConfig)?.provider_description || '',
  );
  const [savingDescription, setSavingDescription] = useState(false);

  const tenantId = tenant?.id || '';
  const tenantSlug = tenant?.slug || '';
  const zonas: string[] = (tenant?.config as TenantConfig)?.zonas || [];
  const currentCode = inviteCode || (tenant?.config as TenantConfig)?.provider_invite_code || '';

  // ─── Fetch providers ─────────────────────────────
  const fetchProviders = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ tenant_id: tenantId });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/providers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
      }

      // Also fetch stats
      const statsRes = await fetch(`/api/providers?tenant_id=${tenantId}&stats=true`);
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch {
      showError('Error cargando proveedores');
    } finally {
      setLoading(false);
    }
  }, [tenantId, statusFilter, showError]);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  // ─── Invite code handlers ─────────────────────────
  const handleRegenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const res = await fetch('/api/providers/invite-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al regenerar código');
      }
      const { code } = await res.json();
      setInviteCode(code);
      showSuccess('Nuevo código de invitación generado');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al regenerar código');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyInviteLink = () => {
    if (!currentCode) return;
    const url = `${window.location.origin}/${tenantSlug}/proveedores?code=${currentCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const handleSaveDescription = async () => {
    setSavingDescription(true);
    try {
      const res = await fetch('/api/providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          provider_description: providerDescription || '',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error guardando');
      }
      showSuccess('Descripción guardada');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingDescription(false);
    }
  };

  // ─── Actions ──────────────────────────────────────
  const handleAction = async (providerId: string, action: ProviderAction, extra?: Record<string, unknown>) => {
    setProcessing(providerId);
    try {
      const res = await fetch(`/api/providers/${providerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al procesar acción');
      }
      const labels: Record<ProviderAction, string> = {
        approve: 'Proveedor aprobado',
        reject: 'Proveedor rechazado',
        suspend: 'Proveedor suspendido',
        update_zones: 'Zonas actualizadas',
      };
      showSuccess(labels[action]);
      fetchProviders();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error');
    } finally {
      setProcessing(null);
      setApproveTarget(null);
      setRejectTarget(null);
      setZonesTarget(null);
    }
  };

  const handleDelete = async (providerId: string) => {
    setProcessing(providerId);
    try {
      const res = await fetch(`/api/providers/${providerId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al eliminar');
      }
      showSuccess('Proveedor eliminado');
      fetchProviders();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error');
    } finally {
      setProcessing(null);
    }
  };

  // ─── Helpers ──────────────────────────────────────
  const statusBadge = (status: ProviderStatus) => {
    const styles: Record<ProviderStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      suspended: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
    const labels: Record<ProviderStatus, string> = {
      pending: 'Pendiente',
      approved: 'Aprobado',
      rejected: 'Rechazado',
      suspended: 'Suspendido',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const openApproveModal = (provider: TenantProviderFull) => {
    setApproveTarget(provider);
    setSelectedZones(provider.allowed_zones || []);
    setApproveNotas('');
  };

  const openRejectModal = (provider: TenantProviderFull) => {
    setRejectTarget(provider);
    setRejectMotivo('');
  };

  const openZonesModal = (provider: TenantProviderFull) => {
    setZonesTarget(provider);
    setSelectedZones(provider.allowed_zones || []);
  };

  const toggleZone = (zona: string) => {
    setSelectedZones(prev =>
      prev.includes(zona) ? prev.filter(z => z !== zona) : [...prev, zona]
    );
  };

  // ─── Render ──────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ═══ Enlace de invitación ═══ */}
      <div className="bg-surface rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
            <i className="fas fa-link text-brand text-sm" />
          </div>
          <h3 className="font-bold text-heading text-sm">Enlace de invitación</h3>
        </div>

        {currentCode ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-subtle rounded-lg text-sm font-mono text-heading tracking-wider truncate">
                {currentCode}
              </code>
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="px-3 py-2 bg-accent-light text-brand rounded-lg text-sm hover:bg-info-light transition flex items-center gap-1.5 shrink-0"
              >
                <i className={`fas ${codeCopied ? 'fa-check' : 'fa-link'}`} />
                {codeCopied ? 'Copiado' : 'Copiar enlace'}
              </button>
              <button
                type="button"
                onClick={handleRegenerateCode}
                disabled={generatingCode}
                className="px-3 py-2 bg-subtle text-body rounded-lg text-sm hover:bg-edge transition flex items-center gap-1.5 shrink-0"
                title="Generar nuevo código (invalida el anterior)"
              >
                {generatingCode ? (
                  <><ButtonSpinner /> <span className="hidden sm:inline">Generando...</span></>
                ) : (
                  <><i className="fas fa-sync-alt" /> <span className="hidden sm:inline">Regenerar</span></>
                )}
              </button>
            </div>
            <p className="text-[11px] text-muted">
              <i className="fas fa-info-circle mr-1" />
              Enlace: <span className="font-mono">/{tenantSlug}/proveedores?code=...</span> — Compártelo con los proveedores que deseas invitar. Regenerar invalida el código anterior.
            </p>

            {/* Descripción para proveedores */}
            <div className="pt-3 border-t border-edge">
              <label className="block text-xs font-medium text-label mb-1">Descripción (visible al proveedor)</label>
              <div className="flex gap-2">
                <textarea
                  value={providerDescription}
                  onChange={(e) => setProviderDescription(e.target.value)}
                  placeholder="Ej: Bienvenido al sistema de acreditaciones. Solicita acceso para poder acreditar a tu equipo."
                  rows={2}
                  className="flex-1 px-3 py-2 rounded-lg border border-field-border text-heading text-sm"
                />
                <button
                  type="button"
                  onClick={handleSaveDescription}
                  disabled={savingDescription}
                  className="self-end px-3 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-hover disabled:opacity-50 transition shrink-0"
                >
                  {savingDescription ? <ButtonSpinner /> : <i className="fas fa-save" />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted mb-3">No hay código de invitación generado</p>
            <button
              type="button"
              onClick={handleRegenerateCode}
              disabled={generatingCode}
              className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-hover transition flex items-center gap-2 mx-auto"
            >
              {generatingCode ? (
                <><ButtonSpinner /> Generando...</>
              ) : (
                <><i className="fas fa-key" /> Generar código de invitación</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Header + Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-heading">Proveedores</h2>
          <p className="text-sm text-muted">Gestiona quién puede acreditar personas en tu organización</p>
        </div>
        {stats && (
          <div className="flex gap-3 text-sm">
            {[
              { label: 'Pendientes', value: stats.pending, color: 'text-yellow-600' },
              { label: 'Aprobados', value: stats.approved, color: 'text-green-600' },
              { label: 'Rechazados', value: stats.rejected, color: 'text-red-600' },
              { label: 'Suspendidos', value: stats.suspended, color: 'text-gray-500' },
            ].map(s => (
              <div key={s.label} className="text-center px-3 py-2 bg-surface rounded-lg border">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ProviderStatus | '')}
          className="px-3 py-2 rounded-lg border border-field-border text-sm text-heading bg-surface"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobados</option>
          <option value="rejected">Rechazados</option>
          <option value="suspended">Suspendidos</option>
        </select>
        <span className="text-sm text-muted">
          {providers.length} proveedor{providers.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* List */}
      {loading ? (
        <LoadingSpinner />
      ) : providers.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-xl border">
          <i className="fas fa-user-shield text-4xl text-muted mb-3" />
          <p className="text-heading font-medium">No hay proveedores {statusFilter ? 'con este estado' : 'registrados'}</p>
          <p className="text-sm text-muted mt-1">
            Los proveedores aparecerán aquí cuando soliciten acceso usando el enlace de invitación.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => {
            const profile = provider.profile;
            const isProcessing = processing === provider.id;
            return (
              <div
                key={provider.id}
                className="bg-surface rounded-xl border p-4 hover:shadow-sm transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Provider info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold text-sm shrink-0">
                      {profile?.nombre?.charAt(0) || '?'}{profile?.apellido?.charAt(0) || ''}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-heading text-sm truncate">
                          {profile ? `${profile.nombre} ${profile.apellido}` : 'Sin perfil'}
                        </h4>
                        {statusBadge(provider.status as ProviderStatus)}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted mt-1">
                        {profile?.email && <span><i className="fas fa-envelope mr-1" />{profile.email}</span>}
                        {provider.organizacion && <span><i className="fas fa-building mr-1" />{provider.organizacion}</span>}
                        {profile?.rut && <span><i className="fas fa-id-card mr-1" />{profile.rut}</span>}
                      </div>
                      {provider.mensaje && (
                        <p className="text-xs text-body mt-1.5 bg-canvas rounded px-2 py-1">
                          <i className="fas fa-comment mr-1 text-muted" />{provider.mensaje}
                        </p>
                      )}
                      {provider.allowed_zones.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {provider.allowed_zones.map(z => (
                            <span key={z} className="px-2 py-0.5 bg-brand/10 text-brand text-[11px] rounded-full font-medium">
                              {z}
                            </span>
                          ))}
                        </div>
                      )}
                      {provider.motivo_rechazo && (
                        <p className="text-xs text-danger mt-1">
                          <i className="fas fa-ban mr-1" />Motivo: {provider.motivo_rechazo}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isProcessing ? (
                      <ButtonSpinner />
                    ) : (
                      <>
                        {provider.status === 'pending' && (
                          <>
                            <button
                              onClick={() => openApproveModal(provider)}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition"
                              title="Aprobar"
                            >
                              <i className="fas fa-check mr-1" />Aprobar
                            </button>
                            <button
                              onClick={() => openRejectModal(provider)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition"
                              title="Rechazar"
                            >
                              <i className="fas fa-times mr-1" />Rechazar
                            </button>
                          </>
                        )}
                        {provider.status === 'approved' && (
                          <>
                            <button
                              onClick={() => openZonesModal(provider)}
                              className="px-3 py-1.5 bg-accent-light text-brand rounded-lg text-xs font-medium hover:bg-info-light transition"
                              title="Editar zonas"
                            >
                              <i className="fas fa-map-marker-alt mr-1" />Zonas
                            </button>
                            <button
                              onClick={() => handleAction(provider.id, 'suspend')}
                              className="px-3 py-1.5 bg-subtle text-body rounded-lg text-xs font-medium hover:bg-edge transition"
                              title="Suspender"
                            >
                              <i className="fas fa-pause mr-1" />Suspender
                            </button>
                          </>
                        )}
                        {provider.status === 'suspended' && (
                          <button
                            onClick={() => openApproveModal(provider)}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition"
                            title="Reactivar"
                          >
                            <i className="fas fa-redo mr-1" />Reactivar
                          </button>
                        )}
                        {provider.status === 'rejected' && (
                          <button
                            onClick={() => openApproveModal(provider)}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition"
                            title="Aprobar"
                          >
                            <i className="fas fa-check mr-1" />Aprobar
                          </button>
                        )}
                        <button
                          onClick={() => { if (confirm('¿Eliminar este proveedor permanentemente?')) handleDelete(provider.id); }}
                          className="px-2 py-1.5 text-muted hover:text-danger rounded-lg text-xs transition"
                          title="Eliminar"
                        >
                          <i className="fas fa-trash-alt" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Metadata line */}
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-edge text-[11px] text-muted">
                  <span>Solicitud: {provider.created_at ? new Date(provider.created_at).toLocaleDateString('es-CL') : '—'}</span>
                  {provider.approved_at && <span>Aprobado: {new Date(provider.approved_at).toLocaleDateString('es-CL')}</span>}
                  {provider.notas && <span className="truncate"><i className="fas fa-sticky-note mr-0.5" />{provider.notas}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Approve Modal ═══ */}
      <Modal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title={`Aprobar proveedor: ${approveTarget?.profile?.nombre || ''} ${approveTarget?.profile?.apellido || ''}`}
      >
        {approveTarget && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-label mb-2">
                Zonas asignadas <span className="text-danger">*</span>
              </label>
              <p className="text-xs text-muted mb-3">
                Selecciona las zonas a las que este proveedor podrá acreditar personas.
              </p>
              <div className="flex flex-wrap gap-2">
                {zonas.map(zona => (
                  <button
                    key={zona}
                    type="button"
                    onClick={() => toggleZone(zona)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                      selectedZones.includes(zona)
                        ? 'bg-brand text-white border-brand'
                        : 'bg-surface text-body border-edge hover:border-brand/50'
                    }`}
                  >
                    {selectedZones.includes(zona) && <i className="fas fa-check mr-1.5 text-xs" />}
                    {zona}
                  </button>
                ))}
              </div>
              {zonas.length === 0 && (
                <p className="text-sm text-danger">No hay zonas configuradas para este tenant.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-label mb-1">Notas internas (opcional)</label>
              <textarea
                value={approveNotas}
                onChange={(e) => setApproveNotas(e.target.value)}
                placeholder="Ej: Aprobado por acuerdo con dirección de prensa"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading text-sm"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setApproveTarget(null)}
                className="flex-1 px-4 py-2.5 bg-subtle text-body rounded-lg text-sm font-medium hover:bg-edge transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={selectedZones.length === 0 || processing === approveTarget.id}
                onClick={() => handleAction(approveTarget.id, 'approve', {
                  allowed_zones: selectedZones,
                  notas: approveNotas || undefined,
                })}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                {processing === approveTarget.id ? <><ButtonSpinner /> Aprobando...</> : (
                  <><i className="fas fa-check" /> Aprobar proveedor</>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══ Reject Modal ═══ */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={`Rechazar proveedor: ${rejectTarget?.profile?.nombre || ''} ${rejectTarget?.profile?.apellido || ''}`}
      >
        {rejectTarget && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-label mb-1">Motivo del rechazo (opcional)</label>
              <textarea
                value={rejectMotivo}
                onChange={(e) => setRejectMotivo(e.target.value)}
                placeholder="Ej: No cumple con los requisitos de acreditación para este evento"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-field-border text-heading text-sm"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="flex-1 px-4 py-2.5 bg-subtle text-body rounded-lg text-sm font-medium hover:bg-edge transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={processing === rejectTarget.id}
                onClick={() => handleAction(rejectTarget.id, 'reject', {
                  motivo: rejectMotivo || undefined,
                })}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                {processing === rejectTarget.id ? <><ButtonSpinner /> Rechazando...</> : (
                  <><i className="fas fa-times" /> Rechazar proveedor</>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══ Update Zones Modal ═══ */}
      <Modal
        open={!!zonesTarget}
        onClose={() => setZonesTarget(null)}
        title={`Editar zonas: ${zonesTarget?.profile?.nombre || ''} ${zonesTarget?.profile?.apellido || ''}`}
      >
        {zonesTarget && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-label mb-2">Zonas asignadas</label>
              <div className="flex flex-wrap gap-2">
                {zonas.map(zona => (
                  <button
                    key={zona}
                    type="button"
                    onClick={() => toggleZone(zona)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                      selectedZones.includes(zona)
                        ? 'bg-brand text-white border-brand'
                        : 'bg-surface text-body border-edge hover:border-brand/50'
                    }`}
                  >
                    {selectedZones.includes(zona) && <i className="fas fa-check mr-1.5 text-xs" />}
                    {zona}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setZonesTarget(null)}
                className="flex-1 px-4 py-2.5 bg-subtle text-body rounded-lg text-sm font-medium hover:bg-edge transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={selectedZones.length === 0 || processing === zonesTarget.id}
                onClick={() => handleAction(zonesTarget.id, 'update_zones', {
                  allowed_zones: selectedZones,
                })}
                className="flex-1 px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-info disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                {processing === zonesTarget.id ? <><ButtonSpinner /> Guardando...</> : (
                  <><i className="fas fa-save" /> Guardar zonas</>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
