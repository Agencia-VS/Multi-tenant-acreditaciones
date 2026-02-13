'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FormFieldDefinition, Profile, TeamMember } from '@/types';
import { TIPOS_MEDIO, CARGOS } from '@/types';
import { useQuotaCheck } from '@/hooks/useQuotaCheck';
import { Alert, LoadingSpinner, Modal } from '@/components/shared/ui';
import { validateRut, validateEmail, validatePhone, cleanRut, formatRut, sanitize } from '@/lib/validation';
import Disclaimer from '@/components/forms/Disclaimer';
import ExcelJS from 'exceljs';

interface DynamicRegistrationFormProps {
  eventId: string;
  eventName: string;
  formFields: FormFieldDefinition[];
  tenantColors: {
    primario: string;
    secundario: string;
  };
  tenantSlug: string;
  tenantName?: string;
  userProfile: Partial<Profile> | null;
  bulkEnabled?: boolean;
  eventFecha?: string | null;
  eventVenue?: string | null;
  fechaLimite?: string | null;
  contactEmail?: string;
  onSuccess?: () => void;
}

type AccreditationTarget = 'self' | 'team' | 'new' | 'bulk';
type Step = 'choose' | 'disclaimer' | 'team-select' | 'bulk-upload' | 'form' | 'success';

interface BulkRow {
  rut: string;
  nombre: string;
  apellido: string;
  email?: string;
  telefono?: string;
  cargo?: string;
  organizacion?: string;
  tipo_medio?: string;
  [key: string]: string | undefined;
}

interface BulkResult {
  row: number;
  rut: string;
  nombre: string;
  ok: boolean;
  error?: string;
}

/** Parsea CSV text a array de objetos */
function parseCSV(text: string): BulkRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(/[,;\t]/).map(h => 
    h.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
  );

  // Map common header variations
  const headerMap: Record<string, string> = {
    rut: 'rut', nombre: 'nombre', apellido: 'apellido',
    email: 'email', correo: 'email', mail: 'email',
    telefono: 'telefono', celular: 'telefono', fono: 'telefono',
    cargo: 'cargo', funcion: 'cargo',
    organizacion: 'organizacion', medio: 'organizacion', empresa: 'organizacion',
    tipo_medio: 'tipo_medio', tipo: 'tipo_medio',
  };

  const mappedHeaders = headers.map(h => headerMap[h] || h);

  return lines.slice(1)
    .filter(line => line.trim())
    .map(line => {
      const values = line.split(/[,;\t]/).map(v => v.trim().replace(/^"|"$/g, ''));
      const row: BulkRow = { rut: '', nombre: '', apellido: '' };
      mappedHeaders.forEach((header, i) => {
        if (values[i]) row[header] = values[i];
      });
      return row;
    })
    .filter(row => row.rut || row.nombre); // Filtrar filas vacías
}

/**
 * Formulario Dinámico de Inscripción v2
 * 
 * Flujo seguro post-login:
 * 1. ¿A quién acreditar? → "A mí mismo" / "A mi equipo" / "A alguien nuevo"
 * 2. Formulario con datos precargados según la opción
 * 3. Verificación de cupos en tiempo real
 * 4. Confirmación
 */
