import {
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Task } from '../../../core/models/app.models';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <article class="task-card" [class.task-card--completed]="task.status === 'COMPLETED'">
      <label class="task-card__check">
        <input
          type="checkbox"
          [checked]="task.status === 'COMPLETED'"
          (change)="toggleComplete.emit(task)"
          [attr.aria-label]="'Mark ' + task.title + ' as complete'"
        />
        <span class="task-card__checkbox"></span>
      </label>

      <div class="task-card__body">
        <div class="task-card__header">
          <h3>{{ task.title }}</h3>
          <span class="badge badge--{{ task.priority.toLowerCase() }}">{{
            task.priority
          }}</span>
        </div>

        @if (task.description) {
          <p class="task-card__description">{{ task.description }}</p>
        }

        <div class="task-card__meta">
          @if (task.category) {
            <span class="chip">{{ task.category.icon }} {{ task.category.name }}</span>
          }
          @if (task.dueDate) {
            <span class="chip chip--date">{{ task.dueDate | date: 'MMM d, y' }}</span>
          }
          <span class="chip chip--status">{{ task.status.replace('_', ' ') }}</span>
        </div>
      </div>

      <div class="task-card__actions">
        <button type="button" class="btn-icon" (click)="edit.emit(task)" aria-label="Edit task">
          ✏️
        </button>
        @if (task.status !== 'ARCHIVED') {
          <button type="button" class="btn-icon" (click)="archive.emit(task)" aria-label="Archive task">
            📦
          </button>
        }
        <button type="button" class="btn-icon btn-icon--danger" (click)="remove.emit(task)" aria-label="Delete task">
          🗑️
        </button>
      </div>
    </article>
  `,
  styles: [
    `
      .task-card {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 0.875rem;
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--surface);
        box-shadow: var(--shadow-sm);
      }
      .task-card--completed h3 {
        text-decoration: line-through;
        color: var(--text-muted);
      }
      .task-card__check input {
        position: absolute;
        opacity: 0;
      }
      .task-card__checkbox {
        display: inline-flex;
        width: 20px;
        height: 20px;
        border: 2px solid var(--border-strong);
        border-radius: 6px;
        align-items: center;
        justify-content: center;
      }
      .task-card__check input:checked + .task-card__checkbox {
        background: var(--primary);
        border-color: var(--primary);
      }
      .task-card__check input:checked + .task-card__checkbox::after {
        content: '✓';
        color: white;
        font-size: 0.75rem;
      }
      .task-card__header {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: start;
      }
      h3 {
        margin: 0;
        font-size: 1rem;
        line-height: 1.4;
      }
      .task-card__description {
        margin: 0.5rem 0 0;
        color: var(--text-muted);
        font-size: 0.875rem;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .task-card__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.75rem;
      }
      .chip {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 999px;
        background: var(--surface-muted);
        color: var(--text-muted);
      }
      .badge {
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 0.25rem 0.5rem;
        border-radius: 999px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }
      .badge--low { background: #ecfdf5; color: #047857; }
      .badge--medium { background: #eff6ff; color: #1d4ed8; }
      .badge--high { background: #fff7ed; color: #c2410c; }
      .badge--urgent { background: #fef2f2; color: #b91c1c; }
      .task-card__actions {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .btn-icon {
        border: none;
        background: transparent;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 8px;
      }
      .btn-icon:hover {
        background: var(--surface-muted);
      }
      @media (max-width: 640px) {
        .task-card {
          grid-template-columns: auto 1fr;
        }
        .task-card__actions {
          grid-column: 1 / -1;
          flex-direction: row;
          justify-content: flex-end;
        }
      }
    `,
  ],
})
export class TaskCardComponent {
  @Input({ required: true }) task!: Task;
  @Output() toggleComplete = new EventEmitter<Task>();
  @Output() edit = new EventEmitter<Task>();
  @Output() archive = new EventEmitter<Task>();
  @Output() remove = new EventEmitter<Task>();
}
