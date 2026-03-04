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
    // Chain: .select('*').eq('event_id', ...).ilike('tipo_medio', ...).single()
    const terminal = { single: vi.fn().mockResolvedValue({ data: null }) };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue(terminal),
          eq: vi.fn().mockReturnValue(terminal),
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
        // event_quota_rules: .select().eq(event_id).ilike(tipo_medio).single()
        const terminal = { single: vi.fn().mockResolvedValue({ data: { max_per_organization: 3, max_global: 0, tipo_medio: 'Fotógrafo' } }) };
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue(terminal),
              eq: vi.fn().mockReturnValue(terminal),
            }),
          }),
        };
      }
      if (callCount === 2) {
        // registrations count org: .select().eq(event_id).ilike(tipo_medio).ilike(organizacion).neq(status)
        const neqFn = vi.fn().mockResolvedValue({ count: 3 });
        const step3: Record<string, ReturnType<typeof vi.fn>> = { neq: neqFn };
        const step2: Record<string, ReturnType<typeof vi.fn>> = { ilike: vi.fn().mockReturnValue(step3), eq: vi.fn().mockReturnValue(step3), neq: neqFn };
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue(step2),
              eq: vi.fn().mockReturnValue(step2),
            }),
          }),
        };
      }
      // registrations count global: .select().eq(event_id).ilike(tipo_medio).neq(status)
      const neqFn = vi.fn().mockResolvedValue({ count: 5 });
      const step2: Record<string, ReturnType<typeof vi.fn>> = { neq: neqFn };
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue(step2),
            eq: vi.fn().mockReturnValue(step2),
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
        const terminal = { single: vi.fn().mockResolvedValue({ data: { max_per_organization: 10, max_global: 5, tipo_medio: 'Radial' } }) };
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue(terminal),
              eq: vi.fn().mockReturnValue(terminal),
            }),
          }),
        };
      }
      if (callCount === 2) {
        // org count = 2 (within limit)
        const neqFn = vi.fn().mockResolvedValue({ count: 2 });
        const step3: Record<string, ReturnType<typeof vi.fn>> = { neq: neqFn };
        const step2: Record<string, ReturnType<typeof vi.fn>> = { ilike: vi.fn().mockReturnValue(step3), eq: vi.fn().mockReturnValue(step3), neq: neqFn };
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue(step2),
              eq: vi.fn().mockReturnValue(step2),
            }),
          }),
        };
      }
      // global count = 5 (at limit)
      const neqFn = vi.fn().mockResolvedValue({ count: 5 });
      const step2: Record<string, ReturnType<typeof vi.fn>> = { neq: neqFn };
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue(step2),
            eq: vi.fn().mockReturnValue(step2),
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
        const terminal = { single: vi.fn().mockResolvedValue({ data: { max_per_organization: 5, max_global: 20, tipo_medio: 'Prensa' } }) };
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue(terminal),
              eq: vi.fn().mockReturnValue(terminal),
            }),
          }),
        };
      }
      if (callCount === 2) {
        const neqFn = vi.fn().mockResolvedValue({ count: 2 });
        const step3: Record<string, ReturnType<typeof vi.fn>> = { neq: neqFn };
        const step2: Record<string, ReturnType<typeof vi.fn>> = { ilike: vi.fn().mockReturnValue(step3), eq: vi.fn().mockReturnValue(step3), neq: neqFn };
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue(step2),
              eq: vi.fn().mockReturnValue(step2),
            }),
          }),
        };
      }
      const neqFn = vi.fn().mockResolvedValue({ count: 8 });
      const step2: Record<string, ReturnType<typeof vi.fn>> = { neq: neqFn };
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue(step2),
            eq: vi.fn().mockReturnValue(step2),
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
