/**
 * Tests: profiles.ts — computeTenantProfileStatus (pure logic, no mocks)
 */
import { describe, it, expect } from 'vitest';
import { computeTenantProfileStatus } from '@/lib/services/profiles';
import type { Profile, FormFieldDefinition } from '@/types';

const makeField = (key: string, required = true, profile_field?: string): FormFieldDefinition => ({
  key,
  label: key,
  type: 'text',
  required,
  profile_field,
});

const baseProfile: Profile = {
  id: 'p-1',
  rut: '12345678-9',
  nombre: 'Juan',
  apellido: 'Pérez',
  email: 'jp@test.com',
  telefono: '+56912345678',
  nacionalidad: null,
  cargo: 'Periodista',
  medio: null,
  tipo_medio: null,
  datos_base: {},
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  user_id: null,
  foto_url: null,
};

describe('computeTenantProfileStatus', () => {
  it('returns all fields missing when profile has no data for form', () => {
    const fields = [
      makeField('talla_polera', true),
      makeField('grupo_sanguineo', true),
    ];

    const result = computeTenantProfileStatus(baseProfile, 'tenant-1', fields);
    expect(result.totalRequired).toBe(2);
    expect(result.filledRequired).toBe(0);
    expect(result.missingFields).toHaveLength(2);
  });

  it('detects filled fields from profile fixed fields', () => {
    const fields = [
      makeField('nombre', true, 'nombre'),
      makeField('cargo', true, 'cargo'),
      makeField('talla_polera', true),
    ];

    const result = computeTenantProfileStatus(baseProfile, 'tenant-1', fields);
    expect(result.totalRequired).toBe(3);
    expect(result.filledRequired).toBe(2); // nombre + cargo filled
    expect(result.missingFields).toHaveLength(1);
    expect(result.missingFields[0].key).toBe('talla_polera');
  });

  it('detects filled fields from tenant-specific datos_base', () => {
    const profile: Profile = {
      ...baseProfile,
      datos_base: {
        _tenant: {
          'tenant-1': { talla_polera: 'L', _form_keys: ['talla_polera'], _updated_at: '2026-01-01' },
        },
      },
    };

    const fields = [makeField('talla_polera', true)];
    const result = computeTenantProfileStatus(profile, 'tenant-1', fields);
    expect(result.filledRequired).toBe(1);
    expect(result.missingFields).toHaveLength(0);
  });

  it('detects form changes (new keys added)', () => {
    const profile: Profile = {
      ...baseProfile,
      datos_base: {
        _tenant: {
          'tenant-1': {
            talla_polera: 'M',
            _form_keys: ['talla_polera'],
            _updated_at: '2026-01-01',
          },
        },
      },
    };

    // Form now has a new field
    const fields = [
      makeField('talla_polera', true),
      makeField('grupo_sanguineo', true),
    ];

    const result = computeTenantProfileStatus(profile, 'tenant-1', fields);
    expect(result.formChanged).toBe(true);
    expect(result.newKeys).toContain('grupo_sanguineo');
  });

  it('detects form changes (keys removed)', () => {
    const profile: Profile = {
      ...baseProfile,
      datos_base: {
        _tenant: {
          'tenant-1': {
            talla_polera: 'M',
            grupo_sanguineo: 'A+',
            _form_keys: ['talla_polera', 'grupo_sanguineo'],
            _updated_at: '2026-01-01',
          },
        },
      },
    };

    // Form now only has talla_polera
    const fields = [makeField('talla_polera', true)];
    const result = computeTenantProfileStatus(profile, 'tenant-1', fields);
    expect(result.formChanged).toBe(true);
    expect(result.removedKeys).toContain('grupo_sanguineo');
  });

  it('formChanged=false when no prior data', () => {
    const fields = [makeField('talla_polera', true)];
    const result = computeTenantProfileStatus(baseProfile, 'tenant-1', fields);
    expect(result.formChanged).toBe(false);
    expect(result.newKeys).toHaveLength(0);
    expect(result.removedKeys).toHaveLength(0);
  });

  it('ignores non-required fields for missing count', () => {
    const fields = [
      makeField('nombre', true, 'nombre'),
      makeField('comentarios', false), // optional
    ];

    const result = computeTenantProfileStatus(baseProfile, 'tenant-1', fields);
    expect(result.totalRequired).toBe(1); // only nombre
    expect(result.filledRequired).toBe(1); // nombre is filled
    expect(result.missingFields).toHaveLength(0);
  });

  it('returns empty when no form fields', () => {
    const result = computeTenantProfileStatus(baseProfile, 'tenant-1', []);
    expect(result.totalRequired).toBe(0);
    expect(result.filledRequired).toBe(0);
    expect(result.missingFields).toHaveLength(0);
  });
});
