import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DefaultLandingPage,
  MotionIntensity,
  PlainTexture,
  PreferencesService,
} from '../../../core/services/preferences.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-preferences-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="preferences-panel">
      <div class="preferences-panel__section">
        <span class="preferences-panel__label">Motion intensity</span>
        <p class="preferences-panel__hint">How much the background reacts to cursor movement.</p>
        <div class="preferences-panel__row" role="radiogroup" aria-label="Motion intensity">
          @for (option of prefs.motionOptions; track option.id) {
            <button
              type="button"
              class="pref-chip"
              role="radio"
              [attr.aria-checked]="prefs.motionIntensity === option.id"
              [class.pref-chip--active]="prefs.motionIntensity === option.id"
              (click)="setMotion(option.id)"
            >
              {{ option.label }}
            </button>
          }
        </div>
      </div>

      @if (themeService.currentBackground === 'plain') {
        <div class="preferences-panel__section">
          <span class="preferences-panel__label">Plain texture</span>
          <p class="preferences-panel__hint">Optional subtle texture on the plain background.</p>
          <div class="preferences-panel__row" role="radiogroup" aria-label="Plain texture">
            @for (option of prefs.plainTextureOptions; track option.id) {
              <button
                type="button"
                class="pref-chip"
                role="radio"
                [attr.aria-checked]="prefs.plainTexture === option.id"
                [class.pref-chip--active]="prefs.plainTexture === option.id"
                (click)="setTexture(option.id)"
              >
                {{ option.icon }} {{ option.label }}
              </button>
            }
          </div>
        </div>
      }

      <div class="preferences-panel__section">
        <span class="preferences-panel__label">Default page</span>
        <p class="preferences-panel__hint">Where to land after login.</p>
        <div class="preferences-panel__row" role="radiogroup" aria-label="Default landing page">
          @for (option of prefs.landingOptions; track option.id) {
            <button
              type="button"
              class="pref-chip"
              role="radio"
              [attr.aria-checked]="prefs.defaultLanding === option.id"
              [class.pref-chip--active]="prefs.defaultLanding === option.id"
              (click)="setLanding(option.id)"
            >
              {{ option.icon }} {{ option.label }}
            </button>
          }
        </div>
      </div>

      <div class="preferences-panel__section preferences-panel__section--toggle">
        <div>
          <span class="preferences-panel__label">Compact layout</span>
          <p class="preferences-panel__hint">Denser sidebar, cards, and spacing.</p>
        </div>
        <button
          type="button"
          class="toggle-switch"
          role="switch"
          [attr.aria-checked]="prefs.compactLayout"
          [class.toggle-switch--on]="prefs.compactLayout"
          (click)="toggleCompact()"
        >
          <span class="toggle-switch__knob"></span>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .preferences-panel {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .preferences-panel__section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .preferences-panel__section--toggle {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }
      .preferences-panel__label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
      }
      .preferences-panel__hint {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--text-muted);
      }
      .preferences-panel__row {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .pref-chip {
        border: 1px solid var(--border);
        background: var(--surface-muted);
        color: var(--text-primary);
        border-radius: 999px;
        padding: 0.5rem 0.875rem;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.875rem;
      }
      .pref-chip--active {
        border-color: var(--primary);
        background: var(--primary-soft);
        color: var(--primary);
      }
      .toggle-switch {
        width: 48px;
        height: 28px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--surface-muted);
        padding: 3px;
        cursor: pointer;
        flex-shrink: 0;
        transition: background 0.2s ease;
      }
      .toggle-switch--on {
        background: var(--primary);
        border-color: var(--primary);
      }
      .toggle-switch__knob {
        display: block;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: white;
        transition: transform 0.2s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      }
      .toggle-switch--on .toggle-switch__knob {
        transform: translateX(20px);
      }
    `,
  ],
})
export class PreferencesPanelComponent {
  readonly prefs = inject(PreferencesService);
  readonly themeService = inject(ThemeService);

  setMotion(value: MotionIntensity): void {
    this.prefs.setMotionIntensity(value);
  }

  setTexture(value: PlainTexture): void {
    this.prefs.setPlainTexture(value);
  }

  setLanding(value: DefaultLandingPage): void {
    this.prefs.setDefaultLanding(value);
  }

  toggleCompact(): void {
    this.prefs.setCompactLayout(!this.prefs.compactLayout);
  }
}
