/**
 * Tests: Team Members — Tenant Isolation (M12)
 * Verifica que getTeamMembersForEvent enriquece correctamente
 * los datos con contexto del evento/tenant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
const mockSupabaseFrom = vi.fn();
const mockSupabaseChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      mockSupabaseFrom(table);
      return mockSupabaseChain;
    },
  }),
}));

import { getTeamMembersForEvent } from '@/lib/services/teams';
import type { Profile } from '@/types';

// ── Fixtures ──

const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'prof-member-1',
  rut: '11111111-1',
  nombre: 'Ana',
  apellido: 'López',
  email: 'ana@test.com',
  telefono: '+56912345678',
  cargo: 'Periodista',       // ← Valor global (puede ser de otro tenant)
  medio: 'Canal Global',
  tipo_medio: 'TV',
  foto_url: null,
  user_id: null,
  nacionalidad: null,
  datos_base: {},
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const MANAGER_ID = 'prof-manager-1';
const EVENT_ID = 'event-1';
const TENANT_ID = 'tenant-1';

describe('getTeamMembersForEvent — Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper: configura las respuestas de Supabase para el flujo completo de getTeamMembersForEvent.
   * Orden de llamadas:
   * 1. from('events').select.eq.single → { tenant_id }
   * 2. from('team_members').select.eq.order → team members array
   * 3. from('profiles').select.eq.single → manager profile (guard check)
   * 4. from('registrations').select.eq.in → registrations array
   */
  function setupMocks(opts: {
    members: Array<{ id: string; member_profile: Profile }>;
    registrations?: Array<{ profile_id: string; datos_extra: Record<string, unknown> }>;
    managerProfile?: { rut: string; email: string };
  }) {
    let callCount = 0;
    mockSupabaseChain.single.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // events lookup
        return Promise.resolve({ data: { tenant_id: TENANT_ID }, error: null });
      }
      // manager profile guard in getTeamMembers
      return Promise.resolve({
        data: opts.managerProfile || { rut: '99999999-9', email: 'manager@test.com' },
        error: null,
      });
    });

    mockSupabaseChain.order.mockImplementation(() => {
      // team_members query
      return Promise.resolve({
        data: opts.members.map(m => ({
          id: m.id,
          manager_id: MANAGER_ID,
          member_profile_id: m.member_profile.id,
          alias: m.member_profile.nombre,
          created_at: '2026-01-01T00:00:00Z',
          member_profile: m.member_profile,
        })),
        error: null,
      });
    });

    mockSupabaseChain.in.mockImplementation(() => {
      // registrations query
      return Promise.resolve({
        data: opts.registrations || [],
        error: null,
      });
    });
  }

  it('retorna miembros sin cambios cuando no hay datos de tenant ni registrations', async () => {
    const profile = makeProfile({
      datos_base: {}, // sin datos _tenant
    });

    setupMocks({
      members: [{ id: 'tm-1', member_profile: profile }],
      registrations: [],
    });

    const result = await getTeamMembersForEvent(MANAGER_ID, EVENT_ID);

    expect(result).toHaveLength(1);
    // Sin enriquecimiento, usa datos globales del perfil
    expect(result[0].member_profile?.cargo).toBe('Periodista');
    expect(result[0].member_profile?.medio).toBe('Canal Global');
    expect(result[0].member_profile?.tipo_medio).toBe('TV');
  });

  it('enriquece con datos de datos_base._tenant cuando existen', async () => {
    const profile = makeProfile({
      cargo: 'Periodista',       // Global (otro tenant)
      medio: 'Canal Global',
      tipo_medio: 'TV',
      datos_base: {
        _tenant: {
          [TENANT_ID]: {
            cargo: 'Fotógrafo',      // Dato del tenant correcto
            medio: 'Agencia Local',
            tipo_medio: 'Prensa Escrita',
            _form_keys: ['cargo', 'medio', 'tipo_medio'],
            _updated_at: '2026-02-01T00:00:00Z',
          },
        },
      },
    });

    setupMocks({
      members: [{ id: 'tm-1', member_profile: profile }],
      registrations: [],
    });

    const result = await getTeamMembersForEvent(MANAGER_ID, EVENT_ID);

    expect(result).toHaveLength(1);
    // Debe usar datos del tenant, NO los globales
    expect(result[0].member_profile?.cargo).toBe('Fotógrafo');
    expect(result[0].member_profile?.medio).toBe('Agencia Local');
    expect(result[0].member_profile?.tipo_medio).toBe('Prensa Escrita');
  });

  it('prioriza registration del evento sobre datos_base._tenant', async () => {
    const profile = makeProfile({
      cargo: 'Periodista',       // Global
      datos_base: {
        _tenant: {
          [TENANT_ID]: {
            cargo: 'Fotógrafo',  // Tenant data
          },
        },
      },
    });

    setupMocks({
      members: [{ id: 'tm-1', member_profile: profile }],
      registrations: [{
        profile_id: 'prof-member-1',
        datos_extra: {
          cargo: 'Camarógrafo',  // Registration data (máxima prioridad)
          organizacion: 'Medio del Evento',
        },
      }],
    });

    const result = await getTeamMembersForEvent(MANAGER_ID, EVENT_ID);

    expect(result).toHaveLength(1);
    // Registration > Tenant > Global
    expect(result[0].member_profile?.cargo).toBe('Camarógrafo');
    expect(result[0].member_profile?.medio).toBe('Medio del Evento');
  });

  it('no mezcla datos entre miembros distintos', async () => {
    const profileA = makeProfile({
      id: 'prof-a',
      rut: '11111111-1',
      nombre: 'Ana',
      cargo: 'Periodista',
      datos_base: {},
    });

    const profileB = makeProfile({
      id: 'prof-b',
      rut: '22222222-2',
      nombre: 'Juan',
      cargo: 'Editor',
      datos_base: {
        _tenant: {
          [TENANT_ID]: { cargo: 'Productor' },
        },
      },
    });

    setupMocks({
      members: [
        { id: 'tm-a', member_profile: profileA },
        { id: 'tm-b', member_profile: profileB },
      ],
      registrations: [{
        profile_id: 'prof-a',
        datos_extra: { cargo: 'Reportero' },
      }],
    });

    const result = await getTeamMembersForEvent(MANAGER_ID, EVENT_ID);

    expect(result).toHaveLength(2);
    // Ana: tiene registration → usa datos del registration
    expect(result[0].member_profile?.cargo).toBe('Reportero');
    // Juan: sin registration, tiene tenant data → usa tenant data
    expect(result[1].member_profile?.cargo).toBe('Productor');
  });

  it('falla si el evento no existe', async () => {
    mockSupabaseChain.single.mockResolvedValueOnce({ data: null, error: null });

    await expect(getTeamMembersForEvent(MANAGER_ID, 'bad-event')).rejects.toThrow(
      'Evento no encontrado'
    );
  });

  it('retorna lista vacía si manager no tiene equipo', async () => {
    mockSupabaseChain.single.mockResolvedValueOnce({
      data: { tenant_id: TENANT_ID },
      error: null,
    });
    mockSupabaseChain.order.mockResolvedValueOnce({ data: [], error: null });

    const result = await getTeamMembersForEvent(MANAGER_ID, EVENT_ID);
    expect(result).toEqual([]);
  });
});
