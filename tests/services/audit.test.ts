/**
 * Tests: audit.ts — logAuditAction + getAuditLogs with mocked Supabase
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    from: mockFrom,
  }),
}));

import { logAuditAction, getAuditLogs } from '@/lib/services/audit';

describe('logAuditAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts audit record without throwing', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });

    await expect(
      logAuditAction('user-1', 'registration.approved', 'registration', 'r-1', { reason: 'ok' })
    ).resolves.toBeUndefined();

    expect(mockFrom).toHaveBeenCalledWith('audit_logs');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        action: 'registration.approved',
        entity_type: 'registration',
        entity_id: 'r-1',
      })
    );
  });

  it('swallows errors without rethrowing (non-blocking)', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('DB down');
    });

    // Should NOT throw
    await expect(
      logAuditAction('user-1', 'test', 'test', 't-1')
    ).resolves.toBeUndefined();
  });

  it('uses empty object when metadata is undefined', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });

    await logAuditAction('user-1', 'action', 'entity', 'e-1');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: {} })
    );
  });
});

describe('getAuditLogs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns logs with default limit 100', async () => {
    const logs = [{ id: '1', action: 'test' }];
    const mockLimit = vi.fn().mockResolvedValue({ data: logs, error: null });
    const mockOrder = vi.fn().mockReturnValue({ eq: vi.fn(), limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });

    const result = await getAuditLogs();
    expect(result).toHaveLength(1);
    expect(mockLimit).toHaveBeenCalledWith(100);
  });

  it('applies entity_type filter', async () => {
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEq = vi.fn().mockReturnValue({ eq: vi.fn(), limit: mockLimit });
    const mockOrder = vi.fn().mockReturnValue({ eq: mockEq, limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });

    await getAuditLogs({ entity_type: 'registration' });
    expect(mockEq).toHaveBeenCalledWith('entity_type', 'registration');
  });

  it('throws on supabase error', async () => {
    const mockLimit = vi.fn().mockResolvedValue({ data: null, error: { message: 'Timeout' } });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });

    await expect(getAuditLogs()).rejects.toThrow('Error obteniendo logs: Timeout');
  });
});
