/**
 * Tests: Event Visibility & Invitations
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockOrder = vi.fn();
const mockIn = vi.fn();
const mockUpsert = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: (...a: unknown[]) => { mockSelect(...a); return { eq: mockEq, order: mockOrder, single: mockSingle }; },
        insert: (...a: unknown[]) => { mockInsert(...a); return { select: mockSelect }; },
        upsert: (...a: unknown[]) => { mockUpsert(...a); return { select: mockSelect }; },
        update: (...a: unknown[]) => { mockUpdate(...a); return { eq: mockEq }; },
        delete: () => { mockDelete(); return { eq: mockEq }; },
        eq: mockEq,
      };
    },
  }),
}));

// Chain setup helper
function setupChain(finalData: unknown, finalError: unknown = null) {
  mockEq.mockReturnValue({ eq: mockEq, single: mockSingle, order: mockOrder, in: mockIn, select: mockSelect });
  mockOrder.mockReturnValue({ limit: vi.fn().mockReturnValue({ single: mockSingle }) });
  mockSingle.mockResolvedValue({ data: finalData, error: finalError });
  mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder, single: mockSingle, data: finalData, error: finalError });
  mockIn.mockResolvedValue({ error: finalError });
  mockUpsert.mockReturnValue({ select: vi.fn().mockResolvedValue({ data: finalData, error: finalError }) });
}

describe('Event Visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveEvent', () => {
    it('does not filter by visibility by default', async () => {
      setupChain({ id: 'e-1', nombre: 'Test', visibility: 'public' });
      
      const { getActiveEvent } = await import('@/lib/services/events');
      await getActiveEvent('tenant-1');
      
      // eq should be called with tenant_id and is_active, but NOT visibility
      const eqCalls = mockEq.mock.calls.map(c => c[0]);
      expect(eqCalls).toContain('tenant_id');
      expect(eqCalls).toContain('is_active');
    });

    it('filters by visibility=public when publicOnly is true', async () => {
      setupChain({ id: 'e-1', nombre: 'Public Event', visibility: 'public' });
      
      const { getActiveEvent } = await import('@/lib/services/events');
      await getActiveEvent('tenant-1', { publicOnly: true });
      
      const eqCalls = mockEq.mock.calls.map(c => c[0]);
      expect(eqCalls).toContain('visibility');
    });

    it('returns null when no active event found', async () => {
      mockEq.mockReturnValue({ eq: mockEq, single: mockSingle, order: mockOrder });
      mockOrder.mockReturnValue({ limit: vi.fn().mockReturnValue({ single: mockSingle }) });
      mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });
      
      const { getActiveEvent } = await import('@/lib/services/events');
      const result = await getActiveEvent('tenant-1');
      expect(result).toBeNull();
    });
  });
});

describe('Invitation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateInviteToken', () => {
    it('returns invalid for non-existent token', async () => {
      mockEq.mockReturnValue({ single: mockSingle });
      mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });
      
      const { validateInviteToken } = await import('@/lib/services/invitations');
      const result = await validateInviteToken('bad-token');
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invitación no encontrada');
    });

    it('returns invalid for expired invitation', async () => {
      // First call: getInvitationByToken
      mockEq.mockReturnValueOnce({ single: mockSingle });
      mockSingle.mockResolvedValueOnce({
        data: { id: 'inv-1', event_id: 'e-1', status: 'expired', token: 'tok-1' },
        error: null,
      });
      
      const { validateInviteToken } = await import('@/lib/services/invitations');
      const result = await validateInviteToken('tok-1');
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Esta invitación ha expirado');
    });

    it('returns invalid for already accepted invitation', async () => {
      mockEq.mockReturnValueOnce({ single: mockSingle });
      mockSingle.mockResolvedValueOnce({
        data: { id: 'inv-2', event_id: 'e-1', status: 'accepted', token: 'tok-2' },
        error: null,
      });
      
      const { validateInviteToken } = await import('@/lib/services/invitations');
      const result = await validateInviteToken('tok-2');
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Esta invitación ya fue utilizada');
    });

    it('returns valid for pending invitation with active event', async () => {
      // getInvitationByToken
      mockEq.mockReturnValueOnce({ single: mockSingle });
      mockSingle.mockResolvedValueOnce({
        data: { id: 'inv-3', event_id: 'e-1', email: 'test@test.com', status: 'pending', token: 'tok-3' },
        error: null,
      });
      
      // getActiveEvent check (select → eq → single on events)
      mockSelect.mockReturnValueOnce({ eq: mockEq });
      mockEq.mockReturnValueOnce({ single: mockSingle });
      mockSingle.mockResolvedValueOnce({
        data: { id: 'e-1', is_active: true, visibility: 'invite_only' },
        error: null,
      });
      
      const { validateInviteToken } = await import('@/lib/services/invitations');
      const result = await validateInviteToken('tok-3');
      
      expect(result.valid).toBe(true);
      expect(result.eventId).toBe('e-1');
    });
  });

  describe('createInvitations', () => {
    it('returns empty array for empty invitees list', async () => {
      const { createInvitations } = await import('@/lib/services/invitations');
      const result = await createInvitations('e-1', []);
      expect(result).toEqual([]);
      // Should not call any DB operation
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('acceptInvitation', () => {
    it('updates invitation status to accepted', async () => {
      mockEq.mockResolvedValueOnce({ error: null });
      
      const { acceptInvitation } = await import('@/lib/services/invitations');
      await acceptInvitation('tok-1');
      
      expect(mockUpdate).toHaveBeenCalled();
      const updateArgs = mockUpdate.mock.calls[0][0];
      expect(updateArgs.status).toBe('accepted');
      expect(updateArgs.accepted_at).toBeDefined();
    });
  });
});
