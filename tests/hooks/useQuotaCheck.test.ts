/**
 * Tests: useQuotaCheck hook
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useQuotaCheck } from '@/hooks/useQuotaCheck';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useQuotaCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with null result and not loading', () => {
    const { result } = renderHook(() => useQuotaCheck('event-1'));
    expect(result.current.quotaResult).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('does nothing if eventId is null', async () => {
    const { result } = renderHook(() => useQuotaCheck(null));

    await act(async () => {
      await result.current.checkQuota('Fotógrafo', 'CNN');
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.quotaResult).toBeNull();
  });

  it('does nothing if tipoMedio is empty', async () => {
    const { result } = renderHook(() => useQuotaCheck('event-1'));

    await act(async () => {
      await result.current.checkQuota('', 'CNN');
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does nothing if organizacion is empty', async () => {
    const { result } = renderHook(() => useQuotaCheck('event-1'));

    await act(async () => {
      await result.current.checkQuota('Prensa', '');
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches quota and sets result on success', async () => {
    const quotaData = { available: true, used_org: 2, max_org: 5 };
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(quotaData),
    });

    const { result } = renderHook(() => useQuotaCheck('event-1'));

    await act(async () => {
      await result.current.checkQuota('Fotógrafo', 'CNN');
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/events/event-1/quotas?tipo_medio=Fot%C3%B3grafo&organizacion=CNN')
    );
    expect(result.current.quotaResult).toEqual(quotaData);
    expect(result.current.loading).toBe(false);
  });

  it('sets null on fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useQuotaCheck('event-1'));

    await act(async () => {
      await result.current.checkQuota('Prensa', 'El Mercurio');
    });

    expect(result.current.quotaResult).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('encodes special characters in URL params', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ available: true }),
    });

    const { result } = renderHook(() => useQuotaCheck('e-1'));

    await act(async () => {
      await result.current.checkQuota('Cámara & Foto', 'Canal 13');
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain(encodeURIComponent('Cámara & Foto'));
    expect(url).toContain(encodeURIComponent('Canal 13'));
  });
});
