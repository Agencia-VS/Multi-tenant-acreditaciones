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
  rut: string;
  patente: string;
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
}

export const STEP_LABELS = ['Responsable', 'Tipo de medio', 'Acreditados'];
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
