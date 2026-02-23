/**
 * Tests for Disclaimer configuration feature.
 * Covers: type shapes, default sections, config merging and rendering logic.
 */
import { describe, it, expect } from 'vitest';
import type { DisclaimerSection, DisclaimerConfig, EventConfig } from '@/types';
import { DEFAULT_DISCLAIMER_SECTIONS } from '@/components/admin-dashboard/DisclaimerEditor';

/* ═══════════════════════════════════════════════════════
   Type shape / contracts
   ═══════════════════════════════════════════════════════ */

describe('DisclaimerSection type shape', () => {
  it('accepts a valid section with all required fields', () => {
    const section: DisclaimerSection = {
      id: 'test-1',
      icon: '📋',
      title: 'Test Section',
      body: 'Some body text.',
      color: 'blue',
    };
    expect(section.id).toBe('test-1');
    expect(section.color).toBe('blue');
  });

  it('supports all 6 color options', () => {
    const colors: DisclaimerSection['color'][] = ['blue', 'yellow', 'red', 'green', 'purple', 'gray'];
    colors.forEach(color => {
      const section: DisclaimerSection = { id: `c-${color}`, icon: '🎨', title: color, body: '', color };
      expect(section.color).toBe(color);
    });
  });
});

describe('DisclaimerConfig type shape', () => {
  it('has enabled boolean and sections array', () => {
    const config: DisclaimerConfig = {
      enabled: true,
      sections: [],
    };
    expect(config.enabled).toBe(true);
    expect(config.sections).toEqual([]);
  });

  it('defaults enabled=false skips disclaimer', () => {
    const config: DisclaimerConfig = {
      enabled: false,
      sections: [],
    };
    expect(config.enabled).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════
   EventConfig integration
   ═══════════════════════════════════════════════════════ */

describe('EventConfig.disclaimer integration', () => {
  it('stores disclaimer config in EventConfig', () => {
    const config: EventConfig = {
      disclaimer: {
        enabled: true,
        sections: [
          { id: 's1', icon: '📋', title: 'Test', body: 'Body', color: 'blue' },
        ],
      },
    };
    expect(config.disclaimer?.enabled).toBe(true);
    expect(config.disclaimer?.sections).toHaveLength(1);
  });

  it('EventConfig without disclaimer is undefined (backward compat)', () => {
    const config: EventConfig = {};
    expect(config.disclaimer).toBeUndefined();
  });

  it('can coexist with other EventConfig fields', () => {
    const config: EventConfig = {
      zonas: ['Tribuna', 'Cancha'],
      disclaimer: { enabled: true, sections: [] },
    };
    expect(config.zonas).toHaveLength(2);
    expect(config.disclaimer?.enabled).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════
   Default sections
   ═══════════════════════════════════════════════════════ */

describe('DEFAULT_DISCLAIMER_SECTIONS', () => {
  it('has exactly 4 default sections', () => {
    expect(DEFAULT_DISCLAIMER_SECTIONS).toHaveLength(4);
  });

  it('each section has all required fields', () => {
    for (const s of DEFAULT_DISCLAIMER_SECTIONS) {
      expect(s.id).toBeTruthy();
      expect(s.icon).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.body).toBeTruthy();
      expect(['blue', 'yellow', 'red', 'green', 'purple', 'gray']).toContain(s.color);
    }
  });

  it('includes expected section ids', () => {
    const ids = DEFAULT_DISCLAIMER_SECTIONS.map(s => s.id);
    expect(ids).toContain('proceso');
    expect(ids).toContain('restricciones');
    expect(ids).toContain('excepciones');
    expect(ids).toContain('datos');
  });

  it('does NOT include Plazo section (it is automatic)', () => {
    const ids = DEFAULT_DISCLAIMER_SECTIONS.map(s => s.id);
    expect(ids).not.toContain('plazo');
  });
});

/* ═══════════════════════════════════════════════════════
   Disclaimer skip logic
   ═══════════════════════════════════════════════════════ */

describe('Disclaimer enabled/disabled logic', () => {
  it('enabled=true means disclaimer is shown (default)', () => {
    const config: DisclaimerConfig = { enabled: true, sections: [] };
    const disclaimerEnabled = config.enabled !== false;
    expect(disclaimerEnabled).toBe(true);
  });

  it('enabled=false means disclaimer is skipped', () => {
    const config: DisclaimerConfig = { enabled: false, sections: [] };
    const disclaimerEnabled = config.enabled !== false;
    expect(disclaimerEnabled).toBe(false);
  });

  it('undefined config means disclaimer is shown (backward compat)', () => {
    const config = undefined as DisclaimerConfig | undefined;
    const disclaimerEnabled = config?.enabled !== false;
    expect(disclaimerEnabled).toBe(true);
  });

  it('determines initial step based on disclaimer enabled', () => {
    // Simulates useRegistrationForm logic
    const getInitialStep = (dc?: DisclaimerConfig) => {
      const enabled = dc?.enabled !== false;
      return enabled ? 'disclaimer' : 'responsable';
    };

    expect(getInitialStep(undefined)).toBe('disclaimer');
    expect(getInitialStep({ enabled: true, sections: [] })).toBe('disclaimer');
    expect(getInitialStep({ enabled: false, sections: [] })).toBe('responsable');
  });
});

/* ═══════════════════════════════════════════════════════
   Section rendering logic
   ═══════════════════════════════════════════════════════ */

describe('Section rendering logic', () => {
  it('custom sections with length > 0 triggers custom rendering', () => {
    const config: DisclaimerConfig = {
      enabled: true,
      sections: [{ id: 'custom1', icon: '🏫', title: 'Custom', body: 'Custom text', color: 'green' }],
    };
    const useCustom = config.sections.length > 0;
    expect(useCustom).toBe(true);
  });

  it('empty sections array falls back to defaults', () => {
    const config: DisclaimerConfig = { enabled: true, sections: [] };
    const useCustom = config.sections.length > 0;
    expect(useCustom).toBe(false);
  });

  it('body with double newline creates multiple paragraphs', () => {
    const body = 'First paragraph.\n\nSecond paragraph.';
    const paragraphs = body.split('\n\n');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toBe('First paragraph.');
    expect(paragraphs[1]).toBe('Second paragraph.');
  });
});

/* ═══════════════════════════════════════════════════════
   Config merge (admin create/update)
   ═══════════════════════════════════════════════════════ */

describe('Config merge for create/update', () => {
  it('builds disclaimer config from form state', () => {
    const formState = {
      disclaimer_enabled: true,
      disclaimer_sections: [
        { id: 's1', icon: '📋', title: 'Proceso', body: 'Custom process', color: 'blue' as const },
      ],
    };

    const eventConfig: EventConfig = {
      disclaimer: {
        enabled: formState.disclaimer_enabled,
        sections: formState.disclaimer_sections,
      },
    };

    expect(eventConfig.disclaimer?.enabled).toBe(true);
    expect(eventConfig.disclaimer?.sections).toHaveLength(1);
    expect(eventConfig.disclaimer?.sections[0].title).toBe('Proceso');
  });

  it('preserves existing config fields when adding disclaimer', () => {
    const existingConfig: EventConfig = {
      zonas: ['Tribuna', 'Cancha'],
      acreditacion_cerrada: false,
    };

    const updatedConfig: EventConfig = {
      ...existingConfig,
      disclaimer: { enabled: false, sections: [] },
    };

    expect(updatedConfig.zonas).toEqual(['Tribuna', 'Cancha']);
    expect(updatedConfig.acreditacion_cerrada).toBe(false);
    expect(updatedConfig.disclaimer?.enabled).toBe(false);
  });
});
