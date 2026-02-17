/**
 * Tests: eventDays.ts — Event days CRUD with mocked Supabase
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    from: mockFrom,
  }),
}));

import {
  listEventDays,
  getCurrentEventDay,
  createEventDay,
  createEventDaysBulk,
  updateEventDay,
  deleteEventDay,
  syncEventDays,
} from '@/lib/services/eventDays';

// ─── Chain builder helpers ───
function listChain(data: unknown[], error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data, error }),
        }),
      }),
    }),
  };
}

function singleQueryChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data, error }),
            }),
          }),
        }),
      }),
    }),
  };
}

function insertChain(data: unknown, error: unknown = null) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

function insertBulkChain(data: unknown[], error: unknown = null) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data, error }),
    }),
  };
}

function updateChain(data: unknown, error: unknown = null) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data, error }),
        }),
      }),
    }),
  };
}

function deleteChain(error: unknown = null) {
  return {
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error }),
    }),
  };
}

const DAY_1 = { id: 'd1', event_id: 'e1', fecha: '2026-03-01', label: 'Día 1', orden: 1, is_active: true };
const DAY_2 = { id: 'd2', event_id: 'e1', fecha: '2026-03-02', label: 'Día 2', orden: 2, is_active: true };

describe('listEventDays', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ordered days for an event', async () => {
    mockFrom.mockReturnValue(listChain([DAY_1, DAY_2]));
    const days = await listEventDays('e1');
    expect(days).toEqual([DAY_1, DAY_2]);
    expect(mockFrom).toHaveBeenCalledWith('event_days');
  });

  it('returns empty array when no days', async () => {
    mockFrom.mockReturnValue(listChain([]));
    const days = await listEventDays('e2');
    expect(days).toEqual([]);
  });

  it('throws on Supabase error', async () => {
    mockFrom.mockReturnValue(listChain([], { message: 'DB error' }));
    await expect(listEventDays('e1')).rejects.toThrow('Error listando días del evento');
  });
});

describe('getCurrentEventDay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the day matching today', async () => {
    mockFrom.mockReturnValue(singleQueryChain(DAY_1));
    const day = await getCurrentEventDay('e1');
    expect(day).toEqual(DAY_1);
  });

  it('returns null when no day matches', async () => {
    mockFrom.mockReturnValue(singleQueryChain(null, { code: 'PGRST116' }));
    const day = await getCurrentEventDay('e1');
    expect(day).toBeNull();
  });
});

describe('createEventDay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts and returns a day', async () => {
    mockFrom.mockReturnValue(insertChain(DAY_1));
    const day = await createEventDay('e1', { fecha: '2026-03-01', label: 'Día 1' });
    expect(day).toEqual(DAY_1);
    expect(mockFrom).toHaveBeenCalledWith('event_days');
  });

  it('throws on insert error', async () => {
    mockFrom.mockReturnValue(insertChain(null, { message: 'dup' }));
    await expect(createEventDay('e1', { fecha: '2026-03-01', label: 'Día 1' })).rejects.toThrow('Error creando día');
  });
});

describe('createEventDaysBulk', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts multiple days', async () => {
    mockFrom.mockReturnValue(insertBulkChain([DAY_1, DAY_2]));
    const days = await createEventDaysBulk('e1', [
      { fecha: '2026-03-01', label: 'Día 1' },
      { fecha: '2026-03-02', label: 'Día 2' },
    ]);
    expect(days).toHaveLength(2);
  });
});

describe('updateEventDay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates and returns the day', async () => {
    const updated = { ...DAY_1, label: 'Jornada 1' };
    mockFrom.mockReturnValue(updateChain(updated));
    const day = await updateEventDay('d1', { label: 'Jornada 1' });
    expect(day.label).toBe('Jornada 1');
  });

  it('throws on update error', async () => {
    mockFrom.mockReturnValue(updateChain(null, { message: 'not found' }));
    await expect(updateEventDay('d1', { label: 'X' })).rejects.toThrow('Error actualizando día');
  });
});

describe('deleteEventDay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes without error', async () => {
    mockFrom.mockReturnValue(deleteChain(null));
    await expect(deleteEventDay('d1')).resolves.toBeUndefined();
  });

  it('throws on delete error', async () => {
    mockFrom.mockReturnValue(deleteChain({ message: 'FK constraint' }));
    await expect(deleteEventDay('d1')).rejects.toThrow('Error eliminando día');
  });
});

describe('syncEventDays', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes existing and inserts new days', async () => {
    // First call: delete → event_days table
    const deleteMock = deleteChain(null);
    // Second call: insert → event_days table
    const insertMock = insertBulkChain([DAY_1, DAY_2]);
    
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? deleteMock : insertMock;
    });

    const days = await syncEventDays('e1', [
      { fecha: '2026-03-01', label: 'Día 1' },
      { fecha: '2026-03-02', label: 'Día 2' },
    ]);
    expect(days).toHaveLength(2);
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('returns empty array when syncing to zero days', async () => {
    mockFrom.mockReturnValue(deleteChain(null));
    const days = await syncEventDays('e1', []);
    expect(days).toEqual([]);
  });
});
