/**
 * Configuraciones de formularios por defecto para el sistema de acreditaciones
 * 
 * Estas constantes definen la configuración "Prensa estándar" que se usa
 * como base para todos los tenants. Cada tenant puede personalizar su config.
 */

import type { FormFieldDefinition, FormSectionDefinition, FormConfig, FormConfigInput } from '../types/form-config';

// ============================================================================
// SECCIONES POR DEFECTO
// ============================================================================

export const DEFAULT_SECTIONS: FormSectionDefinition[] = [
  {
    key: 'responsable',
    label: 'Datos del Responsable',
    description: 'Información de contacto del responsable de la acreditación',
    icon: 'user',
    order: 1,
  },
  {
    key: 'medio',
    label: 'Medio de Comunicación',
    description: 'Seleccione su medio y la categoría correspondiente',
    icon: 'building',
    order: 2,
  },
  {
    key: 'acreditados',
    label: 'Datos de Acreditados',
    description: 'Complete los datos de cada persona a acreditar',
    icon: 'users',
    order: 3,
  },
];

// ============================================================================
// CAMPOS POR DEFECTO - RESPONSABLE
// ============================================================================

export const DEFAULT_RESPONSABLE_FIELDS: FormFieldDefinition[] = [
  {
    key: 'responsable_nombre',
    label: 'Nombre',
    placeholder: 'Nombre del responsable',
    type: 'text',
    required: true,
    section: 'responsable',
    scope: 'responsable',
    order: 1,
    gridCol: 2,
    validation: { minLength: 2, maxLength: 100 },
  },
  {
    key: 'responsable_primer_apellido',
    label: 'Primer Apellido',
    placeholder: 'Primer apellido',
    type: 'text',
    required: true,
    section: 'responsable',
    scope: 'responsable',
    order: 2,
    gridCol: 2,
    validation: { minLength: 2, maxLength: 100 },
  },
  {
    key: 'responsable_segundo_apellido',
    label: 'Segundo Apellido',
    placeholder: 'Segundo apellido',
    type: 'text',
    required: false,
    section: 'responsable',
    scope: 'responsable',
    order: 3,
    gridCol: 2,
    validation: { maxLength: 100 },
  },
  {
    key: 'responsable_rut',
    label: 'RUT',
    placeholder: 'Ej: 18274356-7',
    type: 'rut',
    required: true,
    section: 'responsable',
    scope: 'responsable',
    order: 4,
    gridCol: 2,
    validation: { builtIn: 'rut_chileno' },
  },
  {
    key: 'responsable_email',
    label: 'Email',
    placeholder: 'correo@ejemplo.com',
    type: 'email',
    required: true,
    section: 'responsable',
    scope: 'responsable',
    order: 5,
    gridCol: 2,
    validation: { builtIn: 'email' },
  },
  {
    key: 'responsable_telefono',
    label: 'Teléfono',
    placeholder: '+56 9 1234 5678',
    type: 'tel',
    required: false,
    section: 'responsable',
    scope: 'responsable',
    order: 6,
    gridCol: 2,
    validation: { builtIn: 'telefono_cl' },
  },
];

// ============================================================================
// CAMPOS POR DEFECTO - SOLICITUD (medio/área)
// ============================================================================

export const DEFAULT_SOLICITUD_FIELDS: FormFieldDefinition[] = [
  {
    key: 'empresa',
    label: 'Medio / Empresa',
    placeholder: 'Seleccionar medio',
    type: 'select',
    required: true,
    section: 'medio',
    scope: 'solicitud',
    order: 1,
    gridCol: 2,
    options: [
      { value: 'ESPN Chile', label: 'ESPN Chile' },
      { value: 'DNews Internacional', label: 'DNews Internacional' },
      { value: 'DSport (DirecTV)', label: 'DSport (DirecTV)' },
      { value: 'Photosport', label: 'Photosport' },
      { value: 'EFE', label: 'EFE' },
      { value: 'Redgol', label: 'Redgol' },
      { value: 'La Hora', label: 'La Hora' },
      { value: 'Publimetro', label: 'Publimetro' },
      { value: 'TVN', label: 'TVN' },
      { value: 'Mega', label: 'Mega' },
      { value: 'Canal 13', label: 'Canal 13' },
      { value: 'Chilevisión', label: 'Chilevisión' },
      { value: 'ADN', label: 'ADN' },
      { value: 'Cooperativa', label: 'Cooperativa' },
      { value: 'Agricultura', label: 'Agricultura' },
      { value: 'BioBio', label: 'BioBio' },
      { value: 'CNN Chile', label: 'CNN Chile' },
      { value: 'EMOL', label: 'EMOL' },
      { value: 'La Tercera', label: 'La Tercera' },
      { value: 'El Mercurio', label: 'El Mercurio' },
      { value: 'Otros', label: 'Otros', allowCustom: true },
    ],
    customOptionTrigger: 'Otros',
  },
  {
    key: 'empresa_personalizada',
    label: 'Nombre del Medio',
    placeholder: 'Ingrese el nombre de su medio',
    type: 'text',
    required: true,
    section: 'medio',
    scope: 'solicitud',
    order: 2,
    gridCol: 2,
    condition: {
      dependsOn: 'empresa',
      operator: 'equals',
      value: 'Otros',
    },
  },
  {
    key: 'area',
    label: 'Categoría del Medio',
    placeholder: 'Seleccionar categoría',
    type: 'select',
    required: true,
    section: 'medio',
    scope: 'solicitud',
    order: 3,
    gridCol: 2,
    // Las opciones se cargan dinámicamente desde mt_areas_prensa
    options: [],
    helpText: 'La categoría determina la cantidad de cupos disponibles',
  },
];

