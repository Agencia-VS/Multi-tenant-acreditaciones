/**
 * Tests: zones.ts — resolveZone priority + CRUD with mocked Supabase
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    from: mockFrom,
  }),
}));

import { resolveZone, getZoneRules, upsertZoneRule, deleteZoneRule } from '@/lib/services/zones';

/**
 * resolveZone now does 1 query: from('event_zone_rules').select(...).eq('event_id', ...)
 * Returns all rules for the event, then filters in JS with normalizeForMatch.
 */
function mockZoneRules(rules: unknown[]) {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: rules }),
    }),
  });
}

function listChain(data: unknown[], error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data, error }),
        }),
      }),
    }),
  };
}

describe('resolveZone', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns cargo match zone when cargo matches', async () => {
    mockZoneRules([
      { match_field: 'cargo', cargo: 'Periodista', zona: 'Prensa' },
      { match_field: 'tipo_medio', cargo: 'TV', zona: 'Tribuna' },
    ]);

    const zone = await resolveZone('e-1', 'Periodista', 'TV');
    expect(zone).toBe('Prensa');
  });

  it('falls back to tipo_medio when cargo has no match', async () => {
    mockZoneRules([
      { match_field: 'cargo', cargo: 'Periodista', zona: 'Prensa' },
      { match_field: 'tipo_medio', cargo: 'Operaciones', zona: 'Staff' },
    ]);

    const zone = await resolveZone('e-1', 'Unknown', 'Operaciones');
    expect(zone).toBe('Staff');
  });

  it('returns null when no rules match', async () => {
    mockZoneRules([
      { match_field: 'cargo', cargo: 'Periodista', zona: 'Prensa' },
    ]);

    const zone = await resolveZone('e-1', 'NoMatch', 'NoMatch');
    expect(zone).toBeNull();
  });

  it('returns null when cargo and tipoMedio are undefined', async () => {
    const zone = await resolveZone('e-1');
    expect(zone).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('skips cargo check when cargo is undefined', async () => {
    mockZoneRules([
      { match_field: 'cargo', cargo: 'Periodista', zona: 'Prensa' },
      { match_field: 'tipo_medio', cargo: 'Invitado', zona: 'VIP' },
    ]);

    const zone = await resolveZone('e-1', undefined, 'Invitado');
    expect(zone).toBe('VIP');
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('matches case-insensitively and ignores spaces', async () => {
    mockZoneRules([
      { match_field: 'cargo', cargo: 'Prensa Escrita', zona: 'Sala Prensa' },
    ]);

    const zone = await resolveZone('e-1', 'prensaescrita');
    expect(zone).toBe('Sala Prensa');
  });
});

describe('getZoneRules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns rules for event', async () => {
    const rules = [
      { id: 'r-1', event_id: 'e-1', match_field: 'cargo', cargo: 'Periodista', zona: 'Prensa' },
      { id: 'r-2', event_id: 'e-1', match_field: 'tipo_medio', cargo: 'TV', zona: 'Tribuna' },
    ];
    mockFrom.mockReturnValue(listChain(rules));

    const result = await getZoneRules('e-1');
    expect(result).toHaveLength(2);
    expect(result[0].zona).toBe('Prensa');
  });

  it('throws on supabase error', async () => {
    mockFrom.mockReturnValue(listChain([], { message: 'DB down' }));

    await expect(getZoneRules('e-1')).rejects.toThrow('Error obteniendo reglas de zona: DB down');
  });
});

describe('upsertZoneRule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts and returns the rule', async () => {
    const returned = { id: 'r-1', event_id: 'e-1', match_field: 'cargo', cargo: 'Periodista', zona: 'Prensa' };
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: returned, error: null }),
        }),
      }),
    });

    const result = await upsertZoneRule('e-1', 'Periodista', 'Prensa');
    expect(result.zona).toBe('Prensa');
  });
});

describe('deleteZoneRule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes without error', async () => {
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    await expect(deleteZoneRule('r-1')).resolves.toBeUndefined();
  });

  it('throws on supabase error', async () => {
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'FK violation' } }),
      }),
    });

    await expect(deleteZoneRule('r-1')).rejects.toThrow('Error eliminando regla de zona: FK violation');
  });
});
