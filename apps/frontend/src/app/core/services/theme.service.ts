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

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly modeKey = 'todo-app-theme-mode';
  private readonly paletteKey = 'todo-app-theme-palette';
  private readonly backgroundKey = 'todo-app-background-style';

  private readonly modeSubject = new BehaviorSubject<ThemeMode>('light');
  private readonly paletteSubject = new BehaviorSubject<ThemePalette>(DEFAULT_PALETTE);
  private readonly backgroundSubject = new BehaviorSubject<BackgroundStyle>(DEFAULT_BACKGROUND);

  readonly theme$ = this.modeSubject.asObservable();
  readonly palette$ = this.paletteSubject.asObservable();
  readonly background$ = this.backgroundSubject.asObservable();
  readonly palettes = THEME_PALETTES;
  readonly backgrounds = BACKGROUND_STYLES;

  readonly selection$ = combineLatest([
    this.modeSubject,
    this.paletteSubject,
    this.backgroundSubject,
  ]).pipe(map(([mode, palette, background]) => ({ mode, palette, background })));

  get current(): ThemeMode {
    return this.modeSubject.value;
  }

  get currentPalette(): ThemePalette {
    return this.paletteSubject.value;
  }

  get currentBackground(): BackgroundStyle {
    return this.backgroundSubject.value;
  }

  get activePalette(): ThemePaletteOption {
    return (
      THEME_PALETTES.find((p) => p.id === this.currentPalette) ?? THEME_PALETTES[0]
    );
  }

  get activeBackground(): BackgroundStyleOption {
    return (
      BACKGROUND_STYLES.find((b) => b.id === this.currentBackground) ??
      BACKGROUND_STYLES[0]
    );
  }

  init(): void {
    const savedMode = localStorage.getItem(this.modeKey) as ThemeMode | null;
    const savedPalette = localStorage.getItem(this.paletteKey) as ThemePalette | null;
    const savedBackground = localStorage.getItem(this.backgroundKey) as BackgroundStyle | null;
    const legacy = localStorage.getItem('todo-app-theme') as ThemeMode | null;

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = savedMode ?? legacy ?? (prefersDark ? 'dark' : 'light');
    const palette =
      savedPalette && THEME_PALETTES.some((p) => p.id === savedPalette)
        ? savedPalette
        : DEFAULT_PALETTE;
    const background =
      savedBackground && BACKGROUND_STYLES.some((b) => b.id === savedBackground)
        ? savedBackground
        : DEFAULT_BACKGROUND;

    this.apply(mode, palette, background);
  }

  toggle(): void {
    this.apply(this.current === 'light' ? 'dark' : 'light', this.currentPalette, this.currentBackground);
  }

  setTheme(mode: ThemeMode): void {
    this.apply(mode, this.currentPalette, this.currentBackground);
  }

  setPalette(palette: ThemePalette): void {
    this.apply(this.current, palette, this.currentBackground);
  }

  setBackground(background: BackgroundStyle): void {
    this.apply(this.current, this.currentPalette, background);
  }

  private apply(mode: ThemeMode, palette: ThemePalette, background: BackgroundStyle): void {
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-palette', palette);
    document.documentElement.setAttribute('data-background', background);
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem(this.modeKey, mode);
    localStorage.setItem(this.paletteKey, palette);
    localStorage.setItem(this.backgroundKey, background);
    localStorage.removeItem('todo-app-theme');
    this.modeSubject.next(mode);
    this.paletteSubject.next(palette);
    this.backgroundSubject.next(background);
  }
}
