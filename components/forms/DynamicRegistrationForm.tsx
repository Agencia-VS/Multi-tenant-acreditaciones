'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FormFieldDefinition, Profile, TeamMember } from '@/types';
import { TIPOS_MEDIO } from '@/types';
import { useQuotaCheck } from '@/hooks/useQuotaCheck';
import { useTenantProfile } from '@/hooks/useTenantProfile';
import { Alert, LoadingSpinner, Modal } from '@/components/shared/ui';
import { validateRut, validateEmail, validatePhone, cleanRut, formatRut, sanitize } from '@/lib/validation';
import Disclaimer from '@/components/forms/Disclaimer';
import AcreditadoRow, { createEmptyAcreditado, validateAcreditado } from '@/components/forms/AcreditadoRow';
import type { AcreditadoData } from '@/components/forms/AcreditadoRow';
import ExcelJS from 'exceljs';

/* ═══════════════════════════════════════════════════════
   Types & Constants
   ═══════════════════════════════════════════════════════ */

interface DynamicRegistrationFormProps {
  eventId: string;
  eventName: string;
  formFields: FormFieldDefinition[];
  tenantColors: {
    primario: string;
    secundario: string;
  };
  tenantSlug: string;
  tenantId?: string;
  tenantName?: string;
  userProfile: Partial<Profile> | null;
  bulkEnabled?: boolean;
  eventFecha?: string | null;
  eventVenue?: string | null;
  fechaLimite?: string | null;
  contactEmail?: string;
  onSuccess?: () => void;
}

type Step = 'disclaimer' | 'responsable' | 'medio' | 'acreditados' | 'success';

interface SubmitResult {
  nombre: string;
  ok: boolean;
  error?: string;
}

const STEP_LABELS = ['Responsable', 'Tipo de medio', 'Acreditados'];
const STEP_KEYS: Step[] = ['responsable', 'medio', 'acreditados'];

const TIPO_MEDIO_ICONS: Record<string, string> = {
  'TV': 'fa-tv',
  'Radio': 'fa-broadcast-tower',
  'Prensa Escrita': 'fa-newspaper',
  'Sitio Web': 'fa-globe',
  'Fotógrafo': 'fa-camera',
  'Agencia': 'fa-building',
  'Freelance': 'fa-user-edit',
  'Podcast': 'fa-podcast',
  'Streaming': 'fa-video',
  'Otro': 'fa-ellipsis-h',
};

/* ═══════════════════════════════════════════════════════
   CSV / Excel Parser
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

/** Mapa estándar de headers → claves internas (soporta PuntoTicket, formatos típicos, etc.) */
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
  patente: 'patente',
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

/** Claves base de AcreditadoData (no van a dynamicData) */
const BASE_ACREDITADO_KEYS = new Set(['rut', 'nombre', 'apellido', 'email', 'telefono', 'cargo']);

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */

