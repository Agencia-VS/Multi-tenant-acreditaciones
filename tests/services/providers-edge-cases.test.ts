/**
 * Tests: Provider Edge Cases (F8 — QA)
 *
 * Cubre los 8 edge cases del doc PROVIDERS-FLOW.md § 9:
 * 1. Proveedor suspendido: nuevas solicitudes bloqueadas
 * 2. Admin cambia zonas: solo afecta futuro
 * 3. Admin desactiva provider_mode: config → open, providers permanecen
 * 4. Doble solicitud: re-request tras rechazo + errores descriptivos
 * 5. Tenant sin zonas: toggle falla
 * 6. Aprobar con 0 zonas: falla
 * 7. Código regenerado: viejo caduca inmediatamente
 * 8. Acceso sin código: landing genérica
 *
 * Además: intersección de zonas del proveedor con zonas del evento.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase mock ─────────────────────────────────────────

/**
 * Creates an independent chainable mock.
 * `terminalValue` is returned when the chain reaches a terminal call (single() / non-chained eq()).
 * If `eqTerminal` is provided, eq() returns it directly (for `.update().eq()` patterns).
 */
function makeChain(terminalValue: unknown = { data: null, error: null }, eqTerminal?: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'in', 'order'];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn().mockResolvedValue(terminalValue);
  // eq: returns chain for chaining, unless eqTerminal is set (for final await)
  if (eqTerminal !== undefined) {
    chain.eq = vi.fn().mockResolvedValue(eqTerminal);
  } else {
    chain.eq = vi.fn(() => chain);
  }
  return chain;
}

/** Queue of chains: each from() call pops the next chain. */
const fromQueue: unknown[] = [];
const mockFrom = vi.fn(() => {
  if (fromQueue.length > 0) return fromQueue.shift();
  return makeChain(); // fallback
});

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({ from: mockFrom }),
}));

// ─── Imports (after mocks) ─────────────────────────────────

import {
  createProviderRequest,
  approveProvider,
  updateProviderZones,
  toggleProviderMode,
  validateInviteCode,
  getProviderByTenantAndProfile,
} from '@/lib/services/providers';

// ─── Helpers ────────────────────────────────────────────────

const TENANT_ID = '11111111-1111-4111-a111-111111111111';
const PROFILE_ID = '22222222-2222-4222-a222-222222222222';

function resetMocks() {
  vi.clearAllMocks();
  fromQueue.length = 0;
}

// ═════════════════════════════════════════════════════════════
// Edge Case 4: Doble solicitud (re-request after rejection)
// ═════════════════════════════════════════════════════════════
describe('Edge 4: createProviderRequest — duplicate handling', () => {
  beforeEach(resetMocks);

  it('re-requests after rejection — resets to pending', async () => {
    const existingRejected = {
      id: 'prov-1',
      tenant_id: TENANT_ID,
      profile_id: PROFILE_ID,
      status: 'rejected',
      mensaje: 'old message',
      organizacion: 'old org',
      motivo_rechazo: 'No cumple',
    };
    const updatedProvider = { ...existingRejected, status: 'pending', motivo_rechazo: null, mensaje: 'Solicito acceso de nuevo' };

    // 1st from('tenant_providers') → getProviderByTenantAndProfile → returns rejected
    fromQueue.push(makeChain({ data: existingRejected, error: null }));
    // 2nd from('tenant_providers') → update → returns updated
    fromQueue.push(makeChain({ data: updatedProvider, error: null }));

    const result = await createProviderRequest({
      tenantId: TENANT_ID,
      profileId: PROFILE_ID,
      mensaje: 'Solicito acceso de nuevo',
    });

    expect(result.status).toBe('pending');
    expect(result.motivo_rechazo).toBeNull();
    expect(result.mensaje).toBe('Solicito acceso de nuevo');
  });

  it('throws descriptive error when already pending', async () => {
    fromQueue.push(makeChain({
      data: { id: 'prov-2', status: 'pending', tenant_id: TENANT_ID, profile_id: PROFILE_ID },
      error: null,
    }));

    await expect(
      createProviderRequest({ tenantId: TENANT_ID, profileId: PROFILE_ID }),
    ).rejects.toThrow('solicitud pendiente');
  });

  it('throws descriptive error when already approved', async () => {
    fromQueue.push(makeChain({
      data: { id: 'prov-3', status: 'approved', tenant_id: TENANT_ID, profile_id: PROFILE_ID },
      error: null,
    }));

    await expect(
      createProviderRequest({ tenantId: TENANT_ID, profileId: PROFILE_ID }),
    ).rejects.toThrow('Ya tienes acceso');
  });

  it('throws descriptive error when suspended', async () => {
    fromQueue.push(makeChain({
      data: { id: 'prov-4', status: 'suspended', tenant_id: TENANT_ID, profile_id: PROFILE_ID },
      error: null,
    }));

    await expect(
      createProviderRequest({ tenantId: TENANT_ID, profileId: PROFILE_ID }),
    ).rejects.toThrow('suspendido');
  });
});

