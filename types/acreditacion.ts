/**
 * Tipos y constantes para el sistema de acreditaciones multi-tenant
 * 
 * Este archivo centraliza todas las interfaces, enums y constantes
 * utilizadas en el proceso de acreditación de prensa y medios.
 */

// ============================================================================
// ENUMS Y TIPOS UNION
// ============================================================================

/**
 * Estados posibles de una acreditación
 */
export type Estado = "pendiente" | "aprobado" | "rechazado";

/**
 * Roles de administrador en el sistema multi-tenant
 */
export type RolAdmin = "admin" | "editor" | "lector";

/**
 * Cargos disponibles para acreditados de prensa
 */
export type Cargo =
  | "Periodista"
  | "Periodista Pupitre"
  | "Relator"
  | "Comentarista"
  | "Camarógrafo"
  | "Reportero Gráfico Cancha"
  | "Reportero Gráfico Tribuna"
  | "Técnico";

// ============================================================================
// INTERFACES DE FORMULARIO
// ============================================================================

/**
 * Datos del responsable que solicita la acreditación
 */
export interface Responsable {
  /** Nombre del responsable */
  responsable_nombre: string;
  /** Primer apellido del responsable */
  responsable_primer_apellido: string;
  /** Segundo apellido del responsable (opcional) */
  responsable_segundo_apellido?: string;
  /** RUT del responsable */
  responsable_rut: string;
  /** Email de contacto del responsable */
  responsable_email: string;
  /** Teléfono de contacto del responsable (opcional) */
  responsable_telefono?: string;
}

/**
 * Datos de una persona a acreditar en el formulario
 */
export interface AcreditadoFormulario {
  /** Nombre del acreditado */
  nombre: string;
  /** Primer apellido del acreditado */
  primer_apellido: string;
  /** Segundo apellido del acreditado */
  segundo_apellido: string;
  /** RUT del acreditado */
  rut: string;
  /** Email del acreditado */
  email: string;
  /** Cargo del acreditado (ej: Periodista, Camarógrafo) */
  cargo: string;
  /** Tipo de credencial solicitada */
  tipo_credencial: string;
  /** Número de credencial (si aplica) */
  numero_credencial: string;
}

/**
 * Datos completos del formulario de acreditación de prensa
 */
export interface FormDataAcreditacion extends Responsable {
  /** Nombre de la empresa o medio de comunicación */
  empresa: string;
  /** Nombre personalizado si empresa es "Otros" */
  empresa_personalizada?: string;
  /** Código del área de prensa seleccionada */
  area: string;
  /** Lista de personas a acreditar */
  acreditados: AcreditadoFormulario[];
}

// ============================================================================
// INTERFACES DE BASE DE DATOS
// ============================================================================

/**
 * Registro de acreditado en la base de datos (tabla mt_acreditados)
 */
export interface Acreditado {
  /** ID único del registro */
  id: number;
  /** ID del tenant al que pertenece */
  tenant_id: string;
  /** ID del evento asociado */
  evento_id: number;
  /** Nombre del acreditado */
  nombre: string;
  /** Apellido del acreditado (puede incluir primer y segundo apellido) */
  apellido: string | null;
  /** RUT del acreditado */
  rut: string | null;
  /** Email del acreditado */
  email: string | null;
  /** Estado de la acreditación */
  status: Estado;
  /** Motivo del rechazo (solo si status es 'rechazado') */
  motivo_rechazo: string | null;
  /** Empresa o medio de comunicación */
  empresa: string | null;
  /** Cargo del acreditado */
  cargo: string | null;
  /** Tipo de credencial */
  tipo_credencial: string | null;
  /** ID de la zona asignada */
  zona_id: number | null;
  /** Nombre del responsable de la solicitud */
  responsable_nombre: string | null;
  /** Email del responsable */
  responsable_email: string | null;
  /** Teléfono del responsable */
  responsable_telefono: string | null;
  /** Fecha de última actualización */
  updated_at: string;
}

/**
 * Resultado de acreditación para el panel de administración
 * Incluye campos adicionales procesados para visualización
 */
export interface Acreditacion {
  /** ID único del registro */
  id: number;
  /** Nombre del acreditado */
  nombre: string;
  /** Primer apellido del acreditado */
  primer_apellido: string;
  /** Segundo apellido del acreditado */
  segundo_apellido?: string;
  /** RUT del acreditado */
  rut: string;
  /** Email del acreditado */
  email: string;
  /** Cargo del acreditado */
  cargo: string;
  /** Tipo de credencial */
  tipo_credencial: string;
  /** Número de credencial */
  numero_credencial: string;
  /** Código del área de prensa */
  area: string;
  /** Empresa o medio de comunicación */
  empresa: string;
  /** ID de la zona asignada */
  zona_id?: number;
  /** Estado de la acreditación */
  status: Estado;
  /** Motivo del rechazo */
  motivo_rechazo?: string;
  /** Nombre del responsable */
  responsable_nombre?: string;
  /** Primer apellido del responsable */
  responsable_primer_apellido?: string;
  /** Segundo apellido del responsable */
  responsable_segundo_apellido?: string;
  /** RUT del responsable */
  responsable_rut?: string;
  /** Email del responsable */
  responsable_email?: string;
  /** Teléfono del responsable */
  responsable_telefono?: string;
  /** Fecha de creación */
  created_at: string;
}

