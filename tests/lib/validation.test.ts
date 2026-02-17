/**
 * Tests: validation.ts — RUT, email, phone, sanitize
 */
import { describe, it, expect } from 'vitest';
import { cleanRut, formatRut, validateRut, validateEmail, validatePhone, sanitize } from '@/lib/validation';

describe('cleanRut', () => {
  it('removes dots and spaces', () => {
    expect(cleanRut('12.345.678-9')).toBe('12345678-9');
  });

  it('adds dash if missing', () => {
    expect(cleanRut('123456789')).toBe('12345678-9');
  });

  it('uppercases K', () => {
    expect(cleanRut('12345678-k')).toBe('12345678-K');
  });

  it('handles already clean RUT', () => {
    expect(cleanRut('12345678-K')).toBe('12345678-K');
  });
});

describe('formatRut', () => {
  it('formats with dots and dash', () => {
    expect(formatRut('12345678-9')).toBe('12.345.678-9');
  });

  it('handles 7-digit RUT', () => {
    expect(formatRut('1234567-8')).toBe('1.234.567-8');
  });

  it('returns raw if no dash can be found', () => {
    expect(formatRut('1')).toBe('1');
  });
});

describe('validateRut', () => {
  it('returns error for empty string', () => {
    const result = validateRut('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('requerido');
  });

  it('returns error for whitespace-only', () => {
    const result = validateRut('   ');
    expect(result.valid).toBe(false);
  });

  it('returns error for invalid format', () => {
    const result = validateRut('abc');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Formato inválido');
  });

  it('validates correct RUT (11.111.111-1)', () => {
    const result = validateRut('11.111.111-1');
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe('11.111.111-1');
  });

  it('validates RUT with K dígito verificador', () => {
    const result = validateRut('10000013-K');
    expect(result.valid).toBe(true);
  });

  it('rejects incorrect dígito verificador', () => {
    const result = validateRut('11.111.111-2');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('verificador');
  });

  it('validates short RUT (7 digits)', () => {
    // 1234567 → compute DV for this body
    const result = validateRut('1234567-4');
    expect(result.valid).toBe(true);
  });

  it('rejects too-short body (6 or fewer digits)', () => {
    const result = validateRut('123456-7');
    expect(result.valid).toBe(false);
  });
});

describe('validateEmail', () => {
  it('returns error for empty email', () => {
    const result = validateEmail('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('requerido');
  });

  it('validates correct email', () => {
    const result = validateEmail('test@example.com');
    expect(result.valid).toBe(true);
  });

  it('validates email with subdomain', () => {
    const result = validateEmail('user@sub.domain.cl');
    expect(result.valid).toBe(true);
  });

  it('rejects email without @', () => {
    const result = validateEmail('notanemail');
    expect(result.valid).toBe(false);
  });

  it('rejects email with single-char TLD', () => {
    const result = validateEmail('a@b.c');
    expect(result.valid).toBe(false);
  });
});

describe('validatePhone', () => {
  it('allows empty (optional field)', () => {
    const result = validatePhone('');
    expect(result.valid).toBe(true);
  });

  it('validates 9-digit phone', () => {
    expect(validatePhone('912345678').valid).toBe(true);
  });

  it('validates phone with +56 prefix', () => {
    expect(validatePhone('+56 9 1234 5678').valid).toBe(true);
  });

  it('rejects too-short phone', () => {
    const result = validatePhone('123');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('8 dígitos');
  });
});

describe('sanitize', () => {
  it('trims and normalizes spaces', () => {
    expect(sanitize('  hello   world  ')).toBe('hello world');
  });

  it('handles single word', () => {
    expect(sanitize('hello')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(sanitize('')).toBe('');
  });
});
