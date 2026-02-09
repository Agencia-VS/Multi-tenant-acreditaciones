/**
 * Tipos para el sistema de formularios dinámicos multi-tenant
 * 
 * Define la estructura de configuración de formularios que permite
 * a cada tenant tener campos, secciones y reglas personalizadas.
 */

// ============================================================================
// TIPOS DE CAMPOS
// ============================================================================

/**
 * Tipos de campo soportados por el renderer dinámico
 */
export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'rut'
  | 'select'
  | 'multiselect'
  | 'textarea'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'file'
  | 'hidden';

/**
 * Reglas de validación para un campo
 */
export interface FieldValidation {
  /** Patrón regex para validar el valor */
  pattern?: string;
  /** Mensaje de error si no pasa la validación */
  patternMessage?: string;
  /** Longitud mínima */
  minLength?: number;
  /** Longitud máxima */
  maxLength?: number;
  /** Valor numérico mínimo */
  min?: number;
  /** Valor numérico máximo */
  max?: number;
  /** Validación interna predefinida (ej: "rut_chileno", "email") */
  builtIn?: 'rut_chileno' | 'email' | 'telefono_cl';
}

/**
 * Opción para campos de tipo select/multiselect
 */
export interface FieldOption {
  /** Valor almacenado */
  value: string;
  /** Texto mostrado al usuario */
  label: string;
  /** Si permite escribir un valor personalizado (ej: "Otros" en empresa) */
  allowCustom?: boolean;
}

/**
 * Condición de visibilidad (para campos condicionales)
 */
export interface FieldCondition {
  /** Key del campo del cual depende */
  dependsOn: string;
  /** Operador de comparación */
  operator: 'equals' | 'notEquals' | 'contains' | 'notEmpty';
  /** Valor para comparar */
  value?: string;
}

// ============================================================================
// DEFINICIÓN DE CAMPO
// ============================================================================

/**
 * Definición completa de un campo del formulario dinámico
 */
export interface FormFieldDefinition {
  /** Identificador único del campo (key para almacenar el valor) */
  key: string;
  /** Texto mostrado como label */
  label: string;
  /** Texto placeholder del input */
  placeholder?: string;
  /** Tipo de campo */
  type: FieldType;
  /** Si es obligatorio */
  required: boolean;
  /** Clave de la sección donde se muestra */
  section: string;
  /** Orden dentro de la sección */
  order: number;

  /** Opciones para select/multiselect */
  options?: FieldOption[];
  /** Si permite escribir opción personalizada cuando se selecciona cierto valor */
  customOptionTrigger?: string;

  /** Reglas de validación */
  validation?: FieldValidation;
  /** Condición de visibilidad */
  condition?: FieldCondition;

  /** Valor por defecto */
  defaultValue?: string;
  /** Si es un campo custom (no estándar) — se guarda en datos_custom */
  custom?: boolean;
  /** Ancho en la grid (1-4 columnas) */
  gridCol?: 1 | 2 | 3 | 4;
  /** Texto de ayuda debajo del campo */
  helpText?: string;
  /** Si se usa en la carga masiva */
  masivo?: boolean;

  /** 
   * Scope del campo: determina dónde se muestra
   * - "responsable": sección de datos del responsable
   * - "acreditado": se repite para cada acreditado
   * - "solicitud": datos generales de la solicitud (empresa, área)
   */
  scope: 'responsable' | 'acreditado' | 'solicitud';
}

// ============================================================================
// SECCIÓN DE FORMULARIO
// ============================================================================

/**
 * Definición de una sección visual del formulario
 */
export interface FormSectionDefinition {
  /** Key identificador */
  key: string;
  /** Título de la sección */
  label: string;
  /** Icono (nombre de icono o emoji) */
  icon?: string;
  /** Orden de la sección */
  order: number;
  /** Descripción debajo del título */
  description?: string;
}

// ============================================================================
// CONFIGURACIÓN GENERAL DEL FORMULARIO
// ============================================================================

/**
 * Configuración general de un formulario
 */
export interface FormConfig {
  /** Máximo de acreditados por solicitud */
  max_acreditados_por_solicitud: number;
  /** Mínimo de acreditados por solicitud */
  min_acreditados: number;
  /** Si requiere datos del responsable */
  requiere_responsable: boolean;
  /** Si permite carga masiva (CSV/Excel) */
  permite_masivo: boolean;
  /** Si las acreditaciones se aprueban automáticamente */
  auto_aprobacion: boolean;
  /** Campos incluidos en la plantilla de carga masiva */
  campos_masivo: string[];
  /** Texto de disclaimer personalizado (null = usar default) */
  disclaimer: string | null;
  /** Si envía email de confirmación al responsable */
  email_confirmacion: boolean;
}

