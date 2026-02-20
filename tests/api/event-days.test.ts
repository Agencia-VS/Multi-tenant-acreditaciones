/**
 * Tests: API /api/events/[id]/days — Event days route
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ── Mocks ──
const mockListEventDays = vi.fn();
const mockSyncEventDays = vi.fn();
const mockCreateEventDay = vi.fn();
const mockDeleteEventDay = vi.fn();
const mockGetEventTenantId = vi.fn();
const mockRequireAuth = vi.fn();

vi.mock('@/lib/services', () => ({
  listEventDays: (...args: unknown[]) => mockListEventDays(...args),
  syncEventDays: (...args: unknown[]) => mockSyncEventDays(...args),
  createEventDay: (...args: unknown[]) => mockCreateEventDay(...args),
  deleteEventDay: (...args: unknown[]) => mockDeleteEventDay(...args),
  getEventTenantId: (...args: unknown[]) => mockGetEventTenantId(...args),
}));

vi.mock('@/lib/services/requireAuth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock('@/lib/schemas', async () => {
  const actual = await vi.importActual('@/lib/schemas');
  return actual;
});

import { GET, PUT, POST, DELETE } from '@/app/api/events/[id]/days/route';

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

/** Auth helper — tenant resolved + requireAuth OK */
function authOk(userId = 'admin-1') {
  mockGetEventTenantId.mockResolvedValue('tenant-1');
  mockRequireAuth.mockResolvedValue({ user: { id: userId }, role: 'admin_tenant', tenantId: 'tenant-1' });
}

describe('GET /api/events/[id]/days', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of days', async () => {
    const days = [
      { id: 'd1', event_id: 'e1', fecha: '2026-03-01', label: 'Día 1' },
      { id: 'd2', event_id: 'e1', fecha: '2026-03-02', label: 'Día 2' },
    ];
    mockListEventDays.mockResolvedValue(days);

    const req = new NextRequest('http://localhost/api/events/e1/days');
    const res = await GET(req, makeParams('e1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(mockListEventDays).toHaveBeenCalledWith('e1');
  });

  it('returns 500 on service error', async () => {
    mockListEventDays.mockRejectedValue(new Error('DB down'));

    const req = new NextRequest('http://localhost/api/events/e1/days');
    const res = await GET(req, makeParams('e1'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('DB down');
  });
});

describe('PUT /api/events/[id]/days', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authOk();
  });

  it('syncs days when valid array is passed', async () => {
    const synced = [{ id: 'd1', fecha: '2026-03-01', label: 'Jornada 1' }];
    mockSyncEventDays.mockResolvedValue(synced);

    const req = new NextRequest('http://localhost/api/events/e1/days', {
      method: 'PUT',
      body: JSON.stringify({ days: [{ fecha: '2026-03-01', label: 'Jornada 1' }] }),
    });
    const res = await PUT(req, makeParams('e1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(mockSyncEventDays).toHaveBeenCalledWith('e1', [{ fecha: '2026-03-01', label: 'Jornada 1', orden: 1, is_active: true }]);
  });

  it('returns 400 when days is not an array', async () => {
    const req = new NextRequest('http://localhost/api/events/e1/days', {
      method: 'PUT',
      body: JSON.stringify({ days: 'invalid' }),
    });
    const res = await PUT(req, makeParams('e1'));

    expect(res.status).toBe(400);
  });
});

describe('POST /api/events/[id]/days', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authOk();
  });

  it('creates a day and returns 201', async () => {
    const day = { id: 'd1', event_id: 'e1', fecha: '2026-03-01', label: 'Día 1', orden: 1 };
    mockCreateEventDay.mockResolvedValue(day);

    const req = new NextRequest('http://localhost/api/events/e1/days', {
      method: 'POST',
      body: JSON.stringify({ fecha: '2026-03-01', label: 'Día 1', orden: 1 }),
    });
    const res = await POST(req, makeParams('e1'));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.label).toBe('Día 1');
    expect(mockCreateEventDay).toHaveBeenCalledWith('e1', { fecha: '2026-03-01', label: 'Día 1', orden: 1, is_active: true });
  });

  it('returns 400 when fecha or label is missing', async () => {
    const req = new NextRequest('http://localhost/api/events/e1/days', {
      method: 'POST',
      body: JSON.stringify({ fecha: '2026-03-01' }), // label missing
    });
    const res = await POST(req, makeParams('e1'));

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/events/[id]/days', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authOk();
  });

  it('deletes a day when day_id is provided', async () => {
    mockDeleteEventDay.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/events/e1/days?day_id=d1', {
      method: 'DELETE',
    });
    const res = await DELETE(req, makeParams('e1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDeleteEventDay).toHaveBeenCalledWith('d1');
  });

  it('returns 400 when day_id is missing', async () => {
    const req = new NextRequest('http://localhost/api/events/e1/days', {
      method: 'DELETE',
    });
    const res = await DELETE(req, makeParams('e1'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('day_id');
  });
});
