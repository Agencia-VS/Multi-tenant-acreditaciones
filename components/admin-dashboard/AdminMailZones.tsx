'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdmin } from './AdminContext';
import { ButtonSpinner, LoadingSpinner } from '@/components/shared/ui';
import { sanitizeHtml } from '@/lib/sanitize';
import type { EmailZoneContent, EmailTemplateType, TenantConfig, EventConfig } from '@/types';

/**
 * AdminMailZones — Editor de contenido de email por zona
 * 
 * Permite a los admins configurar instrucciones de acceso, información 
 * específica y notas importantes para cada zona definida en el tenant.
 * Este contenido se inyecta en las plantillas de email vía variables.
 */
export default function AdminMailZones() {
  const { tenant, events, registrations, showSuccess, showError } = useAdmin();
  const [activeType, setActiveType] = useState<EmailTemplateType>('aprobacion');
  const [zoneContents, setZoneContents] = useState<EmailZoneContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // zona being saved

  // Zone rule zonas fetched from all events
  const [zoneRuleZonas, setZoneRuleZonas] = useState<string[]>([]);

  // Fetch zone rule zonas from all events of this tenant
  useEffect(() => {
    if (!events || events.length === 0) return;
    let cancelled = false;
    (async () => {
      const allRuleZonas: string[] = [];
      await Promise.all(events.map(async (ev) => {
        try {
          const res = await fetch(`/api/events/${ev.id}/zones`);
          if (res.ok) {
            const rules: { zona: string }[] = await res.json();
            if (Array.isArray(rules)) {
              rules.forEach(r => { if (r.zona) allRuleZonas.push(r.zona); });
            }
          }
        } catch { /* ignore */ }
      }));
      if (!cancelled) setZoneRuleZonas(allRuleZonas);
    })();
    return () => { cancelled = true; };
  }, [events]);

  // Zonas: merge de TODAS las fuentes disponibles
  const zonas = useMemo(() => {
    const tenantConfig = tenant?.config as TenantConfig | undefined;
    const tenantZonas = tenantConfig?.zonas || [];

    // Zonas definidas en event.config.zonas
    const eventConfigZonas = (events || []).flatMap(ev => {
      const cfg = ev.config as EventConfig | undefined;
      return cfg?.zonas || [];
    });

    // Zonas definidas en event_zone_rules (cargo/tipo_medio → zona)
    // (ya cargadas en zoneRuleZonas)

    // Zonas ya asignadas en registrations existentes
    const registrationZonas = (registrations || [])
      .map(r => (r.datos_extra as Record<string, unknown>)?.zona as string | undefined)
      .filter((z): z is string => !!z);

    // Deduplicar preservando orden
    return [...new Set([...tenantZonas, ...eventConfigZonas, ...zoneRuleZonas, ...registrationZonas])];
  }, [tenant, events, zoneRuleZonas, registrations]);

  // Currently editing zona
  const [selectedZona, setSelectedZona] = useState<string>('');
  const [form, setForm] = useState({
    titulo: '',
    instrucciones_acceso: '',
    info_especifica: '',
    notas_importantes: '',
  });
  const [previewField, setPreviewField] = useState<string | null>(null);

  // Fetch zone contents
  const fetchZoneContents = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/email/zone-content?tenant_id=${tenant.id}&tipo=${activeType}`);
      if (res.ok) {
        const data: EmailZoneContent[] = await res.json();
        setZoneContents(data);
      }
    } catch {
      // Zone content might not exist yet
    } finally {
      setLoading(false);
    }
  }, [tenant, activeType]);

  useEffect(() => { fetchZoneContents(); }, [fetchZoneContents]);

  // Select first zona on mount or when zonas change
  useEffect(() => {
    if (zonas.length > 0 && !selectedZona) {
      setSelectedZona(zonas[0]);
    }
  }, [zonas, selectedZona]);

  // Load form data when selected zona changes
  useEffect(() => {
    const existing = zoneContents.find(zc => zc.zona === selectedZona);
    if (existing) {
      setForm({
        titulo: existing.titulo || '',
        instrucciones_acceso: existing.instrucciones_acceso || '',
        info_especifica: existing.info_especifica || '',
        notas_importantes: existing.notas_importantes || '',
      });
    } else {
      setForm({ titulo: '', instrucciones_acceso: '', info_especifica: '', notas_importantes: '' });
    }
    setPreviewField(null);
  }, [selectedZona, zoneContents]);

  const handleSave = async () => {
    if (!tenant || !selectedZona) return;
    setSaving(selectedZona);
    try {
      const res = await fetch('/api/email/zone-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          tipo: activeType,
          zona: selectedZona,
          ...form,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setZoneContents(prev => {
          const filtered = prev.filter(zc => !(zc.zona === selectedZona && zc.tipo === activeType));
          return [...filtered, data];
        });
        showSuccess(`Contenido de zona "${selectedZona}" guardado`);
      } else {
        const d = await res.json();
        showError(d.error || 'Error guardando contenido de zona');
      }
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async () => {
    const existing = zoneContents.find(zc => zc.zona === selectedZona && zc.tipo === activeType);
    if (!existing) return;
    
    try {
      const res = await fetch(`/api/email/zone-content?id=${existing.id}`, { method: 'DELETE' });
      if (res.ok) {
        setZoneContents(prev => prev.filter(zc => zc.id !== existing.id));
        setForm({ titulo: '', instrucciones_acceso: '', info_especifica: '', notas_importantes: '' });
        showSuccess(`Contenido de zona "${selectedZona}" eliminado`);
      }
    } catch {
      showError('Error eliminando contenido');
    }
  };

  // Check if a zone has content saved
  const zoneHasContent = (zona: string) => {
    return zoneContents.some(zc => zc.zona === zona && (zc.instrucciones_acceso || zc.info_especifica || zc.notas_importantes));
  };

  const hasAnyContent = form.instrucciones_acceso || form.info_especifica || form.notas_importantes;

  if (!tenant) return null;

  if (zonas.length === 0) {
    return (
      <div className="bg-surface rounded-2xl shadow-sm border border-edge p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[#fef3c7] flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-map-marker-alt text-[#d97706] text-2xl" />
        </div>
        <h3 className="text-lg font-bold text-heading mb-2">No hay zonas configuradas</h3>
        <p className="text-sm text-body max-w-md mx-auto">
          Para configurar instrucciones por zona, primero define las zonas disponibles del tenant en
          la sección de Configuración. Las zonas se configuran en el campo <code className="px-1 py-0.5 bg-subtle rounded text-xs">zonas</code> de la configuración del tenant.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface rounded-2xl shadow-sm border border-edge p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#fef3c7] flex items-center justify-center">
            <i className="fas fa-map-signs text-[#d97706] text-lg" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-heading">Instrucciones por Zona</h2>
            <p className="text-sm text-body">
              Configura instrucciones de acceso, información y notas para cada zona.
              Se inyectan en las plantillas vía <code className="px-1 py-0.5 bg-subtle rounded text-xs">{'{instrucciones_acceso}'}</code>,
              <code className="px-1 py-0.5 bg-subtle rounded text-xs ml-1">{'{info_especifica}'}</code>,
              <code className="px-1 py-0.5 bg-subtle rounded text-xs ml-1">{'{notas_importantes}'}</code>
            </p>
          </div>
        </div>

        {/* Tipo tabs */}
        <div className="flex gap-2">
          {[
            { key: 'aprobacion' as EmailTemplateType, label: 'Aprobación', icon: 'fa-check-circle', color: 'text-[#059669]' },
            { key: 'rechazo' as EmailTemplateType, label: 'Rechazo', icon: 'fa-times-circle', color: 'text-[#dc2626]' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setActiveType(t.key); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                activeType === t.key
                  ? 'bg-[#7c3aed] text-white'
                  : 'bg-subtle text-body hover:bg-edge'
              }`}
            >
              <i className={`fas ${t.icon} ${activeType === t.key ? 'text-white' : t.color}`} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Zona selector sidebar */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-label uppercase tracking-wide px-1 mb-2">
            Zonas ({zonas.length})
          </p>
          {zonas.map(zona => {
            const hasContent = zoneHasContent(zona);
            const isActive = zona === selectedZona;
            return (
              <button
                key={zona}
                onClick={() => setSelectedZona(zona)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition flex items-center justify-between gap-2 ${
                  isActive
                    ? 'bg-[#7c3aed] text-white shadow-sm'
                    : 'bg-surface border border-edge text-body hover:bg-subtle'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <i className={`fas fa-map-pin ${isActive ? 'text-white' : 'text-muted'}`} />
                  <span className="truncate">{zona}</span>
                </span>
                {hasContent && (
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    isActive ? 'bg-white' : 'bg-[#059669]'
                  }`} />
                )}
              </button>
            );
          })}

          {/* Legend */}
          <div className="px-2 pt-3 border-t border-edge mt-3">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="w-2 h-2 rounded-full bg-[#059669]" />
              Con contenido configurado
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="lg:col-span-3 space-y-4">
          {loading ? (
            <div className="bg-surface rounded-2xl shadow-sm border border-edge p-8 text-center">
              <LoadingSpinner size="sm" />
              <p className="text-sm text-muted mt-3">Cargando contenido...</p>
            </div>
          ) : selectedZona ? (
            <>
              {/* Zona badge */}
              <div className="bg-surface rounded-2xl shadow-sm border border-edge p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#fef3c7] flex items-center justify-center">
                      <i className="fas fa-map-marker-alt text-[#d97706]" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-heading">{selectedZona}</h3>
                      <p className="text-xs text-muted">
                        {activeType === 'aprobacion' ? 'Email de aprobación' : 'Email de rechazo'}
                      </p>
                    </div>
                  </div>
                  {hasAnyContent && (
                    <button
                      onClick={handleDelete}
                      className="px-3 py-1.5 text-xs text-[#dc2626] bg-[#fef2f2] rounded-lg hover:bg-[#fee2e2] transition"
                    >
                      <i className="fas fa-trash mr-1" /> Limpiar contenido
                    </button>
                  )}
                </div>
              </div>

              {/* Título */}
              <div className="bg-surface rounded-2xl shadow-sm border border-edge p-5">
                <label className="text-sm font-semibold text-label block mb-2">
                  <i className="fas fa-tag mr-1 text-muted" /> Título de la sección
                </label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => setForm(prev => ({ ...prev, titulo: e.target.value }))}
                  placeholder={`Ej: Acceso ${selectedZona}`}
                  className="w-full px-4 py-2.5 border border-edge rounded-xl text-sm text-heading focus:border-brand transition"
                />
                <p className="text-xs text-muted mt-1">Título descriptivo (no aparece en el email, solo para referencia interna)</p>
              </div>

              {/* Instrucciones de acceso */}
              <FieldEditor
                label="Instrucciones de Acceso"
                icon="fa-door-open"
                color="#1e5799"
                bgColor="#eff6ff"
                helpText="Cómo llegar a esta zona, dónde acreditarse, instrucciones de ingreso."
                value={form.instrucciones_acceso}
                onChange={v => setForm(prev => ({ ...prev, instrucciones_acceso: v }))}
                preview={previewField === 'instrucciones'}
                onTogglePreview={() => setPreviewField(previewField === 'instrucciones' ? null : 'instrucciones')}
                variable="{instrucciones_acceso}"
              />

              {/* Info específica */}
              <FieldEditor
                label="Información Específica"
                icon="fa-info-circle"
                color="#6b7280"
                bgColor="#f9fafb"
                helpText="Información particular de la zona: horarios, equipos necesarios, normas."
                value={form.info_especifica}
                onChange={v => setForm(prev => ({ ...prev, info_especifica: v }))}
                preview={previewField === 'info_especifica'}
                onTogglePreview={() => setPreviewField(previewField === 'info_especifica' ? null : 'info_especifica')}
                variable="{info_especifica}"
              />

              {/* Notas importantes */}
              <FieldEditor
                label="Notas Importantes / Advertencias"
                icon="fa-exclamation-triangle"
                color="#dc2626"
                bgColor="#fef2f2"
                helpText="Restricciones, advertencias o información crítica para esta zona."
                value={form.notas_importantes}
                onChange={v => setForm(prev => ({ ...prev, notas_importantes: v }))}
                preview={previewField === 'notas'}
                onTogglePreview={() => setPreviewField(previewField === 'notas' ? null : 'notas')}
                variable="{notas_importantes}"
              />

              {/* Save button */}
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving === selectedZona}
                  className="px-6 py-2.5 bg-[#7c3aed] text-white rounded-xl font-medium hover:bg-[#6d28d9] disabled:opacity-50 transition flex items-center gap-2"
                >
                  {saving === selectedZona ? (
                    <ButtonSpinner />
                  ) : (
                    <i className="fas fa-save" />
                  )}
                  Guardar contenido de &quot;{selectedZona}&quot;
                </button>
              </div>
            </>
          ) : (
            <div className="bg-surface rounded-2xl shadow-sm border border-edge p-8 text-center">
              <p className="text-sm text-muted">Selecciona una zona para editar su contenido</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

interface FieldEditorProps {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  helpText: string;
  value: string;
  onChange: (v: string) => void;
  preview: boolean;
  onTogglePreview: () => void;
  variable: string;
}

function FieldEditor({ label, icon, color, bgColor, helpText, value, onChange, preview, onTogglePreview, variable }: FieldEditorProps) {
  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-edge p-5">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-label flex items-center gap-2">
          <i className={`fas ${icon}`} style={{ color }} />
          {label}
          <code className="px-1.5 py-0.5 bg-[#faf5ff] text-[#7c3aed] rounded text-[10px] font-mono">
            {variable}
          </code>
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePreview}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              preview ? 'bg-[#7c3aed] text-white' : 'bg-subtle text-body hover:bg-edge'
            }`}
          >
            <i className={`fas ${preview ? 'fa-code' : 'fa-eye'} mr-1`} />
            {preview ? 'Editor' : 'Preview'}
          </button>
        </div>
      </div>
      <p className="text-xs text-muted mb-3">{helpText}</p>

      {preview ? (
        <div
          className="border border-edge rounded-xl p-4 bg-white min-h-[100px]"
          style={{ borderLeft: `4px solid ${color}`, backgroundColor: bgColor }}
        >
          {value ? (
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }} />
          ) : (
            <p className="text-sm text-muted italic">Sin contenido configurado</p>
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={5}
          placeholder={`HTML para ${label.toLowerCase()}...`}
          className="w-full px-4 py-3 border border-edge rounded-xl text-sm text-heading font-mono resize-y focus:border-brand transition"
        />
      )}
    </div>
  );
}
