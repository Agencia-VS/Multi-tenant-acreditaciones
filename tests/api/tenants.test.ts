/**
 * Tests: API /api/tenants — HTTP layer (auth, validation, status codes)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──
const mockGetCurrentUser = vi.fn();
const mockIsSuperAdmin = vi.fn();
const mockListTenants = vi.fn();
const mockListActiveTenants = vi.fn();
const mockCreateTenant = vi.fn();
const mockUpdateTenant = vi.fn();
const mockLogAuditAction = vi.fn();

vi.mock('@/lib/services', () => ({
  listTenants: (...args: unknown[]) => mockListTenants(...args),
  listActiveTenants: (...args: unknown[]) => mockListActiveTenants(...args),
  createTenant: (...args: unknown[]) => mockCreateTenant(...args),
  updateTenant: (...args: unknown[]) => mockUpdateTenant(...args),
  getCurrentUser: () => mockGetCurrentUser(),
  isSuperAdmin: (id: string) => mockIsSuperAdmin(id),
  logAuditAction: (...args: unknown[]) => mockLogAuditAction(...args),
}));

import { GET, POST, PATCH } from '@/app/api/tenants/route';

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

  it('returns all tenants when all=true', async () => {
    mockListTenants.mockResolvedValue([{ id: 't-1' }, { id: 't-2' }]);

    const req = new NextRequest('http://localhost/api/tenants?all=true');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockListTenants).toHaveBeenCalled();
  });
});

describe('POST /api/tenants', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/tenants', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'New', slug: 'new' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when user is not superadmin', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockIsSuperAdmin.mockResolvedValue(false);

    const req = new NextRequest('http://localhost/api/tenants', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'New', slug: 'new' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 201 when superadmin creates tenant', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockIsSuperAdmin.mockResolvedValue(true);
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
    mockGetCurrentUser.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/tenants?id=t-1', {
      method: 'PATCH',
      body: JSON.stringify({ nombre: 'Updated' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 when id is missing', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockIsSuperAdmin.mockResolvedValue(true);

    const req = new NextRequest('http://localhost/api/tenants', {
      method: 'PATCH',
      body: JSON.stringify({ nombre: 'Updated' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful update', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockIsSuperAdmin.mockResolvedValue(true);
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
