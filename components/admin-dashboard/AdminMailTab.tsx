'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdmin } from './AdminContext';
import { ButtonSpinner } from '@/components/shared/ui';
import AdminMailZones from './AdminMailZones';
import { sanitizeHtml } from '@/lib/sanitize';
import type { EmailTemplate, EmailTemplateType, EmailZoneContent, Event, EventConfig, TenantConfig } from '@/types';

type MailSubTab = 'templates' | 'zonas';

const TEMPLATE_TYPES: { key: EmailTemplateType; label: string; icon: string; color: string }[] = [
  { key: 'aprobacion', label: 'Aprobación', icon: 'fa-check-circle', color: 'text-[#059669]' },
  { key: 'rechazo', label: 'Rechazo', icon: 'fa-times-circle', color: 'text-[#dc2626]' },
];

const VARIABLES_HELP = [
  { var: '{nombre}', desc: 'Nombre del acreditado' },
  { var: '{apellido}', desc: 'Apellido del acreditado' },
  { var: '{evento}', desc: 'Nombre del evento' },
  { var: '{fecha}', desc: 'Fecha del evento' },
  { var: '{lugar}', desc: 'Lugar del evento' },
  { var: '{organizacion}', desc: 'Organización/medio' },
  { var: '{cargo}', desc: 'Cargo del acreditado' },
  { var: '{zona}', desc: 'Zona asignada al acreditado' },
  { var: '{area}', desc: 'Tipo de medio / área de acreditación' },
  { var: '{motivo}', desc: 'Motivo del rechazo (solo rechazo)' },
  { var: '{tenant}', desc: 'Nombre del tenant/club' },
  { var: '{qr_section}', desc: 'Bloque de código QR (si aplica)' },
  { var: '{instrucciones_acceso}', desc: 'Instrucciones de acceso por zona' },
  { var: '{info_especifica}', desc: 'Info específica de la zona' },
  { var: '{notas_importantes}', desc: 'Notas/advertencias de la zona' },
  { var: '{info_general}', desc: 'Info general (común a todas las zonas)' },
  { var: '{horario_apertura}', desc: 'Variable custom por evento (ejemplo)' },
  { var: '{horario_cierre}', desc: 'Variable custom por evento (ejemplo)' },
];

interface MailVariableRow {
  id: string;
  key: string;
  value: string;
}

function normalizeVariableKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function eventVarsToRows(raw: unknown): MailVariableRow[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>)
    .map(([key, value], index) => ({ id: `${key}-${index}`, key, value: String(value ?? '') }))
    .filter(row => row.key.trim() && row.value.trim());
}

function rowsToEventVars(rows: MailVariableRow[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const row of rows) {
    const key = normalizeVariableKey(row.key);
    const value = row.value.trim();
    if (!key || !value) continue;
    result[key] = value;
  }
  return result;
}