// ============================================================================
// INTERFACES DE ENTIDADES RELACIONADAS
// ============================================================================

/**
 * Área de prensa con información de cupos
 */
export interface Area {
  /** Código identificador del área (ej: "A", "B", "C") */
  codigo: string;
  /** Nombre descriptivo del área */
  nombre: string;
  /** Número máximo de cupos disponibles */
  cupos: number;
}

/**
 * Área de prensa en base de datos (tabla mt_areas_prensa)
 */
export interface AreaPrensa {
  /** ID único del área */
  id: number;
  /** ID del tenant */
  tenant_id: string;
  /** ID del evento */
  evento_id: number;
  /** Nombre del área */
  nombre: string;
  /** Cupo máximo de acreditados */
  cupo_maximo: number;
}

/**
 * Zona de acreditación para asignación de espacios
 */
export interface Zona {
  /** ID único de la zona */
  id: number;
  /** Nombre de la zona */
  nombre: string;
}

/**
 * Zona de acreditación en base de datos (tabla mt_zonas_acreditacion)
 */
export interface ZonaAcreditacion {
  /** ID único de la zona */
  id: number;
  /** ID del tenant */
  tenant_id: string;
  /** ID del evento */
  evento_id: number;
  /** Nombre de la zona */
  nombre: string;
  /** Descripción de la zona */
  descripcion: string | null;
  /** Fecha de creación */
  created_at: string;
}

/**
 * Tenant (cliente/organización) del sistema multi-tenant
 */
export interface Tenant {
  /** UUID del tenant */
  id: string;
  /** Slug único para URL */
  slug: string;
  /** Nombre del tenant */
  nombre: string;
  /** URL del logo */
  logo_url: string | null;
  /** Fecha de creación */
  created_at: string;
}

/**
 * Evento asociado a un tenant
 */
export interface Evento {
  /** ID único del evento */
  id: number;
  /** ID del tenant */
  tenant_id: string;
  /** Nombre del evento */
  nombre: string;
  /** Descripción del evento */
  descripcion: string | null;
  /** Si el evento está activo */
  is_active: boolean;
}

/**
 * Usuario administrador de un tenant
 */
export interface AdminTenant {
  /** UUID del registro */
  id: string;
  /** UUID del usuario (auth.users) */
  user_id: string | null;
  /** UUID del tenant */
  tenant_id: string;
  /** Rol del administrador */
  rol: RolAdmin;
}

/**
 * Usuario del sistema
 */
export interface User {
  /** UUID del usuario */
  id: string;
  /** Email del usuario */
  email?: string;
  /** Rol del usuario */
  role?: string;
}

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Mapeo de códigos de área a nombres descriptivos
 */
export const AREA_NAMES: Record<string, string> = {
  "A": "Radiales con caseta",
  "B": "Radiales sin caseta",
  "C": "TV Nacionales",
  "D": "Sitios Web",
  "E": "Medios Escritos",
  "F": "Agencias",
  "G": "Reportero gráfico cancha",
};

/**
 * Clases CSS para cada estado de acreditación
 */
export const ESTADO_COLORS: Record<Estado, string> = {
  pendiente: "bg-yellow-100 text-yellow-800 border-yellow-300",
  aprobado: "bg-green-100 text-green-800 border-green-300",
  rechazado: "bg-red-100 text-red-800 border-red-300",
};

/**
 * Lista de cargos disponibles para acreditados
 */
export const CARGOS: Cargo[] = [
  "Periodista",
  "Periodista Pupitre",
  "Relator",
  "Comentarista",
  "Camarógrafo",
  "Reportero Gráfico Cancha",
  "Reportero Gráfico Tribuna",
  "Técnico",
];

/**
 * Estados disponibles para filtrado
 */
export const ESTADOS: Estado[] = ["pendiente", "aprobado", "rechazado"];

/**
 * Áreas de prensa por defecto (fallback)
 */
export const AREAS_DEFAULT: Area[] = [
  { codigo: "A", nombre: "Radiales con caseta", cupos: 5 },
  { codigo: "B", nombre: "Radiales sin caseta", cupos: 3 },
  { codigo: "C", nombre: "TV Nacionales", cupos: 2 },
  { codigo: "D", nombre: "Sitios Web", cupos: 2 },
  { codigo: "E", nombre: "Medios Escritos", cupos: 2 },
  { codigo: "F", nombre: "Agencias", cupos: 1 },
  { codigo: "G", nombre: "Reportero gráfico cancha", cupos: 1 },
];