export default function DynamicRegistrationForm({
  eventId,
  eventName,
  formFields,
  tenantColors,
  tenantSlug,
  tenantId,
  tenantName,
  userProfile,
  bulkEnabled = false,
  eventFecha,
  eventVenue,
  fechaLimite,
  contactEmail,
  onSuccess,
}: DynamicRegistrationFormProps) {
  const { quotaResult, checkQuota } = useQuotaCheck(eventId);
  const { buildDynamicDataForProfile, saveTenantData } = useTenantProfile();

  // ─── Steps ───
  const [step, setStep] = useState<Step>('disclaimer');
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  // ─── Responsable data ───
  const [responsable, setResponsable] = useState({
    rut: '',
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    organizacion: '',
  });
  const [respErrors, setRespErrors] = useState<Record<string, string>>({});
  const [respTouched, setRespTouched] = useState<Set<string>>(new Set());

  // ─── Tipo de medio ───
  const [tipoMedio, setTipoMedio] = useState('');

  // ─── Derive tipo_medio options from event form config (fallback to hardcoded) ───
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

  // ─── Submit ───
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitResults, setSubmitResults] = useState<SubmitResult[]>([]);

  // ─── Messages ───
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  /* ═══════════════════════════════════════════════════════
     Effects
     ═══════════════════════════════════════════════════════ */

  // Pre-fill responsable from user profile
  useEffect(() => {
    if (userProfile) {
      setResponsable(prev => ({
        rut: userProfile.rut || prev.rut,
        nombre: userProfile.nombre || prev.nombre,
        apellido: userProfile.apellido || prev.apellido,
        email: userProfile.email || prev.email,
        telefono: userProfile.telefono || prev.telefono,
        organizacion: userProfile.medio || prev.organizacion,
      }));
      // Pre-select tipo de medio from profile
      if (userProfile.tipo_medio) {
        setTipoMedio(userProfile.tipo_medio);
      }
    }
  }, [userProfile]);

  // Fetch team members when user is authenticated
  useEffect(() => {
    if (!userProfile?.id) return;
    let cancelled = false;
    setLoadingTeam(true);
    fetch('/api/teams')
      .then(res => res.ok ? res.json() : [])
      .then((data: TeamMember[]) => {
        if (!cancelled) setTeamMembers(data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingTeam(false); });
    return () => { cancelled = true; };
  }, [userProfile?.id]);

  // Check quota when tipoMedio or organizacion changes
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
    const v = responsable[field as keyof typeof responsable]?.trim() || '';
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

  const handleMedioSelect = (tipo: string) => {
    setTipoMedio(tipo);
  };

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

  /** Map profile datos_base to dynamicData based on current formFields.
   *  Uses tenant-aware cascade: tenant-specific → flat datos_base → profile_field mapping.
   */
  const buildDynamicData = (datosBase?: Record<string, unknown> | null): Record<string, string> => {
    if (!datosBase) return {};

    // If tenantId is available, use the tenant-aware cascade
    if (tenantId) {
      return buildDynamicDataForProfile(datosBase, tenantId, formFields);
    }

    // Legacy fallback: flat lookup
    const result: Record<string, string> = {};
    for (const field of formFields) {
      // 1. Direct key match
      let val = datosBase[field.key];
      // 2. profile_field mapping (e.g. "datos_base.talla_polera" → datosBase.talla_polera)
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

  const handleIncluirme = () => {
    if (incluirmeDone) return;
    const me: AcreditadoData = {
      id: crypto.randomUUID(),
      rut: responsable.rut,
      nombre: responsable.nombre,
      apellido: responsable.apellido,
      email: responsable.email,
      telefono: responsable.telefono,
      cargo: (userProfile?.cargo as string) || '',
      dynamicData: buildDynamicData(userProfile?.datos_base as Record<string, unknown> | null),
      isResponsable: true,
    };
    setAcreditados(prev => [me, ...prev]);
    setIncluirmeDone(true);
  };

  const handleAddFromTeam = (member: TeamMember) => {
    const p = member.member_profile;
    if (!p) return;
    // Check if already added
    if (acreditados.some(a => a.rut && cleanRut(a.rut) === cleanRut(p.rut))) {
      setMessage({ type: 'error', text: `${p.nombre} ${p.apellido} ya está en la lista` });
      return;
    }
    if (acreditados.length >= maxCupos) {
      setMessage({ type: 'error', text: `Has alcanzado el máximo de cupos` });
      return;
    }
    const newA: AcreditadoData = {
      id: crypto.randomUUID(),
      rut: p.rut || '',
      nombre: p.nombre || '',
      apellido: p.apellido || '',
      email: p.email || '',
      telefono: p.telefono || '',
      cargo: p.cargo || '',
      dynamicData: buildDynamicData(p.datos_base),
      isResponsable: false,
    };
    setAcreditados(prev => [...prev, newA]);
    setMessage({ type: 'success', text: `${p.nombre} ${p.apellido} agregado` });
  };

  const handleAddAcreditado = () => {
    if (acreditados.length >= maxCupos) {
      setMessage({ type: 'error', text: `Has alcanzado el máximo de ${quotaResult?.max_org} cupos para ${tipoMedio}` });
      return;
    }
    setAcreditados(prev => [...prev, createEmptyAcreditado()]);
  };

  const handleAcreditadoChange = (index: number, field: string, value: string) => {
    setAcreditados(prev => prev.map((a, i) =>
      i === index ? { ...a, [field]: value } : a
    ));
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
    const allErrors = validateAcreditado(a);
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
     File Import (XLSX / CSV)
     ═══════════════════════════════════════════════════════ */

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let rows: BulkRow[] = [];
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const sheet = workbook.worksheets[0];
        if (!sheet || sheet.rowCount < 2) {
          setMessage({ type: 'error', text: 'El archivo está vacío o sin datos' });
          return;
        }
        const headerRow = sheet.getRow(1);
        const headers: string[] = [];
        headerRow.eachCell((cell, colNumber) => {
          headers[colNumber - 1] = normalizeHeader(cell.value?.toString() || '');
        });
        const mapped = headers.map(h => BULK_HEADER_MAP[h] || h);
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const r: BulkRow = { rut: '', nombre: '', apellido: '' };
          row.eachCell((cell, colNumber) => {
            const h = mapped[colNumber - 1];
            if (h) r[h] = cell.value?.toString().trim() || '';
          });
          if (r.rut || r.nombre) rows.push(r);
        });
      } catch {
        setMessage({ type: 'error', text: 'Error al leer el archivo Excel' });
        return;
      }
    } else {
      const text = await file.text();
      rows = parseCSV(text);
    }

    if (rows.length === 0) {
      setMessage({ type: 'error', text: 'No se encontraron datos válidos' });
      return;
    }

    if (acreditados.length + rows.length > maxCupos && maxCupos !== Infinity) {
      setMessage({ type: 'error', text: `El archivo tiene ${rows.length} personas pero solo quedan ${maxCupos - acreditados.length} cupos` });
      return;
    }

    const newAcreditados: AcreditadoData[] = rows.map(r => {
      // Extraer campos extra → dynamicData (empresa, zona, patente, area, etc.)
      const dynamicData: Record<string, string> = {};
      for (const [key, val] of Object.entries(r)) {
        if (!BASE_ACREDITADO_KEYS.has(key) && val) {
          dynamicData[key] = val;
        }
      }
      return {
        id: crypto.randomUUID(),
        rut: r.rut || '',
        nombre: r.nombre || '',
        apellido: r.apellido || '',
        email: r.email || '',
        telefono: r.telefono || '',
        cargo: r.cargo || '',
        dynamicData,
        isResponsable: false,
      };
    });

    setAcreditados(prev => [...prev, ...newAcreditados]);
    setMessage({ type: 'success', text: `${rows.length} persona${rows.length !== 1 ? 's' : ''} importada${rows.length !== 1 ? 's' : ''}` });
    e.target.value = '';
  };

  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Acreditados');

    // Columnas base + columnas dinámicas del evento
    const baseColumns = [
      { header: 'RUT', key: 'rut', width: 16 },
      { header: 'Nombre', key: 'nombre', width: 20 },
      { header: 'Apellido', key: 'apellido', width: 20 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Teléfono', key: 'telefono', width: 18 },
      { header: 'Cargo', key: 'cargo', width: 18 },
    ];
    // Agregar campos dinámicos del formulario del evento (excluir los ya cubiertos)
    const coveredKeys = new Set(['rut', 'nombre', 'apellido', 'email', 'telefono', 'cargo', 'tipo_medio']);
    const dynamicColumns = formFields
      .filter(f => !coveredKeys.has(f.key) && f.key !== 'foto')
      .map(f => ({ header: f.label || f.key, key: f.key, width: 20 }));

    ws.columns = [...baseColumns, ...dynamicColumns];
    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tenantColors.primario.replace('#', '') } };
    });
    // Fila de ejemplo
    const exampleRow: Record<string, string> = {
      rut: '12.345.678-9', nombre: 'Juan', apellido: 'Pérez',
      email: 'juan@ejemplo.cl', telefono: '+56912345678', cargo: 'Periodista',
    };
    for (const col of dynamicColumns) {
      exampleRow[col.key] = `(${col.header})`;
    }
    ws.addRow(exampleRow);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla-acreditados-${tenantSlug}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ═══════════════════════════════════════════════════════
     Submit
     ═══════════════════════════════════════════════════════ */

  const validateAllAcreditados = (): boolean => {
    if (acreditados.length === 0) {
      setMessage({ type: 'error', text: 'Agrega al menos una persona para acreditar' });
      return false;
    }
    const allErrors: Record<string, Record<string, string>> = {};
    let hasErrors = false;
    for (const a of acreditados) {
      const errs = validateAcreditado(a);
      if (Object.keys(errs).length > 0) {
        allErrors[a.id] = errs;
        hasErrors = true;
      }
    }
    setAcreditadoErrors(allErrors);
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

    for (const a of acreditados) {
      const nombre = `${a.nombre} ${a.apellido}`;
      try {
        const payload = {
          event_id: eventId,
          rut: sanitize(a.rut),
          nombre: sanitize(a.nombre),
          apellido: sanitize(a.apellido),
          email: sanitize(a.email),
          telefono: sanitize(a.telefono),
          cargo: sanitize(a.cargo),
          organizacion: sanitize(responsable.organizacion),
          tipo_medio: tipoMedio,
          datos_extra: {
            ...a.dynamicData,
            responsable_rut: sanitize(responsable.rut),
            responsable_nombre: sanitize(responsable.nombre),
            responsable_apellido: sanitize(responsable.apellido),
            responsable_email: sanitize(responsable.email),
            responsable_telefono: sanitize(responsable.telefono),
          },
          submitted_by: userProfile?.id || undefined,
        };

        const res = await fetch('/api/registrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          results.push({ nombre, ok: true });
        } else {
          results.push({ nombre, ok: false, error: data.error || 'Error' });
        }
      } catch {
        results.push({ nombre, ok: false, error: 'Error de conexión' });
      }
    }

    setSubmitResults(results);
    setSubmitting(false);

    // ─── Persistencia inteligente: guardar datos en namespace del tenant ───
    if (tenantId && results.some(r => r.ok)) {
      try {
        // Recopilar todos los dynamicData de los acreditados exitosos
        const successfulAcreditados = acreditados.filter((_, i) => results[i]?.ok);
        if (successfulAcreditados.length > 0) {
          // Usar los datos del primer acreditado exitoso (ej: el responsable si se incluyó)
          const firstData = successfulAcreditados[0]?.dynamicData || {};
          const formKeys = formFields.map(f => f.key);
          await saveTenantData(tenantId, firstData, formKeys);
        }
      } catch {
        // No bloquear el flujo — la persistencia es best-effort
        console.warn('[DynamicRegistrationForm] Error saving tenant profile data');
      }
    }

    if (results.every(r => r.ok)) {
      setStep('success');
      onSuccess?.();
    } else if (results.some(r => r.ok)) {
      setMessage({ type: 'error', text: `${results.filter(r => !r.ok).length} acreditación(es) fallaron. Revisa los detalles.` });
      setStep('success');
    } else {
      setMessage({ type: 'error', text: 'Ninguna acreditación pudo ser enviada. Intenta nuevamente.' });
    }
  };

  const resetForm = () => {
    setStep('disclaimer');
    setDisclaimerAccepted(false);
    setResponsable({ rut: '', nombre: '', apellido: '', email: '', telefono: '', organizacion: '' });
    setRespErrors({});
    setRespTouched(new Set());
    setTipoMedio('');
    setAcreditados([]);
    setAcreditadoErrors({});
    setIncluirmeDone(false);
    setSubmitResults([]);
    setMessage(null);
  };

  /* ═══════════════════════════════════════════════════════
     Step Indicator
     ═══════════════════════════════════════════════════════ */

  const currentStepIndex = STEP_KEYS.indexOf(step);

  function StepIndicator() {
    return (
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-6 sm:mb-8 px-2">
        {STEP_LABELS.map((label, i) => {
          const isComplete = currentStepIndex > i;
          const isCurrent = currentStepIndex === i;
          return (
            <div key={label} className="flex items-center gap-1.5 sm:gap-2">
              {i > 0 && (
                <div className={`w-5 sm:w-8 h-0.5 rounded-full transition-snappy ${isComplete ? 'bg-brand' : 'bg-edge'}`} />
              )}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div
                  className={`
                    w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-snappy
                    ${isComplete ? 'bg-success text-white' : isCurrent ? 'bg-brand text-white' : 'bg-surface border border-edge text-muted'}
                  `}
                >
                  {isComplete ? <i className="fas fa-check text-xs" /> : i + 1}
                </div>
                <span className={`text-sm font-medium hidden sm:inline ${isCurrent ? 'text-heading' : 'text-muted'}`}>
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     Input Helper
     ═══════════════════════════════════════════════════════ */

  const getRespInputClass = (field: string) => {
    const hasError = respErrors[field];
    const touched = respTouched.has(field);
    if (hasError && touched) return 'field-input field-input-error';
    return 'field-input';
  };

  /* ═══════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════ */

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      {/* Messages */}
      {message && (
        <Alert message={message} onClose={() => setMessage(null)} />
      )}

      {/* ═══════ DISCLAIMER ═══════ */}
      {step === 'disclaimer' && (
        <Disclaimer
          visible={true}
          onAccept={handleDisclaimerAccept}
          onBack={() => window.history.back()}
          tenantColors={tenantColors}
          tenantName={tenantName}
          eventName={eventName}
          eventFecha={eventFecha}
          eventVenue={eventVenue}
          fechaLimite={fechaLimite}
          contactEmail={contactEmail}
        />
      )}

      {/* ═══════ STEP INDICATOR ═══════ */}
      {disclaimerAccepted && step !== 'success' && <StepIndicator />}

      {/* ═══════ PASO 1 — RESPONSABLE ═══════ */}
      {step === 'responsable' && (
        <form onSubmit={handleResponsableSubmit} className="space-y-4 sm:space-y-6 animate-fade-in">
          {/* Section Card */}
          <div className="rounded-2xl border border-edge bg-surface/30 overflow-hidden">
            {/* Section Header */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-edge/50 bg-surface/60">
              <div className="flex items-center gap-3 sm:gap-4">
                <span
                  className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl text-white font-bold text-base sm:text-lg shrink-0"
                  style={{ backgroundColor: tenantColors.primario }}
                >
                  1
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-heading">Responsable de acreditación</h2>
                  <p className="text-xs sm:text-sm text-muted">Persona que gestiona las solicitudes de prensa para este evento</p>
                </div>
              </div>
            </div>

            {/* Event badge */}
            <div className="flex items-center justify-center px-4 sm:px-6 pt-4 sm:pt-5">
              <span className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-surface border border-edge text-xs sm:text-sm text-body">
                <i className="fas fa-calendar-alt text-brand" />
                <span className="truncate max-w-[200px] sm:max-w-none">{eventName}</span>
              </span>
            </div>

            {/* Form fields */}
            <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* RUT */}
              <div>
                <label className="field-label">RUT *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={responsable.rut}
                    onChange={(e) => handleRespChange('rut', e.target.value)}
                    onBlur={() => handleRespBlur('rut')}
                    placeholder="12.345.678-9"
                    className={`${getRespInputClass('rut')} pr-10`}
                  />
                  {respTouched.has('rut') && responsable.rut && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {respErrors.rut
                        ? <i className="fas fa-times-circle text-danger" />
                        : <i className="fas fa-check-circle text-success" />}
                    </span>
                  )}
                </div>
                {respErrors.rut && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {respErrors.rut}</p>}
              </div>

              {/* Nombre */}
              <div>
                <label className="field-label">Nombre *</label>
                <input
                  type="text"
                  value={responsable.nombre}
                  onChange={(e) => handleRespChange('nombre', e.target.value)}
                  onBlur={() => handleRespBlur('nombre')}
                  placeholder="Juan"
                  className={getRespInputClass('nombre')}
                />
                {respErrors.nombre && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {respErrors.nombre}</p>}
              </div>

              {/* Apellido */}
              <div>
                <label className="field-label">Apellido *</label>
                <input
                  type="text"
                  value={responsable.apellido}
                  onChange={(e) => handleRespChange('apellido', e.target.value)}
                  onBlur={() => handleRespBlur('apellido')}
                  placeholder="Pérez"
                  className={getRespInputClass('apellido')}
                />
                {respErrors.apellido && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {respErrors.apellido}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="field-label">Email *</label>
                <div className="relative">
                  <input
                    type="email"
                    value={responsable.email}
                    onChange={(e) => handleRespChange('email', e.target.value)}
                    onBlur={() => handleRespBlur('email')}
                    placeholder="correo@ejemplo.cl"
                    className={`${getRespInputClass('email')} pr-10`}
                  />
                  {respTouched.has('email') && responsable.email && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {respErrors.email
                        ? <i className="fas fa-times-circle text-danger" />
                        : <i className="fas fa-check-circle text-success" />}
                    </span>
                  )}
                </div>
                {respErrors.email && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {respErrors.email}</p>}
              </div>

              {/* Teléfono */}
              <div>
                <label className="field-label">Teléfono</label>
                <input
                  type="tel"
                  value={responsable.telefono}
                  onChange={(e) => handleRespChange('telefono', e.target.value)}
                  onBlur={() => handleRespBlur('telefono')}
                  placeholder="+56 9 1234 5678"
                  className="field-input"
                />
              </div>

              {/* Organización */}
              <div>
                <label className="field-label">Organización / Medio *</label>
                <input
                  type="text"
                  value={responsable.organizacion}
                  onChange={(e) => handleRespChange('organizacion', e.target.value)}
                  onBlur={() => handleRespBlur('organizacion')}
                  placeholder="Ej: Canal 13, Radio ADN"
                  className={getRespInputClass('organizacion')}
                />
                {respErrors.organizacion && <p className="mt-1 text-xs text-danger flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {respErrors.organizacion}</p>}
              </div>
            </div>
          </div>
          </div>{/* close section card */}

          {/* ── Profile linked / Account invitation ── */}
          {userProfile ? (
            <div className="rounded-xl border border-success/30 bg-success/5 px-5 py-4 flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-success/15 shrink-0">
                <i className="fas fa-link text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-success">Perfil vinculado</p>
                <p className="text-xs text-muted">
                  Tus acreditaciones quedarán asociadas a tu cuenta. Podrás ver su estado desde el <strong>Portal de Acreditados</strong>.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-brand/20 bg-brand/5 px-5 py-4 flex items-start sm:items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand/15 shrink-0 mt-0.5 sm:mt-0">
                <i className="fas fa-user-shield text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-heading">¿Acreditas frecuentemente?</p>
                <p className="text-xs text-muted mt-0.5">
                  <a href="/auth/acreditado" className="text-brand font-semibold hover:underline">Crea una cuenta</a> para guardar tu equipo, reutilizar datos y hacer seguimiento de tus solicitudes.
                </p>
              </div>
            </div>
          )}

          {/* Navegación */}
          <div className="flex gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => goBack('disclaimer')}
              className="flex-1 py-3 sm:py-3.5 rounded-xl border border-edge text-body font-semibold hover:bg-surface transition-snappy text-sm sm:text-base"
            >
              <i className="fas fa-arrow-left mr-1.5 sm:mr-2" /> Volver
            </button>
            <button
              type="submit"
              className="flex-1 py-3 sm:py-3.5 rounded-xl text-white font-bold transition-snappy hover:opacity-90 text-sm sm:text-base"
              style={{ backgroundColor: tenantColors.primario }}
            >
              Siguiente <i className="fas fa-arrow-right ml-1.5 sm:ml-2" />
            </button>
          </div>
        </form>
      )}

      {/* ═══════ PASO 2 — TIPO DE MEDIO ═══════ */}
      {step === 'medio' && (
        <div className="space-y-4 sm:space-y-6 animate-fade-in">
          {/* Section Card */}
          <div className="rounded-2xl border border-edge bg-surface/30 overflow-hidden">
            {/* Section Header */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-edge/50 bg-surface/60">
              <div className="flex items-center gap-3 sm:gap-4">
                <span
                  className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl text-white font-bold text-base sm:text-lg shrink-0"
                  style={{ backgroundColor: tenantColors.primario }}
                >
                  2
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-heading">Tipo de medio</h2>
                  <p className="text-xs sm:text-sm text-muted">Selecciona la categoría que mejor describe a <strong className="text-heading">{responsable.organizacion}</strong></p>
                </div>
              </div>
            </div>

            {/* Tipo de medio cards */}
            <div className="p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
            {tiposMedioOptions.map((tipo) => {
              const selected = tipoMedio === tipo;
              const icon = TIPO_MEDIO_ICONS[tipo] || 'fa-ellipsis-h';
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => handleMedioSelect(tipo)}
                  className={`
                    group relative flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl border-2 transition-snappy cursor-pointer
                    ${selected
                      ? 'border-brand bg-brand/10 shadow-md'
                      : 'border-edge bg-surface/40 hover:border-brand/40 hover:bg-surface/80'}
                  `}
                >
                  <i className={`fas ${icon} text-xl ${selected ? 'text-brand' : 'text-muted group-hover:text-brand/60'} transition-snappy`} />
                  <span className={`text-sm font-medium text-center ${selected ? 'text-brand' : 'text-body'} transition-snappy`}>
                    {tipo}
                  </span>
                  {selected && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                      <i className="fas fa-check text-white text-[0.6rem]" />
                    </div>
                  )}
                </button>
              );
            })}
            </div>{/* close grid */}

            {/* Quota info */}
            {tipoMedio && quotaResult && (
              <div className={`mt-4 rounded-xl p-4 border ${quotaResult.available ? 'bg-success/5 border-success/30' : 'bg-danger/5 border-danger/30'}`}>
                <div className="flex items-center gap-3">
                  <i className={`fas ${quotaResult.available ? 'fa-check-circle text-success' : 'fa-exclamation-triangle text-danger'} text-lg`} />
                  <div>
                    <p className={`font-semibold ${quotaResult.available ? 'text-success' : 'text-danger'}`}>
                      {quotaResult.available ? 'Cupos disponibles' : 'Sin cupos disponibles'}
                    </p>
                    <p className="text-sm text-muted">
                      {quotaResult.max_org > 0
                        ? `${quotaResult.used_org} de ${quotaResult.max_org} utilizados por ${responsable.organizacion}`
                        : 'Sin límite de cupos para este tipo de medio'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            </div>{/* close p-6 */}
          </div>{/* close section card */}

          {/* Nav */}
          <div className="flex gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => goBack('responsable')}
              className="flex-1 py-3 sm:py-3.5 rounded-xl border border-edge text-body font-semibold hover:bg-surface transition-snappy text-sm sm:text-base"
            >
              <i className="fas fa-arrow-left mr-1.5 sm:mr-2" /> Volver
            </button>
            <button
              type="button"
              onClick={handleMedioSubmit}
              disabled={!tipoMedio || (quotaResult !== null && !quotaResult.available)}
              className="flex-1 py-3 sm:py-3.5 rounded-xl text-white font-bold transition-snappy hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-sm sm:text-base"
              style={{ backgroundColor: tenantColors.primario }}
            >
              Siguiente <i className="fas fa-arrow-right ml-1.5 sm:ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════ PASO 3 — ACREDITADOS ═══════ */}
      {step === 'acreditados' && (
        <div className="space-y-4 sm:space-y-6 animate-fade-in">
          {/* Section Card Header */}
          <div className="rounded-2xl border border-edge bg-surface/30 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 sm:py-5 bg-surface/60">
              <div className="flex items-center gap-3 sm:gap-4">
                <span
                  className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl text-white font-bold text-base sm:text-lg shrink-0"
                  style={{ backgroundColor: tenantColors.primario }}
                >
                  3
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-heading">Acreditados</h2>
                  <p className="text-xs sm:text-sm text-muted">Agrega las personas que asistirán al evento por <strong className="text-heading">{responsable.organizacion}</strong></p>
                </div>
              </div>

              {/* Context chips */}
              <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-4 ml-11 sm:ml-14">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-edge text-xs text-body">
                  <i className={`fas ${TIPO_MEDIO_ICONS[tipoMedio] || 'fa-ellipsis-h'} text-brand`} /> {tipoMedio}
                </span>
                {quotaResult && quotaResult.max_org > 0 && (
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    (quotaResult.used_org + acreditados.length) >= quotaResult.max_org
                      ? 'bg-danger/10 border border-danger/30 text-danger'
                      : 'bg-success/10 border border-success/30 text-success'
                  }`}>
                    <i className="fas fa-users" /> {acreditados.length} / {quotaResult.max_org - quotaResult.used_org} cupos
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Incluirme card ── */}
          {!incluirmeDone && (
            <div className="rounded-2xl border-2 border-dashed border-brand/30 bg-brand/5 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-heading flex items-center gap-2 text-sm sm:text-base">
                    <i className="fas fa-user-check text-brand" />
                    ¿Asistirás tú también?
                  </p>
                  <p className="text-sm text-muted mt-0.5">
                    Incluye tus datos como responsable directamente, sin volver a llenarlos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleIncluirme}
                  className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-white font-semibold text-xs sm:text-sm transition-snappy hover:opacity-90 shrink-0 w-full sm:w-auto justify-center"
                  style={{ backgroundColor: tenantColors.primario }}
                >
                  <i className="fas fa-user-plus" /> Incluirme como acreditado
                </button>
              </div>
            </div>
          )}

          {/* ── Action buttons ── */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAddAcreditado}
              disabled={acreditados.length >= maxCupos}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-edge text-body font-semibold text-xs sm:text-sm hover:bg-surface transition-snappy disabled:opacity-40"
            >
              <i className="fas fa-user-plus" /> Agregar persona
            </button>
            {teamMembers.length > 0 && (
              <button
                type="button"
                onClick={() => setShowTeamPicker(!showTeamPicker)}
                className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-snappy ${
                  showTeamPicker
                    ? 'bg-brand/10 border-2 border-brand text-brand'
                    : 'border border-edge text-body hover:bg-surface'
                }`}
              >
                <i className="fas fa-star" /> Frecuentes ({teamMembers.length})
              </button>
            )}
            {bulkEnabled && (
              <>
                <label className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border-2 border-dashed border-brand/40 text-brand font-semibold text-xs sm:text-sm hover:bg-brand/5 transition-snappy cursor-pointer">
                  <i className="fas fa-file-upload" /> <span className="hidden sm:inline">Importar</span> Excel / CSV
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt,.tsv"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-edge text-muted font-semibold text-xs sm:text-sm hover:bg-surface hover:text-body transition-snappy"
                  title="Descargar plantilla Excel con los campos del evento"
                >
                  <i className="fas fa-download" /> Plantilla
                </button>
              </>
            )}
          </div>

          {/* ── Team picker (frecuentes) ── */}
          {showTeamPicker && teamMembers.length > 0 && (
            <div className="rounded-2xl border border-edge bg-surface/40 overflow-hidden animate-fade-in">
              <div className="px-5 py-3 border-b border-edge/50 bg-surface/60 flex items-center justify-between">
                <p className="text-sm font-semibold text-heading flex items-center gap-2">
                  <i className="fas fa-star text-brand" /> Tu equipo frecuente
                </p>
                <button
                  type="button"
                  onClick={() => {
                    // Add all team members at once
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
                      newAcreditados.push({
                        id: crypto.randomUUID(),
                        rut: p.rut || '',
                        nombre: p.nombre || '',
                        apellido: p.apellido || '',
                        email: p.email || '',
                        telefono: p.telefono || '',
                        cargo: p.cargo || '',
                        dynamicData: buildDynamicData(p.datos_base),
                        isResponsable: false,
                      });
                    }
                    setAcreditados(prev => [...prev, ...newAcreditados]);
                    setMessage({ type: 'success', text: `${newAcreditados.length} persona${newAcreditados.length !== 1 ? 's' : ''} del equipo agregada${newAcreditados.length !== 1 ? 's' : ''}` });
                    setShowTeamPicker(false);
                  }}
                  className="text-xs text-brand font-semibold hover:underline"
                >
                  Agregar todos
                </button>
              </div>
              <div className="divide-y divide-edge/50 max-h-64 overflow-y-auto">
                {teamMembers.map((m) => {
                  const p = m.member_profile;
                  if (!p) return null;
                  const alreadyAdded = acreditados.some(a => a.rut && cleanRut(a.rut) === cleanRut(p.rut));
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface/60 transition-snappy">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand/10 text-brand text-xs font-bold shrink-0">
                        {p.nombre?.[0]}{p.apellido?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-heading truncate">
                          {p.nombre} {p.apellido}
                          {m.alias && <span className="text-muted font-normal ml-1">({m.alias})</span>}
                        </p>
                        <p className="text-xs text-muted truncate">
                          {p.rut}{p.cargo ? ` · ${p.cargo}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => handleAddFromTeam(m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-snappy shrink-0 ${
                          alreadyAdded
                            ? 'bg-success/10 text-success cursor-default'
                            : 'bg-brand/10 text-brand hover:bg-brand/20'
                        }`}
                      >
                        {alreadyAdded ? (
                          <><i className="fas fa-check mr-1" /> Agregado</>
                        ) : (
                          <><i className="fas fa-plus mr-1" /> Agregar</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Acreditados list */}
          {acreditados.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-edge bg-surface/30 py-12 text-center">
              <i className="fas fa-user-plus text-3xl text-muted mb-3 block" />
              <p className="text-body font-medium">Aún no has agregado acreditados</p>
              <p className="text-sm text-muted mt-1">Usa los botones de arriba para agregar personas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {acreditados.map((a, i) => (
                <AcreditadoRow
                  key={a.id}
                  index={i}
                  data={a}
                  errors={acreditadoErrors[a.id] || {}}
                  onChange={handleAcreditadoChange}
                  onDynamicChange={handleAcreditadoDynamicChange}
                  onBlur={handleAcreditadoBlur}
                  onRemove={handleRemoveAcreditado}
                  canRemove={true}
                  formFields={formFields}
                />
              ))}
            </div>
          )}

          {/* Error summary */}
          {Object.values(acreditadoErrors).some(e => Object.keys(e).length > 0) && (
            <div className="p-3 rounded-xl bg-danger/5 border border-danger/20 text-sm text-danger">
              <i className="fas fa-exclamation-triangle mr-2" />
              Algunos acreditados tienen errores. Revisa los campos marcados en rojo.
            </div>
          )}

          {/* Nav */}
          <div className="flex gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => goBack('medio')}
              className="flex-1 py-3 sm:py-3.5 rounded-xl border border-edge text-body font-semibold hover:bg-surface transition-snappy text-sm sm:text-base"
            >
              <i className="fas fa-arrow-left mr-1.5 sm:mr-2" /> Volver
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || acreditados.length === 0}
              className="flex-1 py-3 sm:py-3.5 rounded-xl text-white font-bold transition-snappy hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed relative text-sm sm:text-base"
              style={{ backgroundColor: tenantColors.primario }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" /> Enviando...
                </span>
              ) : (
                <>
                  <i className="fas fa-paper-plane mr-2" /> Revisar y Enviar
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══════ SUCCESS ═══════ */}
      {step === 'success' && (
        <div className="animate-fade-in text-center space-y-5 sm:space-y-6 px-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center bg-success/15">
              <i className="fas fa-check text-3xl sm:text-4xl text-success" />
            </div>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-heading">¡Solicitud enviada!</h2>
            <p className="text-muted mt-2">
              {submitResults.filter(r => r.ok).length} de {submitResults.length} acreditaciones enviadas correctamente
            </p>
          </div>

          {/* Results detail */}
          {submitResults.length > 0 && (
            <div className="max-w-md mx-auto space-y-2">
              {submitResults.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left ${r.ok ? 'bg-success/5 border border-success/20' : 'bg-danger/5 border border-danger/20'}`}
                >
                  <i className={`fas ${r.ok ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium truncate ${r.ok ? 'text-success' : 'text-danger'}`}>{r.nombre}</p>
                    {r.error && <p className="text-xs text-danger/80 truncate">{r.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <a
              href={`/${tenantSlug}`}
              className="flex-1 py-3 rounded-xl border border-edge text-body font-semibold text-center hover:bg-surface transition-snappy"
            >
              <i className="fas fa-home mr-2" /> Volver al Inicio
            </a>
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 py-3 rounded-xl text-white font-bold transition-snappy hover:opacity-90"
              style={{ backgroundColor: tenantColors.primario }}
            >
              <i className="fas fa-plus mr-2" /> Nueva Solicitud
            </button>
          </div>
        </div>
      )}

      {/* ═══════ CONFIRM MODAL ═══════ */}
      <Modal open={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirmar Solicitud" maxWidth="max-w-xl">
        <div className="mb-6">
          <div className="text-center mb-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${tenantColors.primario}20` }}>
              <i className="fas fa-clipboard-check text-2xl" style={{ color: tenantColors.primario }} />
            </div>
            <p className="text-sm text-muted">Revisa los datos antes de enviar</p>
          </div>

          {/* Responsable summary */}
          <div className="space-y-3 mb-6">
            <div className="bg-surface rounded-xl p-3 sm:p-4 border border-edge">
              <p className="text-xs font-semibold text-muted uppercase mb-2">Responsable</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-sm">
                <div><span className="text-muted">Nombre:</span> <span className="font-medium text-heading">{responsable.nombre} {responsable.apellido}</span></div>
                <div><span className="text-muted">RUT:</span> <span className="font-medium text-heading">{responsable.rut}</span></div>
                <div><span className="text-muted">Email:</span> <span className="font-medium text-heading">{responsable.email}</span></div>
                <div><span className="text-muted">Medio:</span> <span className="font-medium text-heading">{responsable.organizacion}</span></div>
              </div>
            </div>

            <div className="bg-surface rounded-xl p-3 sm:p-4 border border-edge">
              <p className="text-xs font-semibold text-muted uppercase mb-2">Tipo de Medio</p>
              <div className="flex items-center gap-2">
                <i className={`fas ${TIPO_MEDIO_ICONS[tipoMedio] || 'fa-ellipsis-h'} text-brand`} />
                <span className="font-medium text-heading">{tipoMedio}</span>
              </div>
            </div>

            <div className="bg-surface rounded-xl p-3 sm:p-4 border border-edge">
              <p className="text-xs font-semibold text-muted uppercase mb-2">Acreditados ({acreditados.length})</p>
              <div className="space-y-2">
                {acreditados.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="font-medium text-heading">{a.nombre} {a.apellido}</span>
                    <span className="text-muted">— {a.cargo || 'Sin cargo'}</span>
                    {a.isResponsable && <span className="text-xs text-success font-semibold">(Tú)</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 py-2.5 sm:py-3 rounded-xl border-2 border-edge text-body font-semibold hover:bg-surface transition-snappy text-sm sm:text-base"
            >
              <i className="fas fa-pen mr-1.5 sm:mr-2" /> Modificar
            </button>
            <button
              onClick={handleConfirmedSubmit}
              disabled={submitting}
              className="flex-1 py-2.5 sm:py-3 rounded-xl text-white font-bold transition-snappy hover:opacity-90 disabled:opacity-50 text-sm sm:text-base"
              style={{ backgroundColor: tenantColors.primario }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" /> Enviando...
                </span>
              ) : (
                <>
                  <i className="fas fa-paper-plane mr-2" /> Confirmar y Enviar
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
