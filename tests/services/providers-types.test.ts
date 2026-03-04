import { describe, it, expect } from 'vitest';
import type {
  TenantProvider,
  TenantProviderFull,
  ProviderStatus,
  ProviderMode,
  TenantConfig,
  AdminTab,
  Profile,
} from '@/types';

// ─── Compile-time type checks (if these compile, they pass) ───

describe('Provider types', () => {
  it('ProviderStatus covers all valid statuses', () => {
    const statuses: ProviderStatus[] = ['pending', 'approved', 'rejected', 'suspended'];
    expect(statuses).toHaveLength(4);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('approved');
    expect(statuses).toContain('rejected');
    expect(statuses).toContain('suspended');
  });

  it('ProviderMode covers open and approved_only', () => {
    const modes: ProviderMode[] = ['open', 'approved_only'];
    expect(modes).toHaveLength(2);
    expect(modes).toContain('open');
    expect(modes).toContain('approved_only');
  });

  it('TenantConfig has provider fields as optional', () => {
    // A TenantConfig with no provider fields should be valid
    const config: TenantConfig = {};
    expect(config.provider_mode).toBeUndefined();
    expect(config.provider_invite_code).toBeUndefined();
    expect(config.provider_description).toBeUndefined();
  });

  it('TenantConfig accepts provider_mode as approved_only', () => {
    const config: TenantConfig = {
      provider_mode: 'approved_only',
      provider_invite_code: 'abc123',
      provider_description: 'Organización deportiva',
      zonas: ['VIP', 'Staff', 'Prensa'],
    };
    expect(config.provider_mode).toBe('approved_only');
    expect(config.provider_invite_code).toBe('abc123');
    expect(config.zonas).toHaveLength(3);
  });

  it('TenantConfig defaults to open mode when provider_mode is undefined', () => {
    const config: TenantConfig = { zonas: ['General'] };
    const mode = config.provider_mode ?? 'open';
    expect(mode).toBe('open');
  });

  it('AdminTab includes proveedores', () => {
    const tabs: AdminTab[] = ['acreditaciones', 'configuracion', 'mail', 'plan', 'proveedores'];
    expect(tabs).toContain('proveedores');
    expect(tabs).toHaveLength(5);
  });

  it('TenantProvider has required fields', () => {
    const provider: TenantProvider = {
      id: 'prov-1',
      tenant_id: 'tenant-1',
      profile_id: 'profile-1',
      status: 'approved',
      allowed_zones: ['VIP', 'Staff'],
      organizacion: 'TV Canal 5',
      mensaje: null,
      notas: null,
      approved_by: 'admin-user-1',
      approved_at: '2026-03-01T00:00:00Z',
      rejected_at: null,
      motivo_rechazo: null,
      created_at: '2026-02-28T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    };
    expect(provider.status).toBe('approved');
    expect(provider.allowed_zones).toEqual(['VIP', 'Staff']);
    expect(provider.tenant_id).toBe('tenant-1');
  });

  it('TenantProvider with pending status has empty zones', () => {
    const provider: TenantProvider = {
      id: 'prov-2',
      tenant_id: 'tenant-1',
      profile_id: 'profile-2',
      status: 'pending',
      allowed_zones: [],
      organizacion: 'Radio FM',
      mensaje: 'Somos medio deportivo local',
      notas: null,
      approved_by: null,
      approved_at: null,
      rejected_at: null,
      motivo_rechazo: null,
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    };
    expect(provider.status).toBe('pending');
    expect(provider.allowed_zones).toEqual([]);
    expect(provider.mensaje).toBe('Somos medio deportivo local');
  });

  it('TenantProviderFull extends TenantProvider with profile', () => {
    const providerFull: TenantProviderFull = {
      id: 'prov-3',
      tenant_id: 'tenant-1',
      profile_id: 'profile-3',
      status: 'approved',
      allowed_zones: ['Prensa'],
      organizacion: 'Diario Deportivo',
      mensaje: null,
      notas: 'Proveedor confiable',
      approved_by: 'admin-1',
      approved_at: '2026-03-01T00:00:00Z',
      rejected_at: null,
      motivo_rechazo: null,
      created_at: '2026-02-28T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
      profile: {
        id: 'profile-3',
        user_id: 'user-3',
        rut: '12345678-9',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@diario.cl',
        telefono: '+56912345678',
        nacionalidad: 'Chilena',
        foto_url: null,
        cargo: 'Jefe de Prensa',
        medio: 'Diario Deportivo',
        tipo_medio: 'Prensa Escrita',
        datos_base: {},
        document_type: 'rut',
        document_number: '12345678-9',
        document_normalized: '123456789',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      } as Profile,
    };
    expect(providerFull.profile?.nombre).toBe('Juan');
    expect(providerFull.allowed_zones).toEqual(['Prensa']);
  });

  it('TenantConfig backward compatible — existing configs without provider fields work', () => {
    // Simulate an existing tenant config from DB
    const existingConfig: TenantConfig = {
      acreditacion_masiva_enabled: true,
      zonas: ['VIP', 'Staff', 'Cancha'],
      puntoticket_acreditacion_fija: 'Acreditación',
      social: { instagram: '@club' },
    };
    // provider_mode should be undefined (= 'open' behavior)
    expect(existingConfig.provider_mode).toBeUndefined();
    // Existing fields untouched
    expect(existingConfig.acreditacion_masiva_enabled).toBe(true);
    expect(existingConfig.zonas).toHaveLength(3);
  });
});
