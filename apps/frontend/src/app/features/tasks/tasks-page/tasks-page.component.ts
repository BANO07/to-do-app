import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  Subject,
  switchMap,
  takeUntil,
  combineLatest,
  forkJoin,
  of,
} from 'rxjs';
import { TaskService } from '../../../core/services/task.service';
import { CategoryService } from '../../../core/services/category.service';
import { TaskFilterService } from '../../../core/services/task-filter.service';
import { ToastService } from '../../../core/services/toast.service';
import { UiShortcutService } from '../../../core/services/ui-shortcut.service';
import { ReminderService } from '../../../core/services/reminder.service';
import { SubtaskService } from '../../../core/services/subtask.service';
import {
  Category,
  CreateTaskInput,
  Task,
  TaskConnection,
  TaskFilterInput,
  TaskFormSubmit,
  TaskListView,
  TaskStatus,
  UpdateTaskInput,
} from '../../../core/models/app.models';
import { TaskCardComponent } from '../../../shared/components/task-card/task-card.component';
import { TaskFormComponent } from '../../../shared/components/task-form/task-form.component';
import { TaskSkeletonComponent } from '../../../shared/components/task-skeleton/task-skeleton.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { QuickAddComponent } from '../../../shared/components/quick-add/quick-add.component';
import { snapshotFromTask, snapshotToCreateInput, TaskSnapshot } from '../../../core/utils/task-snapshot';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TaskCardComponent,
    TaskFormComponent,
    TaskSkeletonComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
    QuickAddComponent,
  ],
  template: `
    <section class="tasks-page">
      <header class="tasks-page__header">
        <div>
          <p class="eyebrow">Tasks</p>
          <h1>{{ pageTitle }}</h1>
        </div>
        <button
          type="button"
          class="btn btn--primary"
          (click)="openCreateForm()"
          [hidden]="view === 'ARCHIVED'"
        >
          + Add Task
        </button>
      </header>

      @if (view !== 'ARCHIVED') {
        <app-quick-add [categories]="categories" (created)="reload()" />
      }

      <div class="filters">
        <select [(ngModel)]="selectedPriority" (ngModelChange)="applyFilters()" aria-label="Filter by priority">
          <option value="">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
        <select [(ngModel)]="selectedCategoryId" (ngModelChange)="applyFilters()" aria-label="Filter by category">
          <option value="">All categories</option>
          @for (category of categories; track category.id) {
            <option [value]="category.id">{{ category.icon }} {{ category.name }}</option>
          }
        </select>
        <select [(ngModel)]="sortBy" (ngModelChange)="applyFilters()" aria-label="Sort tasks">
          <option value="CREATED_AT">Created date</option>
          <option value="UPDATED_AT">Updated date</option>
          <option value="DUE_DATE">Due date</option>
          <option value="PRIORITY">Priority</option>
        </select>
      </div>

      @if (selectedIds.size > 0) {
        <div class="bulk-bar glass-panel">
          <label class="bulk-bar__count">
            <input
              type="checkbox"
              [checked]="allSelected"
              (change)="toggleSelectAll($event)"
              aria-label="Select all tasks on page"
            />
            {{ selectedIds.size }} selected
          </label>
          <div class="bulk-bar__actions">
            <button type="button" class="btn btn--ghost" (click)="bulkComplete()">Complete</button>
            <button type="button" class="btn btn--ghost" (click)="bulkArchive()">Archive</button>
            <button type="button" class="btn btn--ghost btn--danger-text" (click)="bulkDelete()">
              Delete
            </button>
            <button type="button" class="btn btn--ghost" (click)="clearSelection()">Clear</button>
          </div>
        </div>
      }

      @if (showForm) {
        <div class="panel" id="task-form-panel">
          <h2>{{ editingTask ? 'Edit task' : 'Create task' }}</h2>
          <app-task-form
            [categories]="categories"
            [mode]="editingTask ? 'edit' : 'create'"
            [task]="editingTask"
            [submitting]="submitting"
            (saved)="saveTask($event)"
            (cancelled)="closeForm()"
          />
        </div>
      }

      @if (loading) {
        <app-task-skeleton />
      } @else if (tasks.length === 0) {
        <app-empty-state
          [icon]="emptyIcon"
          [title]="emptyTitle"
          [message]="emptyMessage"
          [actionLabel]="view === 'ARCHIVED' ? '' : 'Add task'"
          (action)="openCreateForm()"
        />
      } @else {
        @if (highlightedTask) {
          <div class="panel panel--highlight">
            <p class="eyebrow">From Notification</p>
            <app-task-card
              [task]="highlightedTask"
              [highlighted]="true"
              (statusChange)="changeStatus(highlightedTask, $event)"
              (edit)="editTask($event)"
              (archive)="confirmArchive($event)"
              (restore)="restoreTask($event)"
              (remove)="confirmDelete($event)"
            />
          </div>
        }
        <div class="task-list">
          @for (task of tasks; track task.id) {
            <app-task-card
              [task]="task"
              [selectable]="true"
              [selected]="selectedIds.has(task.id)"
              [highlighted]="task.id === highlightedTaskId"
              (selectedChange)="toggleSelection(task.id, $event)"
              (statusChange)="changeStatus(task, $event)"
              (edit)="editTask($event)"
              (archive)="confirmArchive($event)"
              (restore)="restoreTask($event)"
              (remove)="confirmDelete($event)"
            />
          }
        </div>

        <div class="pagination">
          <button type="button" class="btn btn--ghost" [disabled]="page <= 1" (click)="changePage(page - 1)">
            Previous
          </button>
          <span>Page {{ page }} of {{ totalPages }}</span>
          <button
            type="button"
            class="btn btn--ghost"
            [disabled]="page >= totalPages"
            (click)="changePage(page + 1)"
          >
            Next
          </button>
        </div>
      }

      <app-confirm-dialog
        [open]="!!taskToArchive"
        title="Archive task?"
        message="This task will be removed from active task lists but can be restored later."
        confirmLabel="Archive"
        confirmTone="primary"
        (confirmed)="archiveTask()"
        (cancelled)="taskToArchive = null"
      />
      <app-confirm-dialog
        [open]="!!taskToDelete"
        title="Delete task?"
        message="This action permanently removes the task."
        confirmLabel="Delete"
        (confirmed)="deleteTask()"
        (cancelled)="taskToDelete = null"
      />
    </section>
  `,
  styles: [
    `
      .tasks-page__header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: start;
        margin-bottom: 1rem;
      }
      .eyebrow {
        margin: 0 0 0.25rem;
        color: var(--text-muted);
      }
      h1 { margin: 0; }
      .filters {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      .filters select {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 0.625rem 0.75rem;
        background: var(--input-bg);
        color: var(--text-primary);
      }
      .bulk-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.75rem 1rem;
        border-radius: 12px;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }
      .bulk-bar__count {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        font-size: 0.875rem;
      }
      .bulk-bar__actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .btn--danger-text {
        color: var(--danger);
      }
      .panel {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 1.25rem;
        margin-bottom: 1rem;
      }
      .panel--highlight {
        border-color: var(--primary);
      }
      .task-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 1rem;
        margin-top: 1.25rem;
      }
      @media (max-width: 768px) {
        .filters { grid-template-columns: 1fr; }
        .tasks-page__header { flex-direction: column; }
      }
    `,
  ],
})
export class TasksPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly taskService = inject(TaskService);
  private readonly categoryService = inject(CategoryService);
  private readonly taskFilterService = inject(TaskFilterService);
  private readonly toastService = inject(ToastService);
  private readonly shortcuts = inject(UiShortcutService);
  private readonly reminderService = inject(ReminderService);
  private readonly subtaskService = inject(SubtaskService);
  private readonly destroy$ = new Subject<void>();

  view: TaskListView = 'ALL';
  tasks: Task[] = [];
  categories: Category[] = [];
  loading = true;
  showForm = false;
  submitting = false;
  editingTask: Task | null = null;
  taskToDelete: Task | null = null;
  taskToArchive: Task | null = null;
  selectedIds = new Set<string>();
  page = 1;
  totalPages = 1;
  selectedPriority = '';
  selectedCategoryId = '';
  sortBy = 'CREATED_AT';
  highlightedTaskId: string | null = null;
  highlightedTask: Task | null = null;

  pageTitle = 'All Tasks';
  emptyIcon = '✨';
  emptyTitle = "You're all caught up 🎉";
  emptyMessage = 'No tasks here yet.';

  get allSelected(): boolean {
    return this.tasks.length > 0 && this.tasks.every((t) => this.selectedIds.has(t.id));
  }

  ngOnInit(): void {
    this.categoryService.getCategories().subscribe({
      next: (categories) => (this.categories = categories),
    });

    if (this.route.snapshot.queryParamMap.get('new') === '1') {
      this.openCreateForm();
    }

    this.shortcuts.newTask$.pipe(takeUntil(this.destroy$)).subscribe(() => this.openCreateForm());
    this.shortcuts.closePanel$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.showForm) this.closeForm();
      this.taskToDelete = null;
      this.clearSelection();
    });

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const taskId = params.get('taskId');
      this.highlightedTaskId = taskId;

      if (!taskId) {
        this.highlightedTask = null;
        return;
      }

      this.taskService.getTask(taskId).subscribe({
        next: (task) => {
          this.highlightedTask = task;
          setTimeout(() => {
            document
              .querySelector('.task-card--highlighted')
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 50);
        },
        error: () => {
          this.highlightedTask = null;
        },
      });
    });

    combineLatest([
      this.route.data,
      this.taskFilterService.filter$,
    ])
      .pipe(
        takeUntil(this.destroy$),
        switchMap(([data, filter]) => {
          this.view = (data['view'] as TaskListView) ?? 'ALL';
          this.setPageMeta();
          this.loading = true;
          this.clearSelection();
          const query: TaskFilterInput = {
            view: this.view,
            page: this.page,
            limit: 20,
            sortBy: this.sortBy as TaskFilterInput['sortBy'],
            sortOrder: 'DESC',
            search: filter.search,
            priority: (this.selectedPriority || undefined) as TaskFilterInput['priority'],
            categoryId: this.selectedCategoryId || undefined,
          };
          return this.taskService.getTasks(query);
        }),
      )
      .subscribe({
        next: (connection: TaskConnection) => {
          this.tasks = connection.items;
          if (
            this.highlightedTaskId &&
            connection.items.some((task) => task.id === this.highlightedTaskId)
          ) {
            this.highlightedTask = null;
          }
          this.page = connection.pageInfo.page;
          this.totalPages = connection.pageInfo.totalPages;
          this.loading = false;
        },
        error: () => {
          this.toastService.error('Something went wrong while loading your tasks.');
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleSelection(id: string, selected: boolean): void {
    if (selected) this.selectedIds.add(id);
    else this.selectedIds.delete(id);
    this.selectedIds = new Set(this.selectedIds);
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.tasks.forEach((t) => this.selectedIds.add(t.id));
    } else {
      this.clearSelection();
    }
    this.selectedIds = new Set(this.selectedIds);
  }

  clearSelection(): void {
    this.selectedIds = new Set();
  }

  bulkComplete(): void {
    const ids = [...this.selectedIds].filter((id) => {
      const task = this.tasks.find((t) => t.id === id);
      return task && task.status !== 'COMPLETED';
    });
    if (ids.length === 0) return;
    forkJoin(ids.map((id) => this.taskService.completeTask(id))).subscribe({
      next: () => {
        this.toastService.success(`${ids.length} task(s) completed.`);
        this.clearSelection();
        this.reload();
      },
      error: () => this.toastService.error('Unable to complete some tasks.'),
    });
  }

  bulkArchive(): void {
    const ids = [...this.selectedIds].filter((id) => {
      const task = this.tasks.find((t) => t.id === id);
      return task && task.status !== 'ARCHIVED';
    });
    if (ids.length === 0) return;
    forkJoin(ids.map((id) => this.taskService.archiveTask(id))).subscribe({
      next: () => {
        this.toastService.success(`${ids.length} task(s) archived.`);
        this.clearSelection();
        this.reload();
      },
      error: () => this.toastService.error('Unable to archive some tasks.'),
    });
  }

  bulkDelete(): void {
    const tasks = this.tasks.filter((t) => this.selectedIds.has(t.id));
    if (tasks.length === 0) return;
    const snapshots = tasks.map(snapshotFromTask);
    const ids = tasks.map((t) => t.id);

    forkJoin(ids.map((id) => this.taskService.deleteTask(id))).subscribe({
      next: () => {
        this.offerUndo(`${tasks.length} task(s) deleted.`, snapshots);
        this.clearSelection();
        this.reload();
      },
      error: () => this.toastService.error('Unable to delete some tasks.'),
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.reload();
  }

  changePage(page: number): void {
    this.page = page;
    this.reload();
  }

  openCreateForm(): void {
    this.editingTask = null;
    this.showForm = true;
    setTimeout(() => {
      document.getElementById('title')?.focus();
    }, 50);
  }

  editTask(task: Task): void {
    this.editingTask = task;
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingTask = null;
  }

  saveTask(payload: TaskFormSubmit): void {
    if (this.submitting) {
      return;
    }
    this.submitting = true;
    const request = this.editingTask
      ? this.taskService.updateTask(
          this.editingTask.id,
          payload.input as UpdateTaskInput,
        )
      : this.taskService.createTask(payload.input as CreateTaskInput);

    request
      .pipe(
        switchMap((task) =>
          this.syncFollowUpWork(task.id, payload, this.editingTask ? 'edit' : 'create'),
        ),
      )
      .subscribe({
        next: () => {
          this.toastService.success(
            this.editingTask
              ? 'Task updated successfully.'
              : 'Task created successfully.',
          );
          this.submitting = false;
          this.closeForm();
          this.reload();
        },
        error: () => {
          this.toastService.error('Unable to save task. Please try again.');
          this.submitting = false;
        },
      });
  }

  changeStatus(task: Task, status: TaskStatus): void {
    if (status === task.status) {
      return;
    }

    const request =
      status === 'COMPLETED'
        ? this.taskService.completeTask(task.id)
        : task.status === 'COMPLETED' && status === 'TODO'
          ? this.taskService.reopenTask(task.id)
          : this.taskService.updateTask(task.id, { status });

    request.subscribe({
      next: () => this.reload(),
      error: () => this.toastService.error('Unable to update task. Please try again.'),
    });
  }

  confirmArchive(task: Task): void {
    this.taskToArchive = task;
  }

  archiveTask(): void {
    if (!this.taskToArchive) return;
    const id = this.taskToArchive.id;
    this.taskService.archiveTask(id).subscribe({
      next: () => {
        this.toastService.success('Task archived.');
        this.taskToArchive = null;
        this.reload();
      },
      error: () => this.toastService.error('Unable to archive task. Please try again.'),
    });
  }

  restoreTask(task: Task): void {
    this.taskService.restoreTask(task.id).subscribe({
      next: () => {
        this.toastService.success('Task restored.');
        this.reload();
      },
      error: () => this.toastService.error('Unable to restore task. Please try again.'),
    });
  }

  confirmDelete(task: Task): void {
    this.taskToDelete = task;
  }

  deleteTask(): void {
    if (!this.taskToDelete) return;
    const snapshot = snapshotFromTask(this.taskToDelete);
    const id = this.taskToDelete.id;

    this.taskService.deleteTask(id).subscribe({
      next: () => {
        this.offerUndo('Task deleted.', [snapshot]);
        this.taskToDelete = null;
        this.reload();
      },
      error: () => this.toastService.error('Unable to delete task. Please try again.'),
    });
  }

  private syncFollowUpWork(
    taskId: string,
    payload: TaskFormSubmit,
    mode: 'create' | 'edit',
  ) {
    const deletes = payload.deleteReminderIds.map((id) =>
      this.reminderService.deleteReminder(id),
    );
    const creates = payload.reminderDrafts.map((draft) =>
      this.reminderService.createReminder({
        taskId,
        offsetMinutes: draft.offsetMinutes,
        localDateTime: draft.localDateTime,
        channel: draft.channel,
      }),
    );
    const extraSubtasks =
      mode === 'edit'
        ? payload.subtaskTitles.map((title) =>
            this.subtaskService.createSubtask({ taskId, title }),
          )
        : [];
    const operations = [...deletes, ...creates, ...extraSubtasks];
    return operations.length > 0 ? forkJoin(operations) : of(true);
  }

  private offerUndo(message: string, snapshots: TaskSnapshot[]): void {
    this.toastService.successWithAction(message, 'Undo', () => {
      forkJoin(
        snapshots.map((s) => this.taskService.createTask(snapshotToCreateInput(s))),
      ).subscribe({
        next: () => {
          this.toastService.success('Task(s) restored.');
          this.reload();
        },
        error: () => this.toastService.error('Unable to restore task(s).'),
      });
    });
  }

  reload(): void {
    this.taskFilterService.updateFilter({ page: this.page });
  }

  private setPageMeta(): void {
    const meta: Record<
      TaskListView,
      { title: string; emptyTitle: string; emptyMessage: string; icon: string }
    > = {
      ALL: {
        title: 'All Tasks',
        emptyTitle: 'No tasks found.',
        emptyMessage: 'Create a task to get started.',
        icon: '✨',
      },
      TODAY: {
        title: 'Today',
        emptyTitle: "You're all caught up",
        emptyMessage: 'No tasks scheduled for today.',
        icon: '🎉',
      },
      UPCOMING: {
        title: 'Upcoming',
        emptyTitle: 'No upcoming tasks.',
        emptyMessage: 'Nothing is due after today.',
        icon: '✨',
      },
      OVERDUE: {
        title: 'Overdue',
        emptyTitle: 'No overdue tasks.',
        emptyMessage: 'You are on top of your deadlines.',
        icon: '✨',
      },
      COMPLETED: {
        title: 'Completed',
        emptyTitle: 'No completed tasks yet.',
        emptyMessage: '',
        icon: '✨',
      },
      ARCHIVED: {
        title: 'Archived',
        emptyTitle: 'No archived tasks.',
        emptyMessage: 'Archived tasks can be restored from this list.',
        icon: '📦',
      },
    };
    const current = meta[this.view];
    this.pageTitle = current.title;
    this.emptyTitle = current.emptyTitle;
    this.emptyMessage = this.taskFilterService.current.search
      ? 'No tasks found matching your search.'
      : current.emptyMessage;
    this.emptyIcon = current.icon;
  }
}
