// ============================================================================
// ACCREDIA v2 — Tipos del Sistema
// Derivados de la DB via `supabase gen types` + tipos de UI
// ============================================================================

import type { Tables } from '@/lib/supabase/database.types';

// ─── Helper: convierte campos null de la DB a sus defaults de app ──────────
type NonNull<T, K extends keyof T> = Omit<T, K> & { [P in K]: NonNullable<T[P]> };

// ─── Tipos derivados de la DB ──────────────────────────────────────────────

/** Perfil global — derivado de `profiles` */
export type Profile = NonNull<Tables<'profiles'>,
  'created_at' | 'updated_at'
> & {
  datos_base: Record<string, unknown>;
};

/** Tenant — derivado de `tenants` (colores tienen DEFAULT en DB) */
export type Tenant = NonNull<Tables<'tenants'>,
  'activo' | 'color_primario' | 'color_secundario' | 'color_light' | 'color_dark' | 'created_at' | 'updated_at'
> & {
  config: Record<string, unknown>;
};

// ─── Tipos de Evento ───────────────────────────────────────────────────────

export type EventType = 'simple' | 'deportivo' | 'multidia';

/** Evento — derivado de `events` */
export type Event = NonNull<Tables<'events'>,
  'is_active' | 'qr_enabled' | 'created_at' | 'updated_at'
> & {
  event_type: EventType;
  form_fields: FormFieldDefinition[];
  config: Record<string, unknown>;
};

/** Día de evento multidía — derivado de `event_days` */
export type EventDay = NonNull<Tables<'event_days'>,
  'is_active' | 'orden'
>;

/** Check-in por día — derivado de `registration_days` */
export type RegistrationDay = NonNull<Tables<'registration_days'>,
  'checked_in'
>;

/** Registration — derivado de `registrations` */
export type Registration = NonNull<Tables<'registrations'>,
  'status' | 'checked_in' | 'created_at' | 'updated_at'
> & {
  datos_extra: Record<string, unknown>;
};

/** Regla de cupo — derivado de `event_quota_rules` */
export type EventQuotaRule = Tables<'event_quota_rules'>;

/** Regla de zona — derivado de `event_zone_rules` */
export type ZoneAssignmentRule = Tables<'event_zone_rules'>;

/** Admin de Tenant — derivado de `tenant_admins` */
export type TenantAdmin = Tables<'tenant_admins'>;

/** SuperAdmin — derivado de `superadmins` */
export type SuperAdmin = Tables<'superadmins'>;

/** Miembro del equipo — derivado de `team_members` */
export type TeamMember = Tables<'team_members'> & {
  member_profile?: Profile;
};

/** Template de email — derivado de `email_templates` */
export type EmailTemplate = Tables<'email_templates'>;

/** Contenido de email por zona — derivado de `email_zone_content` */
export type EmailZoneContent = Tables<'email_zone_content'>;

/** Log de auditoría — derivado de `audit_logs` */
export type AuditLog = Tables<'audit_logs'> & {
  metadata: Record<string, unknown>;
};

// ─── Enums y Constantes ────────────────────────────────────────────────────

export type RegistrationStatus = 'pendiente' | 'aprobado' | 'rechazado' | 'revision';

export type AdminRole = 'admin' | 'editor' | 'viewer';

export type FormFieldType = 'text' | 'select' | 'file' | 'number' | 'email' | 'textarea' | 'checkbox' | 'date' | 'tel';

export type FormFieldSection = 'personal' | 'profesional' | 'documentos' | 'extra';

export type AuditAction =
  | 'registration.created'
  | 'registration.approved'
  | 'registration.rejected'
  | 'registration.bulk_approved'
  | 'registration.checked_in'
  | 'event.created'
  | 'event.updated'
  | 'tenant.created'
  | 'tenant.updated'
  | 'admin.created'
  | 'admin.removed'
  | 'email.sent';

export type EmailTemplateType = 'aprobacion' | 'rechazo' | 'confirmacion' | 'recordatorio';

// Tipos de medio estándar
export const TIPOS_MEDIO = [
  'TV',
  'Radio',
  'Prensa Escrita',
  'Sitio Web',
  'Fotógrafo',
  'Agencia',
  'Freelance',
  'Podcast',
  'Streaming',
  'Otro',
] as const;

export type TipoMedio = (typeof TIPOS_MEDIO)[number];

// Cargos estándar
export const CARGOS = [
  'Periodista',
  'Fotógrafo',
  'Camarógrafo',
  'Productor',
  'Editor',
  'Reportero',
  'Comentarista',
  'Director',
  'Asistente',
  'Técnico',
  'Otro',
] as const;

export type Cargo = (typeof CARGOS)[number];