export default function AdminMailTab() {
  const { tenant, events, refreshEvents, showSuccess, showError } = useAdmin();
  const [subTab, setSubTab] = useState<MailSubTab>('templates');
  const [activeType, setActiveType] = useState<EmailTemplateType>('aprobacion');
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [infoGeneral, setInfoGeneral] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showInfoPreview, setShowInfoPreview] = useState(false);

  // Event variables state
  const [selectedEventId, setSelectedEventId] = useState('');
  const [mailVariables, setMailVariables] = useState<MailVariableRow[]>([]);
  const [savingVariables, setSavingVariables] = useState(false);

  // Zone content for preview
  const [zoneContents, setZoneContents] = useState<EmailZoneContent[]>([]);
  const [previewZona, setPreviewZona] = useState('');

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/email/templates?tenant_id=${tenant.id}`);
      if (res.ok) {
        const data: EmailTemplate[] = await res.json();
        const map: Record<string, EmailTemplate> = {};
        data.forEach(t => { map[t.tipo] = t; });
        setTemplates(map);
      }
    } catch {
      // Templates might not exist yet — that's OK
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // Fetch zone content for preview
  const fetchZoneContents = useCallback(async () => {
    if (!tenant) return;
    try {
      const res = await fetch(`/api/email/zone-content?tenant_id=${tenant.id}&tipo=${activeType}`);
      if (res.ok) {
        const data: EmailZoneContent[] = await res.json();
        setZoneContents(data);
      }
    } catch { /* zone content might not exist yet */ }
  }, [tenant, activeType]);

  useEffect(() => { fetchZoneContents(); }, [fetchZoneContents]);

  // Available zones (same logic as AdminMailZones)
  const zonas = useMemo(() => {
    const tenantConfig = tenant?.config as TenantConfig | undefined;
    const tenantZonas = tenantConfig?.zonas || [];
    const eventConfigZonas = (events || []).flatMap(ev => {
      const cfg = ev.config as EventConfig | undefined;
      return cfg?.zonas || [];
    });
    return [...new Set([...tenantZonas, ...eventConfigZonas])];
  }, [tenant, events]);

  // Auto-select first zone for preview
  useEffect(() => {
    if (zonas.length > 0 && !previewZona) {
      setPreviewZona(zonas[0]);
    }
  }, [zonas, previewZona]);

  useEffect(() => {
    if (!selectedEventId && events.length > 0) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  useEffect(() => {
    const selected = events.find(e => e.id === selectedEventId) as (Event & { config?: EventConfig }) | undefined;
    setMailVariables(eventVarsToRows(selected?.config?.email_variables));
  }, [events, selectedEventId]);

  // Load template into form when switching type
  useEffect(() => {
    const tmpl = templates[activeType];
    if (tmpl) {
      setSubject(tmpl.subject || '');
      setBodyHtml(tmpl.body_html || '');
      setInfoGeneral(tmpl.info_general || '');
    } else {
      // Defaults
      setInfoGeneral('');
      if (activeType === 'aprobacion') {
        setSubject('✅ Acreditación Aprobada — {evento}');
        setBodyHtml(DEFAULT_APPROVAL_HTML);
      } else {
        setSubject('Acreditación No Aprobada — {evento}');
        setBodyHtml(DEFAULT_REJECTION_HTML);
      }
    }
  }, [activeType, templates]);

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      const res = await fetch('/api/email/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          tipo: activeType,
          subject,
          body_html: bodyHtml,
          info_general: infoGeneral,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(prev => ({ ...prev, [activeType]: data }));
        showSuccess('Plantilla guardada correctamente');
      } else {
        const d = await res.json();
        showError(d.error || 'Error guardando plantilla');
      }
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVariables = async () => {
    if (!selectedEventId) {
      showError('Selecciona un evento para guardar variables');
      return;
    }

    const selected = events.find(e => e.id === selectedEventId) as (Event & { config?: EventConfig }) | undefined;
    if (!selected) {
      showError('Evento no encontrado');
      return;
    }

    const normalized = rowsToEventVars(mailVariables);
    const currentConfig = (selected.config && typeof selected.config === 'object' && !Array.isArray(selected.config))
      ? (selected.config as EventConfig)
      : {};
    const nextConfig: EventConfig = {
      ...currentConfig,
      email_variables: Object.keys(normalized).length > 0 ? normalized : undefined,
    };
    if (!nextConfig.email_variables) delete nextConfig.email_variables;

    setSavingVariables(true);
    try {
      const res = await fetch(`/api/events?id=${selectedEventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: nextConfig }),
      });
      if (!res.ok) {
        const data = await res.json();
        showError(data.error || 'Error guardando variables del evento');
        return;
      }
      await refreshEvents();
      showSuccess('Variables del evento guardadas');
    } catch {
      showError('Error de conexión al guardar variables');
    } finally {
      setSavingVariables(false);
    }
  };

  // Get zone content for selected preview zone
  const selectedZoneContent = useMemo(() => {
    if (!previewZona) return null;
    return zoneContents.find(zc => zc.zona === previewZona) || null;
  }, [zoneContents, previewZona]);

  // Generate preview HTML with sample data + real zone content
  const previewHtml = bodyHtml
    .replace(/\{nombre\}/g, 'Juan')
    .replace(/\{apellido\}/g, 'Pérez')
    .replace(/\{evento\}/g, 'Ejemplo vs Rival')
    .replace(/\{fecha\}/g, '15 de marzo de 2026')
    .replace(/\{lugar\}/g, 'Estadio Nacional')
    .replace(/\{organizacion\}/g, 'El Deportivo')
    .replace(/\{cargo\}/g, 'Periodista')
    .replace(/\{zona\}/g, previewZona || 'Tribuna Prensa')
    .replace(/\{area\}/g, 'Prensa')
    .replace(/\{motivo\}/g, 'Cupo máximo alcanzado')
    .replace(/\{tenant\}/g, tenant?.nombre || 'Accredia')
    .replace(/\{qr_section\}/g, '<div style="text-align:center;padding:15px;background:#f8f9fa;border-radius:8px;"><p style="color:#666;font-size:13px;">[ Código QR aquí ]</p></div>')
    .replace(/\{instrucciones_acceso\}/g, selectedZoneContent?.instrucciones_acceso || '<p style="color:#9ca3af;font-style:italic;">Sin instrucciones de acceso configuradas para esta zona.</p>')
    .replace(/\{info_especifica\}/g, selectedZoneContent?.info_especifica || '<p style="color:#9ca3af;font-style:italic;">Sin información específica configurada para esta zona.</p>')
    .replace(/\{notas_importantes\}/g, selectedZoneContent?.notas_importantes || '<p style="color:#9ca3af;font-style:italic;">Sin notas importantes configuradas para esta zona.</p>')
    .replace(/\{info_general\}/g, infoGeneral || '<p style="color:#9ca3af;font-style:italic;">Sin información general configurada.</p>');

  const previewWithEventVars = (() => {
    let rendered = previewHtml;
    const vars = rowsToEventVars(mailVariables);
    for (const [key, value] of Object.entries(vars)) {
      rendered = rendered.split(`{${key}}`).join(value);
    }
    return rendered;
  })();

  if (!tenant) return null;

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-surface rounded-xl border border-edge p-1">
        {[
          { key: 'templates' as MailSubTab, label: 'Plantillas', icon: 'fa-envelope' },
          { key: 'zonas' as MailSubTab, label: 'Instrucciones por Zona', icon: 'fa-map-signs' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
              subTab === tab.key
                ? 'bg-[#7c3aed] text-white shadow-sm'
                : 'text-body hover:bg-subtle'
            }`}
          >
            <i className={`fas ${tab.icon}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'zonas' ? (
        <AdminMailZones />
      ) : (
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl shadow-sm border border-edge p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#faf5ff] flex items-center justify-center">
                <i className="fas fa-envelope text-[#7c3aed] text-lg" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-heading">Plantillas de Email</h2>
                <p className="text-sm text-body">Personaliza los correos que se envían a los acreditados. Se configuran una vez y aplican a <strong>todos los eventos</strong> del tenant.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {TEMPLATE_TYPES.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveType(t.key)}
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-surface rounded-2xl shadow-sm border border-edge p-5">
                <label className="text-sm font-semibold text-label block mb-2">
                  <i className="fas fa-heading mr-1 text-muted" /> Asunto del email
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Asunto del correo..."
                  className="w-full px-4 py-2.5 border border-edge rounded-xl text-sm text-heading focus:border-brand transition"
                />
                <p className="text-[11px] text-muted mt-1.5">Puedes usar variables como <code className="text-[10px] text-[#7c3aed]">{'{evento}'}</code> o <code className="text-[10px] text-[#7c3aed]">{'{nombre}'}</code> también en el asunto.</p>
              </div>

              <div className="bg-surface rounded-2xl shadow-sm border border-edge p-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-label">
                    <i className="fas fa-code mr-1 text-muted" /> Contenido HTML
                  </label>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                      showPreview ? 'bg-[#7c3aed] text-white' : 'bg-subtle text-body hover:bg-edge'
                    }`}
                  >
                    <i className={`fas ${showPreview ? 'fa-code' : 'fa-eye'} mr-1`} />
                    {showPreview ? 'Editor' : 'Preview'}
                  </button>
                </div>

                {showPreview ? (
                  <div className="space-y-3">
                    {/* Zone selector for preview */}
                    {zonas.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <i className="fas fa-map-pin text-[#d97706]" />
                        <span className="text-label font-medium">Zona de ejemplo:</span>
                        <select
                          value={previewZona}
                          onChange={e => setPreviewZona(e.target.value)}
                          className="px-2 py-1 border border-edge rounded-lg text-xs text-heading bg-white"
                        >
                          {zonas.map(z => (
                            <option key={z} value={z}>{z}</option>
                          ))}
                        </select>
                        {selectedZoneContent ? (
                          <span className="text-[#059669] flex items-center gap-1"><i className="fas fa-check-circle" /> Con contenido</span>
                        ) : (
                          <span className="text-muted">Sin contenido configurado</span>
                        )}
                      </div>
                    )}
                    <div className="border border-edge rounded-xl p-4 bg-white min-h-[400px] overflow-auto">
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewWithEventVars) }} />
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={bodyHtml}
                    onChange={e => setBodyHtml(e.target.value)}
                    rows={18}
                    placeholder="HTML del email..."
                    className="w-full px-4 py-3 border border-edge rounded-xl text-sm text-heading font-mono resize-y focus:border-brand transition"
                  />
                )}
              </div>

              <div className="bg-surface rounded-2xl shadow-sm border border-edge p-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-label flex items-center gap-2">
                    <i className="fas fa-info-circle text-[#6b7280]" />
                    Info General
                    <code className="px-1.5 py-0.5 bg-[#faf5ff] text-[#7c3aed] rounded text-[10px] font-mono">{'{info_general}'}</code>
                  </label>
                  <button
                    onClick={() => setShowInfoPreview(!showInfoPreview)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                      showInfoPreview ? 'bg-[#7c3aed] text-white' : 'bg-subtle text-body hover:bg-edge'
                    }`}
                  >
                    <i className={`fas ${showInfoPreview ? 'fa-code' : 'fa-eye'} mr-1`} />
                    {showInfoPreview ? 'Editor' : 'Preview'}
                  </button>
                </div>
                <p className="text-xs text-muted mb-3">
                  Información común a <strong>todas las zonas</strong> (horarios de apertura, requisitos de ingreso, normas generales, etc.).
                  Se inyecta donde pongas <code className="text-[#7c3aed]">{'{info_general}'}</code> en la plantilla.
                </p>
                {showInfoPreview ? (
                  <div className="border border-edge rounded-xl p-4 bg-white min-h-[100px]" style={{ borderLeft: '4px solid #6b7280', backgroundColor: '#f9fafb' }}>
                    {infoGeneral ? (
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(infoGeneral) }} />
                    ) : (
                      <p className="text-sm text-muted italic">Sin info general configurada</p>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={infoGeneral}
                    onChange={e => setInfoGeneral(e.target.value)}
                    rows={8}
                    placeholder="HTML con información general común (horarios, requisitos, normas)..."
                    className="w-full px-4 py-3 border border-edge rounded-xl text-sm text-heading font-mono resize-y focus:border-brand transition"
                  />
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving || !subject.trim()}
                  className="px-6 py-2.5 bg-[#7c3aed] text-white rounded-xl font-medium hover:bg-[#6d28d9] disabled:opacity-50 transition flex items-center gap-2"
                >
                  {saving ? (
                    <ButtonSpinner />
                  ) : (
                    <i className="fas fa-save" />
                  )}
                  Guardar plantilla
                </button>

                <button
                  onClick={() => {
                    setInfoGeneral('');
                    if (activeType === 'aprobacion') {
                      setSubject('✅ Acreditación Aprobada — {evento}');
                      setBodyHtml(DEFAULT_APPROVAL_HTML);
                    } else {
                      setSubject('Acreditación No Aprobada — {evento}');
                      setBodyHtml(DEFAULT_REJECTION_HTML);
                    }
                  }}
                  className="px-4 py-2.5 bg-subtle text-body rounded-xl font-medium hover:bg-edge transition flex items-center gap-2"
                >
                  <i className="fas fa-undo text-xs" /> Restaurar default
                </button>
              </div>

              <div className="bg-surface rounded-2xl shadow-sm border border-edge p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-heading flex items-center gap-2">
                    <i className="fas fa-box-open text-[#7c3aed]" /> Variables por evento
                  </h3>
                  <button
                    type="button"
                    onClick={() => setMailVariables(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, key: '', value: '' }])}
                    className="px-3 py-1.5 bg-subtle text-body rounded-lg text-xs font-medium hover:bg-edge transition"
                  >
                    <i className="fas fa-plus mr-1" /> Variable
                  </button>
                </div>
                <p className="text-xs text-body">
                  Define valores por evento (ej: horarios). En plantilla usa <code className="text-[#7c3aed]">{'{horario_apertura}'}</code>.
                </p>

                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full px-3 py-2 border border-edge rounded-lg text-sm text-heading bg-white"
                >
                  <option value="">Selecciona evento...</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>{event.nombre}</option>
                  ))}
                </select>

                {mailVariables.length === 0 ? (
                  <p className="text-xs text-muted">Sin variables para este evento.</p>
                ) : (
                  <div className="space-y-2">
                    {mailVariables.map((row) => (
                      <div key={row.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <input
                          value={row.key}
                          onChange={(e) => setMailVariables(prev => prev.map(item => item.id === row.id ? { ...item, key: e.target.value } : item))}
                          placeholder="horario_apertura"
                          className="sm:col-span-5 px-3 py-2 border border-edge rounded-lg text-xs text-heading"
                        />
                        <input
                          value={row.value}
                          onChange={(e) => setMailVariables(prev => prev.map(item => item.id === row.id ? { ...item, value: e.target.value } : item))}
                          placeholder="12:30"
                          className="sm:col-span-6 px-3 py-2 border border-edge rounded-lg text-xs text-heading"
                        />
                        <button
                          type="button"
                          onClick={() => setMailVariables(prev => prev.filter(item => item.id !== row.id))}
                          className="sm:col-span-1 px-2 py-2 bg-subtle text-muted rounded-lg hover:text-danger hover:bg-danger-light transition"
                          aria-label="Eliminar variable"
                        >
                          <i className="fas fa-trash text-xs" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveVariables}
                    disabled={savingVariables || !selectedEventId}
                    className="px-4 py-2 bg-[#7c3aed] text-white rounded-lg text-xs font-medium hover:bg-[#6d28d9] disabled:opacity-50 transition flex items-center gap-2"
                  >
                    {savingVariables ? <ButtonSpinner /> : <i className="fas fa-save" />}
                    Guardar variables del evento
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-surface rounded-2xl shadow-sm border border-edge p-5">
                <h3 className="text-sm font-bold text-heading mb-3 flex items-center gap-2">
                  <i className="fas fa-brackets-curly text-[#7c3aed]" /> Variables disponibles
                </h3>
                <div className="space-y-2">
                  {VARIABLES_HELP.map(v => (
                    <div key={v.var} className="flex items-start gap-2">
                      <code className="px-1.5 py-0.5 bg-[#faf5ff] text-[#7c3aed] rounded text-xs font-mono whitespace-nowrap">
                        {v.var}
                      </code>
                      <span className="text-xs text-body">{v.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface rounded-2xl shadow-sm border border-edge p-5">
                <h3 className="text-sm font-bold text-heading mb-3 flex items-center gap-2">
                  <i className="fas fa-lightbulb text-[#d97706]" /> Consejos
                </h3>
                <ul className="space-y-2 text-xs text-body">
                  <li className="flex items-start gap-2">
                    <i className="fas fa-check text-[#059669] mt-0.5 text-[10px]" />
                    <span>Usa inline styles para compatibilidad con clientes de email</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fas fa-check text-[#059669] mt-0.5 text-[10px]" />
                    <span>Max-width 600px para que se vea bien en todos los dispositivos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fas fa-check text-[#059669] mt-0.5 text-[10px]" />
                    <span>Las variables se reemplazan automáticamente al enviar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fas fa-check text-[#059669] mt-0.5 text-[10px]" />
                    <span>Si no guardas plantilla, se usa la plantilla por defecto del sistema</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fas fa-database text-[#3b82f6] mt-0.5 text-[10px]" />
                    <span>La plantilla aplica a <strong>todos los eventos</strong> de este tenant — no necesitas configurarla de nuevo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fas fa-box-open text-[#7c3aed] mt-0.5 text-[10px]" />
                    <span>Las variables por evento se configuran abajo y se usan con llaves, por ejemplo <code className="text-[#7c3aed]">{'{horario_apertura}'}</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fas fa-map-pin text-[#d97706] mt-0.5 text-[10px]" />
                    <span>Configura contenido por zona en la pestaña &quot;Instrucciones por Zona&quot;</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fas fa-map-pin text-[#d97706] mt-0.5 text-[10px]" />
                    <span>Usa <code className="text-[#7c3aed]">{'{instrucciones_acceso}'}</code> para inyectar instrucciones según zona del acreditado</span>
                  </li>
                </ul>
              </div>

              {templates[activeType] && (
                <div className="bg-canvas rounded-xl p-4 border border-edge">
                  <p className="text-xs text-muted">
                    <i className="fas fa-clock mr-1" />
                    Última modificación: {new Date(templates[activeType].updated_at!).toLocaleString('es-CL')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_APPROVAL_HTML = `<div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
  <div style="background: #059669; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Acreditación Aprobada</h1>
  </div>
  <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb;">
    <p>Estimado/a <strong>{nombre} {apellido}</strong>,</p>
    <p>Tu acreditación para el evento <strong>{evento}</strong> ha sido <span style="color: #059669; font-weight: bold;">APROBADA</span>.</p>
    
    <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Evento:</strong> {evento}</p>
      <p style="margin: 5px 0 0;"><strong>Fecha:</strong> {fecha}</p>
      <p style="margin: 5px 0 0;"><strong>Lugar:</strong> {lugar}</p>
      <p style="margin: 5px 0 0;"><strong>Organización:</strong> {organizacion}</p>
      <p style="margin: 5px 0 0;"><strong>Cargo:</strong> {cargo}</p>
      <p style="margin: 5px 0 0;"><strong>Zona:</strong> {zona}</p>
    </div>

    {instrucciones_acceso}
    {info_especifica}
    {notas_importantes}
    {info_general}
    {qr_section}
    
    <p style="color: #666; font-size: 13px;">Este es un correo automático del sistema de acreditaciones.</p>
  </div>
  <div style="background: #1a1a2e; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
    <p style="color: #999; font-size: 12px; margin: 0;">{tenant} — Sistema de Acreditaciones</p>
  </div>
</div>`;

const DEFAULT_REJECTION_HTML = `<div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
  <div style="background: #dc2626; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Acreditación No Aprobada</h1>
  </div>
  <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb;">
    <p>Estimado/a <strong>{nombre} {apellido}</strong>,</p>
    <p>Lamentamos informarle que su solicitud de acreditación para el evento <strong>{evento}</strong> no ha sido aprobada.</p>
    
    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Motivo:</strong> {motivo}</p>
    </div>
    
    <p>Si tiene consultas, por favor contacte al organizador del evento.</p>
    <p style="color: #666; font-size: 13px;">Este es un correo automático del sistema de acreditaciones.</p>
  </div>
  <div style="background: #1a1a2e; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
    <p style="color: #999; font-size: 12px; margin: 0;">{tenant} — Sistema de Acreditaciones</p>
  </div>
</div>`;
