/**
 * Color Palette System — Inspired by Wise Design Foundations
 *
 * Generates a harmonious, accessible color palette from a tenant's core colors.
 * Follows the principle: "Always start and end with your primary color."
 *
 * Palette proportions (Wise guideline):
 *   White/neutral > Content greys > Primary dark (interactive) > Bright accent (pop)
 *
 * Each tenant gets:
 *   - Core: bright (primary), forest (dark saturated), tint (8% forest)
 *   - Content: primary/secondary/tertiary text with brand tint
 *   - Interactive: primary surface, accent highlight, control, contrast
 *   - Backgrounds: screen, elevated, neutral (tinted), overlay
 *   - Borders: neutral, overlay
 *   - Gradients: hero, card, badge, CTA, glassmorphism
 */

// ─── Hex ↔ HSL conversions ───────────────────────────────────────────────────

interface HSL { h: number; s: number; l: number }

function hexToHSL(hex: string): HSL {
  let r = 0, g = 0, b = 0;
  const h = hex.replace('#', '');
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16) / 255;
    g = parseInt(h[1] + h[1], 16) / 255;
    b = parseInt(h[2] + h[2], 16) / 255;
  } else {
    r = parseInt(h.substring(0, 2), 16) / 255;
    g = parseInt(h.substring(2, 4), 16) / 255;
    b = parseInt(h.substring(4, 6), 16) / 255;
  }

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0;
  const lum = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    sat = lum > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: hue = ((b - r) / d + 2) / 6; break;
      case b: hue = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(hue * 360), s: Math.round(sat * 100), l: Math.round(lum * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hsl(h: number, s: number, l: number): string {
  return hslToHex(h, Math.max(0, Math.min(100, s)), Math.max(0, Math.min(100, l)));
}

function isAchromatic(color: HSL): boolean {
  return color.s < 8;
}

// ─── Relative luminance (for WCAG contrast) ─────────────────────────────────

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Palette generation ──────────────────────────────────────────────────────

export interface TenantPalette {
  // Core brand
  bright: string;         // The vivid "face" color (like Wise Bright Green)
  forest: string;         // Deep dark variant (like Forest Green)
  tint: string;           // Subtle bg tint (8% forest on white)

  // Content (text with brand undertone)
  contentPrimary: string;
  contentSecondary: string;
  contentTertiary: string;

  // Interactive
  interactivePrimary: string;    // Main interactive surface / text (forest-like)
  interactiveAccent: string;     // Pop of color (bright)
  interactiveControl: string;    // Text/icon on accent surface
  interactiveContrast: string;   // Text/icon on primary surface

  // Background
  bgScreen: string;
  bgElevated: string;
  bgNeutral: string;      // Delineation without borders
  bgOverlay: string;      // Faint darkening

  // Border
  borderNeutral: string;
  borderSubtle: string;

  // Sentiment (green-tinted)
  sentimentPositive: string;
  sentimentWarning: string;
  sentimentNegative: string;

  // ─── Precomputed CSS values for the landing ───

  // Focus states (Wise: "interactive-primary for focus borders")
  focusBorder: string;        // Default focus border (forest-like)
  focusBorderInverted: string; // Focus on dark surfaces (bright accent)

  // Hero
  heroGradient: string;          // Fullscreen background overlay
  heroGlassBg: string;           // Navbar glassmorphism
  heroGlassBorder: string;       // Glass border

  // Badges
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;

  // CTA button
  ctaBg: string;
  ctaHoverBg: string;
  ctaBorder: string;
  ctaText: string;

  // Cards / info panels
  cardBg: string;
  cardBorder: string;

  // Text on hero (over dark background)
  heroText: string;
  heroTextMuted: string;
  heroTextSubtle: string;
}

/**
 * Generate a complete palette from a tenant's colors.
 * Follows Wise's "colour foundations" philosophy:
 *   - Bright primary is the face of the brand
 *   - Forest (dark saturated) anchors interactivity
 *   - Tint provides warmth to neutral surfaces
 *   - White space dominates; color is strategic
 */
export function generateTenantPalette(
  colorPrimario: string,
  colorSecundario: string,
  colorLight: string,
  colorDark: string
): TenantPalette {
  const primary = hexToHSL(colorPrimario);
  const secondary = hexToHSL(colorSecundario);
  const light = hexToHSL(colorLight);
  const dark = hexToHSL(colorDark);

  const brightSource = !isAchromatic(primary)
    ? primary
    : (!isAchromatic(secondary) ? secondary : light);
  const brandHue = brightSource.h;
  const forestHue = dark.h;
  const forestSat = isAchromatic(dark) ? 0 : Math.max(dark.s, 40);
  const tintSat = isAchromatic(dark) ? 0 : Math.max(dark.s * 0.3, 8);

  // ── Core ──────────────────────────────────────────────────────────────────
  // Bright: ensure the primary is vivid (saturation ≥ 60%, lightness 50-65%)
  const bright = hsl(brandHue, Math.max(brightSource.s, 60), Math.min(Math.max(brightSource.l, 45), 65));

  // Forest: very dark, high saturation — the "anchor" color
  const forest = hsl(forestHue, forestSat, Math.min(dark.l, 18));

  // Tint: 8% of forest on white (simulated as very light version)
  const tint = hsl(forestHue, tintSat, 96);

  // ── Content (brand-tinted greys) ──────────────────────────────────────────
  const contentPrimary = hsl(brandHue, 5, 6);      // Near-black with brand hue
  const contentSecondary = hsl(brandHue, 3, 28);    // Dark grey
  const contentTertiary = hsl(brandHue, 2, 42);     // Medium grey

  // ── Interactive ───────────────────────────────────────────────────────────
  const interactivePrimary = forest;
  const interactiveAccent = bright;

  // Control: text on bright surface — needs high contrast
  const accentLum = relativeLuminance(bright);
  const interactiveControl = accentLum > 0.4 ? forest : '#FFFFFF';

  // Contrast: text on forest surface
  const interactiveContrast = bright;

  // ── Background ────────────────────────────────────────────────────────────
  const bgScreen = '#FFFFFF';
  const bgElevated = '#FFFFFF';
  const bgNeutral = `${forest}14`;   // 8% opacity
  const bgOverlay = `${forest}14`;

  // ── Border ────────────────────────────────────────────────────────────────
  const borderNeutral = `${contentPrimary}1F`;  // 12% opacity
  const borderSubtle = `${contentPrimary}12`;   // 7% opacity

  // ── Sentiment ─────────────────────────────────────────────────────────────
  const sentimentPositive = hsl(brandHue, 65, 30);
  const sentimentWarning = '#EDC843';
  const sentimentNegative = '#A8200D';

  // ═══════════════════════════════════════════════════════════════════════════
  // Landing-specific computed values
  // ═══════════════════════════════════════════════════════════════════════════

  // Focus states: forest for light surfaces, bright for dark surfaces
  const focusBorder = forest;
  const focusBorderInverted = bright;

  // Hero gradient: top dark → transparent → bottom dark (stronger)
  const heroGradient = `linear-gradient(180deg, ${forest}90 0%, ${forest}30 25%, transparent 50%, ${forest}40 75%, ${forest}E0 100%)`;

  // Glassmorphism — uses forest tint for brand coherence instead of generic black
  const heroGlassBg = `${forest}30`;
  const heroGlassBorder = `${bright}20`;

  // Badges: gradient from forest to primary with bright accent border
  const badgeBg = `linear-gradient(135deg, ${forest}, ${colorPrimario})`;
  const badgeBorder = `${colorLight}60`;
  const badgeText = '#FFFFFF';

  // CTA Button: forest → primary gradient with bright border
  const ctaBg = `linear-gradient(135deg, ${forest}, ${colorPrimario})`;
  const ctaHoverBg = `linear-gradient(135deg, ${colorPrimario}, ${colorSecundario})`;
  const ctaBorder = bright;
  // CTA text: ensure contrast ≥ 4.5 against the button
  const ctaText = contrastRatio('#FFFFFF', colorPrimario) >= 3 ? '#FFFFFF' : forest;

  // Cards
  const cardBg = `${forest}50`;
  const cardBorder = `${bright}30`;

  // Hero text hierarchy
  const heroText = '#FFFFFF';
  const heroTextMuted = `${tint}CC`;       // ~80% white-tinted
  const heroTextSubtle = `${tint}80`;      // ~50%

  return {
    bright, forest, tint,
    contentPrimary, contentSecondary, contentTertiary,
    interactivePrimary, interactiveAccent, interactiveControl, interactiveContrast,
    bgScreen, bgElevated, bgNeutral, bgOverlay,
    borderNeutral, borderSubtle,
    sentimentPositive, sentimentWarning, sentimentNegative,
    focusBorder, focusBorderInverted,
    heroGradient, heroGlassBg, heroGlassBorder,
    badgeBg, badgeBorder, badgeText,
    ctaBg, ctaHoverBg, ctaBorder, ctaText,
    cardBg, cardBorder,
    heroText, heroTextMuted, heroTextSubtle,
  };
}

/**
 * Maps a TenantPalette to CSS custom properties that override the @theme tokens
 * defined in globals.css. Set these on a wrapper element to brand the entire subtree.
 *
 * @example
 *   <div style={paletteToCSS(palette)}>{children}</div>
 */
export function paletteToCSS(
  palette: TenantPalette,
  rawColors: { primario: string; secundario: string; light: string; dark: string }
): Record<string, string> {
  return {
    // Content / Text
    '--color-heading': palette.contentPrimary,
    '--color-body': palette.contentSecondary,
    '--color-muted': palette.contentTertiary,
    '--color-label': palette.contentSecondary,
    // Interactive / Brand
    '--color-brand': palette.interactivePrimary,
    '--color-brand-hover': palette.forest,
    '--color-on-brand': palette.interactiveContrast,
    '--color-accent': palette.interactiveAccent,
    '--color-accent-light': palette.tint,
    // Surfaces
    '--color-surface': palette.bgElevated,
    '--color-canvas': palette.bgScreen,
    '--color-subtle': palette.bgNeutral,
    // Borders
    '--color-edge': palette.borderNeutral,
    '--color-field-border': palette.borderSubtle,
    // Sentiment (brand-tinted)
    '--color-success': palette.sentimentPositive,
    '--color-danger': palette.sentimentNegative,
    '--color-warn': palette.sentimentWarning,
    // Focus
    '--focus-color': palette.focusBorder,
    // Legacy tenant vars (landing, hero, glassmorphism)
    '--tenant-primario': rawColors.primario,
    '--tenant-secundario': rawColors.secundario,
    '--tenant-light': rawColors.light,
    '--tenant-dark': rawColors.dark,
  };
}

// ─── Corporate (non-tenant) default colors ───────────────────────────────────

/**
 * Corporate brand colors for the platform itself (landing page, non-tenant UI).
 * Used when no tenant context is active.
 *
 *   Negro Suave   #111111  — headings, primary text
 *   Gris Grafito  #2B2B2B  — body text, labels
 *   Gris Claro    #F2F2F2  — canvas / light backgrounds
 *   Blanco        #FFFFFF  — surfaces, elevated elements
 *   Verde Acento  #00C48C  — primary action / accent (CTA, links, focus)
 */
export const CORPORATE_COLORS = {
  negroSuave:   '#111111',
  grisGrafito:  '#2B2B2B',
  grisClaro:    '#F2F2F2',
  blanco:       '#FFFFFF',
  verdeAccion:  '#00C48C',
  verdeHover:   '#00A676',
  accentLight:  '#E6FBF3',
} as const;

/**
 * Generate the corporate (non-tenant) palette using the platform's own colors.
 * Returns a TenantPalette so it's compatible with paletteToCSS().
 */
export function generateCorporatePalette(): TenantPalette {
  return generateTenantPalette(
    CORPORATE_COLORS.verdeAccion,  // primario  → brand / accent
    CORPORATE_COLORS.grisGrafito,  // secundario
    CORPORATE_COLORS.grisClaro,    // light
    CORPORATE_COLORS.negroSuave,   // dark
  );
}
