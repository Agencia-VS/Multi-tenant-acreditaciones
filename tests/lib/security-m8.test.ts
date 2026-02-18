/**
 * Tests: M8 — Seguridad II + Validación de Input
 * Zod schemas, HTML sanitization, escapeHtml
 */
import { describe, it, expect } from 'vitest';
import {
  emailTemplatePostSchema,
  emailZoneContentPostSchema,
  eventCreateSchema,
  tenantCreateSchema,
  profileCreateSchema,
  profileUpdateSchema,
  registrationPatchSchema,
  safeParse,
} from '@/lib/schemas';
import { sanitizeHtml } from '@/lib/sanitize';

/* ─── Zod Schemas ────────────────────────────────────────────────── */

const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('emailTemplatePostSchema', () => {
  const valid = {
    tenant_id: VALID_UUID,
    tipo: 'aprobacion',
    subject: 'Test Subject',
    body_html: '<p>Hello</p>',
  };

  it('accepts valid data', () => {
    const result = safeParse(emailTemplatePostSchema, valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid tipo', () => {
    const result = safeParse(emailTemplatePostSchema, { ...valid, tipo: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing tenant_id', () => {
    const { tenant_id: _, ...rest } = valid;
    const result = safeParse(emailTemplatePostSchema, rest);
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID tenant_id', () => {
    const result = safeParse(emailTemplatePostSchema, { ...valid, tenant_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('eventCreateSchema', () => {
  const valid = {
    tenant_id: VALID_UUID,
    nombre: 'Test Event',
  };

  it('accepts valid event', () => {
    const result = safeParse(eventCreateSchema, valid);
    expect(result.success).toBe(true);
  });

  it('rejects empty nombre', () => {
    const result = safeParse(eventCreateSchema, { ...valid, nombre: '' });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields', () => {
    const result = safeParse(eventCreateSchema, {
      ...valid,
      venue: 'Santiago',
      tipo: 'deportivo',
      qr_enabled: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tipo).toBe('deportivo');
    }
  });
});

describe('tenantCreateSchema', () => {
  it('accepts valid tenant', () => {
    const result = safeParse(tenantCreateSchema, { nombre: 'UC', slug: 'uc' });
    expect(result.success).toBe(true);
  });

  it('rejects slug with spaces', () => {
    const result = safeParse(tenantCreateSchema, { nombre: 'UC', slug: 'has space' });
    expect(result.success).toBe(false);
  });

  it('rejects slug with uppercase', () => {
    const result = safeParse(tenantCreateSchema, { nombre: 'UC', slug: 'UC' });
    expect(result.success).toBe(false);
  });

  it('validates color_primario as hex', () => {
    const result = safeParse(tenantCreateSchema, { nombre: 'UC', slug: 'uc', color_primario: '#ff0000' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid color', () => {
    const result = safeParse(tenantCreateSchema, { nombre: 'UC', slug: 'uc', color_primario: 'javascript:alert(1)' });
    expect(result.success).toBe(false);
  });
});

describe('profileCreateSchema', () => {
  it('accepts valid profile', () => {
    const result = safeParse(profileCreateSchema, {
      rut: '12345678-5',
      nombre: 'Juan',
      apellido: 'Pérez',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid RUT format', () => {
    const result = safeParse(profileCreateSchema, {
      rut: 'abc',
      nombre: 'Juan',
      apellido: 'Pérez',
    });
    expect(result.success).toBe(false);
  });
});

describe('registrationPatchSchema', () => {
  it('accepts status change', () => {
    const result = safeParse(registrationPatchSchema, { status: 'aprobado' });
    expect(result.success).toBe(true);
  });

  it('accepts datos_extra update', () => {
    const result = safeParse(registrationPatchSchema, { datos_extra: { zona: 'VIP' } });
    expect(result.success).toBe(true);
  });

  it('rejects empty body (no status or datos_extra)', () => {
    const result = safeParse(registrationPatchSchema, {});
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = safeParse(registrationPatchSchema, { status: 'invalid' });
    expect(result.success).toBe(false);
  });
});

/* ─── HTML Sanitization ──────────────────────────────────────────── */

describe('sanitizeHtml', () => {
  it('removes script tags and content', () => {
    const result = sanitizeHtml('<p>Hello</p><script>alert(1)</script>');
    expect(result).not.toContain('script');
    expect(result).not.toContain('alert');
    expect(result).toContain('<p>Hello</p>');
  });

  it('removes iframe tags', () => {
    expect(sanitizeHtml('<iframe src="https://evil.com"></iframe>')).toBe('');
  });

  it('removes event handlers', () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).not.toContain('onerror');
  });

  it('removes javascript: protocol', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">click</a>')).not.toContain('javascript');
  });

  it('preserves safe HTML', () => {
    const safe = '<p style="color: red;">Hello <strong>world</strong></p>';
    expect(sanitizeHtml(safe)).toBe(safe);
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('removes form/input tags', () => {
    expect(sanitizeHtml('<form action="/steal"><input type="hidden" name="token" value="x"></form>')).toBe('');
  });
});

/* ─── emailZoneContentPostSchema ─────────────────────────────────── */

describe('emailZoneContentPostSchema', () => {
  const valid = {
    tenant_id: VALID_UUID,
    tipo: 'aprobacion',
    zona: 'VIP',
  };

  it('accepts valid zone content', () => {
    const result = safeParse(emailZoneContentPostSchema, valid);
    expect(result.success).toBe(true);
  });

  it('rejects missing zona', () => {
    const { zona: _, ...rest } = valid;
    const result = safeParse(emailZoneContentPostSchema, rest);
    expect(result.success).toBe(false);
  });
});

describe('profileUpdateSchema', () => {
  it('accepts partial update', () => {
    const result = safeParse(profileUpdateSchema, { nombre: 'Juan' });
    expect(result.success).toBe(true);
  });

  it('rejects completely empty update', () => {
    const result = safeParse(profileUpdateSchema, {});
    expect(result.success).toBe(false);
  });
});
