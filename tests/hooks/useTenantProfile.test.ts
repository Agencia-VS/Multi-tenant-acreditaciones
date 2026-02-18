/**
 * Tests: useTenantProfile hook
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTenantProfile, useTenantStatuses } from '@/hooks/useTenantProfile';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useTenantProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with initial state', () => {
    const { result } = renderHook(() => useTenantProfile());
    expect(result.current.profile).toBeNull();
    expect(result.current.mergedData).toEqual({});
    expect(result.current.tenantData).toEqual({});
    expect(result.current.formFields).toEqual([]);
    expect(result.current.status).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('loads tenant profile successfully', async () => {
    const apiData = {
      profile: { id: 'p1', nombre: 'Juan' },
      mergedData: { nombre: 'Juan', org: 'Test' },
      tenantData: { org: 'Test' },
      formFields: [{ key: 'org', label: 'Org', type: 'text' }],
      status: { totalRequired: 2, filledRequired: 1, missingFields: [], completionPct: 50, formChanged: false, newKeys: [], removedKeys: [], hasData: true },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(apiData),
    });

    const { result } = renderHook(() => useTenantProfile());

    await act(async () => {
      await result.current.loadTenantProfile('tenant-1', 'event-1');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/profiles/tenant-data?tenant_id=tenant-1&event_id=event-1'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.profile).toEqual(apiData.profile);
    expect(result.current.mergedData).toEqual(apiData.mergedData);
    expect(result.current.loading).toBe(false);
  });

  it('handles API error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Not found' }),
    });

    const { result } = renderHook(() => useTenantProfile());

    await act(async () => {
      await result.current.loadTenantProfile('tenant-x');
    });

    expect(result.current.error).toBe('Not found');
    expect(result.current.loading).toBe(false);
  });

  it('handles network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network down'));

    const { result } = renderHook(() => useTenantProfile());

    await act(async () => {
      await result.current.loadTenantProfile('tenant-1');
    });

    expect(result.current.error).toBe('Network down');
    expect(result.current.loading).toBe(false);
  });

  it('saveTenantData calls POST and returns true on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useTenantProfile());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.saveTenantData('t1', { org: 'Test' }, ['org']);
    });

    expect(success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('/api/profiles/tenant-data', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ tenant_id: 't1', data: { org: 'Test' }, form_keys: ['org'] }),
    }));
  });

  it('saveTenantData returns false on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const { result } = renderHook(() => useTenantProfile());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.saveTenantData('t1', {}, []);
    });

    expect(success).toBe(false);
  });

  it('getMissingFieldsFor returns required fields without data', () => {
    const { result } = renderHook(() => useTenantProfile());
    const fields = [
      { key: 'org', label: 'Org', type: 'text' as const, required: true },
      { key: 'nombre', label: 'Nombre', type: 'text' as const, required: true },
      { key: 'extra', label: 'Extra', type: 'text' as const, required: false },
    ];

    const missing = result.current.getMissingFieldsFor(fields, { org: 'Test', nombre: '' });
    expect(missing.map(f => f.key)).toEqual(['nombre']);
  });

  it('getMissingFieldsFor ignores optional fields', () => {
    const { result } = renderHook(() => useTenantProfile());
    const fields = [
      { key: 'notes', label: 'Notas', type: 'text' as const, required: false },
    ];

    const missing = result.current.getMissingFieldsFor(fields, {});
    expect(missing).toHaveLength(0);
  });
});

describe('useTenantStatuses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with empty state', () => {
    const { result } = renderHook(() => useTenantStatuses());
    expect(result.current.tenants).toEqual([]);
    expect(result.current.profile).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('loads tenant statuses successfully', async () => {
    const data = {
      tenants: [{ tenant_id: 't1', name: 'Tenant 1' }],
      profile: { id: 'p1', nombre: 'Juan', apellido: 'P', rut: '123' },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(data),
    });

    const { result } = renderHook(() => useTenantStatuses());

    await act(async () => {
      await result.current.load();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/profiles/tenant-status');
    expect(result.current.tenants).toHaveLength(1);
    expect(result.current.profile?.nombre).toBe('Juan');
    expect(result.current.loading).toBe(false);
  });

  it('handles error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useTenantStatuses());

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.tenants).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
