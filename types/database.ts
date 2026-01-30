// Tipos generados para las tablas multi-tenant

export type MtTenant = {
  id: string;
  slug: string;
  nombre: string;
  logo_url: string | null;
  created_at: string;
  // Colores del equipo
  color_primario: string | null;
  color_secundario: string | null;
  color_light: string | null;
  color_dark: string | null;
  // Assets visuales
  shield_url: string | null;
  background_url: string | null;
  arena_logo_url: string | null;
  arena_nombre: string | null;
  // Redes sociales
  social_facebook: string | null;
  social_twitter: string | null;
  social_instagram: string | null;
  social_youtube: string | null;
};

export type MtEvento = {
  id: number;
  tenant_id: string;
  nombre: string;
  descripcion: string | null;
  is_active: boolean;
  // Datos del partido
  opponent_tenant_id: string | null;
  fecha: string | null;
  hora: string | null;
  venue: string | null;
  league: string | null;
  fecha_limite_acreditacion: string | null;
  created_at: string;
};

// Vista completa de evento con tenant y oponente
export type EventoCompleto = {
  evento_id: number;
  evento_nombre: string;
  descripcion: string | null;
  fecha: string | null;
  hora: string | null;
  venue: string | null;
  league: string | null;
  fecha_limite_acreditacion: string | null;
  is_active: boolean;
  // Tenant
  tenant_id: string;
  tenant_slug: string;
  tenant_nombre: string;
  tenant_logo: string | null;
  color_primario: string | null;
  color_secundario: string | null;
  color_light: string | null;
  color_dark: string | null;
  shield_url: string | null;
  background_url: string | null;
  arena_logo_url: string | null;
  arena_nombre: string | null;
  social_facebook: string | null;
  social_twitter: string | null;
  social_instagram: string | null;
  social_youtube: string | null;
  // Oponente
  opponent_id: string | null;
  opponent_slug: string | null;
  opponent_nombre: string | null;
  opponent_logo: string | null;
  opponent_shield_url: string | null;
  opponent_color_primario: string | null;
};

export type MtAreaPrensa = {
  id: number;
  tenant_id: string;
  evento_id: number;
  nombre: string;
  cupo_maximo: number;
};

export type MtZonaAcreditacion = {
  id: number;
  tenant_id: string;
  evento_id: number;
  nombre: string;
  descripcion: string | null;
  created_at: string;
};

export type MtAcreditado = {
  id: number;
  tenant_id: string;
  evento_id: number;
  nombre: string;
  apellido: string | null;
  rut: string | null;
  email: string | null;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  motivo_rechazo: string | null;
  empresa: string | null;
  cargo: string | null;
  tipo_credencial: string | null;
  zona_id: number | null;
  responsable_nombre: string | null;
  responsable_email: string | null;
  responsable_telefono: string | null;
  updated_at: string;
};

export type MtAdminTenant = {
  id: string;
  user_id: string | null;
  tenant_id: string;
  rol: 'admin' | 'editor' | 'lector';
};
