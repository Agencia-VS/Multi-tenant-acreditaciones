/**
 * Tests: requireAuth helper — 100% coverage target
 *
 * Paths:
 *  1. No user → 401
 *  2. role=authenticated + user → success
 *  3. role=superadmin + not superadmin → 403
 *  4. role=superadmin + superadmin → success
 *  5. role=admin_tenant + superadmin → success (bypass)
 *  6. role=admin_tenant + no tenantId → 403
 *  7. role=admin_tenant + tenantId + role=none → 403
 *  8. role=admin_tenant + tenantId + role=admin → success
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de auth service
const mockGetCurrentUser = vi.fn();
const mockIsSuperAdmin = vi.fn();
const mockGetUserTenantRole = vi.fn();

vi.mock('@/lib/services/auth', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  isSuperAdmin: (id: string) => mockIsSuperAdmin(id),
  getUserTenantRole: (userId: string, tenantId: string) => mockGetUserTenantRole(userId, tenantId),
}));

import { requireAuth } from '@/lib/services/requireAuth';

const fakeRequest = new Request('http://localhost/api/test');
const fakeUser = { id: 'user-1', email: 'test@test.com' };

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Path 1: No user → 401 ──
  it('throws 401 when no user is authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    try {
      await requireAuth(fakeRequest);
      expect.fail('Should have thrown');
    } catch (response: unknown) {
      // requireAuth throws a NextResponse
      expect(response).toBeDefined();
      const res = response as Response;
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toContain('No autenticado');
    }
  });

  // ── Path 2: role=authenticated + user → success ──
  it('returns user when only authentication is required (default)', async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser);

    const result = await requireAuth(fakeRequest);
    expect(result.user.id).toBe('user-1');
    expect(result.role).toBe('authenticated');
  });

  it('returns user when role=authenticated is explicit', async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser);

    const result = await requireAuth(fakeRequest, { role: 'authenticated' });
    expect(result.user.id).toBe('user-1');
    expect(result.role).toBe('authenticated');
  });

  // ── Path 3: role=superadmin + not superadmin → 403 ──
  it('throws 403 when superadmin required but user is not', async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser);
    mockIsSuperAdmin.mockResolvedValue(false);

    try {
      await requireAuth(fakeRequest, { role: 'superadmin' });
      expect.fail('Should have thrown');
    } catch (response: unknown) {
      const res = response as Response;
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('superadmin');
    }
  });

  // ── Path 4: role=superadmin + superadmin → success ──
  it('returns user with superadmin role', async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser);
    mockIsSuperAdmin.mockResolvedValue(true);

    const result = await requireAuth(fakeRequest, { role: 'superadmin' });
    expect(result.user.id).toBe('user-1');
    expect(result.role).toBe('superadmin');
  });

  // ── Path 5: role=admin_tenant + superadmin → bypass ──
  it('allows superadmin as admin_tenant (bypass)', async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser);
    mockIsSuperAdmin.mockResolvedValue(true);

    const result = await requireAuth(fakeRequest, { role: 'admin_tenant', tenantId: 'tenant-1' });
    expect(result.role).toBe('superadmin');
    expect(result.tenantId).toBe('tenant-1');
  });

  // ── Path 6: role=admin_tenant + no tenantId → 403 ──
  it('throws 403 when admin_tenant required but no tenantId', async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser);
    mockIsSuperAdmin.mockResolvedValue(false);

    try {
      await requireAuth(fakeRequest, { role: 'admin_tenant' });
      expect.fail('Should have thrown');
    } catch (response: unknown) {
      const res = response as Response;
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('tenantId');
    }
  });

  // ── Path 7: role=admin_tenant + tenantId + role=none → 403 ──
  it('throws 403 when user is not admin of specific tenant', async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser);
    mockIsSuperAdmin.mockResolvedValue(false);
    mockGetUserTenantRole.mockResolvedValue('none');

    try {
      await requireAuth(fakeRequest, { role: 'admin_tenant', tenantId: 'tenant-1' });
      expect.fail('Should have thrown');
    } catch (response: unknown) {
      const res = response as Response;
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('no es admin');
    }
  });

  // ── Path 8: role=admin_tenant + tenantId + role=admin → success ──
  it('returns admin_tenant when user is admin of tenant', async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser);
    mockIsSuperAdmin.mockResolvedValue(false);
    mockGetUserTenantRole.mockResolvedValue('admin');

    const result = await requireAuth(fakeRequest, { role: 'admin_tenant', tenantId: 'tenant-1' });
    expect(result.user.id).toBe('user-1');
    expect(result.role).toBe('admin_tenant');
    expect(result.tenantId).toBe('tenant-1');
  });
});
