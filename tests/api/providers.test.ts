/**
 * Tests: API /api/providers — HTTP layer (auth, validation, status codes)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ── Mocks ──
const mockListProvidersByTenant = vi.fn();
const mockGetProviderStats = vi.fn();
const mockGetProviderById = vi.fn();
const mockCreateProviderRequest = vi.fn();
const mockApproveProvider = vi.fn();
const mockRejectProvider = vi.fn();
const mockSuspendProvider = vi.fn();
const mockUpdateProviderZones = vi.fn();
const mockDeleteProvider = vi.fn();
const mockListProvidersByProfile = vi.fn();
const mockGenerateInviteCode = vi.fn();
const mockValidateInviteCode = vi.fn();
const mockToggleProviderMode = vi.fn();
const mockLogAuditAction = vi.fn();
const mockRequireAuth = vi.fn();
const mockGetProfileByUserId = vi.fn();
const mockGetTenantById = vi.fn();

vi.mock('@/lib/services', () => ({
  listProvidersByTenant: (...args: unknown[]) => mockListProvidersByTenant(...args),
  getProviderStats: (...args: unknown[]) => mockGetProviderStats(...args),
  getProviderById: (...args: unknown[]) => mockGetProviderById(...args),
  createProviderRequest: (...args: unknown[]) => mockCreateProviderRequest(...args),
  approveProvider: (...args: unknown[]) => mockApproveProvider(...args),
  rejectProvider: (...args: unknown[]) => mockRejectProvider(...args),
  suspendProvider: (...args: unknown[]) => mockSuspendProvider(...args),
  updateProviderZones: (...args: unknown[]) => mockUpdateProviderZones(...args),
  deleteProvider: (...args: unknown[]) => mockDeleteProvider(...args),
  listProvidersByProfile: (...args: unknown[]) => mockListProvidersByProfile(...args),
  generateInviteCode_forTenant: (...args: unknown[]) => mockGenerateInviteCode(...args),
  validateInviteCode: (...args: unknown[]) => mockValidateInviteCode(...args),
  toggleProviderMode: (...args: unknown[]) => mockToggleProviderMode(...args),
  logAuditAction: (...args: unknown[]) => mockLogAuditAction(...args),
  getProfileByUserId: (...args: unknown[]) => mockGetProfileByUserId(...args),
  getTenantById: (...args: unknown[]) => mockGetTenantById(...args),
}));

vi.mock('@/lib/services/requireAuth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock('@/lib/services/profiles', () => ({
  getProfileByUserId: (...args: unknown[]) => mockGetProfileByUserId(...args),
}));

vi.mock('@/lib/services/tenants', () => ({
  getTenantById: (...args: unknown[]) => mockGetTenantById(...args),
  getTenantBySlug: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({
        in: () => ({ data: [{ id: 't-1', nombre: 'UC', slug: 'uc', logo_url: null }] }),
      }),
    }),
  }),
}));

// Schemas: no mock needed — use real validation logic

// ── Imports (after mocks) ──
import { GET as listProviders } from '@/app/api/providers/route';
import { POST as requestAccess } from '@/app/api/providers/request/route';
import { PATCH as patchProvider, DELETE as deleteProviderRoute } from '@/app/api/providers/[id]/route';
import { GET as myAccess } from '@/app/api/providers/my-access/route';
import { POST as generateCode } from '@/app/api/providers/invite-code/route';
import { GET as validateCode } from '@/app/api/providers/validate-code/route';
import { POST as toggleModule } from '@/app/api/providers/toggle/route';

// ── Helpers ──
function authOk(userId = 'user-1', role = 'admin_tenant') {
  mockRequireAuth.mockResolvedValue({ user: { id: userId }, role });
}

function authForbidden() {
  mockRequireAuth.mockRejectedValue(
    NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  );
}

function authUnauthorized() {
  mockRequireAuth.mockRejectedValue(
    NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  );
}

const TENANT_ID = '11111111-1111-4111-a111-111111111111';
const PROVIDER_ID = '22222222-2222-4222-a222-222222222222';
const PROFILE_ID = '33333333-3333-4333-a333-333333333333';

// ═══════════════════════════════════════════════════════════════
// GET /api/providers
// ═══════════════════════════════════════════════════════════════
describe('GET /api/providers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when tenant_id is missing', async () => {
    const req = new NextRequest('http://localhost/api/providers');
    const res = await listProviders(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 when user is not admin of tenant', async () => {
    authForbidden();
    const req = new NextRequest(`http://localhost/api/providers?tenant_id=${TENANT_ID}`);
    const res = await listProviders(req);
    expect(res.status).toBe(403);
  });

  it('returns providers list for admin', async () => {
    authOk();
    mockListProvidersByTenant.mockResolvedValue([
      { id: PROVIDER_ID, status: 'pending', profile: { nombre: 'Ana' } },
    ]);

    const req = new NextRequest(`http://localhost/api/providers?tenant_id=${TENANT_ID}`);
    const res = await listProviders(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].status).toBe('pending');
  });

  it('filters by status when provided', async () => {
    authOk();
    mockListProvidersByTenant.mockResolvedValue([]);

    const req = new NextRequest(`http://localhost/api/providers?tenant_id=${TENANT_ID}&status=approved`);
    await listProviders(req);
    expect(mockListProvidersByTenant).toHaveBeenCalledWith(TENANT_ID, 'approved');
  });

  it('returns stats when stats=true', async () => {
    authOk();
    mockGetProviderStats.mockResolvedValue({ total: 5, pending: 2, approved: 3, rejected: 0, suspended: 0 });

    const req = new NextRequest(`http://localhost/api/providers?tenant_id=${TENANT_ID}&stats=true`);
    const res = await listProviders(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(5);
    expect(body.approved).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/providers/request
// ═══════════════════════════════════════════════════════════════
describe('POST /api/providers/request', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    authUnauthorized();
    const req = new NextRequest('http://localhost/api/providers/request', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: TENANT_ID, code: 'ABC123' }),
    });
    const res = await requestAccess(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when code is missing', async () => {
    authOk('user-1', 'authenticated');
    const req = new NextRequest('http://localhost/api/providers/request', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: TENANT_ID }),
    });
    const res = await requestAccess(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when tenant does not exist', async () => {
    authOk('user-1', 'authenticated');
    mockGetTenantById.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/providers/request', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: TENANT_ID, code: 'ABC123' }),
    });
    const res = await requestAccess(req);
    expect(res.status).toBe(404);
  });

  it('returns 403 when invite code is invalid', async () => {
    authOk('user-1', 'authenticated');
    mockGetTenantById.mockResolvedValue({ id: TENANT_ID, slug: 'cruzados' });
    mockValidateInviteCode.mockResolvedValue({ valid: false });

    const req = new NextRequest('http://localhost/api/providers/request', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: TENANT_ID, code: 'BAD_CODE' }),
    });
    const res = await requestAccess(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 when user has no profile', async () => {
    authOk('user-1', 'authenticated');
    mockGetTenantById.mockResolvedValue({ id: TENANT_ID, slug: 'cruzados' });
    mockValidateInviteCode.mockResolvedValue({ valid: true, tenantId: TENANT_ID });
    mockGetProfileByUserId.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/providers/request', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: TENANT_ID, code: 'VALID01' }),
    });
    const res = await requestAccess(req);
    expect(res.status).toBe(400);
  });

  it('returns 201 on successful request', async () => {
    authOk('user-1', 'authenticated');
    mockGetTenantById.mockResolvedValue({ id: TENANT_ID, slug: 'cruzados' });
    mockValidateInviteCode.mockResolvedValue({ valid: true, tenantId: TENANT_ID });
    mockGetProfileByUserId.mockResolvedValue({ id: PROFILE_ID });
    mockCreateProviderRequest.mockResolvedValue({
      id: PROVIDER_ID,
      tenant_id: TENANT_ID,
      profile_id: PROFILE_ID,
      status: 'pending',
    });

    const req = new NextRequest('http://localhost/api/providers/request', {
      method: 'POST',
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        code: 'VALID01',
        organizacion: 'Mi Empresa',
        mensaje: 'Solicito acceso',
      }),
    });
    const res = await requestAccess(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('pending');
  });
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/providers/[id]
// ═══════════════════════════════════════════════════════════════
describe('PATCH /api/providers/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it('returns 404 when provider does not exist', async () => {
    mockGetProviderById.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/providers/xxx', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve', allowed_zones: ['VIP'] }),
    });
    const res = await patchProvider(req, makeParams(PROVIDER_ID));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not admin of provider tenant', async () => {
    mockGetProviderById.mockResolvedValue({ id: PROVIDER_ID, tenant_id: TENANT_ID });
    authForbidden();

    const req = new NextRequest('http://localhost/api/providers/xxx', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve', allowed_zones: ['VIP'] }),
    });
    const res = await patchProvider(req, makeParams(PROVIDER_ID));
    expect(res.status).toBe(403);
  });

  it('approves provider with zones', async () => {
    mockGetProviderById.mockResolvedValue({ id: PROVIDER_ID, tenant_id: TENANT_ID });
    authOk();
    mockApproveProvider.mockResolvedValue({ id: PROVIDER_ID, status: 'approved', allowed_zones: ['VIP', 'Prensa'] });

    const req = new NextRequest('http://localhost/api/providers/xxx', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve', allowed_zones: ['VIP', 'Prensa'] }),
    });
    const res = await patchProvider(req, makeParams(PROVIDER_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('approved');
    expect(mockApproveProvider).toHaveBeenCalledWith(PROVIDER_ID, {
      allowedZones: ['VIP', 'Prensa'],
      notas: undefined,
      approvedBy: 'user-1',
    });
  });

  it('returns 400 when approving without zones', async () => {
    mockGetProviderById.mockResolvedValue({ id: PROVIDER_ID, tenant_id: TENANT_ID });
    authOk();

    const req = new NextRequest('http://localhost/api/providers/xxx', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve', allowed_zones: [] }),
    });
    const res = await patchProvider(req, makeParams(PROVIDER_ID));
    expect(res.status).toBe(400);
  });

  it('rejects provider with motivo', async () => {
    mockGetProviderById.mockResolvedValue({ id: PROVIDER_ID, tenant_id: TENANT_ID });
    authOk();
    mockRejectProvider.mockResolvedValue({ id: PROVIDER_ID, status: 'rejected' });

    const req = new NextRequest('http://localhost/api/providers/xxx', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject', motivo: 'No cumple requisitos' }),
    });
    const res = await patchProvider(req, makeParams(PROVIDER_ID));
    expect(res.status).toBe(200);
    expect(mockRejectProvider).toHaveBeenCalledWith(PROVIDER_ID, 'No cumple requisitos');
  });

  it('suspends provider', async () => {
    mockGetProviderById.mockResolvedValue({ id: PROVIDER_ID, tenant_id: TENANT_ID });
    authOk();
    mockSuspendProvider.mockResolvedValue({ id: PROVIDER_ID, status: 'suspended' });

    const req = new NextRequest('http://localhost/api/providers/xxx', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'suspend' }),
    });
    const res = await patchProvider(req, makeParams(PROVIDER_ID));
    expect(res.status).toBe(200);
    expect(mockSuspendProvider).toHaveBeenCalledWith(PROVIDER_ID);
  });

  it('updates zones', async () => {
    mockGetProviderById.mockResolvedValue({ id: PROVIDER_ID, tenant_id: TENANT_ID });
    authOk();
    mockUpdateProviderZones.mockResolvedValue({ id: PROVIDER_ID, allowed_zones: ['Cancha'] });

    const req = new NextRequest('http://localhost/api/providers/xxx', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'update_zones', allowed_zones: ['Cancha'] }),
    });
    const res = await patchProvider(req, makeParams(PROVIDER_ID));
    expect(res.status).toBe(200);
    expect(mockUpdateProviderZones).toHaveBeenCalledWith(PROVIDER_ID, ['Cancha']);
  });

  it('returns 400 for invalid action', async () => {
    mockGetProviderById.mockResolvedValue({ id: PROVIDER_ID, tenant_id: TENANT_ID });
    authOk();

    const req = new NextRequest('http://localhost/api/providers/xxx', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'invalid_action' }),
    });
    const res = await patchProvider(req, makeParams(PROVIDER_ID));
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/providers/[id]
// ═══════════════════════════════════════════════════════════════
describe('DELETE /api/providers/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it('returns 404 when provider does not exist', async () => {
    mockGetProviderById.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/providers/xxx', { method: 'DELETE' });
    const res = await deleteProviderRoute(req, makeParams(PROVIDER_ID));
    expect(res.status).toBe(404);
  });

  it('deletes provider successfully', async () => {
    mockGetProviderById.mockResolvedValue({ id: PROVIDER_ID, tenant_id: TENANT_ID, profile_id: PROFILE_ID });
    authOk();
    mockDeleteProvider.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/providers/xxx', { method: 'DELETE' });
    const res = await deleteProviderRoute(req, makeParams(PROVIDER_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockDeleteProvider).toHaveBeenCalledWith(PROVIDER_ID);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/providers/my-access
// ═══════════════════════════════════════════════════════════════
describe('GET /api/providers/my-access', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    authUnauthorized();
    const req = new NextRequest('http://localhost/api/providers/my-access');
    const res = await myAccess(req);
    expect(res.status).toBe(401);
  });

  it('returns empty array when user has no profile', async () => {
    authOk('user-1', 'authenticated');
    mockGetProfileByUserId.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/providers/my-access');
    const res = await myAccess(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns providers with tenant data', async () => {
    authOk('user-1', 'authenticated');
    mockGetProfileByUserId.mockResolvedValue({ id: PROFILE_ID });
    mockListProvidersByProfile.mockResolvedValue([
      { id: PROVIDER_ID, tenant_id: 't-1', status: 'approved', allowed_zones: ['VIP'] },
    ]);

    const req = new NextRequest('http://localhost/api/providers/my-access');
    const res = await myAccess(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].tenant).toBeTruthy();
    expect(body[0].tenant.nombre).toBe('UC');
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/providers/invite-code
// ═══════════════════════════════════════════════════════════════
describe('POST /api/providers/invite-code', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 when not admin of tenant', async () => {
    authForbidden();
    const req = new NextRequest('http://localhost/api/providers/invite-code', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: TENANT_ID }),
    });
    const res = await generateCode(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid tenant_id', async () => {
    authOk();
    const req = new NextRequest('http://localhost/api/providers/invite-code', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: 'not-a-uuid' }),
    });
    const res = await generateCode(req);
    expect(res.status).toBe(400);
  });

  it('generates invite code successfully', async () => {
    authOk();
    mockGenerateInviteCode.mockResolvedValue('Abc12345');

    const req = new NextRequest('http://localhost/api/providers/invite-code', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: TENANT_ID }),
    });
    const res = await generateCode(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe('Abc12345');
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/providers/validate-code
// ═══════════════════════════════════════════════════════════════
describe('GET /api/providers/validate-code', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when slug or code is missing', async () => {
    const req = new NextRequest('http://localhost/api/providers/validate-code');
    const res = await validateCode(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 for invalid code', async () => {
    mockValidateInviteCode.mockResolvedValue({ valid: false });

    const req = new NextRequest('http://localhost/api/providers/validate-code?slug=cruzados&code=BAD');
    const res = await validateCode(req);
    expect(res.status).toBe(404);
  });

  it('returns tenant info for valid code', async () => {
    mockValidateInviteCode.mockResolvedValue({
      valid: true,
      tenantId: TENANT_ID,
      tenantNombre: 'Cruzados',
      tenantLogo: 'https://example.com/logo.png',
      tenantDescription: 'Bienvenido a Cruzados',
    });

    const req = new NextRequest('http://localhost/api/providers/validate-code?slug=cruzados&code=VALID01');
    const res = await validateCode(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.tenant_nombre).toBe('Cruzados');
    expect(body.tenant_logo).toBe('https://example.com/logo.png');
    // tenantId should NOT be exposed in public endpoint
    expect(body.tenantId).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/providers/toggle
// ═══════════════════════════════════════════════════════════════
describe('POST /api/providers/toggle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 when not superadmin', async () => {
    authForbidden();
    const req = new NextRequest('http://localhost/api/providers/toggle', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: TENANT_ID, enabled: true }),
    });
    const res = await toggleModule(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid payload', async () => {
    authOk('sa-1', 'superadmin');
    const req = new NextRequest('http://localhost/api/providers/toggle', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: 'bad', enabled: 'yes' }),
    });
    const res = await toggleModule(req);
    expect(res.status).toBe(400);
  });

  it('enables provider module', async () => {
    authOk('sa-1', 'superadmin');
    mockToggleProviderMode.mockResolvedValue({
      provider_mode: 'approved_only',
      provider_invite_code: 'CODE1234',
    });

    const req = new NextRequest('http://localhost/api/providers/toggle', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: TENANT_ID, enabled: true }),
    });
    const res = await toggleModule(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider_mode).toBe('approved_only');
    expect(body.provider_invite_code).toBe('CODE1234');
  });

  it('disables provider module', async () => {
    authOk('sa-1', 'superadmin');
    mockToggleProviderMode.mockResolvedValue({ provider_mode: 'open' });

    const req = new NextRequest('http://localhost/api/providers/toggle', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: TENANT_ID, enabled: false }),
    });
    const res = await toggleModule(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider_mode).toBe('open');
  });
});

// ═══════════════════════════════════════════════════════════════
// Schema validation tests
// ═══════════════════════════════════════════════════════════════
describe('Provider Zod schemas', () => {
  it('providerRequestSchema validates correct input', async () => {
    const { providerRequestSchema, safeParse } = await import('@/lib/schemas');
    const result = safeParse(providerRequestSchema, {
      tenant_id: TENANT_ID,
      code: 'ABC12345',
      organizacion: 'Mi Empresa',
      mensaje: 'Solicito acceso',
    });
    expect(result.success).toBe(true);
  });

  it('providerRequestSchema rejects missing code', async () => {
    const { providerRequestSchema, safeParse } = await import('@/lib/schemas');
    const result = safeParse(providerRequestSchema, { tenant_id: TENANT_ID });
    expect(result.success).toBe(false);
  });

  it('providerApproveSchema rejects empty zones', async () => {
    const { providerApproveSchema, safeParse } = await import('@/lib/schemas');
    const result = safeParse(providerApproveSchema, { allowed_zones: [] });
    expect(result.success).toBe(false);
  });

  it('providerToggleSchema validates boolean enabled', async () => {
    const { providerToggleSchema, safeParse } = await import('@/lib/schemas');
    const result = safeParse(providerToggleSchema, { tenant_id: TENANT_ID, enabled: true });
    expect(result.success).toBe(true);
  });

  it('providerToggleSchema rejects non-boolean enabled', async () => {
    const { providerToggleSchema, safeParse } = await import('@/lib/schemas');
    const result = safeParse(providerToggleSchema, { tenant_id: TENANT_ID, enabled: 'yes' });
    expect(result.success).toBe(false);
  });
});
