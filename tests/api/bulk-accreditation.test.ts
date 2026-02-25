/**
 * Tests: API /api/bulk-accreditation — Bulk RPC v2
 *
 * Validates HTTP layer: validation, auth, deadline, profile batch ops,
 * zone resolution, single bulk RPC registration, and response shape.
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
let profileStore: { id: string; rut: string | null; user_id: string | null; document_type?: string; document_normalized?: string }[] = [];
let zoneRulesStore: { cargo: string; zona: string; match_field: string }[] = [];
let registrationStore: { profile_id: string }[] = [];
let registrationEmailStore: string[] = [];

/**
 * Creates a smart from() mock that returns correct chains based on table name.
 */
function createFromMock() {
  return vi.fn((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [...profileStore] }),
        }),
        upsert: vi.fn().mockImplementation((rows: Array<{ rut?: string | null; nombre: string; document_type?: string; document_normalized?: string }>) => {
          const created = rows.map((r, i) => {
            const existing = profileStore.find(
              p => (r.document_type && r.document_normalized)
                ? p.document_type === r.document_type && p.document_normalized === r.document_normalized
                : p.rut === (r.rut ?? null)
            );
            if (existing) return { id: existing.id, rut: existing.rut };
            const newProfile = {
              id: `auto-prof-${Date.now()}-${i}`,
              rut: r.rut ?? null,
              user_id: null,
              document_type: r.document_type,
              document_normalized: r.document_normalized,
            };
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
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockImplementation((_col: string, ids: string[]) => {
            profileStore = profileStore.filter(p => !ids.includes(p.id));
            return Promise.resolve({ error: null });
          }),
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
    if (table === 'registrations') {
      return {
        select: vi.fn().mockImplementation((columns: string) => {
          if (columns === 'email_snapshot') {
            return {
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockResolvedValue({
                  data: registrationEmailStore.map(email => ({ email_snapshot: email })),
                }),
              }),
            };
          }
          return {
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockImplementation((_col: string, ids: string[]) => {
                const matched = registrationStore.filter(r => ids.includes(r.profile_id));
                return Promise.resolve({ data: matched });
              }),
            }),
          };
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };
    }
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

/**
 * Helper: configure mockRpc to simulate bulk_check_and_create_registrations.
 */
function mockBulkRpcSuccess(rowResults: Array<{ row_index: number; ok: boolean; error?: string; reg_id?: string }>) {
  mockRpc.mockResolvedValueOnce({ data: rowResults, error: null });
}

function mockBulkRpcError(message: string) {
  mockRpc.mockResolvedValueOnce({ data: null, error: { message } });
}

describe('POST /api/bulk-accreditation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(null);
    mockIsSuperAdmin.mockResolvedValue(false);
    mockGetEventById.mockResolvedValue(null);
    mockLogAuditAction.mockResolvedValue(undefined);
    profileStore = [];
    zoneRulesStore = [];
    registrationStore = [];
    registrationEmailStore = [];
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

  // ── Success flow (single bulk RPC) ──

  it('processes valid rows via single bulk RPC call', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [
      { id: 'prof-1', rut: '11111111-1', user_id: null },
      { id: 'prof-2', rut: '22222222-2', user_id: null },
    ];

    mockBulkRpcSuccess([
      { row_index: 0, ok: true, reg_id: 'reg-1' },
      { row_index: 1, ok: true, reg_id: 'reg-2' },
    ]);

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

    // Verify single RPC call (not N calls)
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      'bulk_check_and_create_registrations',
      expect.objectContaining({
        p_event_id: 'evt-1',
      }),
    );
  });

  it('sends all rows in a single RPC payload', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [
      { id: 'prof-1', rut: '11111111-1', user_id: null },
      { id: 'prof-2', rut: '22222222-2', user_id: null },
      { id: 'prof-3', rut: '33333333-3', user_id: null },
    ];

    mockBulkRpcSuccess([
      { row_index: 0, ok: true, reg_id: 'reg-1' },
      { row_index: 1, ok: true, reg_id: 'reg-2' },
      { row_index: 2, ok: true, reg_id: 'reg-3' },
    ]);

    const rows = [
      makeRow('11111111-1', 'A', 'B'),
      makeRow('22222222-2', 'C', 'D'),
      makeRow('33333333-3', 'E', 'F'),
    ];
    const req = makeRequest({ event_id: 'evt-1', rows });
    await POST(req);

    // Verify the RPC received 3 rows in a single call
    const rpcCall = mockRpc.mock.calls[0];
    expect(rpcCall[0]).toBe('bulk_check_and_create_registrations');
    const payload = rpcCall[1].p_rows as Array<{ profile_id: string }>;
    expect(payload).toHaveLength(3);
  });

  it('creates new profiles via upsert for unknown RUTs', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [];

    mockBulkRpcSuccess([{ row_index: 0, ok: true, reg_id: 'reg-1' }]);

    const rows = [makeRow('99999999-9', 'Nuevo', 'Periodista')];
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(1);
    expect(profileStore).toHaveLength(1);
    expect(profileStore[0].rut).toBe('99999999-9');
  });

  it('all-or-nothing: when RPC returns per-row error, response fails all', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [
      { id: 'prof-1', rut: '11111111-1', user_id: null },
      { id: 'prof-2', rut: '22222222-2', user_id: null },
    ];

    mockBulkRpcSuccess([
      { row_index: 0, ok: true, reg_id: 'reg-1' },
      { row_index: 1, ok: false, error: 'Esta persona ya está registrada en este evento' },
    ]);

    const rows = [
      makeRow('11111111-1', 'Juan', 'Pérez'),
      makeRow('22222222-2', 'María', 'López'),
    ];
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.success).toBe(0);
    expect(body.errors).toBe(2);
    const failed = body.results.find((r: { rut: string }) => r.rut === '22222222-2');
    const blocked = body.results.find((r: { rut: string }) => r.rut === '11111111-1');
    expect(failed.error).toContain('registrada');
    expect(blocked.error).toContain('No se procesó');
  });

  it('handles RPC-level failure (all fail)', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];

    mockBulkRpcError('Connection timeout');

    const rows = [makeRow('11111111-1', 'Juan', 'Pérez')];
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(0);
    expect(body.errors).toBe(1);
    expect(body.results[0].ok).toBe(false);
    expect(body.results[0].error).toContain('Connection timeout');
  });

  it('all-or-nothing: mixes valid and invalid rows — none succeed', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];

    const rows = [
      makeRow('', 'Bad', 'Row'), // invalid: no rut
      makeRow('11111111-1', 'Juan', 'Pérez'), // valid
    ];
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.success).toBe(0);
    expect(body.errors).toBe(2);
    expect(body.results[0].ok).toBe(false);
    expect(body.results[0].error).toContain('Faltan campos requeridos');
    expect(body.results[1].ok).toBe(false);
    expect(body.results[1].error).toContain('No se procesó');
    // RPC should NOT be called
    expect(mockRpc).not.toHaveBeenCalled();
  });

  // ── Auth: superadmin does NOT link profile ──

  it('superadmin does not set submitterProfileId', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-uid' });
    mockIsSuperAdmin.mockResolvedValue(true);
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];

    mockBulkRpcSuccess([{ row_index: 0, ok: true, reg_id: 'reg-1' }]);

    const rows = [makeRow('11111111-1', 'Juan', 'Pérez')];
    const req = makeRequest({ event_id: 'evt-1', rows });
    await POST(req);

    expect(mockRpc).toHaveBeenCalledWith(
      'bulk_check_and_create_registrations',
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

    mockBulkRpcSuccess([{ row_index: 0, ok: true, reg_id: 'reg-1' }]);

    const rows = [makeRow('11111111-1', 'Juan', 'Pérez')];
    const req = makeRequest({ event_id: 'evt-1', rows });
    await POST(req);

    expect(mockRpc).toHaveBeenCalledWith(
      'bulk_check_and_create_registrations',
      expect.objectContaining({
        p_submitted_by: 'user-prof-1',
      }),
    );
  });

  // ── Zone resolution (still happens in JS before RPC) ──

  it('resolves zone from cargo rule locally and includes in datos_extra', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];
    zoneRulesStore = [{ cargo: 'Periodista', zona: 'Prensa', match_field: 'cargo' }];

    mockBulkRpcSuccess([{ row_index: 0, ok: true, reg_id: 'reg-1' }]);

    const rows = [makeRow('11111111-1', 'Juan', 'Pérez', { cargo: 'Periodista' })];
    const req = makeRequest({ event_id: 'evt-1', rows });
    await POST(req);

    const rpcPayload = (mockRpc.mock.calls[0][1].p_rows as Array<{ datos_extra: Record<string, string> }>);
    expect(rpcPayload[0].datos_extra.zona).toBe('Prensa');
  });

  it('resolves zone from tipo_medio when cargo has no match', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];
    zoneRulesStore = [{ cargo: 'TV', zona: 'Media', match_field: 'tipo_medio' }];

    mockBulkRpcSuccess([{ row_index: 0, ok: true, reg_id: 'reg-1' }]);

    const rows = [makeRow('11111111-1', 'Juan', 'Pérez', { tipo_medio: 'TV', cargo: 'Unknown' })];
    const req = makeRequest({ event_id: 'evt-1', rows });
    await POST(req);

    const rpcPayload = (mockRpc.mock.calls[0][1].p_rows as Array<{ datos_extra: Record<string, string> }>);
    expect(rpcPayload[0].datos_extra.zona).toBe('Media');
  });

  // ── Datos extra ──

  it('passes extra fields in datos_extra to RPC rows', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];

    mockBulkRpcSuccess([{ row_index: 0, ok: true, reg_id: 'reg-1' }]);

    const rows = [makeRow('11111111-1', 'Juan', 'Pérez', {
      patente: 'AB-1234',
      vehiculo: 'Sedan',
    })];
    const req = makeRequest({ event_id: 'evt-1', rows });
    await POST(req);

    const rpcPayload = (mockRpc.mock.calls[0][1].p_rows as Array<{ datos_extra: Record<string, string> }>);
    expect(rpcPayload[0].datos_extra.patente).toBe('AB-1234');
    expect(rpcPayload[0].datos_extra.vehiculo).toBe('Sedan');
  });

  // ── Duplicate RUTs in same batch ──

  it('all-or-nothing: deduplicates RUTs in batch — all fail', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];

    const rows = [
      makeRow('11111111-1', 'Juan', 'Pérez'),
      makeRow('11111111-1', 'Juan', 'Pérez'),
    ];
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(0);
    expect(body.errors).toBe(2);
    body.results.forEach((r: { ok: boolean; error: string }) => {
      expect(r.ok).toBe(false);
      expect(r.error).toContain('duplicado');
    });
    // RPC should NOT be called
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('all-or-nothing: catches pre-existing registrations before RPC', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [
      { id: 'prof-1', rut: '11111111-1', user_id: null },
      { id: 'prof-2', rut: '22222222-2', user_id: null },
    ];
    // prof-1 already has a registration for this event
    registrationStore = [{ profile_id: 'prof-1' }];

    const rows = [
      makeRow('11111111-1', 'Juan', 'Pérez'),
      makeRow('22222222-2', 'María', 'López'),
    ];
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(0);
    expect(body.errors).toBe(2);
    const dupResult = body.results.find((r: { rut: string }) => r.rut === '11111111-1');
    expect(dupResult.error).toContain('ya está registrada');
    const otherResult = body.results.find((r: { rut: string }) => r.rut === '22222222-2');
    expect(otherResult.error).toContain('No se procesó');
    // RPC should NOT be called
    expect(mockRpc).not.toHaveBeenCalled();
  });

  // ── Audit ──

  it('logs a single audit entry for the entire batch', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-uid' });
    mockIsSuperAdmin.mockResolvedValue(true);
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];

    mockBulkRpcSuccess([{ row_index: 0, ok: true, reg_id: 'reg-1' }]);

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

  // ── Performance: single RPC call verification ──

  it('makes exactly 1 RPC call regardless of row count', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);

    // Helper: compute valid DV for a RUT body (módulo 11)
    function computeDV(body: number): string {
      let sum = 0, mul = 2, n = body;
      while (n > 0) { sum += (n % 10) * mul; n = Math.floor(n / 10); mul = mul === 7 ? 2 : mul + 1; }
      const r = 11 - (sum % 11);
      return r === 11 ? '0' : r === 10 ? 'K' : r.toString();
    }

    profileStore = Array.from({ length: 50 }, (_, i) => {
      const body = 10000000 + i;
      const rut = `${body}-${computeDV(body)}`;
      return { id: `prof-${i}`, rut, user_id: null };
    });

    const rpcResults = profileStore.map((_, i) => ({
      row_index: i,
      ok: true,
      reg_id: `reg-${i}`,
    }));
    mockBulkRpcSuccess(rpcResults);

    const rows = profileStore.map(p => makeRow(p.rut || '11111111-1', 'Nombre', 'Apellido'));
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    const body = await res.json();

    expect(body.success).toBe(50);
    // The key assertion: only 1 RPC call, not 50
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  // ── Server-side RUT/Email validation ──

  it('rejects rows with invalid RUT (dígito verificador)', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);

    const rows = [
      makeRow('11111111-0', 'Juan', 'Pérez'), // DV correcto es 1, no 0
    ];
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(0);
    expect(body.errors).toBe(1);
    expect(body.results[0].ok).toBe(false);
    expect(body.results[0].error).toContain('RUT inválido');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects rows with invalid email format', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];

    const rows = [
      makeRow('11111111-1', 'Juan', 'Pérez', { email: 'not-an-email' }),
    ];
    const req = makeRequest({ event_id: 'evt-1', rows });
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(0);
    expect(body.errors).toBe(1);
    expect(body.results[0].ok).toBe(false);
    expect(body.results[0].error).toContain('Email inválido');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('sanitizes input data (strips HTML tags)', async () => {
    mockGetEventById.mockResolvedValue(VALID_EVENT);
    profileStore = [{ id: 'prof-1', rut: '11111111-1', user_id: null }];

    mockBulkRpcSuccess([{ row_index: 0, ok: true, reg_id: 'reg-1' }]);

    const rows = [
      makeRow('11111111-1', '<script>alert("xss")</script>Juan', 'Pérez', {
        email: 'test@example.com',
        cargo: '<b>Periodista</b>',
      }),
    ];
    const req = makeRequest({ event_id: 'evt-1', rows });
    await POST(req);

    // cargo is passed directly in the RPC row payload
    const rpcPayload = mockRpc.mock.calls[0][1].p_rows as Array<{ cargo: string }>;
    expect(rpcPayload[0].cargo).toBe('Periodista');
  });
});
