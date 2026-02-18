'use client';

import { useState, useEffect, useMemo } from 'react';
import type { FormFieldDefinition, TeamMember, ProfileDatosBase } from '@/types';
import { TIPOS_MEDIO } from '@/types';
import { useQuotaCheck } from '@/hooks/useQuotaCheck';
import { useTenantProfile } from '@/hooks/useTenantProfile';
import { validateRut, validateEmail, cleanRut, formatRut, sanitize } from '@/lib/validation';
import { createEmptyAcreditado, validateAcreditado } from '@/components/forms/AcreditadoRow';
import type { AcreditadoData } from '@/components/forms/AcreditadoRow';
import type {
  Step,
  SubmitResult,
  ResponsableData,
  BulkImportRow,
  RegistrationFormProps,
} from './types';
import { STEP_KEYS } from './types';

/* ── Sileo toast helper (fire-and-forget, no React state needed) ── */
const fireToast = (type: 'success' | 'error', text: string) => {
  if (typeof window !== 'undefined') {
    import('sileo').then(({ sileo }) => {
      if (type === 'success') sileo.success({ title: text, duration: 4000 });
      else sileo.error({ title: text, duration: 5000 });
    });
  }
};

/* ═══════════════════════════════════════════════════════
   CSV / Bulk helpers (internal)
   ═══════════════════════════════════════════════════════ */

interface BulkRow {
  rut: string;
  nombre: string;
  apellido: string;
  email?: string;
  telefono?: string;
  cargo?: string;
  [key: string]: string | undefined;
}

const BULK_HEADER_MAP: Record<string, string> = {
  rut: 'rut', 'rut_xxxxxxxx-x': 'rut',
  nombre: 'nombre', first_name: 'nombre',
  apellido: 'apellido', last_name: 'apellido',
  email: 'email', correo: 'email', mail: 'email',
  telefono: 'telefono', celular: 'telefono', fono: 'telefono', phone: 'telefono',
  cargo: 'cargo', funcion: 'cargo', rol: 'cargo', acreditacion: 'cargo',
  empresa: 'empresa', organizacion: 'empresa', medio: 'empresa', organization: 'empresa',
  tipo_medio: 'tipo_medio', tipo: 'tipo_medio',
  area: 'area', 'area_claro_arena_/_cruzados': 'area',
  zona: 'zona', zone: 'zona',
  patente: 'patente', 'patente_(opcional)': 'patente',
  cantidad: 'cantidad',
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function parseCSV(text: string): BulkRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[,;\t]/).map(normalizeHeader);
  const mappedHeaders = headers.map(h => BULK_HEADER_MAP[h] || h);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(/[,;\t]/).map(v => v.trim().replace(/^"|"$/g, ''));
    const row: BulkRow = { rut: '', nombre: '', apellido: '' };
    mappedHeaders.forEach((header, i) => { if (values[i]) row[header] = values[i]; });
    return row;
  }).filter(row => row.rut || row.nombre);
}

/* ═══════════════════════════════════════════════════════
   Hook
   ═══════════════════════════════════════════════════════ */

