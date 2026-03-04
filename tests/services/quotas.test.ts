/**
 * Tests: quotas.ts — checkQuota logic with mocked Supabase
 *
 * Tests the quota engine's decision logic:
 * - No rule → always available
 * - Org limit reached → unavailable
 * - Global limit reached → unavailable
 * - Within limits → available
 * - Case/space normalization works
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    from: mockFrom,
  }),
}));

import { checkQuota } from '@/lib/services/quotas';

/**
 * checkQuota now does 2 queries:
 *   1. from('event_quota_rules').select('*').eq('event_id', ...) → { data: rules[] }
 *   2. from('registrations').select('tipo_medio, organizacion').eq('event_id', ...).neq('status', 'rechazado') → { data: regs[] }
 */
function mockQuotaQueries(rules: unknown[], registrations: unknown[]) {
  let callCount = 0;
  mockFrom.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // event_quota_rules
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: rules }),
        }),
      };
    }
    // registrations
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockResolvedValue({ data: registrations }),
        }),
      }),
    };
  });
}

describe('checkQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns available when no quota rule exists', async () => {
    mockQuotaQueries([], []);

    const result = await checkQuota('event-1', 'Fotógrafo', 'CNN');
    expect(result.available).toBe(true);
    expect(result.message).toContain('Sin restricción');
  });

  it('returns unavailable when org limit is reached', async () => {
    mockQuotaQueries(
      [{ tipo_medio: 'Fotógrafo', max_per_organization: 3, max_global: 0 }],
      [
        { tipo_medio: 'Fotógrafo', organizacion: 'CNN' },
        { tipo_medio: 'Fotógrafo', organizacion: 'CNN' },
        { tipo_medio: 'Fotógrafo', organizacion: 'CNN' },
        { tipo_medio: 'Fotógrafo', organizacion: 'BBC' },
        { tipo_medio: 'Radial', organizacion: 'CNN' },
      ]
    );

    const result = await checkQuota('event-1', 'Fotógrafo', 'CNN');
    expect(result.available).toBe(false);
    expect(result.message).toContain('límite');
    expect(result.message).toContain('3');
    expect(result.used_org).toBe(3);
    expect(result.max_org).toBe(3);
  });

  it('returns unavailable when global limit is reached', async () => {
    mockQuotaQueries(
      [{ tipo_medio: 'Radial', max_per_organization: 10, max_global: 5 }],
      [
        { tipo_medio: 'Radial', organizacion: 'Radio Bio Bio' },
        { tipo_medio: 'Radial', organizacion: 'Radio Bio Bio' },
        { tipo_medio: 'Radial', organizacion: 'Cooperativa' },
        { tipo_medio: 'Radial', organizacion: 'Cooperativa' },
        { tipo_medio: 'Radial', organizacion: 'ADN' },
      ]
    );

    const result = await checkQuota('event-1', 'Radial', 'Radio Bio Bio');
    expect(result.available).toBe(false);
    expect(result.message).toContain('global');
    expect(result.used_global).toBe(5);
    expect(result.max_global).toBe(5);
  });

  it('returns available when within limits', async () => {
    mockQuotaQueries(
      [{ tipo_medio: 'Prensa', max_per_organization: 5, max_global: 20 }],
      [
        { tipo_medio: 'Prensa', organizacion: 'El Mercurio' },
        { tipo_medio: 'Prensa', organizacion: 'El Mercurio' },
        { tipo_medio: 'Prensa', organizacion: 'La Tercera' },
        { tipo_medio: 'Prensa', organizacion: 'La Tercera' },
        { tipo_medio: 'Prensa', organizacion: 'La Tercera' },
        { tipo_medio: 'Prensa', organizacion: 'La Tercera' },
        { tipo_medio: 'Prensa', organizacion: 'La Tercera' },
        { tipo_medio: 'Prensa', organizacion: 'Cooperativa' },
      ]
    );

    const result = await checkQuota('event-1', 'Prensa', 'El Mercurio');
    expect(result.available).toBe(true);
    expect(result.used_org).toBe(2);
    expect(result.max_org).toBe(5);
    expect(result.used_global).toBe(8);
    expect(result.max_global).toBe(20);
  });

  it('matches case-insensitively and ignores spaces', async () => {
    mockQuotaQueries(
      [{ tipo_medio: 'Prensa Escrita', max_per_organization: 2, max_global: 0 }],
      [
        { tipo_medio: 'prensa escrita', organizacion: 'el mercurio' },
        { tipo_medio: 'PRENSA ESCRITA', organizacion: 'El Mercurio' },
      ]
    );

    // "prensaescrita" normalizes to match "Prensa Escrita"
    const result = await checkQuota('event-1', 'prensaescrita', 'ElMercurio');
    expect(result.available).toBe(false);
    expect(result.used_org).toBe(2);
  });
});
