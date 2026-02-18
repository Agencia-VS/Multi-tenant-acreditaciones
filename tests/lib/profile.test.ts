/**
 * Tests para lib/profile.ts — isProfileComplete, getMissingProfileFields
 */
import { describe, it, expect } from 'vitest';
import {
  isProfileComplete,
  getMissingProfileFields,
  REQUIRED_PROFILE_FIELDS,
} from '@/lib/profile';

describe('isProfileComplete', () => {
  it('retorna false para null', () => {
    expect(isProfileComplete(null)).toBe(false);
  });

  it('retorna false para undefined', () => {
    expect(isProfileComplete(undefined)).toBe(false);
  });

  it('retorna false si faltan todos los campos', () => {
    expect(isProfileComplete({ rut: '12345678-9' })).toBe(false);
  });

  it('retorna false si falta medio', () => {
    expect(isProfileComplete({
      nombre: 'Juan',
      apellido: 'Pérez',
      medio: null,
      tipo_medio: 'Televisión',
    })).toBe(false);
  });

  it('retorna false si medio es string vacío', () => {
    expect(isProfileComplete({
      nombre: 'Juan',
      apellido: 'Pérez',
      medio: '',
      tipo_medio: 'Televisión',
    })).toBe(false);
  });

  it('retorna false si falta tipo_medio', () => {
    expect(isProfileComplete({
      nombre: 'Juan',
      apellido: 'Pérez',
      medio: 'Canal 13',
      tipo_medio: '',
    })).toBe(false);
  });

  it('retorna false si falta nombre', () => {
    expect(isProfileComplete({
      nombre: '',
      apellido: 'Pérez',
      medio: 'Canal 13',
      tipo_medio: 'Televisión',
    })).toBe(false);
  });

  it('retorna true si todos los campos requeridos están completos', () => {
    expect(isProfileComplete({
      nombre: 'Juan',
      apellido: 'Pérez',
      medio: 'Canal 13',
      tipo_medio: 'Televisión',
    })).toBe(true);
  });

  it('retorna true con campos extra presentes', () => {
    expect(isProfileComplete({
      nombre: 'Juan',
      apellido: 'Pérez',
      medio: 'ESPN Chile',
      tipo_medio: 'Radio',
      cargo: 'Periodista',
      email: 'juan@test.com',
    })).toBe(true);
  });
});

describe('getMissingProfileFields', () => {
  it('retorna todos los campos para null', () => {
    const missing = getMissingProfileFields(null);
    expect(missing).toHaveLength(REQUIRED_PROFILE_FIELDS.length);
    expect(missing.map(f => f.key)).toEqual(['nombre', 'apellido', 'medio', 'tipo_medio']);
  });

  it('retorna campos faltantes', () => {
    const missing = getMissingProfileFields({
      nombre: 'Ana',
      apellido: 'López',
      medio: null,
      tipo_medio: '',
    });
    expect(missing).toHaveLength(2);
    expect(missing.map(f => f.key)).toEqual(['medio', 'tipo_medio']);
  });

  it('retorna array vacío si perfil completo', () => {
    const missing = getMissingProfileFields({
      nombre: 'Ana',
      apellido: 'López',
      medio: 'Radio ADN',
      tipo_medio: 'Radio',
    });
    expect(missing).toHaveLength(0);
  });

  it('identifica solo nombre faltante', () => {
    const missing = getMissingProfileFields({
      nombre: '',
      apellido: 'López',
      medio: 'Diario X',
      tipo_medio: 'Prensa Escrita',
    });
    expect(missing).toHaveLength(1);
    expect(missing[0]).toEqual({ key: 'nombre', label: 'Nombre' });
  });
});

describe('REQUIRED_PROFILE_FIELDS', () => {
  it('contiene exactamente 4 campos', () => {
    expect(REQUIRED_PROFILE_FIELDS).toHaveLength(4);
  });

  it('cada campo tiene key y label', () => {
    REQUIRED_PROFILE_FIELDS.forEach(field => {
      expect(field).toHaveProperty('key');
      expect(field).toHaveProperty('label');
      expect(typeof field.key).toBe('string');
      expect(typeof field.label).toBe('string');
    });
  });
});