export function useRegistrationForm(props: RegistrationFormProps) {
  const {
    eventId,
    formFields,
    tenantSlug,
    tenantId,
    tenantColors,
    userProfile,
    onSuccess,
  } = props;

  const { quotaResult, checkQuota } = useQuotaCheck(eventId);
  const { buildDynamicDataForProfile, saveTenantData } = useTenantProfile();

  // ─── Steps ───
  const [step, setStep] = useState<Step>('disclaimer');
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  // ─── Responsable data ───
  const [responsable, setResponsable] = useState<ResponsableData>({
    rut: '', nombre: '', apellido: '', segundo_apellido: '',
    email: '', telefono: '', organizacion: '',
  });
  const [respErrors, setRespErrors] = useState<Record<string, string>>({});
  const [respTouched, setRespTouched] = useState<Set<string>>(new Set());

  // ─── Tipo de medio ───
  const [tipoMedio, setTipoMedio] = useState('');

  const tiposMedioOptions = useMemo(() => {
    const tipoMedioField = formFields.find(f => f.key === 'tipo_medio');
    if (tipoMedioField?.options && tipoMedioField.options.length > 0) {
      return tipoMedioField.options;
    }
    return [...TIPOS_MEDIO];
  }, [formFields]);

  // ─── Acreditados ───
  const [acreditados, setAcreditados] = useState<AcreditadoData[]>([]);
  const [acreditadoErrors, setAcreditadoErrors] = useState<Record<string, Record<string, string>>>({});
  const [incluirmeDone, setIncluirmeDone] = useState(false);

  // ─── Equipo (frecuentes) ───
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  // ─── Carga Masiva ───
  const [bulkRows, setBulkRows] = useState<BulkImportRow[]>([]);

  // ─── Submit ───
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitResults, setSubmitResults] = useState<SubmitResult[]>([]);
  const [submitProgress, setSubmitProgress] = useState<{ current: number; total: number } | null>(null);

  // ─── Messages ───
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  /* ═══════════════════════════════════════════════════════
     Effects
     ═══════════════════════════════════════════════════════ */

  useEffect(() => {
    if (userProfile) {
      setResponsable(prev => ({
        rut: userProfile.rut || prev.rut,
        nombre: userProfile.nombre || prev.nombre,
        apellido: userProfile.apellido || prev.apellido,
        segundo_apellido: (userProfile.datos_base as Record<string, string> | undefined)?.segundo_apellido || prev.segundo_apellido,
        email: userProfile.email || prev.email,
        telefono: userProfile.telefono || prev.telefono,
        organizacion: userProfile.medio || prev.organizacion,
      }));
      if (userProfile.tipo_medio) setTipoMedio(userProfile.tipo_medio);
    }
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile?.id) return;
    let cancelled = false;
    setLoadingTeam(true);
    // M12: Pasar event_id para enriquecer equipo con datos del contexto del evento
    const teamUrl = eventId ? `/api/teams?event_id=${eventId}` : '/api/teams';
    fetch(teamUrl)
      .then(res => res.ok ? res.json() : [])
      .then((data: TeamMember[]) => { if (!cancelled) setTeamMembers(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingTeam(false); });
    return () => { cancelled = true; };
  }, [userProfile?.id, eventId]);

  useEffect(() => {
    if (tipoMedio && responsable.organizacion) {
      checkQuota(tipoMedio, responsable.organizacion);
    }
  }, [tipoMedio, responsable.organizacion, checkQuota]);

  /* ═══════════════════════════════════════════════════════
     Responsable Handlers
     ═══════════════════════════════════════════════════════ */

  const handleRespChange = (field: string, value: string) => {
    setResponsable(prev => ({ ...prev, [field]: value }));
    if (respErrors[field]) {
      setRespErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  };

  const handleRespBlur = (field: string) => {
    setRespTouched(prev => new Set(prev).add(field));
    if (field === 'rut' && responsable.rut) {
      const cleaned = cleanRut(responsable.rut);
      setResponsable(prev => ({ ...prev, rut: formatRut(cleaned) }));
    }
    const err = validateRespField(field);
    setRespErrors(prev => err ? { ...prev, [field]: err } : (() => { const n = { ...prev }; delete n[field]; return n; })());
  };

  const validateRespField = (field: string): string | null => {
    const v = responsable[field as keyof ResponsableData]?.trim() || '';
    switch (field) {
      case 'rut': return !v ? 'RUT es requerido' : !validateRut(responsable.rut) ? 'RUT inválido' : null;
      case 'nombre': return !v ? 'Nombre es requerido' : null;
      case 'apellido': return !v ? 'Apellido es requerido' : null;
      case 'email': return !v ? 'Email es requerido' : !validateEmail(v) ? 'Email inválido' : null;
      case 'organizacion': return !v ? 'Organización es requerida' : null;
      default: return null;
    }
  };

  const validateAllResp = (): boolean => {
    const required = ['rut', 'nombre', 'apellido', 'email', 'organizacion'] as const;
    const errors: Record<string, string> = {};
    for (const f of required) {
      const err = validateRespField(f);
      if (err) errors[f] = err;
    }
    setRespErrors(errors);
    setRespTouched(new Set(required));
    return Object.keys(errors).length === 0;
  };

  /* ═══════════════════════════════════════════════════════
     Step Navigation
     ═══════════════════════════════════════════════════════ */

  const handleDisclaimerAccept = () => {
    setDisclaimerAccepted(true);
    setStep('responsable');
  };

  const handleResponsableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAllResp()) return;
    setStep('medio');
  };

  const handleMedioSelect = (tipo: string) => setTipoMedio(tipo);

  const handleMedioSubmit = () => {
    if (!tipoMedio) return;
    setStep('acreditados');
  };

  const goBack = (to: Step) => {
    setMessage(null);
    setStep(to);
  };

  /* ═══════════════════════════════════════════════════════
     Acreditados Handlers
     ═══════════════════════════════════════════════════════ */

  const maxCupos = quotaResult
    ? (quotaResult.max_org > 0 ? quotaResult.max_org - quotaResult.used_org : Infinity)
    : Infinity;

  const buildDynamicData = (datosBase?: Record<string, unknown> | null): Record<string, string> => {
    if (!datosBase) return {};
    if (tenantId) return buildDynamicDataForProfile(datosBase, tenantId, formFields);
    const result: Record<string, string> = {};
    for (const field of formFields) {
      let val = datosBase[field.key];
      if (val === undefined && field.profile_field) {
        const pfKey = field.profile_field.replace(/^datos_base\./, '');
        val = datosBase[pfKey];
      }
      if (val !== undefined && val !== null && val !== '') {
        result[field.key] = String(val);
      }
    }
    return result;
  };

  // Check if cargo is configured in this event's form_fields
  const eventHasCargo = formFields.some(f => f.key === 'cargo');

  const handleIncluirme = () => {
    if (incluirmeDone) return;
    const me: AcreditadoData = {
      id: crypto.randomUUID(),
      rut: responsable.rut,
      nombre: responsable.nombre,
      apellido: responsable.apellido,
      email: responsable.email,
      telefono: responsable.telefono,
      cargo: eventHasCargo ? ((userProfile?.cargo as string) || '') : '',
      dynamicData: buildDynamicData((userProfile?.datos_base ?? null) as ProfileDatosBase | null),
      isResponsable: true,
    };
    setAcreditados(prev => [me, ...prev]);
    setIncluirmeDone(true);
  };

  const handleAddFromTeam = (member: TeamMember) => {
    const p = member.member_profile;
    if (!p) return;
    if (acreditados.some(a => a.rut && cleanRut(a.rut) === cleanRut(p.rut))) {
      setMessage({ type: 'error', text: `${p.nombre} ${p.apellido} ya está en la lista` });
      return;
    }
    if (acreditados.length >= maxCupos) {
      setMessage({ type: 'error', text: `Has alcanzado el máximo de cupos` });
      return;
    }
    // M12: buildDynamicData ya es tenant-scoped. Usar dynamicData.cargo (si existe)
    // en vez del cargo global del perfil para evitar cruce entre tenants.
    const dynamicData = buildDynamicData(p.datos_base);
    const newA: AcreditadoData = {
      id: crypto.randomUUID(),
      rut: p.rut || '', nombre: p.nombre || '', apellido: p.apellido || '',
      email: p.email || '', telefono: p.telefono || '',
      cargo: eventHasCargo ? (dynamicData['cargo'] || p.cargo || '') : '',
      dynamicData,
      isResponsable: false,
    };
    setAcreditados(prev => [...prev, newA]);
    setMessage({ type: 'success', text: `${p.nombre} ${p.apellido} agregado` });
  };

  const handleAddAllTeam = () => {
    let added = 0;
    for (const m of teamMembers) {
      const p = m.member_profile;
      if (!p) continue;
      const alreadyAdded = acreditados.some(a => a.rut && cleanRut(a.rut) === cleanRut(p.rut));
      if (alreadyAdded) continue;
      if (acreditados.length + added >= maxCupos) break;
      added++;
    }
    if (added === 0) {
      setMessage({ type: 'error', text: 'Todos los miembros del equipo ya están en la lista' });
      return;
    }
    const newAcreditados: AcreditadoData[] = [];
    for (const m of teamMembers) {
      const p = m.member_profile;
      if (!p) continue;
      const alreadyAdded = acreditados.some(a => a.rut && cleanRut(a.rut) === cleanRut(p.rut));
      if (alreadyAdded) continue;
      if (acreditados.length + newAcreditados.length >= maxCupos) break;
      // M12: Usar dynamicData.cargo (tenant-scoped) en vez de p.cargo (global)
      const dynamicData = buildDynamicData(p.datos_base);
      newAcreditados.push({
        id: crypto.randomUUID(),
        rut: p.rut || '', nombre: p.nombre || '', apellido: p.apellido || '',
        email: p.email || '', telefono: p.telefono || '',
        cargo: eventHasCargo ? (dynamicData['cargo'] || p.cargo || '') : '',
        dynamicData,
        isResponsable: false,
      });
    }
    setAcreditados(prev => [...prev, ...newAcreditados]);
    setMessage({ type: 'success', text: `${newAcreditados.length} persona${newAcreditados.length !== 1 ? 's' : ''} del equipo agregada${newAcreditados.length !== 1 ? 's' : ''}` });
    setShowTeamPicker(false);
  };

  const handleAddAcreditado = () => {
    if (acreditados.length >= maxCupos) {
      setMessage({ type: 'error', text: `Has alcanzado el máximo de ${quotaResult?.max_org} cupos para ${tipoMedio}` });
      return;
    }
    setAcreditados(prev => [...prev, createEmptyAcreditado()]);
  };

  const handleAcreditadoChange = (index: number, field: string, value: string) => {
    setAcreditados(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
    const id = acreditados[index]?.id;
    if (id && acreditadoErrors[id]?.[field]) {
      setAcreditadoErrors(prev => {
        const updated = { ...prev[id] };
        delete updated[field];
        return { ...prev, [id]: updated };
      });
    }
  };

  const handleAcreditadoDynamicChange = (index: number, key: string, value: string) => {
    setAcreditados(prev => prev.map((a, i) =>
      i === index ? { ...a, dynamicData: { ...a.dynamicData, [key]: value } } : a
    ));
  };

  const handleAcreditadoBlur = (index: number, field: string) => {
    const a = acreditados[index];
    if (!a) return;
    const allErrors = validateAcreditado(a, formFields);
    const fieldError = allErrors[field];
    setAcreditadoErrors(prev => {
      const current = prev[a.id] || {};
      if (fieldError) return { ...prev, [a.id]: { ...current, [field]: fieldError } };
      const updated = { ...current };
      delete updated[field];
      return { ...prev, [a.id]: updated };
    });
  };

  const handleRemoveAcreditado = (index: number) => {
    const removed = acreditados[index];
    if (removed?.isResponsable) setIncluirmeDone(false);
    setAcreditados(prev => prev.filter((_, i) => i !== index));
    if (removed) {
      setAcreditadoErrors(prev => { const n = { ...prev }; delete n[removed.id]; return n; });
    }
  };

  /* ═══════════════════════════════════════════════════════
     File Import
     ═══════════════════════════════════════════════════════ */

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    let rows: BulkRow[] = [];

    if (ext === 'xlsx' || ext === 'xls') {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/bulk/parse', { method: 'POST', body: formData });
        const json = await res.json();
        if (!res.ok) { setMessage({ type: 'error', text: json.error || 'Error al leer el archivo Excel' }); return; }
        rows = json.rows as BulkRow[];
      } catch {
        setMessage({ type: 'error', text: 'Error al leer el archivo Excel' });
        return;
      }
    } else {
      const text = await file.text();
      rows = parseCSV(text);
    }

    if (rows.length === 0) { setMessage({ type: 'error', text: 'No se encontraron datos válidos' }); return; }

    const totalCount = acreditados.length + bulkRows.length + rows.length;
    if (totalCount > maxCupos && maxCupos !== Infinity) {
      setMessage({ type: 'error', text: `El archivo tiene ${rows.length} personas pero solo quedan ${maxCupos - acreditados.length - bulkRows.length} cupos` });
      return;
    }

    const newBulkRows: BulkImportRow[] = rows.map(r => ({
      id: crypto.randomUUID(),
      nombre: r.nombre || '', apellido: r.apellido || '',
      rut: r.rut || '', patente: r.patente || '',
      extras: Object.fromEntries(
        Object.entries(r)
          .filter(([k, v]) => !['nombre', 'apellido', 'rut', 'patente'].includes(k) && v)
          .map(([k, v]) => [k, v!])
      ),
    }));

    setBulkRows(prev => [...prev, ...newBulkRows]);
    setMessage({ type: 'success', text: `${rows.length} persona${rows.length !== 1 ? 's' : ''} importada${rows.length !== 1 ? 's' : ''} para carga masiva` });
    fireToast('success', `${rows.length} persona${rows.length !== 1 ? 's' : ''} importada${rows.length !== 1 ? 's' : ''}`);
    e.target.value = '';
  };

  const downloadTemplate = async () => {
    const color = tenantColors.primario.replace('#', '');
    const url = `/api/bulk/parse?tenant=${tenantSlug}&color=${color}&event_id=${eventId}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla-carga-masiva-${tenantSlug}.xlsx`;
    a.click();
  };

  /* ═══════════════════════════════════════════════════════
     Submit
     ═══════════════════════════════════════════════════════ */

  const validateAllAcreditados = (): boolean => {
    if (acreditados.length === 0 && bulkRows.length === 0) {
      setMessage({ type: 'error', text: 'Agrega al menos una persona para acreditar' });
      return false;
    }
    const allErrors: Record<string, Record<string, string>> = {};
    let hasErrors = false;
    for (const a of acreditados) {
      const errs = validateAcreditado(a, formFields);
      if (Object.keys(errs).length > 0) { allErrors[a.id] = errs; hasErrors = true; }
    }
    setAcreditadoErrors(allErrors);

    for (const row of bulkRows) {
      if (!row.nombre.trim() || !row.apellido.trim() || !row.rut.trim()) {
        setMessage({ type: 'error', text: 'Algunas filas de la carga masiva no tienen Nombre, Apellido o RUT' });
        return false;
      }
      if (!validateRut(row.rut)) {
        setMessage({ type: 'error', text: `RUT inválido: ${row.rut} (${row.nombre} ${row.apellido})` });
        return false;
      }
    }
    return !hasErrors;
  };

  const handleSubmit = () => {
    if (!validateAllAcreditados()) return;
    setShowConfirmModal(true);
  };

  const handleConfirmedSubmit = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    setMessage(null);
    const results: SubmitResult[] = [];
    const totalSteps = acreditados.length + (bulkRows.length > 0 ? 1 : 0);
    setSubmitProgress({ current: 0, total: totalSteps });

    // 1. Enviar acreditados manuales
    for (let idx = 0; idx < acreditados.length; idx++) {
      const a = acreditados[idx];
      setSubmitProgress({ current: idx, total: totalSteps });
      const nombre = `${a.nombre} ${a.apellido}`;
      try {
        const payload = {
          event_id: eventId,
          rut: sanitize(a.rut), nombre: sanitize(a.nombre), apellido: sanitize(a.apellido),
          email: sanitize(a.email), telefono: sanitize(a.telefono), cargo: sanitize(a.cargo),
          organizacion: sanitize(responsable.organizacion), tipo_medio: tipoMedio,
          datos_extra: {
            ...a.dynamicData,
            responsable_rut: sanitize(responsable.rut),
            responsable_nombre: sanitize(responsable.nombre),
            responsable_apellido: sanitize(responsable.apellido),
            responsable_segundo_apellido: sanitize(responsable.segundo_apellido),
            responsable_email: sanitize(responsable.email),
            responsable_telefono: sanitize(responsable.telefono),
          },
          submitted_by: userProfile?.id || undefined,
        };
        const res = await fetch('/api/registrations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        results.push(res.ok ? { nombre, ok: true } : { nombre, ok: false, error: data.error || 'Error' });
      } catch {
        results.push({ nombre, ok: false, error: 'Error de conexión' });
      }
    }

    // 2. Enviar carga masiva
    if (bulkRows.length > 0) {
      setSubmitProgress({ current: acreditados.length, total: totalSteps });
      try {
        const bulkPayloadRows = bulkRows.map(row => ({
          rut: sanitize(row.rut), nombre: sanitize(row.nombre), apellido: sanitize(row.apellido),
          organizacion: row.extras?.organizacion || row.extras?.empresa
            ? sanitize(row.extras.organizacion || row.extras.empresa)
            : sanitize(responsable.organizacion),
          tipo_medio: row.extras?.tipo_medio ? sanitize(row.extras.tipo_medio) : tipoMedio,
          email: row.extras?.email ? sanitize(row.extras.email) : undefined,
          telefono: row.extras?.telefono ? sanitize(row.extras.telefono) : undefined,
          cargo: row.extras?.cargo ? sanitize(row.extras.cargo) : undefined,
          patente: row.patente || undefined,
          // Campos extra dinámicos (zona, area, campos custom, etc.)
          ...Object.fromEntries(
            Object.entries(row.extras || {})
              .filter(([k]) => !['organizacion', 'empresa', 'tipo_medio', 'email', 'telefono', 'cargo'].includes(k))
              .map(([k, v]) => [k, sanitize(v)])
          ),
          responsable_rut: sanitize(responsable.rut),
          responsable_nombre: sanitize(responsable.nombre),
          responsable_apellido: sanitize(responsable.apellido),
          responsable_segundo_apellido: sanitize(responsable.segundo_apellido),
          responsable_email: sanitize(responsable.email),
          responsable_telefono: sanitize(responsable.telefono),
        }));
        const res = await fetch('/api/bulk-accreditation', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: eventId, rows: bulkPayloadRows }),
        });
        const data = await res.json();
        if (res.ok && data.results) {
          for (const r of data.results) results.push({ nombre: r.nombre, ok: r.ok, error: r.error });
        } else {
          for (const row of bulkRows) results.push({ nombre: `${row.nombre} ${row.apellido}`, ok: false, error: data.error || 'Error en carga masiva' });
        }
      } catch {
        for (const row of bulkRows) results.push({ nombre: `${row.nombre} ${row.apellido}`, ok: false, error: 'Error de conexión' });
      }
    }

    setSubmitResults(results);
    setSubmitting(false);
    setSubmitProgress(null);

    // Persistencia inteligente
    if (tenantId && results.some(r => r.ok)) {
      try {
        const successfulAcreditados = acreditados.filter((_, i) => results[i]?.ok);
        if (successfulAcreditados.length > 0) {
          const firstData = successfulAcreditados[0]?.dynamicData || {};
          const formKeys = formFields.map(f => f.key);
          await saveTenantData(tenantId, firstData, formKeys);
        }
      } catch {
        console.warn('[useRegistrationForm] Error saving tenant profile data');
      }
    }

    if (results.every(r => r.ok)) {
      setStep('success');
      fireToast('success', `${results.length} acreditación${results.length !== 1 ? 'es' : ''} enviada${results.length !== 1 ? 's' : ''} correctamente`);
      onSuccess?.();
    } else if (results.some(r => r.ok)) {
      setMessage({ type: 'error', text: `${results.filter(r => !r.ok).length} acreditación(es) fallaron. Revisa los detalles.` });
      fireToast('error', `${results.filter(r => !r.ok).length} acreditación(es) fallaron`);
      setStep('success');
    } else {
      setMessage({ type: 'error', text: 'Ninguna acreditación pudo ser enviada. Intenta nuevamente.' });
      fireToast('error', 'Error al enviar acreditaciones');
    }
  };

  const resetForm = () => {
    setStep('disclaimer');
    setDisclaimerAccepted(false);
    setResponsable({ rut: '', nombre: '', apellido: '', segundo_apellido: '', email: '', telefono: '', organizacion: '' });
    setRespErrors({});
    setRespTouched(new Set());
    setTipoMedio('');
    setAcreditados([]);
    setAcreditadoErrors({});
    setBulkRows([]);
    setIncluirmeDone(false);
    setSubmitResults([]);
    setMessage(null);
  };

  /* ═══════════════════════════════════════════════════════
     Derived
     ═══════════════════════════════════════════════════════ */

  const currentStepIndex = STEP_KEYS.indexOf(step);

  const getRespInputClass = (field: string) => {
    const hasError = respErrors[field];
    const touched = respTouched.has(field);
    if (hasError && touched) return 'field-input field-input-error';
    return 'field-input';
  };

  return {
    // Step state
    step, disclaimerAccepted, currentStepIndex,
    // Responsable
    responsable, respErrors, respTouched, getRespInputClass,
    handleRespChange, handleRespBlur, handleResponsableSubmit,
    // Tipo de medio
    tipoMedio, tiposMedioOptions, handleMedioSelect, handleMedioSubmit,
    // Quota
    quotaResult,
    // Acreditados
    acreditados, acreditadoErrors, incluirmeDone, maxCupos,
    handleIncluirme, handleAddAcreditado, handleRemoveAcreditado,
    handleAcreditadoChange, handleAcreditadoDynamicChange, handleAcreditadoBlur,
    // Team
    teamMembers, loadingTeam, showTeamPicker, setShowTeamPicker,
    handleAddFromTeam, handleAddAllTeam,
    // Bulk
    bulkRows, setBulkRows, handleFileImport, downloadTemplate,
    // Submit
    submitting, showConfirmModal, setShowConfirmModal, submitResults, submitProgress,
    handleSubmit, handleConfirmedSubmit,
    // Navigation
    handleDisclaimerAccept, goBack,
    // Messages
    message, setMessage,
    // Reset
    resetForm,
    // Form config
    formFields,
  } as const;
}

export type UseRegistrationFormReturn = ReturnType<typeof useRegistrationForm>;