// ============================================================================
// FORM CONFIG COMPLETO (registro de BD)
// ============================================================================

/**
 * Registro completo de mt_form_configs
 */
export interface FormConfigRecord {
  id: string;
  tenant_id: string;
  evento_id: number | null;
  nombre: string;
  slug: string;
  tipo: 'individual' | 'masivo' | 'ambos';
  secciones: FormSectionDefinition[];
  campos: FormFieldDefinition[];
  config: FormConfig;
  activo: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

/**
 * Datos para crear/actualizar un form config
 */
export interface FormConfigInput {
  tenant_id: string;
  evento_id?: number | null;
  nombre: string;
  slug: string;
  tipo?: 'individual' | 'masivo' | 'ambos';
  secciones?: FormSectionDefinition[];
  campos: FormFieldDefinition[];
  config?: Partial<FormConfig>;
  activo?: boolean;
  orden?: number;
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

/**
 * Registro de mt_email_templates
 */
export interface EmailTemplateRecord {
  id: string;
  tenant_id: string;
  tipo: 'aprobacion' | 'rechazo' | 'confirmacion' | 'recordatorio';
  subject: string;
  body_html: string;
  variables: string[];
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ESTADO DEL FORMULARIO DINÁMICO (Runtime)
// ============================================================================

/**
 * Valores del formulario en runtime
 */
export interface DynamicFormValues {
  /** Campos del responsable */
  responsable: Record<string, string>;
  /** Campos de la solicitud (empresa, área, etc.) */
  solicitud: Record<string, string>;
  /** Array de acreditados, cada uno con sus campos */
  acreditados: Record<string, string>[];
}

/**
 * Errores de validación del formulario
 */
export interface DynamicFormErrors {
  responsable: Record<string, string>;
  solicitud: Record<string, string>;
  acreditados: Record<string, string>[];
}

/**
 * Props del componente DynamicForm
 */
export interface DynamicFormProps {
  /** Configuración del formulario desde BD */
  formConfig: FormConfigRecord;
  /** Datos de áreas del evento (para cupos) */
  areas?: Array<{ codigo: string; nombre: string; cupos: number }>;
  /** Cupos por tipo de medio (restricción por empresa) */
  tiposMedio?: Array<{ tipo_medio: string; cupo_por_empresa: number; descripcion?: string | null }>;
  /** Datos pre-fill si el usuario está logueado */
  prefillData?: Partial<DynamicFormValues>;
  /** Colores del tenant */
  tenantColors: { primario: string; secundario: string; light: string };
  /** Callback al enviar */
  onSubmit: (values: DynamicFormValues) => Promise<void>;
  /** Si está enviando */
  isSubmitting?: boolean;
}

// ============================================================================
// CONSTANTES DE CAMPOS BASE
// ============================================================================

/**
 * Campos base que siempre están disponibles (aunque un tenant puede
 * desactivarlos o cambiar su required/label)
 */
export const BASE_FIELD_KEYS = {
  // Responsable
  RESP_NOMBRE: 'responsable_nombre',
  RESP_APELLIDO: 'responsable_primer_apellido',
  RESP_APELLIDO2: 'responsable_segundo_apellido',
  RESP_RUT: 'responsable_rut',
  RESP_EMAIL: 'responsable_email',
  RESP_TELEFONO: 'responsable_telefono',
  
  // Solicitud
  EMPRESA: 'empresa',
  AREA: 'area',
  TIPO_MEDIO: 'tipo_medio',
  
  // Acreditado
  NOMBRE: 'nombre',
  PRIMER_APELLIDO: 'primer_apellido',
  SEGUNDO_APELLIDO: 'segundo_apellido',
  RUT: 'rut',
  EMAIL: 'email',
  CARGO: 'cargo',
  TIPO_CREDENCIAL: 'tipo_credencial',
  NUMERO_CREDENCIAL: 'numero_credencial',
} as const;

/**
 * Mapeo de campo key -> columna en mt_acreditados
 * Los campos que no están aquí se guardan en datos_custom
 */
export const FIELD_TO_COLUMN_MAP: Record<string, string> = {
  nombre: 'nombre',
  primer_apellido: 'apellido',  // Se combina con segundo_apellido
  segundo_apellido: 'apellido', // Se combina con primer_apellido
  rut: 'rut',
  email: 'email',
  cargo: 'cargo',
  tipo_credencial: 'tipo_credencial',
  empresa: 'empresa',
  area: 'area',
  tipo_medio: 'tipo_medio',
};
