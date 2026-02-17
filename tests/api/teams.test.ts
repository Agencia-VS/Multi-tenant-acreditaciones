/**
 * Tests: API /api/teams — HTTP layer (auth, validation, status codes)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──
const mockGetCurrentUser = vi.fn();
const mockGetProfileByUserId = vi.fn();
const mockGetTeamMembers = vi.fn();
const mockAddTeamMember = vi.fn();
const mockRemoveTeamMember = vi.fn();

vi.mock('@/lib/services', () => ({
  getTeamMembers: (...args: unknown[]) => mockGetTeamMembers(...args),
  addTeamMember: (...args: unknown[]) => mockAddTeamMember(...args),
  removeTeamMember: (...args: unknown[]) => mockRemoveTeamMember(...args),
  getProfileByUserId: (...args: unknown[]) => mockGetProfileByUserId(...args),
  getCurrentUser: () => mockGetCurrentUser(),
}));

import { GET, POST, DELETE } from '@/app/api/teams/route';

describe('GET /api/teams', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns empty array when user has no profile', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockGetProfileByUserId.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns team members for authenticated user', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockGetProfileByUserId.mockResolvedValue({ id: 'prof-1' });
    mockGetTeamMembers.mockResolvedValue([
      { id: 'm-1', nombre: 'Ana', rut: '11111111-1' },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].nombre).toBe('Ana');
  });
});

describe('POST /api/teams', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/teams', {
      method: 'POST',
      body: JSON.stringify({ rut: '12345678-9', nombre: 'Test', apellido: 'User' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 404 when user has no profile', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockGetProfileByUserId.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/teams', {
      method: 'POST',
      body: JSON.stringify({ rut: '12345678-9', nombre: 'Test', apellido: 'User' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 201 on successful member add', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockGetProfileByUserId.mockResolvedValue({ id: 'prof-1' });
    mockAddTeamMember.mockResolvedValue({ id: 'm-1', rut: '12345678-9' });

    const req = new NextRequest('http://localhost/api/teams', {
      method: 'POST',
      body: JSON.stringify({ rut: '12345678-9', nombre: 'Test', apellido: 'User' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('returns 409 for duplicate member', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockGetProfileByUserId.mockResolvedValue({ id: 'prof-1' });
    mockAddTeamMember.mockRejectedValue(new Error('ya está en tu equipo'));

    const req = new NextRequest('http://localhost/api/teams', {
      method: 'POST',
      body: JSON.stringify({ rut: '12345678-9', nombre: 'Test', apellido: 'User' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/teams', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/teams?member_id=m-1', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when member_id is missing', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockGetProfileByUserId.mockResolvedValue({ id: 'prof-1' });

    const req = new NextRequest('http://localhost/api/teams', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful removal', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockGetProfileByUserId.mockResolvedValue({ id: 'prof-1' });
    mockRemoveTeamMember.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/teams?member_id=m-1', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
