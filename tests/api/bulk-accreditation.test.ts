/**
 * Tests: API /api/bulk-accreditation — Optimized batch accreditation
 *
 * Validates HTTP layer: validation, auth, deadline, profile batch ops,
 * zone resolution, RPC registration, and response shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Service mocks ──
const mockGetEventById = vi.fn();
const mockGetCurrentUser = vi.fn();
const mockIsSuperAdmin = vi.fn();
const mockGetProfileByUserId = vi.fn();
const mockLogAuditAction = vi.fn();

vi.mock('@/lib/services', () => ({
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

vi.mock('@/lib/dates', () => ({
  isAccreditationClosed: (config: Record<string, unknown> | null, fecha: string | null) => {
    if (fecha === 'PAST') return { closed: true, reason: 'Plazo cerrado' };
    if (config?.acreditacion_abierta === true) return { closed: false, reason: 'Abierto' };
    return { closed: false, reason: '' };
  },
}));

// ── Supabase mock (table-aware) ──
const mockRpc = vi.fn();
let profileStore: { id: string; rut: string; user_id: string | null }[] = [];
let zoneRulesStore: { cargo: string; zona: string; match_field: string }[] = [];

/**
 * Creates a smart from() mock that returns correct chains based on table name.
 * Profiles table supports: select().in(), upsert().select(), update().eq()
 * event_zone_rules table supports: select().eq()
 */
function createFromMock() {
  return vi.fn((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [...profileStore] }),
        }),
        upsert: vi.fn().mockImplementation((rows: { rut: string; nombre: string }[]) => {
          // Simulate upsert: add to store and return
          const created = rows.map((r, i) => {
            const existing = profileStore.find(p => p.rut === r.rut);
            if (existing) return { id: existing.id, rut: existing.rut };
            const newProfile = { id: `auto-prof-${Date.now()}-${i}`, rut: r.rut, user_id: null };
            profileStore.push(newProfile);
            return { id: newProfile.id, rut: newProfile.rut };
          });
          return {
            select: vi.fn().mockResolvedValue({ data: created, error: null }),
          };
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    if (table === 'event_zone_rules') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [...zoneRulesStore] }),
        }),
      };
    }
    // fallback
    return {
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [] }),
        eq: vi.fn().mockResolvedValue({ data: null }),
      }),
    };
  });
}

const mockFrom = createFromMock();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => mockFrom(table),
    rpc: (fn: string, params: Record<string, unknown>) => mockRpc(fn, params),
  }),
}));

import { POST } from '@/app/api/bulk-accreditation/route';

// ── Helpers ──
function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/bulk-accreditation', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_EVENT = {
  id: 'evt-1',
  tenant_id: 'tenant-1',
  fecha_limite_acreditacion: null,
  config: {},
  form_fields: [],
};

function makeRow(rut: string, nombre: string, apellido: string, extra: Record<string, string> = {}) {
  return { rut, nombre, apellido, ...extra };
}