// ============================================================================
// CAMPOS POR DEFECTO - ACREDITADO
// ============================================================================

export const DEFAULT_ACREDITADO_FIELDS: FormFieldDefinition[] = [
  {
    key: 'nombre',
    label: 'Nombre',
    placeholder: 'Nombre del acreditado',
    type: 'text',
    required: true,
    section: 'acreditados',
    scope: 'acreditado',
    order: 1,
    gridCol: 3,
    masivo: true,
    validation: { minLength: 2, maxLength: 100 },
  },
  {
    key: 'primer_apellido',
    label: 'Primer Apellido',
    placeholder: 'Primer apellido',
    type: 'text',
    required: true,
    section: 'acreditados',
    scope: 'acreditado',
    order: 2,
    gridCol: 3,
    masivo: true,
    validation: { minLength: 2, maxLength: 100 },
  },
  {
    key: 'segundo_apellido',
    label: 'Segundo Apellido',
    placeholder: 'Segundo apellido',
    type: 'text',
    required: false,
    section: 'acreditados',
    scope: 'acreditado',
    order: 3,
    gridCol: 3,
    masivo: true,
  },
  {
    key: 'rut',
    label: 'RUT',
    placeholder: 'Ej: 18274356-7',
    type: 'rut',
    required: true,
    section: 'acreditados',
    scope: 'acreditado',
    order: 4,
    gridCol: 2,
    masivo: true,
    validation: { builtIn: 'rut_chileno' },
  },
  {
    key: 'email',
    label: 'Email',
    placeholder: 'correo@ejemplo.com',
    type: 'email',
    required: true,
    section: 'acreditados',
    scope: 'acreditado',
    order: 5,
    gridCol: 2,
    masivo: true,
    validation: { builtIn: 'email' },
  },
  {
    key: 'cargo',
    label: 'Cargo',
    placeholder: 'Seleccionar cargo',
    type: 'select',
    required: true,
    section: 'acreditados',
    scope: 'acreditado',
    order: 6,
    gridCol: 3,
    masivo: true,
    options: [
      { value: 'Periodista', label: 'Periodista' },
      { value: 'Periodista Pupitre', label: 'Periodista Pupitre' },
      { value: 'Relator', label: 'Relator' },
      { value: 'Comentarista', label: 'Comentarista' },
      { value: 'Camarógrafo', label: 'Camarógrafo' },
      { value: 'Reportero Gráfico Cancha', label: 'Reportero Gráfico Cancha' },
      { value: 'Reportero Gráfico Tribuna', label: 'Reportero Gráfico Tribuna' },
      { value: 'Técnico', label: 'Técnico' },
    ],
  },
  {
    key: 'tipo_credencial',
    label: 'Tipo de Credencial',
    placeholder: 'Tipo de credencial',
    type: 'text',
    required: true,
    section: 'acreditados',
    scope: 'acreditado',
    order: 7,
    gridCol: 3,
  },
  {
    key: 'numero_credencial',
    label: 'Número de Credencial',
    placeholder: 'Número de credencial',
    type: 'text',
    required: true,
    section: 'acreditados',
    scope: 'acreditado',
    order: 8,
    gridCol: 3,
  },
];

// ============================================================================
// CONFIG POR DEFECTO
// ============================================================================

export const DEFAULT_FORM_CONFIG: FormConfig = {
  max_acreditados_por_solicitud: 10,
  min_acreditados: 1,
  requiere_responsable: true,
  permite_masivo: false,
  auto_aprobacion: false,
  campos_masivo: ['nombre', 'primer_apellido', 'segundo_apellido', 'rut', 'email', 'cargo'],
  disclaimer: null,
  email_confirmacion: true,
};

// ============================================================================
// BUILDER HELPER — Genera un FormConfigInput completo
// ============================================================================

/**
 * Genera la configuración completa por defecto para un tenant.
 * Útil para seed data o para crear configs iniciales.
 */
export function buildDefaultFormConfig(tenantId: string, eventoId?: number): FormConfigInput {
  return {
    tenant_id: tenantId,
    evento_id: eventoId ?? null,
    nombre: 'Prensa',
    slug: 'prensa',
    tipo: 'individual',
    secciones: DEFAULT_SECTIONS,
    campos: [
      ...DEFAULT_RESPONSABLE_FIELDS,
      ...DEFAULT_SOLICITUD_FIELDS,
      ...DEFAULT_ACREDITADO_FIELDS,
    ],
    config: DEFAULT_FORM_CONFIG,
    activo: true,
    orden: 0,
  };
}
