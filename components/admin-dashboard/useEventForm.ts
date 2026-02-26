'use client';

import { useState } from 'react';
import { useAdmin } from './AdminContext';
import { isoToLocalDatetime } from '@/lib/dates';
import type { Event, EventType, EventVisibility, FormFieldDefinition, ZoneMatchField, DisclaimerSection, DisclaimerConfig, BulkTemplateColumn } from '@/types';
import { TIPOS_MEDIO, CARGOS } from '@/types';
import { getBulkTemplateColumnsFromConfig } from '@/lib/bulkTemplate';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface EventForm {
  nombre: string;
  fecha: string;
  hora: string;
  venue: string;
  opponent_name: string;
  opponent_logo_url: string;
  league: string;
  descripcion: string;
  fecha_limite_acreditacion: string;
  qr_enabled: boolean;
  event_type: EventType;
  visibility: EventVisibility;
  disclaimer_enabled: boolean;
  disclaimer_sections: DisclaimerSection[];
}

export interface QuotaRule {
  id?: string;
  tipo_medio: string;
  max_per_organization: number;
  max_global: number;
}

export interface ZoneRule {
  id?: string;
  match_field: ZoneMatchField;
  cargo: string;
  zona: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const INITIAL_FORM: EventForm = {
  nombre: '', fecha: '', hora: '', venue: '',
  opponent_name: '', opponent_logo_url: '',
  league: '', descripcion: '',
  fecha_limite_acreditacion: '', qr_enabled: false,
  event_type: 'simple',
  visibility: 'public',
  disclaimer_enabled: true,
  disclaimer_sections: [],
};

export const DEFAULT_FORM_FIELDS: FormFieldDefinition[] = [
  { key: 'nombre', label: 'Nombre', type: 'text', required: true, profile_field: 'nombre' },
  { key: 'apellido', label: 'Primer Apellido', type: 'text', required: true, profile_field: 'apellido' },
  { key: 'segundo_apellido', label: 'Segundo Apellido', type: 'text', required: false, profile_field: 'datos_base.segundo_apellido' },
  { key: 'rut', label: 'RUT', type: 'text', required: true, profile_field: 'rut' },
  { key: 'email', label: 'Email', type: 'email', required: true, profile_field: 'email' },
  { key: 'telefono', label: 'Teléfono', type: 'tel', required: false, profile_field: 'telefono' },
  { key: 'medio', label: 'Medio de Comunicación', type: 'text', required: true, profile_field: 'medio' },
  { key: 'tipo_medio', label: 'Tipo de Medio', type: 'select', required: true, profile_field: 'tipo_medio', options: [...TIPOS_MEDIO] },
  { key: 'cargo', label: 'Cargo', type: 'select', required: true, profile_field: 'cargo', options: [...CARGOS] },
  { key: 'foto_url', label: 'Foto', type: 'file', required: true, profile_field: 'foto_url' },
];

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useEventForm() {
  const { events, showSuccess } = useAdmin();

  const [form, setForm] = useState<EventForm>(INITIAL_FORM);
  const [formFields, setFormFields] = useState<FormFieldDefinition[]>(DEFAULT_FORM_FIELDS);
  const [quotaRules, setQuotaRules] = useState<QuotaRule[]>([]);
  const [zoneRules, setZoneRules] = useState<ZoneRule[]>([]);
  const [zonas, setZonas] = useState<string[]>([]);
  const [newZona, setNewZona] = useState('');
  const [cloneSourceId, setCloneSourceId] = useState('');
  const [cloning, setCloning] = useState(false);
  const [bulkTemplateColumns, setBulkTemplateColumns] = useState<BulkTemplateColumn[]>([]);

  const addZona = () => {
    const trimmed = newZona.trim();
    if (trimmed && !zonas.includes(trimmed)) {
      setZonas(prev => [...prev, trimmed]);
      setNewZona('');
    }
  };

  const removeZona = (z: string) => {
    setZonas(prev => prev.filter(item => item !== z));
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setFormFields(DEFAULT_FORM_FIELDS);
    setQuotaRules([]);
    setZoneRules([]);
    setZonas([]);
    setNewZona('');
    setCloneSourceId('');
    setBulkTemplateColumns([]);
  };

  /** Sincronizas el formulario con un evento existente (para edición) */
  const syncFromEvent = (event: Event) => {
    const eventConfig = event.config ?? {};
    const dc = eventConfig.disclaimer as DisclaimerConfig | undefined;
    setForm({
      nombre: event.nombre || '',
      fecha: event.fecha || '',
      hora: event.hora || '',
      venue: event.venue || '',
      opponent_name: event.opponent_name || '',
      opponent_logo_url: event.opponent_logo_url || '',
      league: event.league || '',
      descripcion: event.descripcion || '',
      fecha_limite_acreditacion: isoToLocalDatetime(event.fecha_limite_acreditacion),
      qr_enabled: event.qr_enabled || false,
      event_type: (event.event_type as EventType) || 'simple',
      visibility: (event as Event & { visibility?: string }).visibility as EventVisibility || 'public',
      disclaimer_enabled: dc?.enabled ?? true,
      disclaimer_sections: dc?.sections ?? [],
    });
    setZonas(eventConfig.zonas || []);
    setBulkTemplateColumns(getBulkTemplateColumnsFromConfig(eventConfig));
  };

  /** Clonar configuración desde un evento anterior del mismo tenant */
  const handleCloneFrom = async (sourceEventId: string) => {
    setCloneSourceId(sourceEventId);
    if (!sourceEventId) {
      setFormFields(DEFAULT_FORM_FIELDS);
      setQuotaRules([]);
      setZoneRules([]);
      setZonas([]);
      setBulkTemplateColumns([]);
      setForm(f => ({ ...f, descripcion: '', venue: '', league: '', opponent_name: '', opponent_logo_url: '', qr_enabled: false }));
      return;
    }
    const rawSource = events.find(e => e.id === sourceEventId);
    if (!rawSource) return;

    // Deep clone to break ALL shared references with the events array
    const source = JSON.parse(JSON.stringify(rawSource)) as typeof rawSource;

    setCloning(true);
    try {
      setForm(f => ({
        ...f,
        descripcion: source.descripcion || '',
        venue: source.venue || '',
        league: source.league || '',
        opponent_name: '',
        opponent_logo_url: '',
        qr_enabled: source.qr_enabled,
        event_type: (source.event_type as EventType) || 'simple',
      }));

      setFormFields(source.form_fields?.length ? source.form_fields : DEFAULT_FORM_FIELDS);

      const evConfig = source.config ?? {};
      setZonas(evConfig.zonas || []);
      setBulkTemplateColumns(getBulkTemplateColumnsFromConfig(evConfig));

      // Clone disclaimer config
      const dc = evConfig.disclaimer as DisclaimerConfig | undefined;
      setForm(f => ({
        ...f,
        disclaimer_enabled: dc?.enabled ?? true,
        disclaimer_sections: dc?.sections ?? [],
      }));

      try {
        const res = await fetch(`/api/events/${source.id}/quotas`);
        if (res.ok) {
          const data = await res.json();
          const rules = Array.isArray(data) ? data : (data.rules || []);
          setQuotaRules(rules.map((r: QuotaRule) => ({
            tipo_medio: r.tipo_medio,
            max_per_organization: r.max_per_organization,
            max_global: r.max_global,
          })));
        }
      } catch { /* ignore */ }

      try {
        const zRes = await fetch(`/api/events/${source.id}/zones`);
        if (zRes.ok) {
          const zData = await zRes.json();
          const zArr = Array.isArray(zData) ? zData : [];
          setZoneRules(zArr.map((r: { match_field?: string; cargo: string; zona: string }) => ({
            match_field: (r.match_field as ZoneMatchField) || 'cargo',
            cargo: r.cargo,
            zona: r.zona,
          })));
        }
      } catch { /* ignore */ }

      showSuccess(`Configuración copiada de "${source.nombre}"`);
    } finally {
      setCloning(false);
    }
  };

  return {
    form, setForm,
    formFields, setFormFields,
    quotaRules, zoneRules,
    zonas, setZonas,
    newZona, setNewZona,
    addZona, removeZona,
    bulkTemplateColumns,
    cloneSourceId, cloning,
    resetForm, syncFromEvent, handleCloneFrom,
  };
}

export type UseEventFormReturn = ReturnType<typeof useEventForm>;
