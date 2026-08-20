import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import {
  BACKGROUND_STYLES,
  BackgroundStyle,
  BackgroundStyleOption,
  DEFAULT_BACKGROUND,
} from '../config/background.config';
import {
  DEFAULT_PALETTE,
  THEME_PALETTES,
  ThemeMode,
  ThemePalette,
  ThemePaletteOption,
} from '../config/theme.config';

export type { ThemeMode, ThemePalette, ThemePaletteOption } from '../config/theme.config';
export type { BackgroundStyle, BackgroundStyleOption } from '../config/background.config';

export type CardStyle = 'glass' | 'solid' | 'frosted' | 'minimal';
export type BlurIntensity = 'none' | 'low' | 'medium' | 'high';
export type FontFamily = 'system' | 'inter' | 'poppins' | 'nunito' | 'mono';

export interface CardStyleOption {
  id: CardStyle;
  label: string;
  icon: string;
  description: string;
}

export interface BlurOption {
  id: BlurIntensity;
  label: string;
}

export interface FontOption {
  id: FontFamily;
  label: string;
  preview: string;
  /** Google Fonts URL if external; null for system fonts */
  fontUrl: string | null;
}

export const CARD_STYLES: CardStyleOption[] = [
  { id: 'glass', label: 'Glass', icon: '🪟', description: 'Translucent surfaces with subtle blur' },
  { id: 'solid', label: 'Solid', icon: '⬛', description: 'Fully opaque, clean professional look' },
  { id: 'frosted', label: 'Frosted', icon: '❄️', description: 'Strong blur with premium translucency' },
  { id: 'minimal', label: 'Minimal', icon: '✦', description: 'Flat surfaces, minimal shadows and borders' },
];

