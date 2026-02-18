/**
 * Tests: useProfileLookup hook
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProfileLookup } from '@/hooks/useProfileLookup';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useProfileLookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with default state', () => {
    const { result } = renderHook(() => useProfileLookup());
    expect(result.current.profile).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.found).toBe(false);
  });

  it('loads profile successfully', async () => {
    const mockProfile = { id: 'p1', nombre: 'Juan', apellido: 'Pérez', rut: '12345678-9' };
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ found: true, profile: mockProfile }),
    });

    const { result } = renderHook(() => useProfileLookup());
    let returned: unknown;

    await act(async () => {
      returned = await result.current.loadMyProfile();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/profiles/lookup');
    expect(result.current.found).toBe(true);
    expect(result.current.profile).toEqual(mockProfile);
    expect(returned).toEqual(mockProfile);
    expect(result.current.loading).toBe(false);
  });

  it('handles not found profile', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ found: false }),
    });

    const { result } = renderHook(() => useProfileLookup());
    let returned: unknown;

    await act(async () => {
      returned = await result.current.loadMyProfile();
    });

    expect(result.current.found).toBe(false);
    expect(result.current.profile).toBeNull();
    expect(returned).toBeNull();
  });

  it('handles fetch error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useProfileLookup());
    let returned: unknown;

    await act(async () => {
      returned = await result.current.loadMyProfile();
    });

    expect(result.current.found).toBe(false);
    expect(result.current.profile).toBeNull();
    expect(returned).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('getMissingFields returns all fields when no profile', () => {
    const { result } = renderHook(() => useProfileLookup());
    const fields = [
      { key: 'nombre', label: 'Nombre', type: 'text' as const, required: true, profile_field: 'nombre' },
      { key: 'email', label: 'Email', type: 'email' as const, required: true, profile_field: 'email' },
    ];

    const missing = result.current.getMissingFields(fields);
    expect(missing).toHaveLength(2);
  });

  it('getMissingFields filters already filled fields', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ found: true, profile: { nombre: 'Juan', email: '' } }),
    });

    const { result } = renderHook(() => useProfileLookup());

    await act(async () => {
      await result.current.loadMyProfile();
    });

    const fields = [
      { key: 'nombre', label: 'Nombre', type: 'text' as const, required: true, profile_field: 'nombre' },
      { key: 'email', label: 'Email', type: 'email' as const, required: true, profile_field: 'email' },
      { key: 'extra', label: 'Extra', type: 'text' as const, required: true },
    ];

    const missing = result.current.getMissingFields(fields);
    // nombre is filled, email is empty, extra has no profile_field
    expect(missing.map(f => f.key)).toEqual(['email', 'extra']);
  });

  it('getMissingFields handles nested profile_field paths', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ found: true, profile: { datos_base: { telefono: '123' } } }),
    });

    const { result } = renderHook(() => useProfileLookup());

    await act(async () => {
      await result.current.loadMyProfile();
    });

    const fields = [
      { key: 'tel', label: 'Teléfono', type: 'text' as const, required: true, profile_field: 'datos_base.telefono' },
      { key: 'city', label: 'Ciudad', type: 'text' as const, required: true, profile_field: 'datos_base.ciudad' },
    ];

    const missing = result.current.getMissingFields(fields);
    // telefono exists, ciudad doesn't
    expect(missing.map(f => f.key)).toEqual(['city']);
  });
});
