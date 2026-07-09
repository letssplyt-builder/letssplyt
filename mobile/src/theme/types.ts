export type ThemeId = 'aurora' | 'solid';
export type NavStyle = 'ios' | 'android';

export interface Theme {
  id: ThemeId;
  isDark: boolean;

  // Canvas
  bgGradient: [string, string, string];
  orb1: string;
  orb2: string;

  // Surfaces (glass or solid)
  surface: string;
  surfaceStrong: string;
  /** Opaque popup/sheet background — not glass alpha. */
  modalSurface: string;
  /** Inputs and nested rows inside popups. */
  modalInset: string;
  /** Opaque/semi-opaque top header strip. */
  headerBar: string;
  /** Opaque bottom tab bar background. */
  tabBar: string;
  blur: number;

  // Text
  ink: string;
  ink2: string;
  ink3: string;

  // Brand + CTA
  accent: string;
  accentInk: string;
  accentSoft: string;

  // Money + status
  good: string;
  bad: string;
  warn: string;
  warnSoft: string;

  // Lines + radii + shadow
  line: string;
  radius: number;
  radiusSm: number;
  shadow: string;

  // Hero numeric treatment
  heroSize: number;
  heroGlow?: string;

  // Type
  fontDisplay: string;
  fontBody: string;
}
