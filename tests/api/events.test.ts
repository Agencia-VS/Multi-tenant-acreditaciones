/**
 * Tests: API /api/events — HTTP layer (auth, validation, status codes)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──
const mockGetCurrentUser = vi.fn();
const mockCreateEvent = vi.fn();
const mockUpdateEvent = vi.fn();
const mockDeactivateEvent = vi.fn();
const mockDeleteEvent = vi.fn();
const mockListEventsByTenant = vi.fn();
const mockListAllEvents = vi.fn();
const mockGetActiveEvent = vi.fn();
const mockLogAuditAction = vi.fn();

vi.mock('@/lib/services', () => ({
  createEvent: (...args: unknown[]) => mockCreateEvent(...args),
  updateEvent: (...args: unknown[]) => mockUpdateEvent(...args),
  deactivateEvent: (...args: unknown[]) => mockDeactivateEvent(...args),
  deleteEvent: (...args: unknown[]) => mockDeleteEvent(...args),
  listEventsByTenant: (...args: unknown[]) => mockListEventsByTenant(...args),
  listAllEvents: (...args: unknown[]) => mockListAllEvents(...args),
  getActiveEvent: (...args: unknown[]) => mockGetActiveEvent(...args),
  logAuditAction: (...args: unknown[]) => mockLogAuditAction(...args),
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/services/tenants', () => ({
  getTenantBySlug: vi.fn().mockResolvedValue({ id: 'tenant-1' }),
}));

import { GET, POST, PATCH, DELETE } from '@/app/api/events/route';

describe('GET /api/events', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all events when no filters', async () => {
    mockListAllEvents.mockResolvedValue([{ id: 'e-1', nombre: 'Evento 1' }]);

    const req = new NextRequest('http://localhost/api/events');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockListAllEvents).toHaveBeenCalled();
  });

  it('returns events by tenant when tenant_id is provided', async () => {
    mockListEventsByTenant.mockResolvedValue([{ id: 'e-2' }]);

    const req = new NextRequest('http://localhost/api/events?tenant_id=t-1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockListEventsByTenant).toHaveBeenCalledWith('t-1');
  });

  it('returns active event for tenant slug', async () => {
    mockGetActiveEvent.mockResolvedValue({ id: 'e-3', nombre: 'Activo' });

    const req = new NextRequest('http://localhost/api/events?tenant_slug=uc&active=true');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nombre).toBe('Activo');
  });
});

describe('POST /api/events', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Test Event', tenant_id: 't-1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 201 on successful event creation', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockCreateEvent.mockResolvedValue({ id: 'e-1', nombre: 'Test', tenant_id: 't-1' });
    mockLogAuditAction.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Test', tenant_id: 't-1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/events', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/events?id=e-1', {
      method: 'PATCH',
      body: JSON.stringify({ nombre: 'Updated' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when id is missing', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });

    const req = new NextRequest('http://localhost/api/events', {
      method: 'PATCH',
      body: JSON.stringify({ nombre: 'Updated' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful update', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockUpdateEvent.mockResolvedValue({ id: 'e-1', nombre: 'Updated' });
    mockLogAuditAction.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/events?id=e-1', {
      method: 'PATCH',
      body: JSON.stringify({ nombre: 'Updated' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/events', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/events?id=e-1', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when id is missing', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });

    const req = new NextRequest('http://localhost/api/events', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it('deactivates event by default', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockDeactivateEvent.mockResolvedValue(undefined);
    mockLogAuditAction.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/events?id=e-1', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(mockDeactivateEvent).toHaveBeenCalledWith('e-1');
    expect(mockDeleteEvent).not.toHaveBeenCalled();
  });

  it('hard deletes when action=delete', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockDeleteEvent.mockResolvedValue(undefined);
    mockLogAuditAction.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/events?id=e-1&action=delete', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(mockDeleteEvent).toHaveBeenCalledWith('e-1');
  });
});
