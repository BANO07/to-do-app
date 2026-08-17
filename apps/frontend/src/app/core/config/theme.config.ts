export type ThemeMode = 'light' | 'dark';
export type ThemePalette = 'indigo' | 'ocean' | 'forest' | 'sunset' | 'rose';

export interface ThemePaletteOption {
  id: ThemePalette;
  label: string;
  icon: string;
  preview: string;
  /** Particle hue range for antigravity canvas */
  particleHue: { light: [number, number]; dark: [number, number] };
  /** RGB accent for canvas glow [r, g, b] */
  accentRgb: { light: [number, number, number]; dark: [number, number, number] };
}

export const THEME_PALETTES: ThemePaletteOption[] = [
  {
    id: 'indigo',
    label: 'Indigo',
    icon: '💜',
    preview: '#6366f1',
    particleHue: { light: [230, 280], dark: [220, 300] },
    accentRgb: { light: [99, 102, 241], dark: [129, 140, 248] },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    icon: '🌊',
    preview: '#0891b2',
    particleHue: { light: [185, 210], dark: [190, 220] },
    accentRgb: { light: [8, 145, 178], dark: [34, 211, 238] },
  },
  {
    id: 'forest',
    label: 'Forest',
    icon: '🌿',
    preview: '#059669',
    particleHue: { light: [140, 165], dark: [130, 160] },
    accentRgb: { light: [5, 150, 105], dark: [52, 211, 153] },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    icon: '🌅',
    preview: '#ea580c',
    particleHue: { light: [20, 45], dark: [15, 40] },
    accentRgb: { light: [234, 88, 12], dark: [251, 146, 60] },
  },
  {
    id: 'rose',
    label: 'Rose',
    icon: '🌸',
    preview: '#e11d48',
    particleHue: { light: [330, 355], dark: [320, 350] },
    accentRgb: { light: [225, 29, 72], dark: [251, 113, 133] },
  },
];

export const DEFAULT_PALETTE: ThemePalette = 'indigo';
