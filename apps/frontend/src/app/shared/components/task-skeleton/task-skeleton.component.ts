import { Component } from '@angular/core';

@Component({
  selector: 'app-task-skeleton',
  standalone: true,
  template: `
    <div class="skeleton-list" aria-hidden="true">
      @for (item of items; track item) {
        <div class="skeleton-card">
          <div class="skeleton skeleton--checkbox"></div>
          <div class="skeleton-content">
            <div class="skeleton skeleton--title"></div>
            <div class="skeleton skeleton--line"></div>
            <div class="skeleton skeleton--meta"></div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .skeleton-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .skeleton-card {
        display: flex;
        gap: 0.875rem;
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--surface);
      }
      .skeleton {
        background: linear-gradient(
          90deg,
          var(--skeleton-base) 25%,
          var(--skeleton-shine) 50%,
          var(--skeleton-base) 75%
        );
        background-size: 200% 100%;
        animation: shimmer 1.4s infinite;
        border-radius: 8px;
      }
      .skeleton--checkbox {
        width: 20px;
        height: 20px;
        border-radius: 6px;
        flex-shrink: 0;
      }
      .skeleton-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .skeleton--title {
        height: 16px;
        width: 55%;
      }
      .skeleton--line {
        height: 12px;
        width: 80%;
      }
      .skeleton--meta {
        height: 12px;
        width: 35%;
      }
      @keyframes shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
    `,
  ],
})
export class TaskSkeletonComponent {
  readonly items = [1, 2, 3, 4];
}
