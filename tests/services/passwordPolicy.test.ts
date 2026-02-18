/**
 * Tests — passwordPolicy
 */
import { describe, it, expect } from 'vitest';
import {
  shouldForcePasswordChange,
  validatePassword,
  getForceChangeRedirectUrl,
  PASSWORD_RULES,
} from '@/lib/services/passwordPolicy';
import type { User } from '@supabase/supabase-js';

const makeUser = (metadata: Record<string, unknown> = {}): User =>
  ({
    id: 'user-1',
    email: 'test@test.com',
    user_metadata: metadata,
  }) as unknown as User;

describe('shouldForcePasswordChange', () => {
  it('returns false for null user', () => {
    expect(shouldForcePasswordChange(null)).toBe(false);
  });

  it('returns false when must_change_password is absent', () => {
    expect(shouldForcePasswordChange(makeUser({}))).toBe(false);
  });

  it('returns false when must_change_password is false', () => {
    expect(shouldForcePasswordChange(makeUser({ must_change_password: false }))).toBe(false);
  });

  it('returns true when must_change_password is true', () => {
    expect(shouldForcePasswordChange(makeUser({ must_change_password: true }))).toBe(true);
  });

  it('returns false for non-boolean truthy values', () => {
    // Only exact `true` should match
    expect(shouldForcePasswordChange(makeUser({ must_change_password: 'yes' }))).toBe(false);
    expect(shouldForcePasswordChange(makeUser({ must_change_password: 1 }))).toBe(false);
  });
});

describe('validatePassword', () => {
  it('rejects empty password', () => {
    const result = validatePassword('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('requerida');
  });

  it('rejects short password', () => {
    const result = validatePassword('abc');
    expect(result.valid).toBe(false);
    expect(result.error).toContain(`${PASSWORD_RULES.minLength}`);
  });

  it('rejects too long password', () => {
    const result = validatePassword('a'.repeat(129));
    expect(result.valid).toBe(false);
    expect(result.error).toContain(`${PASSWORD_RULES.maxLength}`);
  });

  it('accepts valid password', () => {
    expect(validatePassword('secureP4ss')).toEqual({ valid: true });
  });

  it('accepts minimum length password', () => {
    expect(validatePassword('a'.repeat(PASSWORD_RULES.minLength))).toEqual({ valid: true });
  });

  it('accepts maximum length password', () => {
    expect(validatePassword('a'.repeat(PASSWORD_RULES.maxLength))).toEqual({ valid: true });
  });
});

describe('getForceChangeRedirectUrl', () => {
  it('builds correct URL with encoded next path', () => {
    const url = getForceChangeRedirectUrl('https://accredia.cl', '/mi-tenant/admin');
    expect(url).toBe('https://accredia.cl/auth/callback?type=force-change&next=%2Fmi-tenant%2Fadmin');
  });

  it('handles special characters in next path', () => {
    const url = getForceChangeRedirectUrl('https://app.com', '/tenant/admin?tab=users&x=1');
    expect(url).toContain('type=force-change');
    expect(url).toContain('next=');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('next')).toBe('/tenant/admin?tab=users&x=1');
  });
});