export const BLUR_OPTIONS: BlurOption[] = [
  { id: 'none', label: 'None' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

export const FONT_OPTIONS: FontOption[] = [
  { id: 'inter', label: 'Inter', preview: 'Aa', fontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
  { id: 'system', label: 'System', preview: 'Aa', fontUrl: null },
  { id: 'poppins', label: 'Poppins', preview: 'Aa', fontUrl: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap' },
  { id: 'nunito', label: 'Nunito', preview: 'Aa', fontUrl: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap' },
  { id: 'mono', label: 'Mono', preview: 'Aa', fontUrl: null },
];

const DEFAULT_CARD_STYLE: CardStyle = 'glass';
const DEFAULT_BLUR: BlurIntensity = 'medium';
const DEFAULT_FONT: FontFamily = 'inter';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly modeKey = 'todo-app-theme-mode';
  private readonly paletteKey = 'todo-app-theme-palette';
  private readonly backgroundKey = 'todo-app-background-style';
  private readonly cardStyleKey = 'todo-app-card-style';
  private readonly blurKey = 'todo-app-blur-intensity';
  private readonly fontKey = 'todo-app-font-family';

  private readonly modeSubject = new BehaviorSubject<ThemeMode>('light');
  private readonly paletteSubject = new BehaviorSubject<ThemePalette>(DEFAULT_PALETTE);
  private readonly backgroundSubject = new BehaviorSubject<BackgroundStyle>(DEFAULT_BACKGROUND);
  private readonly cardStyleSubject = new BehaviorSubject<CardStyle>(DEFAULT_CARD_STYLE);
  private readonly blurSubject = new BehaviorSubject<BlurIntensity>(DEFAULT_BLUR);
  private readonly fontSubject = new BehaviorSubject<FontFamily>(DEFAULT_FONT);

  readonly theme$ = this.modeSubject.asObservable();
  readonly palette$ = this.paletteSubject.asObservable();
  readonly background$ = this.backgroundSubject.asObservable();
  readonly cardStyle$ = this.cardStyleSubject.asObservable();
  readonly blur$ = this.blurSubject.asObservable();
  readonly font$ = this.fontSubject.asObservable();
  readonly palettes = THEME_PALETTES;
  readonly backgrounds = BACKGROUND_STYLES;
  readonly cardStyles = CARD_STYLES;
  readonly blurOptions = BLUR_OPTIONS;
  readonly fontOptions = FONT_OPTIONS;

  readonly selection$ = combineLatest([
    this.modeSubject,
    this.paletteSubject,
    this.backgroundSubject,
    this.cardStyleSubject,
    this.blurSubject,
    this.fontSubject,
  ]).pipe(map(([mode, palette, background, cardStyle, blur, font]) => ({
    mode, palette, background, cardStyle, blur, font,
  })));

  get current(): ThemeMode { return this.modeSubject.value; }
  get currentPalette(): ThemePalette { return this.paletteSubject.value; }
  get currentBackground(): BackgroundStyle { return this.backgroundSubject.value; }
  get currentCardStyle(): CardStyle { return this.cardStyleSubject.value; }
  get currentBlur(): BlurIntensity { return this.blurSubject.value; }
  get currentFont(): FontFamily { return this.fontSubject.value; }

  get activePalette(): ThemePaletteOption {
    return THEME_PALETTES.find((p) => p.id === this.currentPalette) ?? THEME_PALETTES[0];
  }
  get activeBackground(): BackgroundStyleOption {
    return BACKGROUND_STYLES.find((b) => b.id === this.currentBackground) ?? BACKGROUND_STYLES[0];
  }
  get activeCardStyle(): CardStyleOption {
    return CARD_STYLES.find((c) => c.id === this.currentCardStyle) ?? CARD_STYLES[0];
  }

  init(): void {
    const savedMode = localStorage.getItem(this.modeKey) as ThemeMode | null;
    const savedPalette = localStorage.getItem(this.paletteKey) as ThemePalette | null;
    const savedBackground = localStorage.getItem(this.backgroundKey) as BackgroundStyle | null;
    const savedCardStyle = localStorage.getItem(this.cardStyleKey) as CardStyle | null;
    const savedBlur = localStorage.getItem(this.blurKey) as BlurIntensity | null;
    const savedFont = localStorage.getItem(this.fontKey) as FontFamily | null;
    const legacy = localStorage.getItem('todo-app-theme') as ThemeMode | null;

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = savedMode ?? legacy ?? (prefersDark ? 'dark' : 'light');
    const palette = savedPalette && THEME_PALETTES.some((p) => p.id === savedPalette) ? savedPalette : DEFAULT_PALETTE;
    const background = savedBackground && BACKGROUND_STYLES.some((b) => b.id === savedBackground) ? savedBackground : DEFAULT_BACKGROUND;
    const cardStyle = savedCardStyle && CARD_STYLES.some((c) => c.id === savedCardStyle) ? savedCardStyle : DEFAULT_CARD_STYLE;
    const blur = savedBlur && BLUR_OPTIONS.some((b) => b.id === savedBlur) ? savedBlur : DEFAULT_BLUR;
    const font = savedFont && FONT_OPTIONS.some((f) => f.id === savedFont) ? savedFont : DEFAULT_FONT;

    this.apply(mode, palette, background, cardStyle, blur, font);
  }

  toggle(): void {
    this.apply(
      this.current === 'light' ? 'dark' : 'light',
      this.currentPalette, this.currentBackground,
      this.currentCardStyle, this.currentBlur, this.currentFont,
    );
  }

  setTheme(mode: ThemeMode): void {
    this.apply(mode, this.currentPalette, this.currentBackground, this.currentCardStyle, this.currentBlur, this.currentFont);
  }

  setPalette(palette: ThemePalette): void {
    this.apply(this.current, palette, this.currentBackground, this.currentCardStyle, this.currentBlur, this.currentFont);
  }

  setBackground(background: BackgroundStyle): void {
    this.apply(this.current, this.currentPalette, background, this.currentCardStyle, this.currentBlur, this.currentFont);
  }

  setCardStyle(cardStyle: CardStyle): void {
    this.apply(this.current, this.currentPalette, this.currentBackground, cardStyle, this.currentBlur, this.currentFont);
  }

  setBlur(blur: BlurIntensity): void {
    this.apply(this.current, this.currentPalette, this.currentBackground, this.currentCardStyle, blur, this.currentFont);
  }

  setFont(font: FontFamily): void {
    this.apply(this.current, this.currentPalette, this.currentBackground, this.currentCardStyle, this.currentBlur, font);
  }

  private apply(
    mode: ThemeMode,
    palette: ThemePalette,
    background: BackgroundStyle,
    cardStyle: CardStyle,
    blur: BlurIntensity,
    font: FontFamily,
  ): void {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.setAttribute('data-palette', palette);
    root.setAttribute('data-background', background);
    root.setAttribute('data-card-style', cardStyle);
    root.setAttribute('data-blur-intensity', blur);
    root.setAttribute('data-font', font);
    root.style.colorScheme = mode;

    // Load external font if needed
    this.loadFont(font);

    localStorage.setItem(this.modeKey, mode);
    localStorage.setItem(this.paletteKey, palette);
    localStorage.setItem(this.backgroundKey, background);
    localStorage.setItem(this.cardStyleKey, cardStyle);
    localStorage.setItem(this.blurKey, blur);
    localStorage.setItem(this.fontKey, font);
    localStorage.removeItem('todo-app-theme');

    this.modeSubject.next(mode);
    this.paletteSubject.next(palette);
    this.backgroundSubject.next(background);
    this.cardStyleSubject.next(cardStyle);
    this.blurSubject.next(blur);
    this.fontSubject.next(font);
  }

  private loadFont(font: FontFamily): void {
    const option = FONT_OPTIONS.find((f) => f.id === font);
    if (!option?.fontUrl) return;

    const existingLink = document.querySelector(`link[data-font-id="${font}"]`);
    if (existingLink) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = option.fontUrl;
    link.setAttribute('data-font-id', font);
    document.head.appendChild(link);
  }
}
