import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-ai-confirmation-card',
  standalone: true,
  template: `
    <div class="confirm-card">
      <strong>{{ title }}</strong>
      <p>{{ description }}</p>
      <div class="confirm-card__actions">
        <button
          type="button"
          class="btn btn--ghost"
          [disabled]="busy"
          (click)="cancelled.emit()"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn--danger"
          [disabled]="busy"
          (click)="confirmed.emit()"
        >
          {{ busy ? 'Working…' : 'Confirm' }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .confirm-card {
        border: 1px solid color-mix(in srgb, var(--danger) 35%, var(--border));
        background: color-mix(in srgb, var(--danger) 6%, var(--surface-muted));
        border-radius: 12px;
        padding: 0.875rem;
        margin-top: 0.5rem;
      }
      .confirm-card strong {
        display: block;
        margin-bottom: 0.35rem;
      }
      .confirm-card p {
        margin: 0 0 0.75rem;
        color: var(--text-muted);
        font-size: 0.875rem;
      }
      .confirm-card__actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
    `,
  ],
})
export class AiConfirmationCardComponent {
  @Input() title = 'Confirm action';
  @Input() description = '';
  @Input() busy = false;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
