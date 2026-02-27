import type { EventConfig, ResponsableConfig } from '@/types';

export const RESPONSABLE_LINK_PREFIX = 'https://www.';
export const RESPONSABLE_OTHER_VALUE = '__otros__';

export function normalizeOrganizationOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  const normalized = options
    .map(opt => typeof opt === 'string' ? opt.trim() : '')
    .filter(Boolean)
    .filter(opt => opt.toLowerCase() !== 'otros');
  return [...new Set(normalized)];
}

export function normalizeResponsableConfig(rawConfig: unknown): ResponsableConfig {
  const source = (rawConfig && typeof rawConfig === 'object')
    ? (rawConfig as Partial<ResponsableConfig>)
    : {};

  const organizationMode = source.organization_mode === 'select' ? 'select' : 'text';

  return {
    organization_mode: organizationMode,
    organization_options: normalizeOrganizationOptions(source.organization_options),
    other_link_prefix: RESPONSABLE_LINK_PREFIX,
  };
}

export function getResponsableConfigFromEventConfig(eventConfig: EventConfig | Record<string, unknown> | null | undefined): ResponsableConfig {
  const source = (eventConfig && typeof eventConfig === 'object')
    ? (eventConfig as EventConfig)
    : {} as EventConfig;
  return normalizeResponsableConfig(source.responsable);
}
