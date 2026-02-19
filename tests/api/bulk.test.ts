/**
 * Tests: API /api/bulk — Bulk approve/reject + optimized email sending
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Service mocks ──
const mockGetCurrentUser = vi.fn();
const mockBulkUpdateStatus = vi.fn();
const mockSendBulkApprovalEmails = vi.fn();
const mockLogAuditAction = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/services/auth', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/services', () => ({
  bulkUpdateStatus: (...args: unknown[]) => mockBulkUpdateStatus(...args),
}));

vi.mock('@/lib/services/email', () => ({
  sendBulkApprovalEmails: (...args: unknown[]) => mockSendBulkApprovalEmails(...args),
}));

vi.mock('@/lib/services/audit', () => ({
  logAuditAction: (...args: unknown[]) => mockLogAuditAction(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

import { POST } from '@/app/api/bulk/route';

// ── Helpers ──
function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/bulk', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(null);
    mockLogAuditAction.mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    const req = makeRequest({ registration_ids: ['r-1'], status: 'aprobado' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when registration_ids is empty', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    const req = makeRequest({ registration_ids: [], status: 'aprobado' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('registration_ids');
  });

  it('returns 400 when status is invalid', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    const req = makeRequest({ registration_ids: ['r-1'], status: 'invalido' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('status');
  });

  it('calls bulkUpdateStatus and returns result', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockBulkUpdateStatus.mockResolvedValue({ success: 3, errors: [] });

    const req = makeRequest({
      registration_ids: ['r-1', 'r-2', 'r-3'],
      status: 'aprobado',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(3);
    expect(body.errors).toEqual([]);

    expect(mockBulkUpdateStatus).toHaveBeenCalledWith(
      ['r-1', 'r-2', 'r-3'],
      'aprobado',
      'user-1',
    );
  });

  it('logs audit action after bulk update', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockBulkUpdateStatus.mockResolvedValue({ success: 2, errors: [] });

    const req = makeRequest({
      registration_ids: ['r-1', 'r-2'],
      status: 'rechazado',
    });
    await POST(req);

    expect(mockLogAuditAction).toHaveBeenCalledWith(
      'user-1',
      'registration.bulk_approved',
      'registration',
      'r-1',
      expect.objectContaining({
        count: 2,
        status: 'rechazado',
        success: 2,
      }),
    );
  });

  it('sends emails in batch when send_emails=true and status=aprobado', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockBulkUpdateStatus.mockResolvedValue({ success: 2, errors: [] });

    const fullRegs = [
      { id: 'r-1', tenant_id: 'tenant-1', nombre: 'Juan' },
      { id: 'r-2', tenant_id: 'tenant-1', nombre: 'María' },
    ];
    const tenant = { id: 'tenant-1', nombre: 'Test Tenant' };

    // from('v_registration_full').select('*').in('id', [...])
    // from('tenants').select('*').eq('id', 'tenant-1').single()
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: fullRegs }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: tenant }),
          }),
        }),
      });

    mockSendBulkApprovalEmails.mockResolvedValue({ sent: 2, failed: 0 });

    const req = makeRequest({
      registration_ids: ['r-1', 'r-2'],
      status: 'aprobado',
      send_emails: true,
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.emails).toEqual({ sent: 2, failed: 0 });
    expect(mockSendBulkApprovalEmails).toHaveBeenCalledWith(fullRegs, tenant);
  });

  it('uses batch query (in) instead of N individual fetches for emails', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockBulkUpdateStatus.mockResolvedValue({ success: 3, errors: [] });

    const fullRegs = [
      { id: 'r-1', tenant_id: 'tenant-1' },
      { id: 'r-2', tenant_id: 'tenant-1' },
      { id: 'r-3', tenant_id: 'tenant-1' },
    ];
    const tenant = { id: 'tenant-1' };

    const mockIn = vi.fn().mockResolvedValue({ data: fullRegs });
    const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
    mockFrom
      .mockReturnValueOnce({ select: mockSelect })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: tenant }),
          }),
        }),
      });
    mockSendBulkApprovalEmails.mockResolvedValue({ sent: 3, failed: 0 });

    const req = makeRequest({
      registration_ids: ['r-1', 'r-2', 'r-3'],
      status: 'aprobado',
      send_emails: true,
    });
    await POST(req);

    // Verify batch query was used (single .in() call, not N .eq() calls)
    expect(mockIn).toHaveBeenCalledWith('id', ['r-1', 'r-2', 'r-3']);
    expect(mockFrom).toHaveBeenCalledTimes(2); // v_registration_full + tenants
  });

  it('does not send emails when status is rechazado', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockBulkUpdateStatus.mockResolvedValue({ success: 1, errors: [] });

    const req = makeRequest({
      registration_ids: ['r-1'],
      status: 'rechazado',
      send_emails: true,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockSendBulkApprovalEmails).not.toHaveBeenCalled();
  });

  it('does not send emails when send_emails is false', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockBulkUpdateStatus.mockResolvedValue({ success: 1, errors: [] });

    const req = makeRequest({
      registration_ids: ['r-1'],
      status: 'aprobado',
      send_emails: false,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSendBulkApprovalEmails).not.toHaveBeenCalled();
  });
});
