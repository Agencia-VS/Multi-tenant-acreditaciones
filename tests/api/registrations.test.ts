/**
 * Tests: API /api/registrations — HTTP layer (validation, auth, status codes)
 *
 * Mocks the service layer to isolate the route handler logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──
const mockGetCurrentUser = vi.fn();
const mockIsSuperAdmin = vi.fn();
const mockGetProfileByUserId = vi.fn();
const mockCreateRegistration = vi.fn();
const mockGetEventById = vi.fn();
const mockListRegistrations = vi.fn();
const mockLogAuditAction = vi.fn();
const mockRequireAuth = vi.fn();

vi.mock('@/lib/services', () => ({
  createRegistration: (...args: unknown[]) => mockCreateRegistration(...args),
  listRegistrations: (...args: unknown[]) => mockListRegistrations(...args),
  getEventById: (...args: unknown[]) => mockGetEventById(...args),
}));

vi.mock('@/lib/services/auth', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  isSuperAdmin: (...args: unknown[]) => mockIsSuperAdmin(...args),
}));

vi.mock('@/lib/services/profiles', () => ({
  getProfileByUserId: (...args: unknown[]) => mockGetProfileByUserId(...args),
}));

vi.mock('@/lib/services/audit', () => ({
  logAuditAction: (...args: unknown[]) => mockLogAuditAction(...args),
}));

vi.mock('@/lib/services/requireAuth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock('@/lib/dates', () => ({
  isDeadlinePast: (d: string) => d === 'PAST',
}));

import { POST, GET } from '@/app/api/registrations/route';

function makeRequest(body: Record<string, unknown>, method = 'POST'): NextRequest {
  return new NextRequest('http://localhost/api/registrations', {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/registrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(null);
    mockIsSuperAdmin.mockResolvedValue(false);
    mockGetEventById.mockResolvedValue(null);
    mockLogAuditAction.mockResolvedValue(undefined);
  });

  it('returns 400 when event_id is missing', async () => {
    const req = makeRequest({ rut: '12345678-9', nombre: 'Juan', apellido: 'Pérez' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('event_id');
  });

  it('returns 400 when required fields are missing', async () => {
    const req = makeRequest({ event_id: 'evt-1' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('RUT');
  });

  it('returns 403 when event deadline has passed', async () => {
    mockGetEventById.mockResolvedValue({ fecha_limite_acreditacion: 'PAST' });

    const req = makeRequest({
      event_id: 'evt-1',
      rut: '12345678-9',
      nombre: 'Juan',
      apellido: 'Pérez',
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('plazo');
  });

  it('returns 201 on successful registration', async () => {
    mockGetEventById.mockResolvedValue({ fecha_limite_acreditacion: null });
    mockCreateRegistration.mockResolvedValue({
      registration: { id: 'reg-1', status: 'pendiente' },
      profile_id: 'prof-1',
    });

    const req = makeRequest({
      event_id: 'evt-1',
      rut: '12345678-9',
      nombre: 'Juan',
      apellido: 'Pérez',
      organizacion: 'CNN',
      tipo_medio: 'TV',
      cargo: '',
      datos_extra: {},
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.registration.id).toBe('reg-1');
  });

  it('returns 409 when duplicate registration', async () => {
    mockGetEventById.mockResolvedValue(null);
    mockCreateRegistration.mockRejectedValue(new Error('Esta persona ya está registrada'));

    const req = makeRequest({
      event_id: 'evt-1',
      rut: '12345678-9',
      nombre: 'Juan',
      apellido: 'Pérez',
      organizacion: '',
      tipo_medio: '',
      cargo: '',
      datos_extra: {},
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it('resolves authenticated non-admin user profile for submitted_by', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'u@t.com' });
    mockIsSuperAdmin.mockResolvedValue(false);
    mockGetProfileByUserId.mockResolvedValue({ id: 'prof-1' });
    mockGetEventById.mockResolvedValue(null);
    mockCreateRegistration.mockResolvedValue({
      registration: { id: 'reg-2' },
      profile_id: 'prof-1',
    });

    const req = makeRequest({
      event_id: 'evt-1',
      rut: '12345678-9',
      nombre: 'Juan',
      apellido: 'Pérez',
      organizacion: '',
      tipo_medio: '',
      cargo: '',
      datos_extra: {},
    });
    await POST(req);

    // createRegistration should have been called with submitterProfileId
    expect(mockCreateRegistration).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ rut: '12345678-9' }),
      'prof-1', // submitterProfileId
      'user-1', // authUserId
      undefined, // eventHint (event was null)
    );
  });
});

describe('GET /api/registrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires auth — delegates to requireAuth', async () => {
    mockRequireAuth.mockResolvedValue({ user: { id: 'u-1' }, role: 'admin_tenant' });
    mockListRegistrations.mockResolvedValue({ data: [], count: 0 });

    const req = new NextRequest('http://localhost/api/registrations?tenant_id=t-1&event_id=evt-1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockRequireAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ role: 'admin_tenant', tenantId: 't-1' }),
    );
  });

  it('returns 403 when requireAuth throws', async () => {
    const { NextResponse } = await import('next/server');
    mockRequireAuth.mockRejectedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );

    const req = new NextRequest('http://localhost/api/registrations?tenant_id=t-1');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});
