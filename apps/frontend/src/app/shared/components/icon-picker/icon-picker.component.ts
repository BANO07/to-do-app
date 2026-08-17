import { Component, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';

export const CATEGORY_ICONS = [
  '📁', '🏠', '💼', '📚', '🛒', '💪', '🎯', '✈️', '🎨', '💡',
  '🔥', '⭐', '❤️', '🎵', '🍔', '🏋️', '📅', '💰', '🌿', '🚀',
  '📝', '🔔', '🎮', '🐾', '🌸', '☀️', '🌙', '🏷️', '✅', '📌',
] as const;

@Component({
  selector: 'app-icon-picker',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => IconPickerComponent),
      multi: true,
    },
  ],
  template: `
    <fieldset class="icon-picker">
      <legend class="icon-picker__label">{{ label }}</legend>
      <div class="icon-picker__grid" role="listbox" [attr.aria-label]="label">
        @for (icon of icons; track icon) {
          <button
            type="button"
            class="icon-picker__btn"
            role="option"
            [attr.aria-selected]="value === icon"
            [class.icon-picker__btn--active]="value === icon"
            (click)="pick(icon)"
            [title]="icon"
          >
            {{ icon }}
          </button>
        }
      </div>
    </fieldset>
  `,
  styles: [
    `
      .icon-picker {
        border: none;
        margin: 0;
        padding: 0;
        min-width: 0;
      }
      .icon-picker__label {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 0.5rem;
        padding: 0;
      }
      .icon-picker__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(42px, 1fr));
        gap: 0.4rem;
      }
      .icon-picker__btn {
        width: 100%;
        aspect-ratio: 1;
        border: 2px solid var(--border);
        border-radius: 10px;
        background: var(--surface-muted);
        font-size: 1.25rem;
        cursor: pointer;
        display: grid;
        place-items: center;
        transition: border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
        line-height: 1;
      }
      .icon-picker__btn:hover {
        border-color: var(--primary);
        background: var(--primary-soft);
        transform: scale(1.05);
      }
      .icon-picker__btn--active {
        border-color: var(--primary);
        background: var(--primary-soft);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 25%, transparent);
      }
    `,
  ],
})
export class IconPickerComponent implements ControlValueAccessor {
  label = 'Pick an icon';
  icons = CATEGORY_ICONS;

  value = '📁';
  disabled = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  pick(icon: string): void {
    if (this.disabled) return;
    this.value = icon;
    this.onChange(icon);
    this.onTouched();
  }

  writeValue(value: string | null): void {
    this.value = value || '📁';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
