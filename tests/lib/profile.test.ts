/**
 * Tests para lib/profile.ts — isProfileComplete, getMissingProfileFields,
 * isReadyToAccredit, getMissingAccreditationFields
 */
import { describe, it, expect } from 'vitest';
import {
  isProfileComplete,
  getMissingProfileFields,
  REQUIRED_PROFILE_FIELDS,
  isReadyToAccredit,
  getMissingAccreditationFields,
  ACCREDITATION_REQUIRED_FIELDS,
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

  it('retorna false si falta tipo de documento', () => {
    expect(isProfileComplete({
      document_number: '12345678-9',
      nombre: 'Juan',
      apellido: 'Pérez',
      medio: 'Canal 13',
    })).toBe(false);
  });

  it('retorna false si falta documento', () => {
    expect(isProfileComplete({
      document_type: 'rut',
      nombre: 'Juan',
      apellido: 'Pérez',
      medio: 'Canal 13',
    })).toBe(false);
  });

  it('retorna false si falta medio', () => {
    expect(isProfileComplete({
      nombre: 'Juan',
      apellido: 'Pérez',
      medio: null,
    })).toBe(false);
  });

  it('retorna false si medio es string vacío', () => {
    expect(isProfileComplete({
      nombre: 'Juan',
      apellido: 'Pérez',
      medio: '',
    })).toBe(false);
  });

  it('retorna false si falta nombre', () => {
    expect(isProfileComplete({
      nombre: '',
      apellido: 'Pérez',
      medio: 'Canal 13',
    })).toBe(false);
  });

  it('retorna true si todos los campos requeridos están completos', () => {
    expect(isProfileComplete({
      document_type: 'rut',
      document_number: '12345678-9',
      nombre: 'Juan',
      apellido: 'Pérez',
      medio: 'Canal 13',
    })).toBe(true);
  });

  it('retorna true con campos extra presentes', () => {
    expect(isProfileComplete({
      document_type: 'rut',
      document_number: '12345678-9',
      nombre: 'Juan',
      apellido: 'Pérez',
      medio: 'ESPN Chile',
      tipo_medio: 'Radio',
      cargo: 'Periodista',
      email: 'juan@test.com',
    })).toBe(true);
  });

  it('retorna true sin tipo_medio (ya no es requerido)', () => {
    expect(isProfileComplete({
      document_type: 'rut',
      document_number: '12345678-9',
      nombre: 'Juan',
      apellido: 'Pérez',
      medio: 'Canal 13',
      tipo_medio: null,
    })).toBe(true);
  });
});

describe('getMissingProfileFields', () => {
  it('retorna todos los campos para null', () => {
    const missing = getMissingProfileFields(null);
    expect(missing).toHaveLength(REQUIRED_PROFILE_FIELDS.length);
    expect(missing.map(f => f.key)).toEqual(['document_type', 'document_number', 'nombre', 'apellido', 'medio']);
  });

  it('retorna campos faltantes', () => {
    const missing = getMissingProfileFields({
      document_type: 'rut',
      document_number: '12345678-9',
      nombre: 'Ana',
      apellido: 'López',
      medio: null,
    });
    expect(missing).toHaveLength(1);
    expect(missing.map(f => f.key)).toEqual(['medio']);
  });

  it('retorna array vacío si perfil completo', () => {
    const missing = getMissingProfileFields({
      document_type: 'rut',
      document_number: '12345678-9',
      nombre: 'Ana',
      apellido: 'López',
      medio: 'Radio ADN',
    });
    expect(missing).toHaveLength(0);
  });

  it('identifica solo nombre faltante', () => {
    const missing = getMissingProfileFields({
      document_type: 'rut',
      document_number: '12345678-9',
      nombre: '',
      apellido: 'López',
      medio: 'Diario X',
    });
    expect(missing).toHaveLength(1);
    expect(missing[0]).toEqual({ key: 'nombre', label: 'Nombre' });
  });
});

