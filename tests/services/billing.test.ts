/**
 * Tests: lib/services/billing — Planes, Suscripciones, Límites, Stripe
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──

// Supabase client mock con chainable API
function createChainMock(resolvedValue: unknown = { data: null, error: null, count: 0 }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['from', 'select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'single', 'order', 'limit', 'gte', 'lt', 'maybeSingle'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Terminal methods resolve the value
  chain.single = vi.fn().mockResolvedValue(resolvedValue);
  chain.select = vi.fn().mockImplementation(() => {
    // If chained after upsert/insert, keep chaining
    return { ...chain, then: (r: (v: unknown) => void) => r(resolvedValue) };
  });
  // Make the chain itself thenable for awaits
  (chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => resolve(resolvedValue);
  return chain;
}

// Mock supabase admin client
const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => mockSupabase,
}));

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: { create: vi.fn().mockResolvedValue({ id: 'cus_test123' }) },
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/session123' }),
        },
      },
      billingPortal: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/portal123' }),
        },
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
    })),
  };
});

import {
  listPlans,
  getPlanBySlug,
  getPlanById,
  getTenantSubscription,
  getTenantPlan,
  checkLimit,
  recordUsage,
  getUsageSummary,
  isStripeConfigured,
  assignFreePlan,
} from '@/lib/services/billing';

// Helpers: plan fixtures
const freePlan = {
  id: 'plan-free',
  name: 'Free',
  slug: 'free',
  is_free: true,
  is_active: true,
  sort_order: 0,
  prices: { CLP: 0, BRL: 0, USD: 0 },
  stripe_price_ids: {},
  limits: { max_events: 1, max_registrations_per_event: 50, max_admins: 1, max_storage_mb: 100 },
  features: ['1 evento', '50 acreditados'],
};

const proPlan = {
  id: 'plan-pro',
  name: 'Pro',
  slug: 'pro',
  is_free: false,
  is_active: true,
  sort_order: 1,
  prices: { CLP: 29990, BRL: 149, USD: 29 },
  stripe_price_ids: { CLP: 'price_clp_pro' },
  limits: { max_events: 10, max_registrations_per_event: 500, max_admins: 5, max_storage_mb: 1000 },
  features: ['10 eventos', '500 acreditados'],
};

// Helper to setup chainable from() mock
function setupFrom(table: string, result: unknown) {
  const chain = createChainMock(result);
  mockFrom.mockImplementation((t: string) => {
    if (t === table) return chain;
    return createChainMock({ data: null, error: null });
  });
  return chain;
}

// Helper to setup multi-table from() mock
function setupMultiFrom(tables: Record<string, unknown>) {
  mockFrom.mockImplementation((t: string) => {
    if (t in tables) return createChainMock(tables[t]);
    return createChainMock({ data: null, error: null });
  });
}

describe('isStripeConfigured', () => {
  const origEnv = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    if (origEnv !== undefined) {
      process.env.STRIPE_SECRET_KEY = origEnv;
    } else {
      delete process.env.STRIPE_SECRET_KEY;
    }
  });

  it('returns false when STRIPE_SECRET_KEY is not set', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(isStripeConfigured()).toBe(false);
  });

  it('returns true when STRIPE_SECRET_KEY is set', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    expect(isStripeConfigured()).toBe(true);
  });
});

describe('listPlans', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns active plans from database', async () => {
    setupFrom('plans', { data: [freePlan, proPlan], error: null });
    const plans = await listPlans();
    expect(plans).toHaveLength(2);
    expect(plans[0].slug).toBe('free');
    expect(mockFrom).toHaveBeenCalledWith('plans');
  });

  it('throws on database error', async () => {
    setupFrom('plans', { data: null, error: { message: 'DB error' } });
    await expect(listPlans()).rejects.toThrow('Error listando planes');
  });
});

describe('getPlanBySlug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns plan when found', async () => {
    setupFrom('plans', { data: freePlan, error: null });
    const plan = await getPlanBySlug('free');
    expect(plan).not.toBeNull();
    expect(plan?.name).toBe('Free');
  });

  it('returns null when not found', async () => {
    setupFrom('plans', { data: null, error: { code: 'PGRST116' } });
    const plan = await getPlanBySlug('nonexistent');
    expect(plan).toBeNull();
  });
});

describe('getPlanById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns plan when found', async () => {
    setupFrom('plans', { data: proPlan, error: null });
    const plan = await getPlanById('plan-pro');
    expect(plan).not.toBeNull();
    expect(plan?.slug).toBe('pro');
  });
});

describe('getTenantSubscription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns subscription with plan join', async () => {
    const subData = {
      id: 'sub-1',
      tenant_id: 'tenant-1',
      plan_id: 'plan-pro',
      status: 'active',
      plan: proPlan,
    };
    setupFrom('subscriptions', { data: subData, error: null });
    const sub = await getTenantSubscription('tenant-1');
    expect(sub).not.toBeNull();
    expect(sub?.status).toBe('active');
    expect(sub?.plan.name).toBe('Pro');
  });

  it('returns null when no subscription', async () => {
    setupFrom('subscriptions', { data: null, error: { code: 'PGRST116' } });
    const sub = await getTenantSubscription('tenant-none');
    expect(sub).toBeNull();
  });
});

describe('checkLimit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows creation when under limit (events)', async () => {
    // Mock: subscription lookup returns free plan
    const subResult = {
      data: { id: 'sub-1', tenant_id: 'tenant-1', plan_id: 'plan-free', status: 'active', plan: freePlan },
      error: null,
    };
    const eventsResult = { data: null, error: null, count: 0 };

    // Setup multi-table mock
    mockFrom.mockImplementation((t: string) => {
      const chain = createChainMock(t === 'subscriptions' ? subResult : eventsResult);
      return chain;
    });

    const result = await checkLimit('tenant-1', 'events');
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(0);
    expect(result.limit).toBe(1);
  });

  it('blocks creation when at limit (events)', async () => {
    const subResult = {
      data: { id: 'sub-1', tenant_id: 'tenant-1', plan_id: 'plan-free', status: 'active', plan: freePlan },
      error: null,
    };
    const eventsResult = { data: null, error: null, count: 1 };

    mockFrom.mockImplementation((t: string) => {
      return createChainMock(t === 'subscriptions' ? subResult : eventsResult);
    });

    const result = await checkLimit('tenant-1', 'events');
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(1);
    expect(result.message).toContain('límite');
  });

  it('allows unlimited when limit is -1 (enterprise)', async () => {
    const entPlan = { ...proPlan, id: 'plan-ent', slug: 'enterprise', limits: { max_events: -1, max_registrations_per_event: -1, max_admins: -1, max_storage_mb: -1 } };
    const subResult = {
      data: { id: 'sub-1', tenant_id: 'tenant-1', plan_id: 'plan-ent', status: 'active', plan: entPlan },
      error: null,
    };

    mockFrom.mockImplementation(() => createChainMock(subResult));

    const result = await checkLimit('tenant-1', 'events');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1);
  });

  it('blocks when subscription is past_due on paid plan', async () => {
    const subResult = {
      data: { id: 'sub-1', tenant_id: 'tenant-1', plan_id: 'plan-pro', status: 'past_due', plan: proPlan },
      error: null,
    };

    mockFrom.mockImplementation(() => createChainMock(subResult));

    const result = await checkLimit('tenant-1', 'events');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('pago pendiente');
  });

  it('requires eventId for registrations metric', async () => {
    const subResult = {
      data: { id: 'sub-1', tenant_id: 'tenant-1', plan_id: 'plan-free', status: 'active', plan: freePlan },
      error: null,
    };
    mockFrom.mockImplementation(() => createChainMock(subResult));

    const result = await checkLimit('tenant-1', 'registrations');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('event_id requerido');
  });

  it('checks registrations per event with eventId', async () => {
    const subResult = {
      data: { id: 'sub-1', tenant_id: 'tenant-1', plan_id: 'plan-free', status: 'active', plan: freePlan },
      error: null,
    };
    const regResult = { data: null, error: null, count: 10 };

    mockFrom.mockImplementation((t: string) => {
      return createChainMock(t === 'subscriptions' ? subResult : regResult);
    });

    const result = await checkLimit('tenant-1', 'registrations', 'event-1');
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(10);
    expect(result.limit).toBe(50);
  });

  it('returns high usage warning at 80%+', async () => {
    const subResult = {
      data: { id: 'sub-1', tenant_id: 'tenant-1', plan_id: 'plan-pro', status: 'active', plan: proPlan },
      error: null,
    };
    const eventsResult = { data: null, error: null, count: 9 }; // 9/10 = 90%

    mockFrom.mockImplementation((t: string) => {
      return createChainMock(t === 'subscriptions' ? subResult : eventsResult);
    });

    const result = await checkLimit('tenant-1', 'events');
    expect(result.allowed).toBe(true);
    expect(result.percentage).toBe(90);
    expect(result.message).toContain('90%');
  });
});

describe('recordUsage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts usage record without throwing', async () => {
    setupFrom('usage_records', { data: null, error: null });
    await expect(recordUsage('tenant-1', 'events', 5)).resolves.not.toThrow();
    expect(mockFrom).toHaveBeenCalledWith('usage_records');
  });
});

describe('getUsageSummary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an object with plan and metrics', async () => {
    const subResult = {
      data: { id: 'sub-1', tenant_id: 'tenant-1', plan_id: 'plan-free', status: 'active', plan: freePlan },
      error: null,
      count: 0,
    };
    // Multiple from() calls: subscriptions → single(), plans → single(), events → count, tenant_admins → count
    mockFrom.mockImplementation(() => {
      // Return a proxy-like chain that resolves with count and data
      const result = { ...subResult };
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.from = vi.fn(self);
      chain.select = vi.fn(self);
      chain.eq = vi.fn(self);
      chain.in = vi.fn(self);
      chain.order = vi.fn(self);
      chain.single = vi.fn().mockResolvedValue(result);
      chain.then = (resolve: (v: unknown) => void) => resolve(result);
      return chain;
    });

    const summary = await getUsageSummary('tenant-1');
    expect(summary).toBeDefined();
    expect(summary.metrics).toBeDefined();
  });
});

describe('assignFreePlan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when free plan not found', async () => {
    setupFrom('plans', { data: null, error: { code: 'PGRST116' } });
    const result = await assignFreePlan('tenant-1');
    expect(result).toBeNull();
  });
});
