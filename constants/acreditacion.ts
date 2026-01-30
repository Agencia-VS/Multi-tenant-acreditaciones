/**
 * Constantes centralizadas para el sistema de acreditaciones
 * 
 * Este archivo contiene todos los valores constantes utilizados
 * en el proceso de acreditación de prensa y medios.
 */

// ============================================================================
// CANALES / MEDIOS DE COMUNICACIÓN
// ============================================================================

/**
 * Lista de medios de comunicación predefinidos para selección en formularios.
 * Incluye "Otros" como opción final para medios no listados.
 */
export const CANALES = [
  "ESPN Chile",
  "DNews Internacional",
  "DSport (DirecTV)",
  "Photosport",
  "EFE",
  "Redgol",
  "La Hora",
  "Publimetro",
  "TVN",
  "Mega",
  "Canal 13",
  "Chilevisión",
  "ADN",
  "Cooperativa",
  "Agricultura",
  "BioBio",
  "Mediabanco",
  "Frencuancia Cruzada",
  "La Tercera",
  "El Mercurio",
  "LUN",
  "La Segunda",
  "Agencia JyE",
  "Campeonato Chileno",
  "Dwos",
  "La Cuarta",
  "Pasión de Hincha",
  "RadioSport",
  "Liga Sport",
  "Imagen Virtual",
  "Radio del Lago",
  "Minuto 90",
  "As Chile",
  "En Cancha",
  "Mundo Cracks",
  "Xpress",
  "Sabes Deportes",
  "DLT",
  "Balong",
  "CNN Chile",
  "Sifup",
  "Espacio Cruzado",
  "Graficapress",
  "SepuTV",
  "Señal Deportiva",
  "Agencia UNO",
  "Rumbo Deportivo",
  "En el Camarín",
  "Radio Portales",
  "Todo es Cancha",
  "Picados TV",
  "Touch TV",
  "Radio Santiago",
  "EMOL",
  "El Mercurio Valparaíso",
  "Tribuna Andes",
  "Al Aire Libre punto CL.",
  "Otros",
] as const;

/** Tipo derivado de CANALES para type-safety */
export type Canal = typeof CANALES[number];

// ============================================================================
// CARGOS
// ============================================================================

/**
 * Lista de cargos disponibles para acreditados de prensa.
 */
export const CARGOS = [
  "Periodista",
  "Periodista Pupitre",
  "Relator",
  "Comentarista",
  "Camarógrafo",
  "Reportero Gráfico Cancha",
  "Reportero Gráfico Tribuna",
  "Técnico",
] as const;

/** Tipo derivado de CARGOS para type-safety */
export type CargoType = typeof CARGOS[number];

// ============================================================================
// REGLAS DE VALIDACIÓN
// ============================================================================

/**
 * Expresiones regulares para validación de campos.
 */
export const VALIDATION_PATTERNS = {
  /** Formato RUT chileno: 12.345.678-9 o 12345678-9 */
  RUT: /^(\d{1,2}\.?\d{3}\.?\d{3})-?([\dkK])$/,
  
  /** Formato email estándar */
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  
  /** Teléfono chileno: +56 9 1234 5678 o 912345678 */
  TELEFONO: /^(\+56\s?)?[9]\s?\d{4}\s?\d{4}$/,
  
  /** Solo letras y espacios (nombres) */
  NOMBRE: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/,
  
  /** Alfanumérico con guiones (credenciales) */
  CREDENCIAL: /^[a-zA-Z0-9\-]+$/,
} as const;

/**
 * Mensajes de error para validaciones.
 */
export const VALIDATION_MESSAGES = {
  RUT: {
    required: "El RUT es requerido",
    invalid: "Formato de RUT inválido (ej: 12.345.678-9)",
    checkDigit: "El dígito verificador del RUT es incorrecto",
  },
  EMAIL: {
    required: "El email es requerido",
    invalid: "Formato de email inválido",
  },
  TELEFONO: {
    required: "El teléfono es requerido",
    invalid: "Formato de teléfono inválido (ej: +56 9 1234 5678)",
  },
  NOMBRE: {
    required: "El nombre es requerido",
    invalid: "El nombre solo puede contener letras y espacios",
    minLength: "El nombre debe tener al menos 2 caracteres",
  },
  APELLIDO: {
    required: "El apellido es requerido",
    invalid: "El apellido solo puede contener letras y espacios",
    minLength: "El apellido debe tener al menos 2 caracteres",
  },
  EMPRESA: {
    required: "Debe seleccionar un medio/empresa",
    customRequired: "Debe ingresar el nombre del medio",
  },
  AREA: {
    required: "Debe seleccionar un área",
  },
  CARGO: {
    required: "Debe seleccionar un cargo",
  },
  CREDENCIAL: {
    required: "El tipo de credencial es requerido",
    invalid: "Formato de credencial inválido",
  },
} as const;

/**
 * Configuración de longitudes mínimas y máximas para campos.
 */
export const FIELD_LENGTHS = {
  NOMBRE: { min: 2, max: 100 },
  APELLIDO: { min: 2, max: 100 },
  EMAIL: { min: 5, max: 255 },
  RUT: { min: 9, max: 12 },
  TELEFONO: { min: 9, max: 15 },
  EMPRESA: { min: 2, max: 200 },
  CREDENCIAL: { min: 1, max: 50 },
} as const;

// ============================================================================
// VALORES POR DEFECTO
// ============================================================================

/**
 * Valores por defecto para un acreditado vacío en formularios.
 */
export const DEFAULT_ACREDITADO = {
  nombre: "",
  primer_apellido: "",
  segundo_apellido: "",
  rut: "",
  email: "",
  cargo: "",
  tipo_credencial: "",
  numero_credencial: "",
} as const;

/**
 * Valores por defecto para el formulario de acreditación.
 */
export const DEFAULT_FORM_DATA = {
  responsable_nombre: "",
  responsable_primer_apellido: "",
  responsable_segundo_apellido: "",
  responsable_rut: "",
  responsable_email: "",
  responsable_telefono: "",
  empresa: "",
  empresa_personalizada: "",
  area: "",
  acreditados: [{ ...DEFAULT_ACREDITADO }],
} as const;

/**
 * Estados de envío de formulario.
 */
export const DEFAULT_SUBMISSION_STATUS = {
  type: null as "success" | "error" | null,
  message: "",
} as const;

// ============================================================================
// CONFIGURACIÓN DE UI
// ============================================================================

/**
 * Número máximo de acreditados por defecto si no hay cupos definidos.
 */
export const MAX_ACREDITADOS_DEFAULT = 10;

/**
 * Número mínimo de acreditados requeridos.
 */
export const MIN_ACREDITADOS = 1;

/**
 * Tiempo de espera para debounce en búsquedas (ms).
 */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Tiempo de auto-cierre de mensajes de éxito (ms).
 */
export const SUCCESS_MESSAGE_TIMEOUT_MS = 5000;

/**
 * Tiempo de auto-cierre de mensajes de error (ms).
 */
export const ERROR_MESSAGE_TIMEOUT_MS = 8000;
