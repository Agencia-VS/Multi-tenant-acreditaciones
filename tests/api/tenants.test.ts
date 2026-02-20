/**
 * Tests: API /api/tenants — HTTP layer (auth, validation, status codes)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ── Mocks ──
const mockListTenants = vi.fn();
const mockListActiveTenants = vi.fn();
const mockCreateTenant = vi.fn();
const mockUpdateTenant = vi.fn();
const mockLogAuditAction = vi.fn();
const mockRequireAuth = vi.fn();

vi.mock('@/lib/services', () => ({
  listTenants: (...args: unknown[]) => mockListTenants(...args),
  listActiveTenants: (...args: unknown[]) => mockListActiveTenants(...args),
  createTenant: (...args: unknown[]) => mockCreateTenant(...args),
  updateTenant: (...args: unknown[]) => mockUpdateTenant(...args),
  logAuditAction: (...args: unknown[]) => mockLogAuditAction(...args),
  assignFreePlan: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/requireAuth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock('@/lib/schemas', async () => {
  const actual = await vi.importActual('@/lib/schemas');
  return actual;
});

vi.mock('@/lib/services/billing', () => ({
  assignFreePlan: vi.fn().mockResolvedValue(undefined),
}));

import { GET, POST, PATCH } from '@/app/api/tenants/route';

/** Helper: simula requireAuth exitoso */
function authOk(userId = 'user-1') {
  mockRequireAuth.mockResolvedValue({ user: { id: userId }, role: 'superadmin' });
}
/** Helper: simula requireAuth fallido (403) */
function authForbidden() {
  mockRequireAuth.mockRejectedValue(NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }));
}

describe('GET /api/tenants', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns active tenants by default', async () => {
    mockListActiveTenants.mockResolvedValue([{ id: 't-1', nombre: 'UC' }]);

    const req = new NextRequest('http://localhost/api/tenants');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(mockListActiveTenants).toHaveBeenCalled();
  });

  it('returns all tenants when all=true and superadmin', async () => {
    authOk();
    mockListTenants.mockResolvedValue([{ id: 't-1' }, { id: 't-2' }]);

    const req = new NextRequest('http://localhost/api/tenants?all=true');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockListTenants).toHaveBeenCalled();
  });

  it('returns 403 for all=true when not superadmin', async () => {
    authForbidden();

    const req = new NextRequest('http://localhost/api/tenants?all=true');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/tenants', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 when not superadmin', async () => {
    authForbidden();

    const req = new NextRequest('http://localhost/api/tenants', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'New', slug: 'new' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 201 when superadmin creates tenant', async () => {
    authOk();
    mockCreateTenant.mockResolvedValue({ id: 't-1', nombre: 'UC', slug: 'uc' });
    mockLogAuditAction.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/tenants', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'UC', slug: 'uc' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.slug).toBe('uc');
  });
});

describe('PATCH /api/tenants', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 when not superadmin', async () => {
    authForbidden();

    const req = new NextRequest('http://localhost/api/tenants?id=t-1', {
      method: 'PATCH',
      body: JSON.stringify({ nombre: 'Updated' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 when id is missing', async () => {
    authOk();

    const req = new NextRequest('http://localhost/api/tenants', {
      method: 'PATCH',
      body: JSON.stringify({ nombre: 'Updated' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful update', async () => {
    authOk();
    mockUpdateTenant.mockResolvedValue({ id: 't-1', nombre: 'Updated', slug: 'uc' });
    mockLogAuditAction.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/tenants?id=t-1', {
      method: 'PATCH',
      body: JSON.stringify({ nombre: 'Updated' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nombre).toBe('Updated');
  });
});