describe('POST /api/bulk-accreditation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(null);
    mockIsSuperAdmin.mockResolvedValue(false);
    mockGetEventById.mockResolvedValue(null);
    mockLogAuditAction.mockResolvedValue(undefined);
    // Reset stores
    profileStore = [];
    zoneRulesStore = [];
  });

  // ── Validation ──

  it('returns 400 when event_id is missing', async () => {
    const req = makeRequest({ rows: [makeRow('1-9', 'A', 'B')] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('event_id');
  });

  it('returns 400 when rows is empty', async () => {
    const req = makeRequest({ event_id: 'evt-1', rows: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('array');
  });

  it('returns 400 when rows exceeds 2000', async () => {
    const rows = Array.from({ length: 2001 }, (_, i) => makeRow(`${i}-K`, 'N', 'A'));
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('2000');
  });

  it('returns 404 when event not found', async () => {
    mockGetEventById.mockResolvedValue(null);
    const req = makeRequest({ event_id: 'evt-missing', rows: [makeRow('1-9', 'A', 'B')] });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 403 when accreditation is closed', async () => {
    mockGetEventById.mockResolvedValue({
      ...VALID_EVENT,
      fecha_limite_acreditacion: 'PAST',
    });
    const req = makeRequest({ event_id: 'evt-1', rows: [makeRow('1-9', 'A', 'B')] });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('cerrado');
  });

  // ── Row validation ──

  it('marks rows with missing required fields as errors', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);

    const rows = [
      { rut: '', nombre: 'Juan', apellido: 'Pérez' },
      { rut: '1-9', nombre: '', apellido: 'Pérez' },
      { rut: '1-9', nombre: 'Juan', apellido: '' },
    ];
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.success).toBe(0);
    expect(body.errors).toBe(3);
    body.results.forEach((r: { ok: boolean; error: string }) => {
      expect(r.ok).toBe(false);
      expect(r.error).toContain('Faltan campos requeridos');
    });
  });

  // ── Success flow ──

  it('processes valid rows with existing profiles via RPC', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [
      { id: 'prof-1', rut: '11111111-1', user_id: null },
      { id: 'prof-2', rut: '22222222-2', user_id: null },
    ];

    mockRpc
      .mockResolvedValueOnce({ data: 'reg-1', error: null })
      .mockResolvedValueOnce({ data: 'reg-2', error: null });

    const rows = [
      makeRow('11111111-1', 'Juan', 'Pérez'),
      makeRow('22222222-2', 'María', 'López'),
    ];
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.success).toBe(2);
    expect(body.errors).toBe(0);
    expect(body.results).toHaveLength(2);
    expect(body.results[0].ok).toBe(true);
    expect(body.results[1].ok).toBe(true);
  });

  it('creates new profiles via upsert for unknown RUTs', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    // No existing profiles — will trigger upsert
    profileStore = [];

    mockRpc.mockResolvedValueOnce({ data: 'reg-1', error: null });

    const rows = [makeRow('99999999-9', 'Nuevo', 'Periodista')];
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(1);
    // Profile was auto-created in the store by upsert mock
    expect(profileStore).toHaveLength(1);
    expect(profileStore[0].rut).toBe('99999999-9');
  });

  it('handles RPC errors gracefully (partial success)', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [
      { id: 'prof-1', rut: '11111111-1', user_id: null },
      { id: 'prof-2', rut: '22222222-2', user_id: null },
    ];

    mockRpc
      .mockResolvedValueOnce({ data: 'reg-1', error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Duplicate registration' } });

    const rows = [
      makeRow('11111111-1', 'Juan', 'Pérez'),
      makeRow('22222222-2', 'María', 'López'),
    ];
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.success).toBe(1);
    expect(body.errors).toBe(1);
    expect(body.results.find((r: { rut: string }) => r.rut === '22222222-2').error).toContain('Duplicate');
  });

  it('mixes valid and invalid rows correctly', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];

    mockRpc.mockResolvedValueOnce({ data: 'reg-1', error: null });

    const rows = [
      makeRow('', 'Bad', 'Row'), // invalid: no rut
      makeRow('11111111-1', 'Juan', 'Pérez'), // valid
    ];
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.success).toBe(1);
    expect(body.errors).toBe(1);
    expect(body.results[0].row).toBe(1);
    expect(body.results[0].ok).toBe(false);
    expect(body.results[1].row).toBe(2);
    expect(body.results[1].ok).toBe(true);
  });

  // ── Auth: superadmin does NOT link profile ──

  it('superadmin does not set submitterProfileId', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-uid' });
    mockIsSuperAdmin.mockResolvedValue(true);
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];

    mockRpc.mockResolvedValueOnce({ data: 'reg-1', error: null });

    const rows = [makeRow('11111111-1', 'Juan', 'Pérez')];
    const req = makeRequest({ event_id: 'evt-1', rows });
    await POST(req);

    expect(mockRpc).toHaveBeenCalledWith(
      'check_and_create_registration',
      expect.objectContaining({
        p_submitted_by: undefined,
      }),
    );
    expect(mockGetProfileByUserId).not.toHaveBeenCalled();
  });

  it('regular user links submitterProfileId', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-uid' });
    mockIsSuperAdmin.mockResolvedValue(false);
    mockGetProfileByUserId.mockResolvedValue({ id: 'user-prof-1' });
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];

    mockRpc.mockResolvedValueOnce({ data: 'reg-1', error: null });

    const rows = [makeRow('11111111-1', 'Juan', 'Pérez')];
    const req = makeRequest({ event_id: 'evt-1', rows });
    await POST(req);

    expect(mockRpc).toHaveBeenCalledWith(
      'check_and_create_registration',
      expect.objectContaining({
        p_submitted_by: 'user-prof-1',
      }),
    );
  });

  // ── Zone resolution ──

  it('resolves zone from cargo rule locally', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];
    zoneRulesStore = [{ cargo: 'Periodista', zona: 'Prensa', match_field: 'cargo' }];

    mockRpc.mockResolvedValueOnce({ data: 'reg-1', error: null });

    const rows = [makeRow('11111111-1', 'Juan', 'Pérez', { cargo: 'Periodista' })];
    const req = makeRequest({ event_id: 'evt-1', rows });
    await POST(req);

    expect(mockRpc).toHaveBeenCalledWith(
      'check_and_create_registration',
      expect.objectContaining({
        p_datos_extra: expect.objectContaining({ zona: 'Prensa' }),
      }),
    );
  });

  it('resolves zone from tipo_medio when cargo has no match', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];
    zoneRulesStore = [{ cargo: 'TV', zona: 'Media', match_field: 'tipo_medio' }];

    mockRpc.mockResolvedValueOnce({ data: 'reg-1', error: null });

    const rows = [makeRow('11111111-1', 'Juan', 'Pérez', { tipo_medio: 'TV', cargo: 'Unknown' })];
    const req = makeRequest({ event_id: 'evt-1', rows });
    await POST(req);

    expect(mockRpc).toHaveBeenCalledWith(
      'check_and_create_registration',
      expect.objectContaining({
        p_datos_extra: expect.objectContaining({ zona: 'Media' }),
      }),
    );
  });

  // ── Datos extra ──

  it('passes extra fields as datos_extra', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];

    mockRpc.mockResolvedValueOnce({ data: 'reg-1', error: null });

    const rows = [makeRow('11111111-1', 'Juan', 'Pérez', {
      patente: 'AB-1234',
      vehiculo: 'Sedan',
    })];
    const req = makeRequest({ event_id: 'evt-1', rows });
    await POST(req);

    expect(mockRpc).toHaveBeenCalledWith(
      'check_and_create_registration',
      expect.objectContaining({
        p_datos_extra: expect.objectContaining({
          patente: 'AB-1234',
          vehiculo: 'Sedan',
        }),
      }),
    );
  });

  // ── Duplicate RUTs in same batch ──

  it('deduplicates profiles for repeated RUTs in same batch', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];

    mockRpc
      .mockResolvedValueOnce({ data: 'reg-1', error: null })
      .mockResolvedValueOnce({ data: 'reg-2', error: null });

    const rows = [
      makeRow('11111111-1', 'Juan', 'Pérez'),
      makeRow('11111111-1', 'Juan', 'Pérez'),
    ];
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(2);
  });

  // ── Audit ──

  it('logs a single audit entry for the entire batch', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-uid' });
    mockIsSuperAdmin.mockResolvedValue(true);
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];

    mockRpc.mockResolvedValueOnce({ data: 'reg-1', error: null });

    const rows = [makeRow('11111111-1', 'Juan', 'Pérez')];
    const req = makeRequest({ event_id: 'evt-1', rows });
    await POST(req);

    expect(mockLogAuditAction).toHaveBeenCalledTimes(1);
    expect(mockLogAuditAction).toHaveBeenCalledWith(
      'admin-uid',
      'registration.bulk_created',
      'event',
      'evt-1',
      expect.objectContaining({
        total: 1,
        success: 1,
        errors: 0,
      }),
    );
  });
});
