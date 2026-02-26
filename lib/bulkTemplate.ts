import type { BulkTemplateColumn } from '@/types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function extractRawBulkTemplateFromConfig(rawConfig: unknown): unknown {
  const config = asRecord(rawConfig);
  if (!config) return undefined;

  const bulkObj = asRecord(config.bulk);

  return (
    config.bulk_template_columns
    ?? config.bulkTemplateColumns
    ?? config.template_columns
    ?? bulkObj?.columns
    ?? bulkObj?.template_columns
  );
}

export function hasBulkTemplateSignalInConfig(rawConfig: unknown): boolean {
  return Boolean(extractRawBulkTemplateFromConfig(rawConfig));
}

export function normalizeBulkTemplateColumns(raw: unknown): BulkTemplateColumn[] {
  if (typeof raw === 'string') {
    try {
      return normalizeBulkTemplateColumns(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  const toColumn = (item: unknown): BulkTemplateColumn | null => {
    if (!item) return null;

    if (typeof item === 'string') {
      return {
        key: item,
        header: item,
        required: false,
        width: 20,
      };
    }

    if (typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const key = String(obj.key ?? obj.field ?? obj.name ?? '').trim();
      const header = String(obj.header ?? obj.label ?? obj.title ?? key).trim();
      if (!key || !header) return null;
      return {
        key,
        header,
        required: Boolean(obj.required),
        example: typeof obj.example === 'string' ? obj.example : undefined,
        width: typeof obj.width === 'number' ? obj.width : 20,
        options: Array.isArray(obj.options) ? obj.options.map(String) : undefined,
      };
    }

    return null;
  };

  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Object.values(raw as Record<string, unknown>)
      : [];

  return items
    .map((item, idx) => {
      const col = toColumn(item);
      const obj = (item && typeof item === 'object') ? (item as Record<string, unknown>) : null;
      const order = obj && typeof obj.order === 'number'
        ? obj.order
        : obj && typeof obj.index === 'number'
          ? obj.index
          : idx;
      return col ? { col, order } : null;
    })
    .filter((entry): entry is { col: BulkTemplateColumn; order: number } => Boolean(entry))
    .sort((a, b) => a.order - b.order)
    .map(entry => entry.col);
}

export function getBulkTemplateColumnsFromConfig(rawConfig: unknown): BulkTemplateColumn[] {
  return normalizeBulkTemplateColumns(extractRawBulkTemplateFromConfig(rawConfig));
}