export default function DynamicRegistrationForm({
  eventId,
  eventName,
  formFields,
  tenantColors,
  tenantSlug,
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

  const [step, setStep] = useState<Step>('choose');
  const [target, setTarget] = useState<AccreditationTarget | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({
    rut: '',
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    cargo: '',
    organizacion: '',
    tipo_medio: '',
  });
  const [dynamicData, setDynamicData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ─── Validation & UX state ───
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  // ─── Team state ───
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ name: string; ok: boolean; msg: string }[]>([]);

  // ─── Bulk CSV state ───
  const [csvRows, setCsvRows] = useState<BulkRow[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [bulkApiResults, setBulkApiResults] = useState<BulkResult[]>([]);
  const [bulkApiSubmitting, setBulkApiSubmitting] = useState(false);
  const [bulkApiDone, setBulkApiDone] = useState(false);

  // Pre-fill formData from profile helper
  const prefillFromProfile = useCallback((profile: Partial<Profile>) => {
    setFormData((prev) => ({
      ...prev,
      rut: (profile.rut as string) || prev.rut,
      nombre: (profile.nombre as string) || prev.nombre,
      apellido: (profile.apellido as string) || prev.apellido,
      email: (profile.email as string) || prev.email,
      telefono: (profile.telefono as string) || prev.telefono,
      cargo: (profile.cargo as string) || prev.cargo,
      organizacion: (profile.medio as string) || prev.organizacion,
      tipo_medio: (profile.tipo_medio as string) || prev.tipo_medio,
    }));

    if (profile.datos_base && typeof profile.datos_base === 'object') {
      const db = profile.datos_base as Record<string, string>;
      const newDynamic: Record<string, string> = {};
      formFields.forEach((field) => {
        if (field.profile_field?.startsWith('datos_base.')) {
          const key = field.profile_field.split('.')[1];
          if (db[key]) newDynamic[field.key] = db[key];
        }
      });
      setDynamicData((prev) => ({ ...prev, ...newDynamic }));
    }
  }, [formFields]);

  // Verificar cupos al cambiar tipo_medio u organización
  useEffect(() => {
    if (formData.tipo_medio && formData.organizacion) {
      checkQuota(formData.tipo_medio, formData.organizacion);
    }
  }, [formData.tipo_medio, formData.organizacion, checkQuota]);

  // ─── Handlers ───

  const handleChoose = (choice: AccreditationTarget) => {
    setTarget(choice);
    setMessage(null);
    // Always go through disclaimer first
    setStep('disclaimer');
  };

  /** Called after the user accepts the disclaimer */
  const handleDisclaimerAccept = () => {
    setDisclaimerAccepted(true);

    if (target === 'self') {
      if (userProfile) prefillFromProfile(userProfile);
      setStep('form');
    } else if (target === 'team') {
      loadTeamMembers();
      setStep('team-select');
    } else if (target === 'bulk') {
      setCsvRows([]);
      setCsvFileName('');
      setBulkApiResults([]);
      setBulkApiDone(false);
      setStep('bulk-upload');
    } else {
      setFormData({ rut: '', nombre: '', apellido: '', email: '', telefono: '', cargo: '', organizacion: '', tipo_medio: '' });
      setDynamicData({});
      setStep('form');
    }
  };

  const loadTeamMembers = async () => {
    setTeamLoading(true);
    try {
      const res = await fetch('/api/teams');
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data);
      }
    } catch { /* ignore */ } finally {
      setTeamLoading(false);
    }
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTeamSubmit = async () => {
    if (selectedMembers.size === 0) return;
    setBulkSubmitting(true);
    setBulkResults([]);
    const results: { name: string; ok: boolean; msg: string }[] = [];

    for (const memberId of selectedMembers) {
      const member = teamMembers.find((m) => m.id === memberId);
      if (!member?.member_profile) continue;

      const mp = member.member_profile;
      try {
        const res = await fetch('/api/registrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventId,
            rut: mp.rut,
            nombre: mp.nombre,
            apellido: mp.apellido,
            email: mp.email || '',
            telefono: mp.telefono || '',
            cargo: mp.cargo || '',
            organizacion: mp.medio || '',
            tipo_medio: mp.tipo_medio || '',
            datos_extra: {},
            submitted_by: userProfile?.id || undefined,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          results.push({ name: `${mp.nombre} ${mp.apellido}`, ok: true, msg: 'Registrado' });
        } else {
          results.push({ name: `${mp.nombre} ${mp.apellido}`, ok: false, msg: data.error || 'Error' });
        }
      } catch {
        results.push({ name: `${mp.nombre} ${mp.apellido}`, ok: false, msg: 'Error de conexión' });
      }
    }

    setBulkResults(results);
    setBulkSubmitting(false);
    if (results.every((r) => r.ok)) {
      setStep('success');
      onSuccess?.();
    }
  };

  // ─── Bulk CSV handlers ───

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      // Parse Excel con ExcelJS
      try {
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const sheet = workbook.worksheets[0];
        if (!sheet || sheet.rowCount < 2) {
          setMessage({ type: 'error', text: 'El archivo Excel está vacío o no tiene datos' });
          return;
        }

        const headerRow = sheet.getRow(1);
        const headers: string[] = [];
        headerRow.eachCell((cell, colNumber) => {
          const val = (cell.value?.toString() || '').trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
          headers[colNumber - 1] = val;
        });

        const headerMap: Record<string, string> = {
          rut: 'rut', nombre: 'nombre', apellido: 'apellido',
          email: 'email', correo: 'email', mail: 'email',
          telefono: 'telefono', celular: 'telefono', fono: 'telefono',
          cargo: 'cargo', funcion: 'cargo',
          organizacion: 'organizacion', medio: 'organizacion', empresa: 'organizacion',
          tipo_medio: 'tipo_medio', tipo: 'tipo_medio',
        };
        const mappedHeaders = headers.map(h => headerMap[h] || h);

        const rows: BulkRow[] = [];
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // skip header
          const rowData: BulkRow = { rut: '', nombre: '', apellido: '' };
          row.eachCell((cell, colNumber) => {
            const header = mappedHeaders[colNumber - 1];
            if (header) rowData[header] = cell.value?.toString().trim() || '';
          });
          if (rowData.rut || rowData.nombre) rows.push(rowData);
        });
        setCsvRows(rows);
      } catch {
        setMessage({ type: 'error', text: 'Error al leer el archivo Excel' });
      }
    } else {
      // Parse CSV/TSV/TXT
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const rows = parseCSV(text);
        setCsvRows(rows);
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const removeCsvRow = (index: number) => {
    setCsvRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleBulkSubmit = async () => {
    if (csvRows.length === 0) return;
    setBulkApiSubmitting(true);
    setBulkApiResults([]);
    setBulkApiDone(false);

    try {
      const res = await fetch('/api/bulk-accreditation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, rows: csvRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Error en carga masiva' });
      } else {
        setBulkApiResults(data.results || []);
        setBulkApiDone(true);
        if (data.errors === 0) {
          setStep('success');
          onSuccess?.();
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión al procesar carga masiva' });
    } finally {
      setBulkApiSubmitting(false);
    }
  };

  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Accredia';
    const sheet = workbook.addWorksheet('Acreditaciones');

    // Columnas con ancho razonable
    sheet.columns = [
      { header: 'RUT', key: 'rut', width: 16 },
      { header: 'Nombre', key: 'nombre', width: 20 },
      { header: 'Apellido', key: 'apellido', width: 20 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Teléfono', key: 'telefono', width: 16 },
      { header: 'Cargo', key: 'cargo', width: 18 },
      { header: 'Organización', key: 'organizacion', width: 22 },
      { header: 'Tipo Medio', key: 'tipo_medio', width: 16 },
    ];

    // Estilo header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    // Fila de ejemplo
    sheet.addRow({
      rut: '12.345.678-9',
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan@mail.com',
      telefono: '+56912345678',
      cargo: 'Periodista',
      organizacion: 'Canal 13',
      tipo_medio: 'TV',
    });

    // Nota
    const noteRow = sheet.addRow([]);
    sheet.addRow(['* Campos requeridos: RUT, Nombre, Apellido.  Los demás son opcionales.']);
    const noteCell = sheet.getCell(`A${noteRow.number + 1}`);
    noteCell.font = { italic: true, color: { argb: 'FF888888' }, size: 9 };
    sheet.mergeCells(`A${noteRow.number + 1}:H${noteRow.number + 1}`);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-acreditacion-masiva.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Field validation helpers ───

  const markTouched = (field: string) => {
    setTouchedFields(prev => new Set(prev).add(field));
  };

  const validateField = useCallback((field: string, value: string): string | null => {
    switch (field) {
      case 'rut': {
        if (!value.trim()) return 'RUT es requerido';
        const result = validateRut(value);
        return result.valid ? null : (result.error || 'RUT inválido');
      }
      case 'email': {
        if (!value.trim()) return 'Email es requerido';
        const result = validateEmail(value);
        return result.valid ? null : (result.error || 'Email inválido');
      }
      case 'nombre':
        return !value.trim() ? 'Nombre es requerido' : null;
      case 'apellido':
        return !value.trim() ? 'Apellido es requerido' : null;
      case 'organizacion':
        return !value.trim() ? 'Organización es requerida' : null;
      case 'tipo_medio':
        return !value.trim() ? 'Tipo de medio es requerido' : null;
      case 'cargo':
        return !value.trim() ? 'Cargo es requerido' : null;
      case 'telefono': {
        if (!value.trim()) return null; // Optional
        const result = validatePhone(value);
        return result.valid ? null : (result.error || 'Teléfono inválido');
      }
      default:
        return null;
    }
  }, []);

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Real-time validation only if field was already touched
    if (touchedFields.has(field)) {
      const error = validateField(field, value);
      setFieldErrors(prev => {
        const next = { ...prev };
        if (error) next[field] = error;
        else delete next[field];
        return next;
      });
    }
  };

  const handleFieldBlur = (field: string) => {
    markTouched(field);
    const value = formData[field] || '';
    
    // Auto-format RUT on blur
    if (field === 'rut' && value.trim()) {
      const cleaned = cleanRut(value);
      const rutResult = validateRut(value);
      if (rutResult.valid && rutResult.formatted) {
        setFormData(prev => ({ ...prev, rut: rutResult.formatted! }));
      } else {
        // Al menos limpiar puntos duplicados
        setFormData(prev => ({ ...prev, rut: formatRut(cleaned) }));
      }
    }

    const error = validateField(field, value);
    setFieldErrors(prev => {
      const next = { ...prev };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  };

  const validateAllFields = (): boolean => {
    const errors: Record<string, string> = {};
    const requiredFields = ['rut', 'nombre', 'apellido', 'email', 'organizacion', 'tipo_medio', 'cargo'];

    for (const field of requiredFields) {
      const error = validateField(field, formData[field] || '');
      if (error) errors[field] = error;
    }

    // Validate optional fields that have values
    if (formData.telefono) {
      const error = validateField('telefono', formData.telefono);
      if (error) errors.telefono = error;
    }

    // Validate required dynamic fields
    missingFields.forEach(f => {
      if (f.required && !dynamicData[f.key]?.trim()) {
        errors[`dynamic_${f.key}`] = `${f.label} es requerido`;
      }
    });

    setFieldErrors(errors);
    setTouchedFields(new Set([...requiredFields, 'telefono']));
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validate all fields first
    if (!validateAllFields()) {
      setMessage({ type: 'error', text: 'Hay errores en el formulario. Revisa los campos marcados en rojo.' });
      // Scroll to first error
      const firstErrorField = document.querySelector('[data-field-error="true"]');
      firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Show confirmation modal instead of submitting directly
    setShowConfirmModal(true);
  };

  const handleConfirmedSubmit = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    setMessage(null);

    // Sanitize all values
    const sanitizedData = {
      rut: cleanRut(formData.rut),
      nombre: sanitize(formData.nombre),
      apellido: sanitize(formData.apellido),
      email: sanitize(formData.email).toLowerCase(),
      telefono: sanitize(formData.telefono),
      cargo: sanitize(formData.cargo),
      organizacion: sanitize(formData.organizacion),
      tipo_medio: sanitize(formData.tipo_medio),
    };

    // Sanitize dynamic data
    const sanitizedDynamic: Record<string, string> = {};
    Object.entries(dynamicData).forEach(([k, v]) => {
      sanitizedDynamic[k] = sanitize(v);
    });

    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          ...sanitizedData,
          datos_extra: sanitizedDynamic,
          submitted_by: userProfile?.id || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Error al enviar solicitud' });
        return;
      }

      setStep('success');
      onSuccess?.();
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  const getMissingFields = (fields: FormFieldDefinition[]): FormFieldDefinition[] => {
    const profileToCheck = target === 'self' ? userProfile : null;
    if (!profileToCheck) return fields;

    return fields.filter((field) => {
      if (!field.profile_field) return true;
      const parts = field.profile_field.split('.');
      let value: unknown = profileToCheck;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[part];
        } else {
          value = undefined;
          break;
        }
      }
      return !value || value === '' || value === null;
    });
  };

  const resetForm = () => {
    setStep('choose');
    setTarget(null);
    setFormData({ rut: '', nombre: '', apellido: '', email: '', telefono: '', cargo: '', organizacion: '', tipo_medio: '' });
    setDynamicData({});
    setMessage(null);
    setSelectedMembers(new Set());
    setBulkResults([]);
    setCsvRows([]);
    setCsvFileName('');
    setBulkApiResults([]);
    setBulkApiDone(false);
    setFieldErrors({});
    setTouchedFields(new Set());
    setShowConfirmModal(false);
    setDisclaimerAccepted(false);
  };

  const missingFields = getMissingFields(formFields);

  // ─── Dynamic CSS helpers ───
  const getInputClass = (field: string) => {
    const hasError = touchedFields.has(field) && fieldErrors[field];
    const baseClass = 'w-full px-3 py-2.5 rounded-lg border-2 focus:ring-2 focus:border-transparent transition text-gray-900 text-base';
    if (hasError) return `${baseClass} border-red-400 focus:ring-red-400 bg-red-50/30`;
    if (touchedFields.has(field) && !fieldErrors[field] && formData[field]?.trim()) {
      return `${baseClass} border-green-400 focus:ring-green-400`;
    }
    return `${baseClass} border-gray-300 focus:ring-blue-500`;
  };
  const inputClass = 'w-full px-3 py-2.5 rounded-lg border-2 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 text-base';
  const labelClass = 'block text-base font-semibold text-gray-700 mb-1';

  /** Inline error message component */
  const FieldError = ({ field }: { field: string }) => {
    if (!touchedFields.has(field) || !fieldErrors[field]) return null;
    return (
      <p className="mt-1 text-sm text-red-600 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
        <i className="fas fa-exclamation-circle" />
        {fieldErrors[field]}
      </p>
    );
  };

  /** Field valid indicator */
  const FieldValid = ({ field }: { field: string }) => {
    if (!touchedFields.has(field) || fieldErrors[field] || !formData[field]?.trim()) return null;
    return (
      <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
        <i className="fas fa-check-circle" />
        Válido
      </p>
    );
  };

  // ─── Progress Steps Indicator ───
  const STEPS_ORDER: { key: Step; label: string; icon: string }[] = [
    { key: 'choose', label: 'Elegir', icon: 'fa-hand-pointer' },
    { key: 'disclaimer', label: 'Términos', icon: 'fa-shield-alt' },
    ...(target === 'team' ? [{ key: 'team-select' as Step, label: 'Equipo', icon: 'fa-users' }] : []),
    ...(target === 'bulk' ? [{ key: 'bulk-upload' as Step, label: 'Carga', icon: 'fa-file-upload' }] : []),
    ...((target === 'self' || target === 'new') ? [{ key: 'form' as Step, label: 'Formulario', icon: 'fa-edit' }] : []),
    { key: 'success', label: 'Listo', icon: 'fa-check' },
  ];

  const currentStepIndex = STEPS_ORDER.findIndex(s => s.key === step);

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-8">
      {STEPS_ORDER.map((s, i) => {
        const isActive = i === currentStepIndex;
        const isCompleted = i < currentStepIndex;
        return (
          <div key={s.key} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              isActive
                ? 'text-white shadow-md'
                : isCompleted
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-400'
            }`}
              style={isActive ? { backgroundColor: tenantColors.primario } : undefined}
            >
              <i className={`fas ${isCompleted ? 'fa-check' : s.icon} text-xs`} />
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS_ORDER.length - 1 && (
              <div className={`w-6 h-0.5 mx-1 ${isCompleted ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // STEP: CHOOSE — ¿A quién deseas acreditar?
  // ═══════════════════════════════════════════════════════════════════════
  if (step === 'choose') {
    return (
      <div className="max-w-2xl mx-auto">
        <StepIndicator />
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">¿A quién deseas acreditar?</h2>
          <p className="text-gray-500 mt-1">{eventName}</p>
          {userProfile && (
            <p className="text-sm text-gray-400 mt-2">
              Conectado como <strong className="text-gray-600">{userProfile.nombre} {userProfile.apellido}</strong>
            </p>
          )}
        </div>

        <div className={`grid gap-4 ${bulkEnabled ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
          {/* Opción 1: A mí mismo */}
          <button
            onClick={() => handleChoose('self')}
            className="bg-white rounded-xl shadow-md border-2 border-transparent hover:border-blue-400 hover:shadow-lg transition-all p-6 text-left group"
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${tenantColors.primario}20` }}
            >
              <i className="fas fa-user text-xl" style={{ color: tenantColors.primario }} />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">A mí mismo</h3>
            <p className="text-gray-400 text-sm mt-1">
              Tus datos se precargan automáticamente
            </p>
          </button>

          {/* Opción 2: A mi equipo */}
          <button
            onClick={() => handleChoose('team')}
            className="bg-white rounded-xl shadow-md border-2 border-transparent hover:border-purple-400 hover:shadow-lg transition-all p-6 text-left group"
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 bg-purple-50"
            >
              <i className="fas fa-users text-xl text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">A mi equipo</h3>
            <p className="text-gray-400 text-sm mt-1">
              Selecciona miembros de tus frecuentes
            </p>
          </button>

          {/* Opción 3: A alguien nuevo */}
          <button
            onClick={() => handleChoose('new')}
            className="bg-white rounded-xl shadow-md border-2 border-transparent hover:border-green-400 hover:shadow-lg transition-all p-6 text-left group"
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 bg-green-50"
            >
              <i className="fas fa-user-plus text-xl text-green-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">A alguien nuevo</h3>
            <p className="text-gray-400 text-sm mt-1">
              Ingresa los datos manualmente
            </p>
          </button>

          {/* Opción 4: Carga masiva (solo si habilitada) */}
          {bulkEnabled && (
            <button
              onClick={() => handleChoose('bulk')}
              className="bg-white rounded-xl shadow-md border-2 border-transparent hover:border-orange-400 hover:shadow-lg transition-all p-6 text-left group"
            >
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 bg-orange-50">
                <i className="fas fa-file-csv text-xl text-orange-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Carga masiva</h3>
              <p className="text-gray-400 text-sm mt-1">
                Sube un CSV con múltiples personas
              </p>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP: DISCLAIMER — Términos y condiciones
  // ═══════════════════════════════════════════════════════════════════════
  if (step === 'disclaimer') {
    return (
      <>
        <StepIndicator />
        <Disclaimer
          visible={true}
          onAccept={handleDisclaimerAccept}
          onBack={resetForm}
          tenantColors={tenantColors}
          tenantName={tenantName}
          eventName={eventName}
          eventFecha={eventFecha}
          eventVenue={eventVenue}
          fechaLimite={fechaLimite}
          contactEmail={contactEmail}
        />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP: BULK-UPLOAD — Carga masiva vía CSV
  // ═══════════════════════════════════════════════════════════════════════
  if (step === 'bulk-upload') {
    const validRows = csvRows.filter(r => r.rut && r.nombre && r.apellido);
    const invalidRows = csvRows.filter(r => !r.rut || !r.nombre || !r.apellido);

    return (
      <div className="max-w-3xl mx-auto">
        <StepIndicator />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Acreditación Masiva</h2>
            <p className="text-gray-500 text-sm mt-1">{eventName}</p>
          </div>
          <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-sm">
            <i className="fas fa-arrow-left mr-1" /> Volver
          </button>
        </div>

        {message && <Alert message={message} onClose={() => setMessage(null)} />}

        {/* Upload area */}
        {csvRows.length === 0 && !bulkApiDone && (
          <div className="bg-white rounded-xl shadow-lg p-5 md:p-6">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-file-csv text-3xl text-orange-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Sube tu archivo CSV</h3>
              <p className="text-gray-500 text-base mt-1">
                El archivo debe tener columnas: <strong>rut, nombre, apellido</strong> (requeridas), email, telefono, cargo, organizacion, tipo_medio
              </p>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-orange-400 transition">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <i className="fas fa-cloud-upload-alt text-4xl text-gray-300 mb-3" />
                <p className="text-gray-600 font-medium">Haz clic para seleccionar archivo</p>
                <p className="text-gray-400 text-sm mt-1">Excel (.xlsx), CSV, TSV o TXT</p>
              </label>
            </div>

            <div className="mt-4 flex justify-center">
              <button
                onClick={downloadTemplate}
                className="text-orange-600 hover:text-orange-700 text-sm font-medium"
              >
                <i className="fas fa-download mr-1" />
                Descargar plantilla Excel
              </button>
            </div>
          </div>
        )}

        {/* Preview table */}
        {csvRows.length > 0 && !bulkApiDone && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  <i className="fas fa-file-csv text-orange-500 mr-2" />
                  {csvFileName}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  <span className="text-green-600 font-medium">{validRows.length} válidos</span>
                  {invalidRows.length > 0 && (
                    <span className="text-red-500 font-medium ml-2">{invalidRows.length} con errores</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => { setCsvRows([]); setCsvFileName(''); }}
                className="text-gray-400 hover:text-red-500 text-sm"
              >
                <i className="fas fa-times mr-1" /> Cambiar archivo
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">#</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">RUT</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Nombre</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Email</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Org.</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Tipo</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {csvRows.map((row, i) => {
                    const valid = row.rut && row.nombre && row.apellido;
                    return (
                      <tr key={i} className={valid ? '' : 'bg-red-50'}>
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-mono text-gray-700">{row.rut || <span className="text-red-400">—</span>}</td>
                        <td className="px-3 py-2 text-gray-900">{row.nombre} {row.apellido}</td>
                        <td className="px-3 py-2 text-gray-500">{row.email || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{row.organizacion || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{row.tipo_medio || '—'}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => removeCsvRow(i)} className="text-gray-300 hover:text-red-500">
                            <i className="fas fa-times" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t">
              <button
                onClick={handleBulkSubmit}
                disabled={validRows.length === 0 || bulkApiSubmitting}
                className="w-full py-4 rounded-lg text-white font-bold text-lg transition disabled:opacity-50 hover:opacity-90"
                style={{ backgroundColor: tenantColors.primario }}
              >
                {bulkApiSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner size="sm" /> Procesando {validRows.length} registros...
                  </span>
                ) : (
                  <>
                    <i className="fas fa-paper-plane mr-2" />
                    Acreditar {validRows.length} persona{validRows.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Results after submit */}
        {bulkApiDone && bulkApiResults.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <p className="font-semibold text-gray-900">Resultados de carga masiva</p>
              <p className="text-sm text-gray-500">
                <span className="text-green-600 font-medium">{bulkApiResults.filter(r => r.ok).length} exitosos</span>
                {bulkApiResults.some(r => !r.ok) && (
                  <span className="text-red-500 font-medium ml-2">{bulkApiResults.filter(r => !r.ok).length} con errores</span>
                )}
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y">
              {bulkApiResults.map((r, i) => (
                <div
                  key={i}
                  className={`px-4 py-3 flex items-center gap-3 text-sm ${r.ok ? '' : 'bg-red-50'}`}
                >
                  <i className={`fas ${r.ok ? 'fa-check-circle text-green-500' : 'fa-times-circle text-red-500'}`} />
                  <span className="font-mono text-gray-500 w-28 shrink-0">{r.rut}</span>
                  <span className="text-gray-900 flex-1">{r.nombre}</span>
                  {!r.ok && <span className="text-red-600 text-xs">{r.error}</span>}
                </div>
              ))}
            </div>
            <div className="p-4 border-t flex gap-3">
              {bulkApiResults.every(r => r.ok) ? (
                <a
                  href="/acreditado/dashboard"
                  className="flex-1 py-3 rounded-lg text-white font-semibold text-center"
                  style={{ backgroundColor: tenantColors.primario }}
                >
                  <i className="fas fa-list-check mr-2" />Ver Mis Acreditaciones
                </a>
              ) : (
                <button
                  onClick={resetForm}
                  className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-600 font-semibold hover:bg-gray-50 transition"
                >
                  <i className="fas fa-redo mr-1" /> Intentar nuevamente
                </button>
              )}
              <button
                onClick={resetForm}
                className="px-6 py-3 rounded-lg border border-gray-300 text-gray-600 font-semibold hover:bg-gray-50 transition"
              >
                Nueva Solicitud
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP: TEAM-SELECT — Seleccionar miembros del equipo
  // ═══════════════════════════════════════════════════════════════════════
  if (step === 'team-select') {
    return (
      <div className="max-w-2xl mx-auto">
        <StepIndicator />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Selecciona tu equipo</h2>
            <p className="text-gray-500 text-sm mt-1">{eventName}</p>
          </div>
          <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-sm">
            <i className="fas fa-arrow-left mr-1" /> Volver
          </button>
        </div>

        {teamLoading ? (
          <div className="text-center py-12">
            <LoadingSpinner size="lg" />
            <p className="text-gray-400 mt-4">Cargando equipo...</p>
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <i className="fas fa-users text-4xl text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg mb-2">No tienes miembros en tu equipo</p>
            <p className="text-gray-400 text-sm mb-4">
              Agrega frecuentes desde tu{' '}
              <a href="/acreditado/equipo" className="text-blue-600 hover:underline">panel de equipo</a>
            </p>
            <button onClick={resetForm} className="text-blue-600 hover:underline text-sm">
              <i className="fas fa-arrow-left mr-1" /> Elegir otra opción
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {teamMembers.map((member) => {
                const mp = member.member_profile;
                const isSelected = selectedMembers.has(member.id);
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-purple-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                          isSelected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {isSelected ? (
                          <i className="fas fa-check" />
                        ) : (
                          mp?.nombre?.charAt(0) || '?'
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">
                          {mp?.nombre} {mp?.apellido}
                          {member.alias && member.alias !== `${mp?.nombre} ${mp?.apellido}` && (
                            <span className="text-gray-400 font-normal ml-2">({member.alias})</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {mp?.rut} · {mp?.medio || 'Sin medio'} · {mp?.cargo || 'Sin cargo'}
                        </p>
                      </div>
                      {mp?.tipo_medio && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {mp.tipo_medio}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bulk results */}
            {bulkResults.length > 0 && (
              <div className="mb-4 space-y-2">
                {bulkResults.map((r, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg text-sm ${r.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                  >
                    <i className={`fas ${r.ok ? 'fa-check-circle' : 'fa-times-circle'} mr-2`} />
                    <strong>{r.name}:</strong> {r.msg}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleTeamSubmit}
              disabled={selectedMembers.size === 0 || bulkSubmitting}
              className="w-full py-4 rounded-lg text-white font-bold text-lg transition disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: tenantColors.primario }}
            >
              {bulkSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" /> Enviando {selectedMembers.size} solicitudes...
                </span>
              ) : (
                <>
                  <i className="fas fa-paper-plane mr-2" />
                  Acreditar {selectedMembers.size} persona{selectedMembers.size !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP: SUCCESS
  // ═══════════════════════════════════════════════════════════════════════
  if (step === 'success') {
    return (
      <div className="max-w-md mx-auto text-center">
        <StepIndicator />
        <div className="bg-white rounded-xl shadow-lg p-5 md:p-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-check text-green-600 text-2xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {target === 'team' ? 'Equipo Acreditado' : target === 'bulk' ? 'Carga Masiva Completada' : 'Solicitud Enviada'}
          </h2>
          <p className="text-gray-500">
            {target === 'team'
              ? 'Las solicitudes de acreditación de tu equipo han sido enviadas.'
              : target === 'bulk'
              ? 'Todas las solicitudes de la carga masiva fueron procesadas exitosamente.'
              : 'Tu solicitud de acreditación ha sido recibida. Te notificaremos por email cuando sea procesada.'}
          </p>
          <div className="flex flex-col gap-3 mt-6">
            <a
              href="/acreditado/dashboard"
              className="px-6 py-2 rounded-lg text-white font-semibold text-center"
              style={{ backgroundColor: tenantColors.primario }}
            >
              <i className="fas fa-list-check mr-2" />
              Ver Mis Acreditaciones
            </a>
            <div className="flex gap-3 justify-center">
              <button
                onClick={resetForm}
                className="px-6 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold hover:bg-gray-50 transition"
              >
                Nueva Solicitud
              </button>
              <a
                href={`/${tenantSlug}`}
                className="px-6 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold hover:bg-gray-50 transition"
              >
                Volver al Inicio
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP: FORM — Formulario individual (self o new)
  // ═══════════════════════════════════════════════════════════════════════

  /** Completion percentage for the progress bar */
  const requiredFieldKeys = ['rut', 'nombre', 'apellido', 'email', 'organizacion', 'tipo_medio', 'cargo'];
  const totalRequired = requiredFieldKeys.length + missingFields.filter(f => f.required).length;
  const filledRequired = requiredFieldKeys.filter(k => formData[k]?.trim()).length
    + missingFields.filter(f => f.required && dynamicData[f.key]?.trim()).length;
  const completionPct = totalRequired > 0 ? Math.round((filledRequired / totalRequired) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto">
      <StepIndicator />

      <div className="flex items-center justify-between mb-6">
        <div className="text-center flex-1">
          <h2 className="text-2xl font-bold text-gray-900">Formulario de Acreditación</h2>
          <p className="text-gray-500">{eventName}</p>
          {target === 'self' && userProfile && (
            <div className="mt-2 inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
              <i className="fas fa-user-check mr-2" />
              Datos precargados desde tu perfil
            </div>
          )}
          {target === 'new' && (
            <div className="mt-2 inline-flex items-center px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
              <i className="fas fa-user-plus mr-2" />
              Registro para una persona nueva
            </div>
          )}
        </div>
        <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-sm ml-4">
          <i className="fas fa-arrow-left mr-1" /> Volver
        </button>
      </div>

      {/* Barra de progreso del formulario */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Progreso del formulario</span>
          <span className={completionPct === 100 ? 'text-green-600 font-semibold' : ''}>
            {completionPct}% completado
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${completionPct}%`,
              backgroundColor: completionPct === 100 ? '#22c55e' : tenantColors.primario,
            }}
          />
        </div>
      </div>

      {message && <Alert message={message} onClose={() => setMessage(null)} />}

      {/* Indicador de cupo */}
      {quotaResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${quotaResult.available ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <i className={`fas ${quotaResult.available ? 'fa-check-circle' : 'fa-exclamation-triangle'} mr-2`} />
          {quotaResult.message}
          {quotaResult.max_org > 0 && (
            <span className="ml-2 font-semibold">
              ({quotaResult.used_org}/{quotaResult.max_org} por organización)
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-5 md:p-6 space-y-5" noValidate>
        {/* Sección: Datos Personales */}
        <fieldset>
          <legend className="text-lg font-bold text-gray-900 mb-3 flex items-center">
            <i className="fas fa-user mr-2 text-blue-500" /> Datos Personales
          </legend>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* RUT */}
            <div data-field-error={!!fieldErrors.rut || undefined}>
              <label className={labelClass}>RUT *</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.rut}
                  onChange={(e) => handleFieldChange('rut', e.target.value)}
                  onBlur={() => handleFieldBlur('rut')}
                  readOnly={target === 'self' && !!userProfile?.rut}
                  placeholder="12.345.678-9"
                  className={`${getInputClass('rut')} ${target === 'self' && !!userProfile?.rut ? 'bg-gray-50 cursor-not-allowed' : ''} pr-10`}
                />
                {touchedFields.has('rut') && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {fieldErrors.rut ? (
                      <i className="fas fa-times-circle text-red-400" />
                    ) : formData.rut?.trim() ? (
                      <i className="fas fa-check-circle text-green-500" />
                    ) : null}
                  </span>
                )}
              </div>
              {target === 'self' && !userProfile?.rut && (
                <p className="text-sm text-amber-600 mt-1"><i className="fas fa-info-circle mr-1" />Tu perfil no tiene RUT, ingrésalo manualmente</p>
              )}
              <FieldError field="rut" />
              <FieldValid field="rut" />
            </div>

            {/* Nombre */}
            <div data-field-error={!!fieldErrors.nombre || undefined}>
              <label className={labelClass}>Nombre *</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => handleFieldChange('nombre', e.target.value)}
                onBlur={() => handleFieldBlur('nombre')}
                placeholder="Juan"
                className={getInputClass('nombre')}
              />
              <FieldError field="nombre" />
            </div>

            {/* Apellido */}
            <div data-field-error={!!fieldErrors.apellido || undefined}>
              <label className={labelClass}>Apellido *</label>
              <input
                type="text"
                value={formData.apellido}
                onChange={(e) => handleFieldChange('apellido', e.target.value)}
                onBlur={() => handleFieldBlur('apellido')}
                placeholder="Pérez"
                className={getInputClass('apellido')}
              />
              <FieldError field="apellido" />
            </div>

            {/* Email */}
            <div data-field-error={!!fieldErrors.email || undefined}>
              <label className={labelClass}>Email *</label>
              <div className="relative">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  onBlur={() => handleFieldBlur('email')}
                  placeholder="correo@ejemplo.cl"
                  className={`${getInputClass('email')} pr-10`}
                />
                {touchedFields.has('email') && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {fieldErrors.email ? (
                      <i className="fas fa-times-circle text-red-400" />
                    ) : formData.email?.trim() ? (
                      <i className="fas fa-check-circle text-green-500" />
                    ) : null}
                  </span>
                )}
              </div>
              <FieldError field="email" />
              <FieldValid field="email" />
            </div>

            {/* Teléfono */}
            <div data-field-error={!!fieldErrors.telefono || undefined}>
              <label className={labelClass}>Teléfono</label>
              <input
                type="tel"
                value={formData.telefono}
                onChange={(e) => handleFieldChange('telefono', e.target.value)}
                onBlur={() => handleFieldBlur('telefono')}
                placeholder="+56 9 1234 5678"
                className={getInputClass('telefono')}
              />
              <FieldError field="telefono" />
            </div>
          </div>
        </fieldset>

        {/* Sección: Datos Profesionales */}
        <fieldset>
          <legend className="text-lg font-bold text-gray-900 mb-3 flex items-center">
            <i className="fas fa-briefcase mr-2 text-purple-500" /> Datos Profesionales
          </legend>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Organización */}
            <div data-field-error={!!fieldErrors.organizacion || undefined}>
              <label className={labelClass}>Organización / Medio *</label>
              <input
                type="text"
                value={formData.organizacion}
                onChange={(e) => handleFieldChange('organizacion', e.target.value)}
                onBlur={() => handleFieldBlur('organizacion')}
                placeholder="Ej: Canal 13, Radio ADN"
                className={getInputClass('organizacion')}
              />
              <FieldError field="organizacion" />
            </div>

            {/* Tipo de Medio */}
            <div data-field-error={!!fieldErrors.tipo_medio || undefined}>
              <label className={labelClass}>Tipo de Medio *</label>
              <select
                value={formData.tipo_medio}
                onChange={(e) => { handleFieldChange('tipo_medio', e.target.value); markTouched('tipo_medio'); }}
                onBlur={() => handleFieldBlur('tipo_medio')}
                className={getInputClass('tipo_medio')}
              >
                <option value="">Selecciona...</option>
                {TIPOS_MEDIO.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
              </select>
              <FieldError field="tipo_medio" />
            </div>

            {/* Cargo */}
            <div data-field-error={!!fieldErrors.cargo || undefined}>
              <label className={labelClass}>Cargo *</label>
              <select
                value={formData.cargo}
                onChange={(e) => { handleFieldChange('cargo', e.target.value); markTouched('cargo'); }}
                onBlur={() => handleFieldBlur('cargo')}
                className={getInputClass('cargo')}
              >
                <option value="">Selecciona...</option>
                {CARGOS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <FieldError field="cargo" />
            </div>
          </div>
        </fieldset>

        {/* Sección: Campos Dinámicos (solo los faltantes) */}
        {missingFields.length > 0 && (
          <fieldset>
            <legend className="text-lg font-bold text-gray-900 mb-3 flex items-center">
              <i className="fas fa-clipboard-list mr-2 text-orange-500" /> Información Adicional
              {target === 'self' && <span className="ml-2 text-sm font-normal text-gray-400">(solo campos pendientes)</span>}
            </legend>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {missingFields
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((field) => {
                  const dynErrorKey = `dynamic_${field.key}`;
                  return (
                    <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''} data-field-error={!!fieldErrors[dynErrorKey] || undefined}>
                      <label className={labelClass}>
                        {field.label} {field.required && '*'}
                      </label>
                      {field.help_text && <p className="text-sm text-gray-400 mb-1">{field.help_text}</p>}
                      
                      {field.type === 'select' && field.options ? (
                        <select
                          value={dynamicData[field.key] || ''}
                          onChange={(e) => setDynamicData({...dynamicData, [field.key]: e.target.value})}
                          required={field.required}
                          className={inputClass}
                        >
                          <option value="">Selecciona...</option>
                          {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea
                          value={dynamicData[field.key] || ''}
                          onChange={(e) => setDynamicData({...dynamicData, [field.key]: e.target.value})}
                          required={field.required}
                          placeholder={field.placeholder}
                          rows={3}
                          className={inputClass}
                        />
                      ) : field.type === 'checkbox' ? (
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={dynamicData[field.key] === 'true'}
                            onChange={(e) => setDynamicData({...dynamicData, [field.key]: e.target.checked ? 'true' : 'false'})}
                            className="w-5 h-5 rounded"
                          />
                          <span className="text-sm text-gray-600">{field.placeholder || field.label}</span>
                        </label>
                      ) : (
                        <input
                          type={field.type}
                          value={dynamicData[field.key] || ''}
                          onChange={(e) => setDynamicData({...dynamicData, [field.key]: e.target.value})}
                          required={field.required}
                          placeholder={field.placeholder}
                          className={inputClass}
                        />
                      )}
                      {fieldErrors[dynErrorKey] && (
                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                          <i className="fas fa-exclamation-circle" />
                          {fieldErrors[dynErrorKey]}
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          </fieldset>
        )}

        {/* Error summary */}
        {Object.keys(fieldErrors).length > 0 && touchedFields.size > 3 && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <i className="fas fa-exclamation-triangle mr-2" />
            Hay <strong>{Object.keys(fieldErrors).length}</strong> campo{Object.keys(fieldErrors).length !== 1 ? 's' : ''} con errores. Revisa los campos marcados en rojo.
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || (quotaResult !== null && !quotaResult.available)}
          className="w-full py-4 rounded-lg text-white font-bold text-lg transition disabled:opacity-50 hover:opacity-90 relative"
          style={{ backgroundColor: tenantColors.primario }}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" /> Enviando...
            </span>
          ) : (
            <>
              <i className="fas fa-paper-plane mr-2" />
              Revisar y Enviar Solicitud
            </>
          )}
        </button>
      </form>

      {/* ═══════ Modal de Confirmación ═══════ */}
      <Modal open={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirmar Solicitud" maxWidth="max-w-lg">
          <div className="mb-6">
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${tenantColors.primario}20` }}>
                <i className="fas fa-clipboard-check text-2xl" style={{ color: tenantColors.primario }} />
              </div>
              <p className="text-sm text-gray-500">Revisa que tus datos sean correctos antes de enviar</p>
            </div>

            <div className="space-y-3 mb-6">
              {/* Datos personales */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Datos Personales</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">RUT:</span> <span className="font-medium text-gray-900">{formData.rut}</span></div>
                  <div><span className="text-gray-500">Nombre:</span> <span className="font-medium text-gray-900">{formData.nombre} {formData.apellido}</span></div>
                  <div><span className="text-gray-500">Email:</span> <span className="font-medium text-gray-900">{formData.email}</span></div>
                  {formData.telefono && <div><span className="text-gray-500">Tel:</span> <span className="font-medium text-gray-900">{formData.telefono}</span></div>}
                </div>
              </div>

              {/* Datos profesionales */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Datos Profesionales</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Medio:</span> <span className="font-medium text-gray-900">{formData.organizacion}</span></div>
                  <div><span className="text-gray-500">Tipo:</span> <span className="font-medium text-gray-900">{formData.tipo_medio}</span></div>
                  <div><span className="text-gray-500">Cargo:</span> <span className="font-medium text-gray-900">{formData.cargo}</span></div>
                </div>
              </div>

              {/* Datos dinámicos */}
              {Object.keys(dynamicData).length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Información Adicional</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(dynamicData).filter(([, v]) => v).map(([k, v]) => {
                      const fieldDef = formFields.find(f => f.key === k);
                      return (
                        <div key={k}>
                          <span className="text-gray-500">{fieldDef?.label || k}:</span>{' '}
                          <span className="font-medium text-gray-900">{v}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 rounded-lg border-2 border-gray-300 text-gray-600 font-semibold hover:bg-gray-50 transition"
              >
                <i className="fas fa-pen mr-2" />
                Modificar
              </button>
              <button
                onClick={handleConfirmedSubmit}
                disabled={submitting}
                className="flex-1 py-3 rounded-lg text-white font-bold transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: tenantColors.primario }}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner size="sm" /> Enviando...
                  </span>
                ) : (
                  <>
                    <i className="fas fa-paper-plane mr-2" />
                    Confirmar y Enviar
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
    </div>
  );
}
