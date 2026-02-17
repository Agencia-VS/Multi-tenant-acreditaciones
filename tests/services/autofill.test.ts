/**
 * Tests: buildMergedAutofillData — Pure function, no mocks needed
 *
 * Cascade priority: tenant-specific → flat datos_base → profile fixed fields
 */
import { describe, it, expect } from 'vitest';
import { buildMergedAutofillData } from '@/lib/services/autofill';
import type { Profile, FormFieldDefinition } from '@/types';

const makeField = (key: string, profile_field?: string): FormFieldDefinition => ({
  key,
  label: key,
  type: 'text',
  required: false,
  profile_field,
});

describe('buildMergedAutofillData', () => {
  // ── Basic: full Profile with fixed fields ──
  it('fills from profile fixed fields', () => {
    const profile: Profile = {
      id: 'p-1',
      rut: '12345678-9',
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'jp@test.com',
      telefono: '+56912345678',
      nacionalidad: 'Chilena',
      cargo: 'Periodista',
      medio: 'Radio ABC',
      tipo_medio: 'Radial',
      datos_base: {},
      created_at: '',
      updated_at: '',
      user_id: null,
    };

    const fields = [
      makeField('nombre', 'nombre'),
      makeField('apellido', 'apellido'),
      makeField('email', 'email'),
      makeField('cargo', 'cargo'),
    ];

    const result = buildMergedAutofillData(profile, 'tenant-1', fields);
    expect(result).toEqual({
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'jp@test.com',
      cargo: 'Periodista',
    });
  });

  // ── Tenant-specific data has highest priority ──
  it('prefers tenant-specific data over flat datos_base', () => {
    const profile: Profile = {
      id: 'p-1', rut: '12345678-9', nombre: 'Juan', apellido: 'Pérez',
      email: 'jp@test.com', telefono: null, nacionalidad: null,
      cargo: null, medio: null, tipo_medio: null,
      datos_base: {
        talla_polera: 'M',
        _tenant: {
          'tenant-1': { talla_polera: 'L' },
        },
      },
      created_at: '', updated_at: '', user_id: null,
    };

    const fields = [makeField('talla_polera', 'datos_base.talla_polera')];
    const result = buildMergedAutofillData(profile, 'tenant-1', fields);
    expect(result.talla_polera).toBe('L'); // tenant-specific wins
  });

  // ── Falls back to flat datos_base when no tenant data ──
  it('falls back to flat datos_base when no tenant-specific data', () => {
    const profile: Profile = {
      id: 'p-1', rut: '12345678-9', nombre: 'Juan', apellido: 'Pérez',
      email: null, telefono: null, nacionalidad: null,
      cargo: null, medio: null, tipo_medio: null,
      datos_base: { talla_polera: 'S' },
      created_at: '', updated_at: '', user_id: null,
    };

    const fields = [makeField('talla_polera', 'datos_base.talla_polera')];
    const result = buildMergedAutofillData(profile, 'tenant-1', fields);
    expect(result.talla_polera).toBe('S');
  });

  // ── Empty when no data available ──
  it('returns empty object when no matching data', () => {
    const profile: Profile = {
      id: 'p-1', rut: '12345678-9', nombre: 'Juan', apellido: 'Pérez',
      email: null, telefono: null, nacionalidad: null,
      cargo: null, medio: null, tipo_medio: null,
      datos_base: {},
      created_at: '', updated_at: '', user_id: null,
    };

    const fields = [makeField('talla_polera', 'datos_base.talla_polera')];
    const result = buildMergedAutofillData(profile, 'tenant-1', fields);
    expect(result).toEqual({});
  });

  // ── Works with datosBase object (client-side usage) ──
  it('works with plain datosBase object (non-Profile)', () => {
    const datosBase = {
      talla_polera: 'XL',
      _tenant: { 'tenant-2': { talla_polera: 'XXL' } },
    };

    const fields = [makeField('talla_polera')];
    const result = buildMergedAutofillData(datosBase, 'tenant-2', fields);
    expect(result.talla_polera).toBe('XXL');
  });

  it('uses flat value with plain datosBase when no tenant match', () => {
    const datosBase = { talla_polera: 'XL' };
    const fields = [makeField('talla_polera')];
    const result = buildMergedAutofillData(datosBase, 'no-match', fields);
    expect(result.talla_polera).toBe('XL');
  });

  // ── No fields → no output ──
  it('returns empty when formFields is empty', () => {
    const profile: Profile = {
      id: 'p-1', rut: '12345678-9', nombre: 'Juan', apellido: 'Pérez',
      email: 'jp@test.com', telefono: null, nacionalidad: null,
      cargo: 'Periodista', medio: null, tipo_medio: null,
      datos_base: { talla_polera: 'M' },
      created_at: '', updated_at: '', user_id: null,
    };

    const result = buildMergedAutofillData(profile, 'tenant-1', []);
    expect(result).toEqual({});
  });

  // ── profile_field resolution via datos_base key ──
  it('resolves profile_field via tenant → flat → profile', () => {
    const profile: Profile = {
      id: 'p-1', rut: '12345678-9', nombre: 'Juan', apellido: 'Pérez',
      email: 'jp@test.com', telefono: '+56912345678', nacionalidad: null,
      cargo: null, medio: null, tipo_medio: null,
      datos_base: {},
      created_at: '', updated_at: '', user_id: null,
    };

    // profile_field = "telefono" → resolves from profile.telefono
    const fields = [makeField('phone', 'telefono')];
    const result = buildMergedAutofillData(profile, 'tenant-1', fields);
    expect(result.phone).toBe('+56912345678');
  });

  // ── Null/empty values are skipped ──
  it('skips null and empty string values', () => {
    const profile: Profile = {
      id: 'p-1', rut: '12345678-9', nombre: 'Juan', apellido: '',
      email: null, telefono: null, nacionalidad: null,
      cargo: null, medio: null, tipo_medio: null,
      datos_base: { x: null, y: '' },
      created_at: '', updated_at: '', user_id: null,
    };

    const fields = [
      makeField('apellido', 'apellido'),
      makeField('email', 'email'),
      makeField('x'),
      makeField('y'),
    ];
    const result = buildMergedAutofillData(profile, 'tenant-1', fields);
    // apellido is '' → skipped, email is null → skipped
    expect(result).toEqual({});
  });
});
