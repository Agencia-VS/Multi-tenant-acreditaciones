/**
 * Zod Schemas — Validación de input para API routes
 * 
 * Centraliza validación de datos de entrada para prevenir
 * datos malformados, SQL injection implícita y tipado incorrecto.
 */

import { z } from 'zod';

/* ─── Primitivos reutilizables ───────────────────────────────────── */

export const uuidSchema = z.string().uuid('ID inválido');

/** Transforma empty string / null / undefined → null */
const coerceEmpty = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? null : v == null ? null : v;

/** Color hex — acepta string hex válido, empty string → null, null → null */
const hexColor = z.preprocess(
  coerceEmpty,
  z.string().regex(/^#[0-9a-fA-F]{3,8}$/).nullable()
);

/** URL — acepta URL válida, empty string → null, null → null */
const optionalUrl = z.preprocess(
  coerceEmpty,
  z.string().url().nullable()
);

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
  fecha: z.string().nullable().optional(),
  fecha_fin: z.string().nullable().optional(),
  fecha_inicio: z.string().nullable().optional(),
  fecha_limite_acreditacion: z.string().nullable().optional(),
  hora: z.string().nullable().optional(),
  venue: safeString.nullable().optional(),
  descripcion: z.string().max(2000).nullable().optional().default(''),
  is_active: z.boolean().optional().default(true),
  event_type: z.enum(['simple', 'deportivo', 'multidia']).optional().default('simple'),
  visibility: z.enum(['public', 'invite_only']).optional().default('public'),
  qr_enabled: z.boolean().optional().default(false),
  league: safeString.nullable().optional(),
  opponent_name: safeString.nullable().optional(),
  opponent_logo_url: z.string().nullable().optional(),
  cupos_globales: z.number().int().min(0).optional(),
  cupos_tipo_medio: z.record(z.string(), z.number().int().min(0)).optional(),
  form_config_id: uuidSchema.optional().nullable(),
}).passthrough(); // Allow extra fields for flexibility

export const eventUpdateSchema = eventCreateSchema
  .partial()
  .omit({ tenant_id: true })
  .extend({
    // Override: no usar default(false) en updates para no sobrescribir valores existentes
    qr_enabled: z.boolean().optional(),
    is_active: z.boolean().optional(),
  });

/* ─── Tenants ────────────────────────────────────────────────────── */

export const tenantCreateSchema = z.object({
  nombre: safeString.pipe(z.string().min(1, 'Nombre es requerido')),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug solo puede contener letras minúsculas, números y guiones'),
  activo: z.boolean().optional().default(true),
  color_primario: hexColor.optional().default('#1a1a2e'),
  color_secundario: hexColor.optional().default('#ffffff'),
  color_light: hexColor.optional().default('#f0f0f0'),
  color_dark: hexColor.optional().default('#1a1a2e'),
  logo_url: optionalUrl,
  shield_url: optionalUrl,
  background_url: optionalUrl,
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

/** Schema completo para crear perfil (usado en acreditación pública y bulk import) */
export const profileCreateSchema = z.object({
  rut: rutSchema,
  nombre: safeString.pipe(z.string().min(1, 'Nombre es requerido')),
  apellido: safeString.pipe(z.string().min(1, 'Apellido es requerido')),
  email: emailSchema.optional().default(''),
});

/** Schema lite para signup — solo email, el resto se completa después */
export const profileSignupSchema = z.object({
  email: emailSchema,
});

export const profileUpdateSchema = z.object({
  rut: rutSchema.optional(),
  nombre: safeString.optional(),
  apellido: safeString.optional(),
  email: emailSchema.nullable().optional(),
  telefono: safeString.nullable().optional(),
  medio: safeString.nullable().optional(),
  tipo_medio: safeString.nullable().optional(),
  cargo: safeString.nullable().optional(),
  nacionalidad: safeString.nullable().optional(),
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'No hay campos para actualizar' }
);

/* ─── Bulk Operations ────────────────────────────────────────────── */

export const bulkActionSchema = z.object({
  registration_ids: z.array(uuidSchema).min(1, 'registration_ids es requerido'),
  status: z.enum(['aprobado', 'rechazado']).optional(),
  send_emails: z.boolean().optional(),
  action: z.enum(['approve', 'reject', 'delete']).optional(),
});

/* ─── Team Members ───────────────────────────────────────────────── */

export const teamMemberCreateSchema = z.object({
  rut: rutSchema,
  nombre: safeString.pipe(z.string().min(1, 'Nombre es requerido')),
  apellido: safeString.pipe(z.string().min(1, 'Apellido es requerido')),
  email: emailSchema.optional().default(''),
  telefono: safeString.optional(),
  cargo: safeString.optional(),
  medio: safeString.optional(),
  tipo_medio: safeString.optional(),
  alias: safeString.optional(),
});

/* ─── Tenant Profile Data ────────────────────────────────────────── */

export const tenantProfileDataSchema = z.object({
  tenant_id: uuidSchema,
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .refine(obj => JSON.stringify(obj).length < 10000, 'Datos demasiado grandes (máx 10KB)'),
});

/* ─── Event Days ─────────────────────────────────────────────────── */

export const eventDaySchema = z.object({
  fecha: z.string().min(1, 'Fecha es requerida'),
  label: safeString.pipe(z.string().min(1, 'Label es requerido')),
  orden: z.number().int().min(0).optional().default(1),
  is_active: z.boolean().optional().default(true),
});

export const eventDaysSyncSchema = z.object({
  days: z.array(eventDaySchema),
});

/* ─── Quota Rules ────────────────────────────────────────────────── */

export const quotaRuleSchema = z.object({
  tipo_medio: safeString.pipe(z.string().min(1, 'tipo_medio es requerido')),
  max_per_organization: z.number().int().min(0).default(0),
  max_global: z.number().int().min(0).default(0),
});

/* ─── Zone Rules ─────────────────────────────────────────────────── */

export const zoneRuleSchema = z.object({
  cargo: safeString.pipe(z.string().min(1, 'cargo es requerido')),
  zona: safeString.pipe(z.string().min(1, 'zona es requerida')),
  match_field: z.enum(['cargo', 'tipo_medio']).optional().default('cargo'),
});

/* ─── Invitations ────────────────────────────────────────────────── */

export const invitationSchema = z.object({
  invitees: z.array(z.object({
    email: emailSchema,
    nombre: safeString.optional(),
  })).min(1, 'Al menos una invitación es requerida'),
});

/* ─── Admin Creation ─────────────────────────────────────────────── */

export const adminCreateSchema = z.object({
  email: emailSchema,
  nombre: safeString.pipe(z.string().min(1, 'Nombre es requerido')),
  password: z.string().min(8, 'Contraseña debe tener al menos 8 caracteres').max(128),
  rol: z.enum(['admin', 'editor', 'viewer']).optional().default('admin'),
});

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
