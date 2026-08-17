import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BackgroundStyle,
  ThemeMode,
  ThemePalette,
  ThemeService,
} from '../../../core/services/theme.service';

@Component({
  selector: 'app-theme-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="theme-picker" [class.theme-picker--compact]="compact">
      @if (!compact) {
        <div class="theme-picker__section">
          <span class="theme-picker__label">Background</span>
          <div class="theme-picker__backgrounds" role="radiogroup" aria-label="Background style">
            @for (bg of themeService.backgrounds; track bg.id) {
              <button
                type="button"
                class="bg-chip"
                role="radio"
                [attr.aria-checked]="themeService.currentBackground === bg.id"
                [class.bg-chip--active]="themeService.currentBackground === bg.id"
                (click)="selectBackground(bg.id)"
                [title]="bg.description"
              >
                <span class="bg-chip__icon" aria-hidden="true">{{ bg.icon }}</span>
                <span class="bg-chip__label">{{ bg.label }}</span>
              </button>
            }
          </div>
        </div>

        <div class="theme-picker__section">
          <span class="theme-picker__label">Accent color</span>
          <div class="theme-picker__palettes" role="radiogroup" aria-label="Accent color">
            @for (palette of themeService.palettes; track palette.id) {
              <button
                type="button"
                class="palette-chip"
                role="radio"
                [attr.aria-checked]="themeService.currentPalette === palette.id"
                [class.palette-chip--active]="themeService.currentPalette === palette.id"
                [style.--chip-color]="palette.preview"
                (click)="selectPalette(palette.id)"
                [title]="palette.label"
              >
                <span
                  class="palette-chip__swatch"
                  [style.background]="palette.preview"
                  aria-hidden="true"
                ></span>
                <span class="palette-chip__label">{{ palette.label }}</span>
              </button>
            }
          </div>
        </div>
      }

      <div class="theme-picker__section">
        @if (!compact) {
          <span class="theme-picker__label">Mode</span>
        }
        <div class="theme-picker__modes" role="radiogroup" aria-label="Light or dark mode">
          <button
            type="button"
            class="mode-chip"
            role="radio"
            [attr.aria-checked]="themeService.current === 'light'"
            [class.mode-chip--active]="themeService.current === 'light'"
            (click)="selectMode('light')"
          >
            ☀️ Light
          </button>
          <button
            type="button"
            class="mode-chip"
            role="radio"
            [attr.aria-checked]="themeService.current === 'dark'"
            [class.mode-chip--active]="themeService.current === 'dark'"
            (click)="selectMode('dark')"
          >
            🌙 Dark
          </button>
        </div>
      </div>

      @if (compact) {
        <details class="theme-picker__dropdown">
          <summary class="theme-picker__trigger" aria-label="Choose background style">
            <span class="theme-picker__trigger-icon" aria-hidden="true">{{
              themeService.activeBackground.icon
            }}</span>
            <span>{{ themeService.activeBackground.label }}</span>
            <span class="theme-picker__chevron" aria-hidden="true">▾</span>
          </summary>
          <div class="theme-picker__menu">
            @for (bg of themeService.backgrounds; track bg.id) {
              <button
                type="button"
                class="theme-picker__menu-item"
                [class.theme-picker__menu-item--active]="
                  themeService.currentBackground === bg.id
                "
                (click)="selectBackground(bg.id)"
              >
                {{ bg.icon }} {{ bg.label }}
              </button>
            }
          </div>
        </details>
      }
    </div>
  `,
  styles: [
    `
      .theme-picker {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .theme-picker--compact {
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
      }
      .theme-picker__section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .theme-picker__label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
      }
      .theme-picker__backgrounds {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
        gap: 0.5rem;
      }
      .bg-chip {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.35rem;
        padding: 0.75rem 0.5rem;
        border: 2px solid var(--border);
        border-radius: 12px;
        background: var(--surface-muted);
        color: var(--text-primary);
        cursor: pointer;
        transition: border-color 0.2s ease, transform 0.15s ease;
      }
      .bg-chip:hover {
        border-color: var(--primary);
        transform: translateY(-1px);
      }
      .bg-chip--active {
        border-color: var(--primary);
        background: var(--primary-soft);
      }
      .bg-chip__icon {
        font-size: 1.35rem;
      }
      .bg-chip__label {
        font-size: 0.8125rem;
        font-weight: 600;
      }
      .theme-picker__palettes {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .palette-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.45rem 0.75rem;
        border: 2px solid var(--border);
        border-radius: 999px;
        background: var(--surface-muted);
        color: var(--text-primary);
        cursor: pointer;
        transition: border-color 0.2s ease;
      }
      .palette-chip:hover {
        border-color: var(--chip-color, var(--primary));
      }
      .palette-chip--active {
        border-color: var(--chip-color, var(--primary));
        background: var(--primary-soft);
      }
      .palette-chip__swatch {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .palette-chip__label {
        font-size: 0.8125rem;
        font-weight: 600;
      }
      .theme-picker__modes {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .mode-chip {
        border: 1px solid var(--border);
        background: var(--surface-muted);
        color: var(--text-primary);
        border-radius: 999px;
        padding: 0.5rem 0.875rem;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.875rem;
      }
      .mode-chip--active {
        border-color: var(--primary);
        background: var(--primary-soft);
        color: var(--primary);
      }
      .theme-picker__dropdown {
        position: relative;
      }
      .theme-picker__trigger {
        list-style: none;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        border: 1px solid var(--border);
        background: var(--surface-muted);
        border-radius: 999px;
        padding: 0.35rem 0.65rem 0.35rem 0.5rem;
        cursor: pointer;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--text-primary);
        user-select: none;
      }
      .theme-picker__trigger::-webkit-details-marker {
        display: none;
      }
      .theme-picker__trigger-icon {
        font-size: 1rem;
        line-height: 1;
      }
      .theme-picker__chevron {
        font-size: 0.65rem;
        opacity: 0.6;
      }
      .theme-picker__menu {
        position: absolute;
        top: calc(100% + 0.35rem);
        right: 0;
        min-width: 170px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: var(--shadow-md);
        padding: 0.35rem;
        z-index: 200;
      }
      .theme-picker__menu-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        border: none;
        background: transparent;
        color: var(--text-primary);
        border-radius: 8px;
        padding: 0.5rem 0.625rem;
        cursor: pointer;
        font-size: 0.875rem;
        text-align: left;
      }
      .theme-picker__menu-item:hover {
        background: var(--primary-soft);
      }
      .theme-picker__menu-item--active {
        background: var(--primary-soft);
        color: var(--primary);
        font-weight: 600;
      }
    `,
  ],
})
export class ThemePickerComponent {
  @Input() compact = false;

  readonly themeService = inject(ThemeService);

  selectMode(mode: ThemeMode): void {
    this.themeService.setTheme(mode);
  }

  selectPalette(palette: ThemePalette): void {
    this.themeService.setPalette(palette);
  }

  selectBackground(background: BackgroundStyle): void {
    this.themeService.setBackground(background);
  }
}
