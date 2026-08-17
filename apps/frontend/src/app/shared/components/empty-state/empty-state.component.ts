import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-state" role="status">
      <div class="empty-state__icon" aria-hidden="true">{{ icon }}</div>
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      @if (actionLabel) {
        <button type="button" class="btn btn--primary empty-state__action" (click)="action.emit()">
          {{ actionLabel }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      .empty-state {
        text-align: center;
        padding: 3rem 1.5rem;
        color: var(--text-muted);
      }
      .empty-state__icon {
        font-size: 2.5rem;
        margin-bottom: 0.75rem;
      }
      h3 {
        margin: 0 0 0.5rem;
        color: var(--text-primary);
        font-size: 1.125rem;
      }
      p {
        margin: 0 0 1rem;
      }
      .empty-state__action {
        margin-top: 0.5rem;
      }
    `,
  ],
})
export class EmptyStateComponent {
  @Input() icon = '✨';
  @Input() title = 'Nothing here yet';
  @Input() message = 'Get started by adding your first task.';
  @Input() actionLabel = '';
  @Output() action = new EventEmitter<void>();
}