// ─── Status — Mapa centralizado para toda la UI ───────────────────────────

export const STATUS_MAP: Record<RegistrationStatus, {
  label: string;
  bg: string;
  text: string;
  icon: string;
}> = {
  pendiente: { label: 'Pendiente',    bg: 'bg-warn-light',    text: 'text-warn-dark',    icon: 'fas fa-clock' },
  aprobado:  { label: 'Aprobado',     bg: 'bg-success-light', text: 'text-success-dark', icon: 'fas fa-check-circle' },
  rechazado: { label: 'Rechazado',    bg: 'bg-danger-light',  text: 'text-danger-dark',  icon: 'fas fa-times-circle' },
  revision:  { label: 'En Revisión',  bg: 'bg-info-light',    text: 'text-info-dark',    icon: 'fas fa-search' },
} as const;

/** @deprecated Usa STATUS_MAP en su lugar */
export const STATUS_COLORS = STATUS_MAP;

// ─── Definición de campo dinámico del formulario ───────────────────────────

/** Definición de campo dinámico del formulario */
export interface FormFieldDefinition {
  key: string;
  label: string;
  type: FormFieldType;
  options?: string[];
  required: boolean;
  profile_field?: string;
  section?: FormFieldSection;
  placeholder?: string;
  help_text?: string;
  order?: number;
}

// ─── Tipos derivados de Vistas ─────────────────────────────────────────────

/** Registration con datos expandidos (vista v_registration_full) */
export type RegistrationFull = NonNull<Tables<'v_registration_full'>,
  'id' | 'event_id' | 'profile_id' | 'status' | 'checked_in' | 'created_at' | 'updated_at'
> & {
  datos_extra: Record<string, unknown>;
  profile_datos_base: Record<string, unknown>;
};

/** Evento con datos del tenant (vista v_event_full) */
export type EventFull = NonNull<Tables<'v_event_full'>,
  'id' | 'tenant_id' | 'nombre' | 'is_active' | 'qr_enabled' | 'created_at' | 'updated_at'
> & {
  event_type: EventType;
  form_fields: FormFieldDefinition[];
  config: Record<string, unknown>;
  tenant_config: Record<string, unknown>;
};

// ─── Tenant-Context Profile Data ───────────────────────────────────────────

/**
 * Datos que un usuario ha completado para un tenant específico.
 * Almacenados en `profile.datos_base._tenant[tenantId]`.
 *
 * Esto permite:
 * - Persistencia inteligente: datos se guardan por tenant
 * - Formulario diferencial: solo mostrar campos faltantes
 * - Detección de cambios: comparar _form_keys contra el form actual
 */
export interface TenantProfileData {
  [key: string]: unknown;
  /** Keys del formulario cuando se guardaron los datos (para detectar cambios) */
  _form_keys?: string[];
  /** Timestamp de la última actualización */
  _updated_at?: string;
}

/**
 * Estado de completitud de un perfil para un tenant/evento específico.
 * Usado en el dashboard del acreditado para mostrar progreso.
 */
export interface TenantProfileStatus {
  tenantId: string;
  tenantSlug: string;
  tenantNombre: string;
  tenantShield?: string | null;
  tenantColor: string;
  /** Evento activo del tenant (si existe) */
  eventId?: string;
  eventNombre?: string;
  eventFecha?: string | null;
  /** Campos del formulario del evento activo */
  formFields: FormFieldDefinition[];
  /** Total de campos dinámicos requeridos */
  totalRequired: number;
  /** Campos requeridos ya completados */
  filledRequired: number;
  /** Campos que faltan (requeridos y no completados) */
  missingFields: FormFieldDefinition[];
  /** Porcentaje de completitud (0-100) */
  completionPct: number;
  /** Si existe algún dato guardado para este tenant */
  hasData: boolean;
  /** Si el formulario cambió desde la última vez que el usuario guardó datos */
  formChanged: boolean;
  /** Keys nuevas que el tenant agregó desde la última vez */
  newKeys: string[];
  /** Keys que el tenant eliminó desde la última vez */
  removedKeys: string[];
}

/** Resultado de verificación de cupo */
export interface QuotaCheckResult {
  available: boolean;
  used_org: number;
  max_org: number;
  used_global: number;
  max_global: number;
  message: string;
}

// ─── Tipos de Formulario / UI ──────────────────────────────────────────────

/** Datos del formulario de inscripción */
export interface RegistrationFormData {
  rut: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  nacionalidad?: string;
  cargo: string;
  organizacion: string;
  tipo_medio: string;
  datos_extra: Record<string, unknown>;
}

/** Datos para inscripción masiva */
export interface BulkRegistrationData {
  manager_profile_id: string;
  event_id: string;
  registrations: RegistrationFormData[];
}