describe('REQUIRED_PROFILE_FIELDS', () => {
  it('contiene exactamente 5 campos', () => {
    expect(REQUIRED_PROFILE_FIELDS).toHaveLength(5);
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

// ──────────────────────────────────────────────────────────
// isReadyToAccredit — identidad + datos base
// ──────────────────────────────────────────────────────────

const fullAccreditProfile = {
  document_type: 'rut',
  document_number: '12345678-9',
  nombre: 'Juan',
  apellido: 'Pérez',
  medio: 'Canal 13',
  rut: '12345678-9',
};

describe('isReadyToAccredit', () => {
  it('retorna false para null', () => {
    expect(isReadyToAccredit(null)).toBe(false);
  });

  it('retorna false para undefined', () => {
    expect(isReadyToAccredit(undefined)).toBe(false);
  });

  it('retorna false si falta rut pero perfil completo', () => {
    expect(isReadyToAccredit({
      document_type: 'rut',
      document_number: null,
      nombre: 'Juan',
      apellido: 'Pérez',
      medio: 'Canal 13',
      rut: null,
    })).toBe(false);
  });

  it('retorna false si documento es string vacío', () => {
    expect(isReadyToAccredit({
      ...fullAccreditProfile,
      document_number: '',
    })).toBe(false);
  });

  it('retorna false si tiene rut pero falta nombre', () => {
    expect(isReadyToAccredit({
      ...fullAccreditProfile,
      nombre: '',
    })).toBe(false);
  });

  it('retorna false si tiene rut pero falta medio', () => {
    expect(isReadyToAccredit({
      ...fullAccreditProfile,
      medio: null,
    })).toBe(false);
  });

  it('retorna true si todos los campos de acreditación están completos', () => {
    expect(isReadyToAccredit(fullAccreditProfile)).toBe(true);
  });

  it('retorna true con campos extra', () => {
    expect(isReadyToAccredit({
      ...fullAccreditProfile,
      cargo: 'Periodista',
      email: 'juan@test.com',
    })).toBe(true);
  });

  it('isProfileComplete true pero isReadyToAccredit false sin rut', () => {
    const profileSinRut = {
      document_type: 'rut',
      document_number: '',
      nombre: 'Ana',
      apellido: 'López',
      medio: 'Radio ADN',
    };
    expect(isProfileComplete(profileSinRut)).toBe(false);
    expect(isReadyToAccredit(profileSinRut)).toBe(false);
  });
});

describe('getMissingAccreditationFields', () => {
  it('retorna todos los campos para null', () => {
    const missing = getMissingAccreditationFields(null);
    expect(missing).toHaveLength(ACCREDITATION_REQUIRED_FIELDS.length);
    expect(missing.map(f => f.key)).toEqual(['document_type', 'document_number', 'nombre', 'apellido', 'medio']);
  });

  it('retorna solo rut si perfil completo sin rut', () => {
    const missing = getMissingAccreditationFields({
      document_type: 'rut',
      document_number: '',
      nombre: 'Ana',
      apellido: 'López',
      medio: 'Radio ADN',
    });
    expect(missing).toHaveLength(1);
    expect(missing[0]).toEqual({ key: 'document_number', label: 'Documento' });
  });

  it('retorna array vacío si todo completo', () => {
    const missing = getMissingAccreditationFields(fullAccreditProfile);
    expect(missing).toHaveLength(0);
  });

  it('retorna múltiples campos faltantes', () => {
    const missing = getMissingAccreditationFields({
      document_type: 'rut',
      document_number: '12345678-9',
      nombre: 'Ana',
      apellido: '',
      medio: null,
      rut: '12345678-9',
    });
    expect(missing).toHaveLength(2);
    expect(missing.map(f => f.key)).toEqual(['apellido', 'medio']);
  });
});

describe('ACCREDITATION_REQUIRED_FIELDS', () => {
  it('contiene exactamente 5 campos', () => {
    expect(ACCREDITATION_REQUIRED_FIELDS).toHaveLength(5);
  });

  it('incluye todos los campos de REQUIRED_PROFILE_FIELDS', () => {
    const profileKeys = REQUIRED_PROFILE_FIELDS.map(f => f.key);
    const accreditKeys = ACCREDITATION_REQUIRED_FIELDS.map(f => f.key);
    profileKeys.forEach(k => {
      expect(accreditKeys).toContain(k);
    });
  });

  it('cada campo tiene key y label', () => {
    ACCREDITATION_REQUIRED_FIELDS.forEach(field => {
      expect(field).toHaveProperty('key');
      expect(field).toHaveProperty('label');
      expect(typeof field.key).toBe('string');
      expect(typeof field.label).toBe('string');
    });
  });
});