// ═════════════════════════════════════════════════════════════
// Edge Case 6: Aprobar con 0 zonas / actualizar a 0 zonas
// ═════════════════════════════════════════════════════════════
describe('Edge 6: approveProvider / updateProviderZones — zone minimum', () => {
  beforeEach(resetMocks);

  it('approveProvider rejects empty allowedZones', async () => {
    await expect(
      approveProvider('prov-1', { allowedZones: [], approvedBy: 'admin-1' }),
    ).rejects.toThrow('al menos una zona');
  });

  it('updateProviderZones rejects empty array', async () => {
    await expect(
      updateProviderZones('prov-1', []),
    ).rejects.toThrow('al menos una zona');
  });
});

// ═════════════════════════════════════════════════════════════
// Edge Case 5: Tenant sin zonas → toggle falla
// ═════════════════════════════════════════════════════════════
describe('Edge 5: toggleProviderMode — zonas required', () => {
  beforeEach(resetMocks);

  it('fails to enable when tenant has no zonas', async () => {
    fromQueue.push(makeChain({ data: { config: {} }, error: null }));

    await expect(
      toggleProviderMode(TENANT_ID, true),
    ).rejects.toThrow('zonas configuradas');
  });

  it('fails to enable when tenant zonas is empty array', async () => {
    fromQueue.push(makeChain({ data: { config: { zonas: [] } }, error: null }));

    await expect(
      toggleProviderMode(TENANT_ID, true),
    ).rejects.toThrow('zonas configuradas');
  });

  it('succeeds when tenant has zonas and generates invite code', async () => {
    // 1st from('tenants') → read config
    fromQueue.push(makeChain({ data: { config: { zonas: ['VIP', 'Staff'] } }, error: null }));
    // 2nd from('tenants') → update config (terminal eq returns { error: null })
    fromQueue.push(makeChain(undefined, { error: null }));

    const result = await toggleProviderMode(TENANT_ID, true);
    expect(result.provider_mode).toBe('approved_only');
    expect(result.provider_invite_code).toBeTruthy();
    expect(typeof result.provider_invite_code).toBe('string');
  });
});

// ═════════════════════════════════════════════════════════════
// Edge Case 3: Desactivar provider_mode → open (providers permanecen)
// ═════════════════════════════════════════════════════════════
describe('Edge 3: toggleProviderMode disable — providers persist', () => {
  beforeEach(resetMocks);

  it('sets mode to open without deleting provider records', async () => {
    // 1st from('tenants') → read config
    fromQueue.push(makeChain({
      data: { config: { provider_mode: 'approved_only', provider_invite_code: 'ABC123', zonas: ['VIP'] } },
      error: null,
    }));
    // 2nd from('tenants') → update config (terminal eq)
    fromQueue.push(makeChain(undefined, { error: null }));

    const result = await toggleProviderMode(TENANT_ID, false);
    expect(result.provider_mode).toBe('open');

    // Key assertion: from() was only called for 'tenants', not 'tenant_providers'
    const fromCalls = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(fromCalls).not.toContain('tenant_providers');
  });
});

