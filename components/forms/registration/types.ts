import type { FormFieldDefinition, Profile, EventType, EventDay } from '@/types';

/* ═══════════════════════════════════════════════════════
   Shared types & constants for the Registration Wizard
   ═══════════════════════════════════════════════════════ */

export type Step = 'disclaimer' | 'responsable' | 'medio' | 'acreditados' | 'success';

export interface SubmitResult {
  nombre: string;
  ok: boolean;
  error?: string;
}

export interface ResponsableData {
  document_type: 'rut' | 'dni_extranjero';
  rut: string;
  nombre: string;
  apellido: string;
  segundo_apellido: string;
  email: string;
  telefono: string;
  organizacion: string;
}

export interface BulkImportRow {
  id: string;
  nombre: string;
  apellido: string;
  document_type: 'rut' | 'dni_extranjero';
  document_number: string;
  rut: string;
  /** Campos extra importados del archivo (email, cargo, telefono, zona, patente, etc.) */
  extras: Record<string, string>;
}

export interface RegistrationFormProps {
  eventId: string;
  eventName: string;
  formFields: FormFieldDefinition[];
  tenantColors: { primario: string; secundario: string };
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
  /** Multi-day support */
  eventType?: EventType;
  eventDays?: EventDay[];
  /** Custom disclaimer config from event.config.disclaimer */
  disclaimerConfig?: import('@/types').DisclaimerConfig;
  /** Zonas available for this event (from event.config.zonas) */
  eventZonas?: string[];
}

export const STEP_LABELS = ['Responsable', 'Tipo de medio', 'Acreditados'];

/** Build step labels with a dynamic label for the tipo_medio step */
export function getStepLabels(tipoMedioLabel?: string): string[] {
  return ['Responsable', tipoMedioLabel || 'Tipo de medio', 'Acreditados'];
}

export const STEP_KEYS: Step[] = ['responsable', 'medio', 'acreditados'];

export const TIPO_MEDIO_ICONS: Record<string, string> = {
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
