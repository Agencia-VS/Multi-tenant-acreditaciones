/**
 * Zod Schemas — Validación de input para API routes
 * 
 * Centraliza validación de datos de entrada para prevenir
 * datos malformados, SQL injection implícita y tipado incorrecto.
 */

import { z } from 'zod';

/* ─── Primitivos reutilizables ───────────────────────────────────── */

export const uuidSchema = z.string().uuid('ID inválido');

export const rutSchema = z
  .string()
  .min(1, 'RUT es requerido')
  .regex(/^[\d]{7,8}-[\dkK]$/i, 'Formato de RUT inválido. Ej: 12345678-9');

export const emailSchema = z
  .string()
  .email('Email inválido')
  .max(255);

export const safeString = z
  .string()
  .max(500)
  .transform(s => s.trim().replace(/\s+/g, ' '));

export const htmlString = z
  .string()
  .max(50000, 'Contenido HTML demasiado largo');

/* ─── Email Templates ────────────────────────────────────────────── */

export const emailTemplateTypeSchema = z.enum([
  'aprobacion',
  'rechazo',
  'confirmacion',
  'recordatorio',
]);

export const emailTemplatePostSchema = z.object({
  tenant_id: uuidSchema,
  tipo: emailTemplateTypeSchema,
  subject: safeString.pipe(z.string().min(1, 'Subject es requerido')),
  body_html: htmlString,
  info_general: htmlString.optional().default(''),
});

/* ─── Email Zone Content ─────────────────────────────────────────── */

export const emailZoneContentPostSchema = z.object({
  tenant_id: uuidSchema,
  tipo: emailTemplateTypeSchema,
  zona: safeString.pipe(z.string().min(1, 'Zona es requerida')),
  titulo: safeString.optional().default(''),
  instrucciones_acceso: htmlString.optional().default(''),
  info_especifica: htmlString.optional().default(''),
  notas_importantes: htmlString.optional().default(''),
});

/* ─── Events ─────────────────────────────────────────────────────── */

export const eventCreateSchema = z.object({
  tenant_id: uuidSchema,
  nombre: safeString.pipe(z.string().min(1, 'Nombre es requerido')),
  fecha: z.string().optional(),
  fecha_fin: z.string().optional(),
  venue: safeString.optional().default(''),
  descripcion: z.string().max(2000).optional().default(''),
  activo: z.boolean().optional().default(true),
  tipo: z.enum(['simple', 'deportivo', 'multidia']).optional().default('simple'),
  qr_enabled: z.boolean().optional().default(false),
  cupos_globales: z.number().int().min(0).optional(),
  cupos_tipo_medio: z.record(z.string(), z.number().int().min(0)).optional(),
  form_config_id: uuidSchema.optional().nullable(),
}).passthrough(); // Allow extra fields for flexibility

export const eventUpdateSchema = eventCreateSchema.partial().omit({ tenant_id: true });

/* ─── Tenants ────────────────────────────────────────────────────── */

export const tenantCreateSchema = z.object({
  nombre: safeString.pipe(z.string().min(1, 'Nombre es requerido')),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug solo puede contener letras minúsculas, números y guiones'),
  activo: z.boolean().optional().default(true),
  color_primario: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional().default('#1a1a2e'),
  color_secundario: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional().default('#ffffff'),
  color_light: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional().default('#f0f0f0'),
  color_dark: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional().default('#1a1a2e'),
  logo_url: z.string().url().optional().nullable(),
  shield_url: z.string().url().optional().nullable(),
  background_url: z.string().url().optional().nullable(),
  config: z.record(z.string(), z.any()).optional(),
}).passthrough();

export const tenantUpdateSchema = tenantCreateSchema.partial();

/* ─── Registrations ──────────────────────────────────────────────── */

export const registrationStatusSchema = z.enum([
  'pendiente',
  'aprobado',
  'rechazado',
  'revision',
]);

export const registrationPatchSchema = z.object({
  status: registrationStatusSchema.optional(),
  motivo_rechazo: safeString.optional(),
  send_email: z.boolean().optional(),
  datos_extra: z.record(z.string(), z.any()).optional(),
}).refine(
  data => data.status || data.datos_extra,
  { message: 'status o datos_extra requerido' }
);

/* ─── Profiles ───────────────────────────────────────────────────── */

export const profileCreateSchema = z.object({
  rut: rutSchema,
  nombre: safeString.pipe(z.string().min(1, 'Nombre es requerido')),
  apellido: safeString.pipe(z.string().min(1, 'Apellido es requerido')),
  email: emailSchema.optional().default(''),
});

export const profileUpdateSchema = z.object({
  nombre: safeString.optional(),
  apellido: safeString.optional(),
  email: emailSchema.optional(),
  telefono: safeString.optional(),
  medio: safeString.optional(),
  tipo_medio: safeString.optional(),
  cargo: safeString.optional(),
  nacionalidad: safeString.optional(),
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'No hay campos para actualizar' }
);

/* ─── Helper: parse seguro que retorna NextResponse compatible ──── */

export type ParseResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown): ParseResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map(i => i.message).join(', ');
  return { success: false, error: errors };
}
