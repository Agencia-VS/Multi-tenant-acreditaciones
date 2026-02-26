/**
 * Tests: colors.ts — Palette generation and WCAG accessibility
 */
import { describe, it, expect } from 'vitest';
import { generateTenantPalette, paletteToCSS, generateCorporatePalette } from '@/lib/colors';
import type { TenantPalette } from '@/lib/colors';

describe('generateTenantPalette', () => {
  it('returns a complete palette object', () => {
    const palette = generateTenantPalette('#2563EB', '#60A5FA', '#DBEAFE', '#1E3A8A');
    expect(palette).toBeDefined();
    expect(palette.bright).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(palette.forest).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(palette.contentPrimary).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('produces valid hex colors for all core properties', () => {
    const palette = generateTenantPalette('#10B981', '#34D399', '#D1FAE5', '#064E3B');
    const hexPattern = /^#[0-9A-Fa-f]{6}/; // may have opacity suffix
    expect(palette.bright).toMatch(hexPattern);
    expect(palette.forest).toMatch(hexPattern);
    expect(palette.interactivePrimary).toMatch(hexPattern);
    expect(palette.interactiveAccent).toMatch(hexPattern);
    expect(palette.bgScreen).toBe('#FFFFFF');
  });

  it('generates different palettes for different inputs', () => {
    const blue = generateTenantPalette('#2563EB', '#60A5FA', '#DBEAFE', '#1E3A8A');
    const green = generateTenantPalette('#10B981', '#34D399', '#D1FAE5', '#064E3B');
    expect(blue.bright).not.toBe(green.bright);
    expect(blue.forest).not.toBe(green.forest);
  });

  it('uses a chromatic fallback for accents when primary is achromatic', () => {
    const palette = generateTenantPalette('#000000', '#d9f72b', '#d9f72b', '#000000');
    expect(palette.bright.toLowerCase()).not.toBe('#b82e2e');
    expect(palette.forest.toLowerCase()).toBe('#000000');
  });

  it('fallback hue changes with tenant secondary color (not hardcoded)', () => {
    const limeTenant = generateTenantPalette('#000000', '#d9f72b', '#d9f72b', '#000000');
    const blueTenant = generateTenantPalette('#000000', '#60a5fa', '#bfdbfe', '#000000');

    expect(limeTenant.bright).not.toBe(blueTenant.bright);
    expect(limeTenant.forest).toBe(blueTenant.forest);
  });
});

describe('generateCorporatePalette', () => {
  it('returns default corporate palette', () => {
    const palette = generateCorporatePalette();
    expect(palette).toBeDefined();
    expect(palette.bright).toBeDefined();
    expect(palette.forest).toBeDefined();
  });
});

describe('paletteToCSS', () => {
  it('generates CSS custom properties record', () => {
    const palette = generateTenantPalette('#2563EB', '#60A5FA', '#DBEAFE', '#1E3A8A');
    const rawColors = { primario: '#2563EB', secundario: '#60A5FA', light: '#DBEAFE', dark: '#1E3A8A' };
    const css = paletteToCSS(palette, rawColors);
    expect(css['--tenant-primario']).toBe('#2563EB');
    expect(css['--color-brand']).toBeDefined();
    expect(css['--color-canvas']).toBe('#FFFFFF');
  });
});
