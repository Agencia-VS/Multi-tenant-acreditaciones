/**
 * Tests: quotas.ts — checkQuota logic with mocked Supabase
 *
 * Tests the quota engine's decision logic:
 * - No rule → always available
 * - Org limit reached → unavailable
 * - Global limit reached → unavailable
 * - Within limits → available
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Supabase builder chain ──
const mockSingle = vi.fn();
const mockNeq = vi.fn(() => ({ count: 0 }));
const mockHead = vi.fn(() => ({ neq: mockNeq }));
const mockSelect = vi.fn(() => ({ count: 'exact', head: true, eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ neq: mockNeq })), neq: mockNeq })) })) }));
const mockEq3 = vi.fn(() => ({ neq: mockNeq }));
const mockEq2 = vi.fn(() => ({ eq: mockEq3, neq: mockNeq }));
const mockEq1 = vi.fn(() => ({ eq: mockEq2, single: mockSingle }));

// We need a more precise mock — let's mock the entire module
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    from: mockFrom,
  }),
}));

import { checkQuota } from '@/lib/services/quotas';

// Chain builder helper
function buildChain(returnData: unknown, count?: number) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: returnData }),
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockResolvedValue({ count }),
          }),
          neq: vi.fn().mockResolvedValue({ count }),
        }),
      }),
    }),
  };
}

describe('checkQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns available when no quota rule exists', async () => {
    // First call: event_quota_rules → no rule
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });

    const result = await checkQuota('event-1', 'Fotógrafo', 'CNN');
    expect(result.available).toBe(true);
    expect(result.message).toContain('Sin restricción');
  });

  it('returns unavailable when org limit is reached', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // event_quota_rules
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { max_per_organization: 3, max_global: 0, tipo_medio: 'Fotógrafo' },
                }),
              }),
            }),
          }),
        };
      }
      if (callCount === 2) {
        // registrations count org
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  neq: vi.fn().mockResolvedValue({ count: 3 }),
                }),
              }),
            }),
          }),
        };
      }
      // registrations count global
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockResolvedValue({ count: 5 }),
            }),
          }),
        }),
      };
    });

    const result = await checkQuota('event-1', 'Fotógrafo', 'CNN');
    expect(result.available).toBe(false);
    expect(result.message).toContain('límite');
    expect(result.message).toContain('3');
    expect(result.used_org).toBe(3);
    expect(result.max_org).toBe(3);
  });

  it('returns unavailable when global limit is reached', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { max_per_organization: 10, max_global: 5, tipo_medio: 'Radial' },
                }),
              }),
            }),
          }),
        };
      }
      if (callCount === 2) {
        // org count = 2 (within limit)
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  neq: vi.fn().mockResolvedValue({ count: 2 }),
                }),
              }),
            }),
          }),
        };
      }
      // global count = 5 (at limit)
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockResolvedValue({ count: 5 }),
            }),
          }),
        }),
      };
    });

    const result = await checkQuota('event-1', 'Radial', 'Radio Bio Bio');
    expect(result.available).toBe(false);
    expect(result.message).toContain('global');
    expect(result.used_global).toBe(5);
    expect(result.max_global).toBe(5);
  });

  it('returns available when within limits', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { max_per_organization: 5, max_global: 20, tipo_medio: 'Prensa' },
                }),
              }),
            }),
          }),
        };
      }
      if (callCount === 2) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  neq: vi.fn().mockResolvedValue({ count: 2 }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockResolvedValue({ count: 8 }),
            }),
          }),
        }),
      };
    });

    const result = await checkQuota('event-1', 'Prensa', 'El Mercurio');
    expect(result.available).toBe(true);
    expect(result.used_org).toBe(2);
    expect(result.max_org).toBe(5);
    expect(result.used_global).toBe(8);
    expect(result.max_global).toBe(20);
  });
});
