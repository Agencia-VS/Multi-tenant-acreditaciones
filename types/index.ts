// ============================================================================
// ACCREDIA v2 — Tipos del Sistema
// Mapeo directo del schema de base de datos + tipos de UI
// ============================================================================

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

// Colores de estado para UI
export const STATUS_COLORS: Record<RegistrationStatus, { bg: string; text: string; label: string }> = {
  pendiente: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' },
  aprobado: { bg: 'bg-green-100', text: 'text-green-800', label: 'Aprobado' },
  rechazado: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rechazado' },
  revision: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'En Revisión' },
};

// ─── Modelos de Base de Datos ──────────────────────────────────────────────

/** Perfil global del usuario — Identidad Única */
export interface Profile {
  id: string;
  user_id: string | null;
  rut: string;
  nombre: string;
  apellido: string;
  email: string | null;
  telefono: string | null;
  nacionalidad: string | null;
  foto_url: string | null;
  cargo: string | null;
  medio: string | null;
  tipo_medio: string | null;
  datos_base: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Tenant — Organización/Cliente */
export interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  logo_url: string | null;
  color_primario: string;
  color_secundario: string;
  color_light: string;
  color_dark: string;
  shield_url: string | null;
  background_url: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Evento — Evento por tenant con form dinámico */
export interface Event {
  id: string;
  tenant_id: string;
  nombre: string;
  descripcion: string | null;
  fecha: string | null;
  hora: string | null;
  venue: string | null;
  is_active: boolean;
  fecha_limite_acreditacion: string | null;
  opponent_name: string | null;
  opponent_logo_url: string | null;
  league: string | null;
  qr_enabled: boolean;
  form_fields: FormFieldDefinition[];
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

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

/** Regla de cupo por tipo de medio */
export interface EventQuotaRule {
  id: string;
  event_id: string;
  tipo_medio: string;
  max_per_organization: number;
  max_global: number;
  created_at: string;
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

/** Registration — El "Ticket" de acreditación */
export interface Registration {
  id: string;
  event_id: string;
  profile_id: string;
  organizacion: string | null;
  tipo_medio: string | null;
  cargo: string | null;
  status: RegistrationStatus;
  motivo_rechazo: string | null;
  submitted_by: string | null;
  datos_extra: Record<string, unknown>;
  qr_token: string | null;
  qr_generated_at: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  checked_in_by: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Registration con datos expandidos (vista) */
export interface RegistrationFull extends Registration {
  rut: string;
  profile_nombre: string;
  profile_apellido: string;
  profile_email: string | null;
  profile_telefono: string | null;
  profile_foto: string | null;
  profile_medio: string | null;
  profile_datos_base: Record<string, unknown>;
  event_nombre: string;
  event_fecha: string | null;
  event_venue: string | null;
  event_qr_enabled: boolean;
  tenant_id: string;
  tenant_nombre: string;
  tenant_slug: string;
  tenant_logo: string | null;
}

/** Evento con datos del tenant (vista) */
export interface EventFull extends Event {
  tenant_nombre: string;
  tenant_slug: string;
  tenant_logo: string | null;
  tenant_color_primario: string;
  tenant_color_secundario: string;
  tenant_color_light: string;
  tenant_color_dark: string;
  tenant_shield: string | null;
  tenant_background: string | null;
  tenant_config: Record<string, unknown>;
}

/** Miembro del equipo de un Manager */
export interface TeamMember {
  id: string;
  manager_id: string;
  member_profile_id: string;
  alias: string | null;
  notas: string | null;
  created_at: string;
  member_profile?: Profile;
}

/** SuperAdmin */
export interface SuperAdmin {
  id: string;
  user_id: string;
  email: string;
  nombre: string | null;
  created_at: string;
}

/** Admin de Tenant */
export interface TenantAdmin {
  id: string;
  user_id: string;
  tenant_id: string;
  rol: AdminRole;
  nombre: string | null;
  email: string | null;
  created_at: string;
}

/** Log de auditoría */
export interface AuditLog {
  id: string;
  user_id: string | null;
  action: AuditAction | string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

/** Template de email */
export interface EmailTemplate {
  id: string;
  tenant_id: string | null;
  tipo: EmailTemplateType;
  subject: string | null;
  body_html: string | null;
  created_at: string;
  updated_at: string;
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
  status: 'checked_in' | 'not_found' | 'not_approved' | 'already_checked_in';
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

export type AdminTab = 'acreditaciones' | 'configuracion';

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

/** Regla de auto-asignación de zona (cargo→zona ó tipo_medio→zona) */
export interface ZoneAssignmentRule {
  id: string;
  event_id: string;
  match_field: ZoneMatchField;
  cargo: string;  // match_value — the value to match against the field
  zona: string;
  created_at: string;
}

/** Typed tenant config */
export interface TenantConfig {
  acreditacion_masiva_enabled?: boolean;
  zonas?: string[];  // zona options available for this tenant
  puntoticket_acreditacion_fija?: string;  // fixed value for PT "Acreditación" column
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
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  
  // Toast
  showSuccess: (text: string) => void;
  showError: (text: string) => void;
}
