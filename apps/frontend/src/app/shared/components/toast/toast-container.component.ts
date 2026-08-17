import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastMessage } from '../../../core/services/toast.service';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, AsyncPipe],
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="true">
      @for (toast of toastService.toasts$ | async; track toast.id) {
        <div class="toast toast--{{ toast.type }}" role="alert">
          <span>{{ toast.message }}</span>
          <div class="toast__actions">
            @if (toast.actionLabel && toast.action) {
              <button
                type="button"
                class="toast__undo"
                (click)="toastService.runAction(toast)"
              >
                {{ toast.actionLabel }}
              </button>
            }
            <button
              type="button"
              class="toast__close"
              (click)="toastService.dismiss(toast.id)"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast-container {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-width: min(420px, calc(100vw - 2rem));
      }
      .toast {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.875rem 1rem;
        border-radius: 12px;
        box-shadow: var(--shadow-md);
        background: var(--surface);
        border: 1px solid var(--border);
        color: var(--text-primary);
        animation: slideIn 0.2s ease;
      }
      .toast--success {
        border-color: color-mix(in srgb, #22c55e 40%, var(--border));
        background: color-mix(in srgb, #22c55e 8%, var(--surface));
      }
      .toast--error {
        border-color: color-mix(in srgb, var(--danger) 40%, var(--border));
        background: color-mix(in srgb, var(--danger) 8%, var(--surface));
      }
      .toast__actions {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex-shrink: 0;
      }
      .toast__undo {
        border: 1px solid var(--primary);
        background: var(--primary-soft);
        color: var(--primary);
        border-radius: 8px;
        padding: 0.25rem 0.625rem;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
      }
      .toast__close {
        background: none;
        border: none;
        font-size: 1.25rem;
        cursor: pointer;
        color: inherit;
        line-height: 1;
      }
      @keyframes slideIn {
        from {
          transform: translateX(12px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `,
  ],
})
export class ToastContainerComponent {
  constructor(readonly toastService: ToastService) {}
}
