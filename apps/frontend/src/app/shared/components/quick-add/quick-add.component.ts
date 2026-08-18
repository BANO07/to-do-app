import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category } from '../../../core/models/app.models';
import { TaskService } from '../../../core/services/task.service';
import { ToastService } from '../../../core/services/toast.service';
import { parseQuickAdd, toCreateTaskInput } from '../../../core/utils/quick-add.parser';

@Component({
  selector: 'app-quick-add',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form class="quick-add" (submit)="submit($event)">
      <input
        #quickInput
        type="text"
        [(ngModel)]="value"
        name="quickAdd"
        placeholder="Quick add: Buy milk @Work tomorrow !high"
        aria-label="Quick add task"
        autocomplete="off"
      />
      <button type="submit" class="btn btn--primary" [disabled]="!value.trim() || submitting">
        Add
      </button>
    </form>
    <p class="quick-add__hint">
      Tips: <kbd>&#64;Category</kbd> <kbd>today</kbd> <kbd>tomorrow</kbd> <kbd>!high</kbd>
      <span class="quick-add__shortcut">Press <kbd>N</kbd> for full form</span>
    </p>
  `,
  styles: [
    `
      .quick-add {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.35rem;
      }
      .quick-add input {
        flex: 1;
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 0.75rem 1rem;
        background: var(--input-bg);
        color: var(--text-primary);
      }
      .quick-add__hint {
        margin: 0 0 1rem;
        font-size: 0.75rem;
        color: var(--text-muted);
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        align-items: center;
      }
      .quick-add__shortcut {
        margin-left: auto;
      }
      kbd {
        font-family: inherit;
        font-size: 0.6875rem;
        padding: 0.1rem 0.35rem;
        border-radius: 4px;
        border: 1px solid var(--border);
        background: var(--surface-muted);
      }
    `,
  ],
})
export class QuickAddComponent {
  @Input() categories: Category[] = [];
  @Output() created = new EventEmitter<void>();

  private readonly taskService = inject(TaskService);
  private readonly toastService = inject(ToastService);

  value = '';
  submitting = false;

  submit(event: Event): void {
    event.preventDefault();
    if (this.submitting) return;
    const parsed = parseQuickAdd(this.value, this.categories);
    if (!parsed.title) return;

    this.submitting = true;
    this.taskService.createTask(toCreateTaskInput(parsed)).subscribe({
      next: () => {
        this.toastService.success('Task added.');
        this.value = '';
        this.submitting = false;
        this.created.emit();
      },
      error: () => {
        this.toastService.error('Unable to add task.');
        this.submitting = false;
      },
    });
  }

  focus(): void {
    const input = document.querySelector<HTMLInputElement>('.quick-add input');
    input?.focus();
  }
}
