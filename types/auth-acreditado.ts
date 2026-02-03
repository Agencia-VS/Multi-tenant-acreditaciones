/**
 * Tipos para el sistema de perfiles de acreditados
 * Fase 3: Login y auto-fill para acreditados
 */

// ============================================================================
// PERFIL DE ACREDITADO
// ============================================================================

/**
 * Perfil completo de un acreditado guardado en la base de datos
 */
export interface PerfilAcreditado {
  id: string;
  user_id: string | null;
  rut: string;
  nombre: string;
  apellido: string;
  email: string;
  empresa: string | null;
  cargo: string | null;
  telefono: string | null;
  nacionalidad: string;
  foto_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Datos para crear o actualizar un perfil
 */
export interface PerfilAcreditadoInput {
  rut: string;
  nombre: string;
  apellido: string;
  email: string;
  empresa?: string;
  cargo?: string;
  telefono?: string;
  nacionalidad?: string;
  foto_url?: string;
}

/**
 * Respuesta de la función vincular_perfil_por_rut
 */
export interface VincularPerfilResponse {
  success: boolean;
  message: string;
  perfil_id: string | null;
}

// ============================================================================
// AUTENTICACIÓN DE ACREDITADOS
// ============================================================================

/**
 * Estado de autenticación del acreditado
 */
export interface AuthAcreditadoState {
  user: AuthUser | null;
  perfil: PerfilAcreditado | null;
  loading: boolean;
  error: string | null;
}

/**
 * Usuario autenticado de Supabase (simplificado)
 */
export interface AuthUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  created_at: string;
}

/**
 * Datos para login
 */
export interface LoginCredentials {
  email: string;
  password?: string;
}

/**
 * Datos para registro
 */
export interface RegisterCredentials {
  email: string;
  password: string;
  rut?: string;
  nombre?: string;
  apellido?: string;
}

/**
 * Métodos de autenticación disponibles
 */
export type AuthMethod = 'password' | 'magic_link';

// ============================================================================
// CONTEXTO DE AUTH
// ============================================================================

/**
 * Contexto de autenticación para acreditados
 */
export interface AuthAcreditadoContextType {
  // Estado
  user: AuthUser | null;
  perfil: PerfilAcreditado | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  
  // Métodos de autenticación
  loginWithPassword: (email: string, password: string) => Promise<void>;
  loginWithMagicLink: (email: string) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  
  // Métodos de perfil
  loadPerfil: () => Promise<void>;
  updatePerfil: (data: Partial<PerfilAcreditadoInput>) => Promise<void>;
  vincularPorRut: (rut: string) => Promise<VincularPerfilResponse>;
  
  // Utilidades
  clearError: () => void;
}

// ============================================================================
// FORMULARIO AUTO-FILL
// ============================================================================

/**
 * Datos pre-llenados para el formulario de acreditación
 */
export interface DatosPrellenos {
  nombre: string;
  apellido: string;
  rut: string;
  email: string;
  empresa: string;
  cargo: string;
  telefono: string;
  nacionalidad: string;
}

/**
 * Estado del auto-fill
 */
export interface AutoFillState {
  isLoggedIn: boolean;
  hasPerfil: boolean;
  datos: DatosPrellenos | null;
  loading: boolean;
}
