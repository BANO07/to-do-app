import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (open) {
      <div class="dialog-backdrop" (click)="cancelled.emit()" role="presentation"></div>
      <div class="dialog" role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId">
        <h2 [id]="titleId">{{ title }}</h2>
        <p>{{ message }}</p>
        <div class="dialog__actions">
          <button type="button" class="btn btn--ghost" (click)="cancelled.emit()">Cancel</button>
          <button type="button" class="btn btn--danger" (click)="confirmed.emit()">{{ confirmLabel }}</button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .dialog-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        z-index: 900;
      }
      .dialog {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 901;
        width: min(420px, calc(100vw - 2rem));
        background: var(--surface);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: var(--shadow-lg);
      }
      h2 {
        margin: 0 0 0.5rem;
        font-size: 1.125rem;
      }
      p {
        margin: 0 0 1.25rem;
        color: var(--text-muted);
      }
      .dialog__actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  @Input() open = false;
  @Input() title = 'Confirm';
  @Input() message = 'Are you sure?';
  @Input() confirmLabel = 'Confirm';
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
  readonly titleId = 'confirm-dialog-title';
}
