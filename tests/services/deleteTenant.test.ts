/**
 * Tests — deleteTenant service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase admin client
const mockFrom = vi.fn();
const mockStorage = {
  from: vi.fn().mockReturnValue({
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
};
const mockAuth = {
  admin: {
    deleteUser: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    from: mockFrom,
    storage: mockStorage,
    auth: mockAuth,
  }),
}));

// Import after mock
import { deleteTenant } from '@/lib/services/tenants';

function chainMock(returnData: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error }),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };
  return chain;
}

describe('deleteTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if tenant not found', async () => {
    const chain = chainMock(null);
    mockFrom.mockReturnValue(chain);

    await expect(deleteTenant('nonexistent')).rejects.toThrow('Tenant no encontrado');
  });

  it('cleans up admins, storage, and deletes tenant', async () => {
    const tenantChain = chainMock({ slug: 'my-tenant' });
    const adminsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [{ user_id: 'u1' }, { user_id: 'u2' }], error: null }),
    };
    const deleteChain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') {
        callCount++;
        // First call: select (get slug), second call: delete
        return callCount === 1 ? tenantChain : deleteChain;
      }
      if (table === 'tenant_admins') return adminsChain;
      return tenantChain;
    });

    mockStorage.from.mockReturnValue({
      list: vi.fn().mockResolvedValue({ data: [{ name: 'logo.png' }, { name: 'bg.jpg' }], error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await deleteTenant('tenant-123');

    // Verify auth users were deleted
    expect(mockAuth.admin.deleteUser).toHaveBeenCalledTimes(2);
    expect(mockAuth.admin.deleteUser).toHaveBeenCalledWith('u1');
    expect(mockAuth.admin.deleteUser).toHaveBeenCalledWith('u2');

    // Verify storage cleanup
    expect(mockStorage.from).toHaveBeenCalledWith('assets');
  });

  it('continues if auth user deletion fails', async () => {
    const tenantChain = chainMock({ slug: 'test' });
    const adminsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [{ user_id: 'u1' }], error: null }),
    };
    const deleteChain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') {
        callCount++;
        return callCount === 1 ? tenantChain : deleteChain;
      }
      if (table === 'tenant_admins') return adminsChain;
      return tenantChain;
    });

    // Auth delete fails
    mockAuth.admin.deleteUser.mockRejectedValue(new Error('Auth error'));

    // Should NOT throw
    await expect(deleteTenant('t-1')).resolves.toBeUndefined();
  });

  it('continues if storage cleanup fails', async () => {
    const tenantChain = chainMock({ slug: 'test' });
    const adminsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const deleteChain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') {
        callCount++;
        return callCount === 1 ? tenantChain : deleteChain;
      }
      if (table === 'tenant_admins') return adminsChain;
      return tenantChain;
    });

    // Storage list throws
    mockStorage.from.mockReturnValue({
      list: vi.fn().mockRejectedValue(new Error('Storage error')),
      remove: vi.fn(),
    });

    await expect(deleteTenant('t-2')).resolves.toBeUndefined();
  });
});