/** Resultado de la validación QR */
export interface QRValidationResult {
  valid: boolean;
  status: 'checked_in' | 'not_found' | 'not_approved' | 'already_checked_in' | 'not_enrolled_day';
  message: string;
  registration_id?: string;
  nombre?: string;
  rut?: string;
  foto_url?: string;
  organizacion?: string;
  tipo_medio?: string;
  cargo?: string;
  event_nombre?: string;
  checked_in_at?: string;
  event_day_id?: string;
}

/** Datos para crear/editar un día de evento */
export interface EventDayFormData {
  fecha: string;
  label: string;
  orden?: number;
}

// ─── Tipos de Auth ─────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: {
    nombre?: string;
    apellido?: string;
    rut?: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  rut: string;
  telefono?: string;
}

// ─── Tipos SuperAdmin UI ──────────────────────────────────────────────────

export interface TenantWithStats extends Tenant {
  total_events: number;
  total_registrations: number;
  total_admins: number;
}

export interface TenantFormData {
  nombre: string;
  slug: string;
  logo_url?: string;
  color_primario: string;
  color_secundario: string;
  color_light: string;
  color_dark: string;
  shield_url?: string;
  background_url?: string;
  config?: Record<string, unknown>;
}

export interface EventFormData {
  tenant_id: string;
  nombre: string;
  descripcion?: string;
  fecha?: string;
  hora?: string;
  venue?: string;
  fecha_limite_acreditacion?: string;
  opponent_name?: string;
  opponent_logo_url?: string;
  league?: string;
  qr_enabled?: boolean;
  form_fields?: FormFieldDefinition[];
  config?: EventConfig;
  event_type?: EventType;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface DashboardStats {
  total_tenants: number;
  total_events: number;
  total_registrations: number;
  pendientes: number;
  aprobados: number;
  rechazados: number;
}

export interface RegistrationFilters {
  status?: RegistrationStatus;
  tipo_medio?: string;
  organizacion?: string;
  search?: string;
  event_id?: string;
  tenant_id?: string;
}

export interface UIMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  badge?: number;
}

// ─── Tipos Admin Dashboard ────────────────────────────────────────────────

export type AdminTab = 'acreditaciones' | 'configuracion' | 'mail';

export interface AdminFilterState {
  search: string;
  status: RegistrationStatus | '';
  tipo_medio: string;
  event_id: string;
}

export interface AdminStats {
  total: number;
  pendientes: number;
  aprobados: number;
  rechazados: number;
  revision: number;
  checked_in: number;
}

export interface AccreditationWindow {
  id?: string;
  event_id: string;
  fecha_inicio: string;
  hora_inicio: string;
  fecha_fin: string;
  hora_fin: string;
  nota: string;
  activa: boolean;
}

export interface BulkActionPayload {
  action: 'approve' | 'reject' | 'delete' | 'email';
  registration_ids: string[];
  motivo_rechazo?: string;
}

export interface PuntoTicketRow {
  nombre: string;
  apellido: string;
  rut: string;
  empresa: string;
  area: string;
  zona: string;
  patente: string;
}

/** Campo fuente para regla de zona */
export type ZoneMatchField = 'cargo' | 'tipo_medio';

/** Typed tenant config */
export interface TenantConfig {
  acreditacion_masiva_enabled?: boolean;
  zonas?: string[];  // zona options available for this tenant (fallback)
  puntoticket_acreditacion_fija?: string;  // fixed value for PT "Acreditación" column
  [key: string]: unknown;
}

/** Typed event config */
export interface EventConfig {
  zonas?: string[];              // zone options for this event
  acreditacion_abierta?: boolean; // manual override to keep accreditation open
  [key: string]: unknown;
}

export interface AdminContextType {
  // Data
  tenant: Tenant | null;
  events: Event[];
  selectedEvent: EventFull | null;
  registrations: RegistrationFull[];
  stats: AdminStats;
  
  // UI state
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  filters: AdminFilterState;
  setFilters: (filters: AdminFilterState) => void;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  loading: boolean;
  processing: string | null;
  
  // Actions
  fetchData: () => Promise<void>;
  selectEvent: (eventId: string) => void;
  handleStatusChange: (regId: string, status: RegistrationStatus, motivo?: string) => Promise<void>;
  handleBulkAction: (payload: BulkActionPayload) => Promise<void>;
  handleDelete: (regId: string) => Promise<void>;
  updateRegistrationZona: (regId: string, zona: string) => Promise<void>;
  sendEmail: (regId: string) => Promise<void>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  
  // Toast
  showSuccess: (text: string) => void;
  showError: (text: string) => void;
}