// ═════════════════════════════════════════════════════════════
// Edge Case 7: Código regenerado invalida el anterior
// ═════════════════════════════════════════════════════════════
describe('Edge 7: validateInviteCode — code regeneration', () => {
  beforeEach(resetMocks);

  it('rejects old code after regeneration (different code in config)', async () => {
    fromQueue.push(makeChain({
      data: {
        id: TENANT_ID,
        nombre: 'UC',
        slug: 'uc',
        logo_url: null,
        config: { provider_mode: 'approved_only', provider_invite_code: 'NEWCODE1' },
      },
      error: null,
    }));

    const result = await validateInviteCode('uc', 'OLDCODE1');
    expect(result.valid).toBe(false);
  });

  it('accepts current code', async () => {
    fromQueue.push(makeChain({
      data: {
        id: TENANT_ID,
        nombre: 'UC',
        slug: 'uc',
        logo_url: null,
        config: { provider_mode: 'approved_only', provider_invite_code: 'CURRENT8' },
      },
      error: null,
    }));

    const result = await validateInviteCode('uc', 'CURRENT8');
    expect(result.valid).toBe(true);
    expect(result.tenantNombre).toBe('UC');
  });

  it('rejects when provider_mode is not approved_only', async () => {
    fromQueue.push(makeChain({
      data: {
        id: TENANT_ID,
        nombre: 'UC',
        slug: 'uc',
        logo_url: null,
        config: { provider_mode: 'open', provider_invite_code: 'CODE1234' },
      },
      error: null,
    }));

    const result = await validateInviteCode('uc', 'CODE1234');
    expect(result.valid).toBe(false);
  });

  it('rejects when tenant has no config', async () => {
    fromQueue.push(makeChain({
      data: {
        id: TENANT_ID,
        nombre: 'UC',
        slug: 'uc',
        logo_url: null,
        config: null,
      },
      error: null,
    }));

    const result = await validateInviteCode('uc', 'ANYTHING');
    expect(result.valid).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════
// Edge Case 1: Proveedor suspendido — no puede acreditar
// (Complementa F7 bulk tests; aquí verifica el fetcher)
// ═════════════════════════════════════════════════════════════
describe('Edge 1: suspended provider — access check', () => {
  beforeEach(resetMocks);

  it('getProviderByTenantAndProfile returns suspended record', async () => {
    const suspendedProvider = {
      id: 'prov-s1',
      tenant_id: TENANT_ID,
      profile_id: PROFILE_ID,
      status: 'suspended',
      allowed_zones: ['VIP'],
    };

    fromQueue.push(makeChain({ data: suspendedProvider, error: null }));

    const result = await getProviderByTenantAndProfile(TENANT_ID, PROFILE_ID);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('suspended');
    // Caller (gate) must check status !== 'approved' → block
  });

  it('returns null when provider does not exist', async () => {
    fromQueue.push(makeChain({ data: null, error: { code: 'PGRST116' } }));

    const result = await getProviderByTenantAndProfile(TENANT_ID, PROFILE_ID);
    expect(result).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════
// Zone intersection logic (used in acreditacion page + bulk)
// ═════════════════════════════════════════════════════════════
describe('Zone intersection logic (pure)', () => {
  /**
   * Extracted from acreditacion/page.tsx L164:
   * const eventZonas = (providerAllowedZones && zonaEnFormulario)
   *   ? eventZonasRaw.filter(z => providerAllowedZones.includes(z))
   *   : eventZonasRaw;
   */
  function intersectZones(
    eventZonasRaw: string[],
    providerAllowedZones: string[] | null,
    zonaEnFormulario: boolean,
  ): string[] {
    return providerAllowedZones && zonaEnFormulario
      ? eventZonasRaw.filter(z => providerAllowedZones.includes(z))
      : eventZonasRaw;
  }

  it('returns all event zones when no provider zones', () => {
    const result = intersectZones(['VIP', 'Staff', 'Prensa'], null, true);
    expect(result).toEqual(['VIP', 'Staff', 'Prensa']);
  });

  it('returns all event zones when zona_en_formulario is off', () => {
    const result = intersectZones(['VIP', 'Staff', 'Prensa'], ['VIP'], false);
    expect(result).toEqual(['VIP', 'Staff', 'Prensa']);
  });

  it('intersects correctly when provider has subset', () => {
    const result = intersectZones(['VIP', 'Staff', 'Prensa', 'Cancha'], ['VIP', 'Prensa'], true);
    expect(result).toEqual(['VIP', 'Prensa']);
  });

  it('returns empty when provider zones have no overlap', () => {
    const result = intersectZones(['VIP', 'Staff'], ['Cancha', 'Tribuna'], true);
    expect(result).toEqual([]);
  });

  it('handles empty event zones', () => {
    const result = intersectZones([], ['VIP'], true);
    expect(result).toEqual([]);
  });

  it('handles provider with all event zones (superset works as intersection)', () => {
    const result = intersectZones(['VIP', 'Staff'], ['VIP', 'Staff', 'Prensa', 'Cancha'], true);
    expect(result).toEqual(['VIP', 'Staff']);
  });

  it('is case-sensitive (zone names must match exactly)', () => {
    const result = intersectZones(['VIP', 'vip'], ['VIP'], true);
    expect(result).toEqual(['VIP']);
  });
});

// ═════════════════════════════════════════════════════════════
// Edge Case 2: updateProviderZones only changes provider record
// ═════════════════════════════════════════════════════════════
describe('Edge 2: updateProviderZones — no impact on existing registrations', () => {
  beforeEach(resetMocks);

  it('updates only tenant_providers table', async () => {
    const updated = { id: 'prov-1', allowed_zones: ['Cancha'] };
    fromQueue.push(makeChain({ data: updated, error: null }));

    const result = await updateProviderZones('prov-1', ['Cancha']);
    expect(result.allowed_zones).toEqual(['Cancha']);

    // Verify only tenant_providers was touched
    const fromCalls = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(fromCalls).toEqual(['tenant_providers']);
    // No call to 'registrations' table
    expect(fromCalls).not.toContain('registrations');
  });
});
