import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      class="theme-toggle"
      (click)="themeService.toggle()"
      [attr.aria-label]="themeService.current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
      [title]="themeService.current === 'dark' ? 'Light mode' : 'Dark mode'"
    >
      <span class="theme-toggle__icon" aria-hidden="true">
        {{ themeService.current === 'dark' ? '☀️' : '🌙' }}
      </span>
    </button>
  `,
  styles: [
    `
      .theme-toggle {
        border: 1px solid var(--border);
        background: var(--surface-muted);
        border-radius: 999px;
        width: 40px;
        height: 40px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.2s ease, transform 0.2s ease;
        flex-shrink: 0;
      }
      .theme-toggle:hover {
        background: var(--primary-soft);
        transform: scale(1.05);
      }
      .theme-toggle__icon {
        font-size: 1.1rem;
        line-height: 1;
      }
    `,
  ],
})
export class ThemeToggleComponent {
  readonly themeService = inject(ThemeService);
}
