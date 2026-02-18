/**
 * Tests: email.ts — Template engine helpers
 * 
 * Pure functions: escapeHtml, safeColor, safeUrl, replaceVars
 */
import { describe, it, expect, vi } from 'vitest';

// Mock Resend before importing email module (constructor needs API key)
vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = { send: vi.fn() };
    },
  };
});

import { escapeHtml, safeColor, safeUrl, replaceVars, type TemplateVars } from '@/lib/services/email';

describe('escapeHtml', () => {
  it('escapes & < > " \'', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('leaves safe strings unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
    expect(escapeHtml('123')).toBe('123');
  });

  it('escapes all in combined string', () => {
    expect(escapeHtml('<b>"A & B"</b>')).toBe('&lt;b&gt;&quot;A &amp; B&quot;&lt;/b&gt;');
  });
});

describe('safeColor', () => {
  it('returns valid hex colors as-is', () => {
    expect(safeColor('#fff', 'red')).toBe('#fff');
    expect(safeColor('#FF5733', 'red')).toBe('#FF5733');
    expect(safeColor('#00C48C80', 'red')).toBe('#00C48C80');
  });

  it('returns valid color names as-is', () => {
    expect(safeColor('red', '#000')).toBe('red');
    expect(safeColor('blue', '#000')).toBe('blue');
  });

  it('returns fallback for null/undefined', () => {
    expect(safeColor(null, '#default')).toBe('#default');
    expect(safeColor(undefined, '#default')).toBe('#default');
  });

  it('returns fallback for injection attempts', () => {
    expect(safeColor('red; background: url(evil)', '#000')).toBe('#000');
    expect(safeColor('expression(alert(1))', '#000')).toBe('#000');
    expect(safeColor('#zzzzzz', '#000')).toBe('#000');
  });

  it('returns fallback for empty string', () => {
    expect(safeColor('', '#000')).toBe('#000');
  });
});

describe('safeUrl', () => {
  it('returns valid http/https URLs', () => {
    expect(safeUrl('https://example.com/logo.png')).toBe('https://example.com/logo.png');
    expect(safeUrl('http://example.com')).toBe('http://example.com');
  });

  it('escapes HTML in valid URLs', () => {
    expect(safeUrl('https://example.com/a&b')).toBe('https://example.com/a&amp;b');
  });

  it('returns empty string for null/undefined', () => {
    expect(safeUrl(null)).toBe('');
    expect(safeUrl(undefined)).toBe('');
  });

  it('rejects javascript: protocol', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
  });

  it('rejects data: protocol', () => {
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('rejects invalid URLs', () => {
    expect(safeUrl('not a url')).toBe('');
    expect(safeUrl('ftp://invalid.com')).toBe('');
  });
});

describe('replaceVars', () => {
  const baseVars: TemplateVars = {
    nombre: 'Juan',
    apellido: 'Pérez',
    evento: 'Copa 2025',
    fecha: '15/01/2025',
    lugar: 'Estadio Nacional',
    organizacion: 'CNN Chile',
    cargo: 'Fotógrafo',
    motivo: '',
    tenant: 'UC',
    zona: 'Tribuna Prensa',
    area: 'Área Media',
    qr_section: '<img src="qr.png"/>',
    instrucciones_acceso: '<p>Ingrese por puerta 5</p>',
    info_especifica: '<p>Info específica</p>',
    notas_importantes: '<p>Notas</p>',
    info_general: '<p>Info general</p>',
  };

  it('replaces all simple vars', () => {
    const tpl = 'Hola {nombre} {apellido}, bienvenido a {evento}';
    expect(replaceVars(tpl, baseVars)).toBe('Hola Juan Pérez, bienvenido a Copa 2025');
  });

  it('replaces multiple occurrences of same var', () => {
    const tpl = '{nombre} y {nombre}';
    expect(replaceVars(tpl, baseVars)).toBe('Juan y Juan');
  });

  it('replaces all known vars', () => {
    const tpl = '{nombre}|{apellido}|{evento}|{fecha}|{lugar}|{organizacion}|{cargo}|{motivo}|{tenant}|{zona}|{area}';
    const result = replaceVars(tpl, baseVars);
    expect(result).toBe('Juan|Pérez|Copa 2025|15/01/2025|Estadio Nacional|CNN Chile|Fotógrafo||UC|Tribuna Prensa|Área Media');
  });

  it('preserves HTML in system-generated vars', () => {
    const tpl = 'QR: {qr_section} | Instrucciones: {instrucciones_acceso}';
    const result = replaceVars(tpl, baseVars);
    expect(result).toContain('<img src="qr.png"/>');
    expect(result).toContain('<p>Ingrese por puerta 5</p>');
  });

  it('handles template with no vars', () => {
    expect(replaceVars('No variables here', baseVars)).toBe('No variables here');
  });

  it('handles empty template', () => {
    expect(replaceVars('', baseVars)).toBe('');
  });
});
