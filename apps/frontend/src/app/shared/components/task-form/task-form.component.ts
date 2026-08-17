import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  Category,
  CreateTaskInput,
  Task,
  TaskPriority,
  UpdateTaskInput,
} from '../../../core/models/app.models';

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form class="task-form" [formGroup]="form" (ngSubmit)="submit()">
      <div class="field">
        <label for="title">Title</label>
        <input id="title" type="text" formControlName="title" placeholder="What needs to be done?" autofocus />
      </div>

      <div class="field">
        <label for="description">Description</label>
        <textarea id="description" rows="3" formControlName="description" placeholder="Add details (optional)"></textarea>
      </div>

      <div class="grid">
        <div class="field">
          <label for="priority">Priority</label>
          <select id="priority" formControlName="priority">
            @for (option of priorities; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label for="categoryId">Category</label>
          <select id="categoryId" formControlName="categoryId">
            <option value="">No category</option>
            @for (category of categories; track category.id) {
              <option [value]="category.id">{{ category.icon }} {{ category.name }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label for="dueDate">Due date</label>
          <input id="dueDate" type="datetime-local" formControlName="dueDate" />
        </div>
      </div>

      <div class="actions">
        @if (mode === 'edit') {
          <button type="button" class="btn btn--ghost" (click)="cancelled.emit()">Cancel</button>
        }
        <button type="submit" class="btn btn--primary" [disabled]="form.invalid || submitting">
          {{ mode === 'edit' ? 'Save changes' : 'Add task' }}
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .task-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }
      label {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-primary);
      }
      input, textarea, select {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 0.75rem 0.875rem;
        font: inherit;
        background: var(--input-bg);
        color: var(--text-primary);
      }
      input:focus, textarea:focus, select:focus {
        outline: 2px solid var(--primary-soft);
        border-color: var(--primary);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
      @media (max-width: 768px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class TaskFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() categories: Category[] = [];
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() task: Task | null = null;
  @Input() submitting = false;
  @Output() saved = new EventEmitter<CreateTaskInput | UpdateTaskInput>();
  @Output() cancelled = new EventEmitter<void>();

  readonly priorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    description: [''],
    priority: ['MEDIUM' as TaskPriority],
    categoryId: [''],
    dueDate: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['task'] && this.task && this.mode === 'edit') {
      this.form.patchValue({
        title: this.task.title,
        description: this.task.description ?? '',
        priority: this.task.priority,
        categoryId: this.task.category?.id ?? '',
        dueDate: this.task.dueDate
          ? this.toLocalInputValue(this.task.dueDate)
          : '',
      });
    }
  }

  submit(): void {
    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      title: value.title!.trim(),
      description: value.description?.trim() || undefined,
      priority: value.priority as TaskPriority,
      categoryId: value.categoryId || undefined,
      dueDate: value.dueDate ? new Date(value.dueDate).toISOString() : undefined,
    };

    this.saved.emit(payload);

    if (this.mode === 'create') {
      this.form.reset({
        title: '',
        description: '',
        priority: 'MEDIUM',
        categoryId: '',
        dueDate: '',
      });
    }
  }

  private toLocalInputValue(iso: string): string {
    const date = new Date(iso);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }
}
