import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  RECURRENCE_LABELS,
  RecurrenceFrequency,
  Subtask,
  Task,
  TaskProgress,
  TaskStatus,
} from '../../../core/models/app.models';
import { SubtaskService } from '../../../core/services/subtask.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { statusLabel, WORKFLOW_STATUSES } from '../../../core/utils/task-status';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, ConfirmDialogComponent],
  template: `
    <article
      class="task-card"
      [class.task-card--completed]="task.status === 'COMPLETED'"
      [class.task-card--selectable]="selectable"
      [class.task-card--selected]="selected"
      [class.task-card--highlighted]="highlighted"
    >
      @if (selectable) {
        <label class="task-card__select">
          <input
            type="checkbox"
            [checked]="selected"
            (change)="selectedChange.emit(!selected)"
            [attr.aria-label]="'Select ' + task.title"
          />
          <span class="task-card__select-box"></span>
        </label>
      }

      <div class="task-card__body">
        <div class="task-card__header">
          <h3>{{ task.title }}</h3>
          @if (task.status === 'ARCHIVED') {
            <span class="status-badge status-badge--archived">{{ statusLabel(task.status) }}</span>
          } @else {
            <label class="sr-only" [attr.for]="'status-' + task.id">Task status</label>
            <select
              class="status-select"
              [id]="'status-' + task.id"
              [ngModel]="task.status"
              (change)="onStatusSelect($event)"
              [attr.aria-label]="'Change status for ' + task.title"
              [title]="'Change status for ' + task.title"
            >
              @for (status of workflowStatuses; track status) {
                <option [value]="status">{{ statusLabel(status) }}</option>
              }
            </select>
          }
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
          <span class="chip chip--status">{{ statusLabel(task.status) }}</span>
          <span class="badge badge--{{ task.priority.toLowerCase() }}">{{
            task.priority
          }}</span>
          @if (recurrenceLabel) {
            <span class="chip">🔁 {{ recurrenceLabel }}</span>
          }
          @if (progress.total > 0) {
            <button
              type="button"
              class="chip chip--progress"
              (click)="toggleSubtasks()"
              [attr.aria-expanded]="expanded"
            >
              {{ progress.completed }}/{{ progress.total }} completed
            </button>
          }
        </div>

        @if (progress.total > 0) {
          <div class="progress" [attr.aria-label]="'Subtask progress'">
            <div class="progress__bar" [style.width.%]="progress.percentage"></div>
          </div>
        }

        <div class="subtasks">
          <button type="button" class="subtasks__toggle" (click)="toggleSubtasks()">
            {{ expanded ? 'Hide subtasks' : 'Subtasks' }}
          </button>

          @if (expanded) {
            @if (subtasksLoading) {
              <p class="subtasks__hint">Loading subtasks…</p>
            } @else if (subtasksError) {
              <p class="subtasks__hint subtasks__hint--error">{{ subtasksError }}</p>
            } @else if (subtasks.length === 0) {
              <p class="subtasks__hint">No subtasks yet.</p>
            } @else {
              <ul class="subtasks__list">
                @for (subtask of subtasks; track subtask.id) {
                  <li class="subtask" [class.subtask--done]="subtask.status === 'COMPLETED'">
                    <label>
                      <input
                        type="checkbox"
                        [checked]="subtask.status === 'COMPLETED'"
                        (change)="toggleSubtask(subtask)"
                      />
                      @if (editingId === subtask.id) {
                        <input
                          class="subtask__edit"
                          [(ngModel)]="editingTitle"
                          (keydown.enter)="saveSubtaskTitle(subtask)"
                          (keydown.escape)="editingId = null"
                        />
                      } @else {
                        <span>{{ subtask.title }}</span>
                      }
                    </label>
                    <div class="subtask__actions">
                      @if (editingId === subtask.id) {
                        <button type="button" class="btn-icon" (click)="saveSubtaskTitle(subtask)" aria-label="Save subtask">
                          💾
                        </button>
                      } @else {
                        <button type="button" class="btn-icon" (click)="startEdit(subtask)" aria-label="Edit subtask">
                          ✏️
                        </button>
                      }
                      <button
                        type="button"
                        class="btn-icon btn-icon--danger"
                        (click)="subtaskToDelete = subtask"
                        aria-label="Delete subtask"
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                }
              </ul>
            }

            <form class="subtasks__add" (submit)="addSubtask($event)">
              <input
                type="text"
                [(ngModel)]="newSubtaskTitle"
                name="newSubtaskTitle"
                placeholder="Add a subtask"
                maxlength="255"
              />
              <button type="submit" class="btn btn--ghost" [disabled]="!newSubtaskTitle.trim() || adding">
                Add
              </button>
            </form>
          }
        </div>
      </div>

      @if (showActions) {
        <div class="task-card__actions">
          <button
            type="button"
            class="action-btn"
            (click)="edit.emit(task)"
            aria-label="Edit task"
            title="Edit task"
          >
            <span aria-hidden="true">✏️</span>
            <span>Edit</span>
          </button>
          @if (task.status === 'ARCHIVED') {
            <button
              type="button"
              class="action-btn"
              (click)="restore.emit(task)"
              aria-label="Restore task"
              title="Restore task"
            >
              <span aria-hidden="true">↩️</span>
              <span>Restore</span>
            </button>
          } @else {
            <button
              type="button"
              class="action-btn"
              (click)="archive.emit(task)"
              aria-label="Archive task"
              title="Archive task"
            >
              <span aria-hidden="true">📦</span>
              <span>Archive</span>
            </button>
          }
          <button
            type="button"
            class="action-btn action-btn--danger"
            (click)="remove.emit(task)"
            aria-label="Delete task"
            title="Delete task"
          >
            <span aria-hidden="true">🗑️</span>
            <span>Delete</span>
          </button>
        </div>
      }

      <app-confirm-dialog
        [open]="!!subtaskToDelete"
        title="Delete subtask"
        message="Remove this subtask?"
        confirmLabel="Delete"
        (confirmed)="deleteSubtask()"
        (cancelled)="subtaskToDelete = null"
      />
    </article>
  `,
  styles: [
    `
      .task-card {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: var(--task-card-gap);
        padding: var(--task-card-padding);
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--surface);
        backdrop-filter: var(--glass-blur);
        -webkit-backdrop-filter: var(--glass-blur);
        box-shadow: var(--shadow-sm);
        transition: box-shadow 0.2s ease, border-color 0.15s ease;
      }
      .task-card--selectable {
        grid-template-columns: auto 1fr auto;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .task-card--selected {
        border-color: var(--primary);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary) 30%, transparent);
      }
      .task-card--highlighted {
        border-color: var(--primary);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 35%, transparent);
      }
      .task-card__select input {
        position: absolute;
        opacity: 0;
      }
      .task-card__select-box {
        display: inline-flex;
        width: 18px;
        height: 18px;
        border: 2px solid var(--border-strong);
        border-radius: 5px;
        align-items: center;
        justify-content: center;
      }
      .task-card__select input:checked + .task-card__select-box {
        background: var(--primary);
        border-color: var(--primary);
      }
      .task-card__select input:checked + .task-card__select-box::after {
        content: '✓';
        color: white;
        font-size: 0.65rem;
      }
      .task-card:hover {
        box-shadow: var(--shadow-md);
      }
      .task-card--completed h3 {
        text-decoration: line-through;
        color: var(--text-muted);
      }
      .status-select,
      .status-badge {
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 0.3rem 0.55rem;
        border-radius: 999px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
        border: 1px solid var(--border);
        background: var(--surface-muted);
        color: var(--text-primary);
      }
      .status-select {
        cursor: pointer;
        font: inherit;
        font-size: 0.75rem;
        font-weight: 700;
      }
      .status-badge--archived {
        color: var(--text-muted);
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
        border: none;
      }
      .chip--progress {
        cursor: pointer;
        color: var(--primary);
      }
      .progress {
        margin-top: 0.5rem;
        height: 6px;
        border-radius: 999px;
        background: var(--surface-muted);
        overflow: hidden;
      }
      .progress__bar {
        height: 100%;
        background: var(--primary);
      }
      .subtasks {
        margin-top: 0.75rem;
      }
      .subtasks__toggle {
        border: none;
        background: transparent;
        color: var(--text-muted);
        font-size: 0.8125rem;
        cursor: pointer;
        padding: 0;
      }
      .subtasks__hint {
        margin: 0.5rem 0 0;
        font-size: 0.8125rem;
        color: var(--text-muted);
      }
      .subtasks__hint--error {
        color: var(--danger);
      }
      .subtasks__list {
        list-style: none;
        margin: 0.5rem 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .subtask {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        align-items: center;
      }
      .subtask label {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex: 1;
        font-size: 0.875rem;
      }
      .subtask--done span {
        text-decoration: line-through;
        color: var(--text-muted);
      }
      .subtask__edit {
        flex: 1;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 0.25rem 0.5rem;
        background: var(--input-bg);
        color: var(--text-primary);
        font: inherit;
      }
      .subtask__actions {
        display: flex;
      }
      .subtasks__add {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }
      .subtasks__add input {
        flex: 1;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 0.5rem 0.75rem;
        background: var(--input-bg);
        color: var(--text-primary);
        font: inherit;
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
      .action-btn,
      .btn-icon {
        border: none;
        background: transparent;
        cursor: pointer;
        padding: 0.25rem 0.4rem;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font: inherit;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-muted);
        white-space: nowrap;
      }
      .action-btn:hover,
      .btn-icon:hover {
        background: var(--surface-muted);
        color: var(--text-primary);
      }
      .action-btn--danger:hover,
      .btn-icon--danger:hover {
        color: var(--danger);
      }
      @media (max-width: 640px) {
        .task-card,
        .task-card--selectable {
          grid-template-columns: auto 1fr;
        }
        .task-card:not(.task-card--selectable) {
          grid-template-columns: 1fr;
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
export class TaskCardComponent implements OnChanges {
  private readonly subtaskService = inject(SubtaskService);
  private readonly toastService = inject(ToastService);

  @Input({ required: true }) task!: Task;
  @Input() selectable = false;
  @Input() selected = false;
  @Input() highlighted = false;
  @Input() showActions = true;
  @Output() selectedChange = new EventEmitter<boolean>();
  @Output() statusChange = new EventEmitter<TaskStatus>();
  @Output() toggleComplete = new EventEmitter<Task>();
  @Output() edit = new EventEmitter<Task>();
  @Output() archive = new EventEmitter<Task>();
  @Output() restore = new EventEmitter<Task>();
  @Output() remove = new EventEmitter<Task>();
  @Output() progressChange = new EventEmitter<TaskProgress>();

  readonly workflowStatuses = WORKFLOW_STATUSES;
  readonly statusLabel = statusLabel;

  expanded = false;
  subtasks: Subtask[] = [];
  subtasksLoading = false;
  subtasksError: string | null = null;
  newSubtaskTitle = '';
  adding = false;
  editingId: string | null = null;
  editingTitle = '';
  subtaskToDelete: Subtask | null = null;
  progress: TaskProgress = { completed: 0, total: 0, percentage: 0 };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['task'] && this.task) {
      this.progress = this.task.progress ?? { completed: 0, total: 0, percentage: 0 };
    }
  }

  get recurrenceLabel(): string | null {
    const rule = this.task.recurrence;
    if (!rule?.isActive) {
      return null;
    }
    return RECURRENCE_LABELS[rule.frequency as RecurrenceFrequency] ?? rule.frequency;
  }

  onStatusSelect(event: Event): void {
    const status = (event.target as HTMLSelectElement).value as TaskStatus;
    this.onStatusChange(status);
  }

  onStatusChange(status: TaskStatus): void {
    if (status === this.task.status) {
      return;
    }
    this.statusChange.emit(status);
  }

  toggleSubtasks(): void {
    this.expanded = !this.expanded;
    if (this.expanded && this.subtasks.length === 0 && !this.subtasksLoading) {
      this.loadSubtasks();
    }
  }

  addSubtask(event: Event): void {
    event.preventDefault();
    const title = this.newSubtaskTitle.trim();
    if (!title) {
      return;
    }
    this.adding = true;
    this.subtaskService.createSubtask({ taskId: this.task.id, title }).subscribe({
      next: (subtask) => {
        this.subtasks = [...this.subtasks, subtask];
        this.newSubtaskTitle = '';
        this.adding = false;
        this.refreshProgress();
      },
      error: () => {
        this.adding = false;
        this.toastService.error('Unable to add subtask.');
      },
    });
  }

  toggleSubtask(subtask: Subtask): void {
    const request =
      subtask.status === 'COMPLETED'
        ? this.subtaskService.reopenSubtask(subtask.id)
        : this.subtaskService.completeSubtask(subtask.id);

    request.subscribe({
      next: (updated) => {
        this.subtasks = this.subtasks.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
        this.refreshProgress();
      },
      error: () => this.toastService.error('Unable to update subtask.'),
    });
  }

  startEdit(subtask: Subtask): void {
    this.editingId = subtask.id;
    this.editingTitle = subtask.title;
  }

  saveSubtaskTitle(subtask: Subtask): void {
    const title = this.editingTitle.trim();
    if (!title) {
      return;
    }
    this.subtaskService.updateSubtask(subtask.id, { title }).subscribe({
      next: (updated) => {
        this.subtasks = this.subtasks.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
        this.editingId = null;
      },
      error: () => this.toastService.error('Unable to rename subtask.'),
    });
  }

  deleteSubtask(): void {
    if (!this.subtaskToDelete) {
      return;
    }
    const id = this.subtaskToDelete.id;
    this.subtaskService.deleteSubtask(id).subscribe({
      next: () => {
        this.subtasks = this.subtasks.filter((item) => item.id !== id);
        this.subtaskToDelete = null;
        this.refreshProgress();
      },
      error: () => this.toastService.error('Unable to delete subtask.'),
    });
  }

  private loadSubtasks(): void {
    this.subtasksLoading = true;
    this.subtasksError = null;
    this.subtaskService.getSubtasks(this.task.id).subscribe({
      next: (subtasks) => {
        this.subtasks = subtasks;
        this.subtasksLoading = false;
        this.refreshProgress();
      },
      error: () => {
        this.subtasksLoading = false;
        this.subtasksError = 'Could not load subtasks.';
      },
    });
  }

  private refreshProgress(): void {
    const total = this.subtasks.length;
    const completed = this.subtasks.filter((item) => item.status === 'COMPLETED').length;
    this.progress = {
      total,
      completed,
      percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
    this.progressChange.emit(this.progress);
  }
}
