/**
 * Tipos para el panel de acreditados/responsables
 * Complementa los tipos de auth-acreditado.ts y acreditacion.ts
 */

// ============================================================================
// TIPOS ESPECÍFICOS DEL PANEL DE ACREDITADO
// ============================================================================

// Re-exportamos PerfilAcreditado de auth-acreditado para conveniencia
export type { PerfilAcreditado } from './auth-acreditado';

// Solicitud de acreditación con relaciones expandidas (para el panel)
export interface AcreditacionPanel {
  id: number;
  tenant_id: string;
  evento_id: number;
  perfil_acreditado_id: string | null;
  nombre: string;
  apellido: string | null;
  rut: string | null;
  email: string | null;
  empresa: string | null;
  cargo: string | null;
  area: string | null;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  motivo_rechazo: string | null;
  tipo_credencial: string | null;
  zona_id: number | null;
  responsable_nombre: string | null;
  responsable_email: string | null;
  responsable_telefono: string | null;
  created_at?: string;
  updated_at: string;
}

// Acreditación con relaciones expandidas (para queries con select)
export interface AcreditacionConRelaciones extends AcreditacionPanel {
  tenant: {
    nombre: string;
    slug: string;
    shield_url: string | null;
  } | null;
  evento: {
    nombre: string;
    fecha: string | null;
  } | null;
}

// Tenant básico
export interface TenantBasico {
  id: string;
  nombre: string;
  slug: string;
  shield_url: string | null;
  color_primario: string | null;
}

// Evento básico
export interface EventoBasico {
  id: number;
  nombre: string;
  fecha: string | null;
  hora: string | null;
  venue: string | null;
  fecha_limite_acreditacion: string | null;
}

// Datos del formulario para agregar persona individual (panel acreditado)
export interface FormPersonaAcreditacion {
  nombre: string;
  apellido: string;
  rut: string;
  email: string;
  telefono: string;
  cargo: string;
  tipo_medio: string;
  nacionalidad: string;
}

// Persona frecuente guardada (plantilla reutilizable de datos)
export interface PersonaFrecuente {
  id: string; // UUID generado en cliente
  nombre: string;
  apellido: string;
  rut: string | null;
  email: string | null;
  telefono: string | null;
  cargo: string | null;
  empresa: string | null;
  nacionalidad: string | null;
  tipo_medio?: string | null;
  veces_usado: number;
}

// Perfil extendido con equipo frecuente (campo JSONB)
export interface PerfilConEquipo {
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
  equipo_frecuente: PersonaFrecuente[];
  created_at: string;
  updated_at: string;
}

// Stats del dashboard
export interface DashboardStats {
  total: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
}

// Tipos de medio disponibles
export const TIPOS_MEDIO = [
  'Periodista',
  'Fotógrafo',
  'Camarógrafo',
  'Productor',
  'Editor',
  'Comentarista',
  'Técnico',
  'Otro',
] as const;

export type TipoMedio = typeof TIPOS_MEDIO[number];
