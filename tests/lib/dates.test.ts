/**
 * Tests: dates.ts — Timezone Chile, deadline checks, formatting
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  nowInChile,
  isDeadlinePast,
  isAccreditationClosed,
  isoToLocalDatetime,
  formatDeadlineChile,
  localToChileISO,
} from '@/lib/dates';

describe('isDeadlinePast', () => {
  it('returns false for null/undefined', () => {
    expect(isDeadlinePast(null)).toBe(false);
    expect(isDeadlinePast(undefined)).toBe(false);
  });

  it('returns false for invalid date string', () => {
    expect(isDeadlinePast('not-a-date')).toBe(false);
  });

  it('returns true for a past date', () => {
    expect(isDeadlinePast('2020-01-01T00:00:00-03:00')).toBe(true);
  });

  it('returns false for a future date', () => {
    expect(isDeadlinePast('2099-12-31T23:59:59-03:00')).toBe(false);
  });
});

describe('isAccreditationClosed', () => {
  it('returns closed=false when no config and no fecha_limite', () => {
    const result = isAccreditationClosed(null, null);
    expect(result.closed).toBe(false);
  });

  it('manual override open → closed=false', () => {
    const result = isAccreditationClosed({ acreditacion_abierta: true }, '2020-01-01T00:00:00-03:00');
    expect(result.closed).toBe(false);
    expect(result.reason).toContain('manualmente');
  });

  it('manual override closed → closed=true', () => {
    const result = isAccreditationClosed({ acreditacion_abierta: false }, '2099-01-01T00:00:00-03:00');
    expect(result.closed).toBe(true);
    expect(result.reason).toContain('Cerrado manualmente');
  });

  it('past deadline → closed=true when no override', () => {
    const result = isAccreditationClosed({}, '2020-01-01T00:00:00-03:00');
    expect(result.closed).toBe(true);
    expect(result.reason).toContain('plazo');
  });

  it('future deadline → closed=false when no override', () => {
    const result = isAccreditationClosed({}, '2099-12-31T23:59:59-03:00');
    expect(result.closed).toBe(false);
  });
});

describe('isoToLocalDatetime', () => {
  it('returns empty for null/undefined', () => {
    expect(isoToLocalDatetime(null)).toBe('');
    expect(isoToLocalDatetime(undefined)).toBe('');
  });

  it('returns empty for invalid date', () => {
    expect(isoToLocalDatetime('garbage')).toBe('');
  });

  it('converts UTC ISO to datetime-local in Chile TZ', () => {
    // 2026-06-15T15:00:00Z = UTC 15:00 → Chile winter (UTC-4) = 11:00
    const result = isoToLocalDatetime('2026-06-15T15:00:00Z');
    expect(result).toMatch(/^2026-06-15T11:00$/);
  });
});

describe('localToChileISO', () => {
  it('returns empty for empty input', () => {
    expect(localToChileISO('')).toBe('');
  });

  it('converts datetime-local to ISO with Chile offset', () => {
    const result = localToChileISO('2026-02-10T23:59');
    // February = summer in Chile = UTC-3
    expect(result).toMatch(/^2026-02-10T23:59:00-0[34]:00$/);
  });

  it('handles invalid input gracefully', () => {
    const result = localToChileISO('not-a-date');
    expect(result).toBe('not-a-date'); // no T separator → returned as-is
  });
});

describe('nowInChile', () => {
  it('returns a Date object', () => {
    const now = nowInChile();
    expect(now).toBeInstanceOf(Date);
  });
});

describe('formatDeadlineChile', () => {
  it('returns empty for null', () => {
    expect(formatDeadlineChile(null)).toBe('');
  });

  it('formats a valid ISO date in Spanish', () => {
    const formatted = formatDeadlineChile('2026-02-10T23:59:00-03:00');
    // Should contain Spanish words
    expect(formatted).toMatch(/febrero|feb/i);
    expect(formatted).toMatch(/2026/);
  });
});
