import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, takeUntil, combineLatest, startWith } from 'rxjs';
import { TaskService } from '../../../core/services/task.service';
import { CategoryService } from '../../../core/services/category.service';
import { TaskFilterService } from '../../../core/services/task-filter.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  Category,
  CreateTaskInput,
  Task,
  TaskConnection,
  TaskFilterInput,
  TaskListView,
  UpdateTaskInput,
} from '../../../core/models/app.models';
import { TaskCardComponent } from '../../../shared/components/task-card/task-card.component';
import { TaskFormComponent } from '../../../shared/components/task-form/task-form.component';
import { TaskSkeletonComponent } from '../../../shared/components/task-skeleton/task-skeleton.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

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
  ],
  template: `
    <section class="tasks-page">
      <header class="tasks-page__header">
        <div>
          <p class="eyebrow">Tasks</p>
          <h1>{{ pageTitle }}</h1>
        </div>
        <button type="button" class="btn btn--primary" (click)="openCreateForm()">+ Add Task</button>
      </header>

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
            <option [value]="category.id">{{ category.name }}</option>
          }
        </select>
        <select [(ngModel)]="sortBy" (ngModelChange)="applyFilters()" aria-label="Sort tasks">
          <option value="CREATED_AT">Created date</option>
          <option value="UPDATED_AT">Updated date</option>
          <option value="DUE_DATE">Due date</option>
          <option value="PRIORITY">Priority</option>
        </select>
      </div>

      @if (showForm) {
        <div class="panel">
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
        />
      } @else {
        <div class="task-list">
          @for (task of tasks; track task.id) {
            <app-task-card
              [task]="task"
              (toggleComplete)="toggleComplete($event)"
              (edit)="editTask($event)"
              (archive)="archiveTask($event)"
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
        [open]="!!taskToDelete"
        title="Delete task"
        message="This action cannot be undone."
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
        background: var(--surface);
      }
      .panel {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 1.25rem;
        margin-bottom: 1rem;
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
        .filters {
          grid-template-columns: 1fr;
        }
        .tasks-page__header {
          flex-direction: column;
        }
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
  private readonly destroy$ = new Subject<void>();

  view: TaskListView = 'ALL';
  tasks: Task[] = [];
  categories: Category[] = [];
  loading = true;
  showForm = false;
  submitting = false;
  editingTask: Task | null = null;
  taskToDelete: Task | null = null;
  page = 1;
  totalPages = 1;
  selectedPriority = '';
  selectedCategoryId = '';
  sortBy = 'CREATED_AT';

  pageTitle = 'All Tasks';
  emptyIcon = '✨';
  emptyTitle = "You're all caught up 🎉";
  emptyMessage = 'No tasks here yet.';

  ngOnInit(): void {
    this.categoryService.getCategories().subscribe({
      next: (categories) => (this.categories = categories),
    });

    combineLatest([
      this.route.data,
      this.taskFilterService.filter$.pipe(startWith({} as TaskFilterInput)),
    ])
      .pipe(
        takeUntil(this.destroy$),
        switchMap(([data, filter]) => {
          this.view = (data['view'] as TaskListView) ?? 'ALL';
          this.setPageMeta();
          this.loading = true;
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
  }

  editTask(task: Task): void {
    this.editingTask = task;
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingTask = null;
  }

  saveTask(payload: CreateTaskInput | UpdateTaskInput): void {
    this.submitting = true;
    const request = this.editingTask
      ? this.taskService.updateTask(this.editingTask.id, payload as UpdateTaskInput)
      : this.taskService.createTask(payload as CreateTaskInput);

    request.subscribe({
      next: () => {
        this.toastService.success(
          this.editingTask ? 'Task updated successfully.' : 'Task created successfully.',
        );
        this.submitting = false;
        this.closeForm();
        this.reload();
      },
      error: () => {
        this.toastService.error('Unable to create task. Please try again.');
        this.submitting = false;
      },
    });
  }

  toggleComplete(task: Task): void {
    const request =
      task.status === 'COMPLETED'
        ? this.taskService.reopenTask(task.id)
        : this.taskService.completeTask(task.id);

    request.subscribe({
      next: () => this.reload(),
      error: () => this.toastService.error('Unable to update task. Please try again.'),
    });
  }

  archiveTask(task: Task): void {
    this.taskService.archiveTask(task.id).subscribe({
      next: () => {
        this.toastService.success('Task archived.');
        this.reload();
      },
      error: () => this.toastService.error('Unable to archive task. Please try again.'),
    });
  }

  confirmDelete(task: Task): void {
    this.taskToDelete = task;
  }

  deleteTask(): void {
    if (!this.taskToDelete) return;
    this.taskService.deleteTask(this.taskToDelete.id).subscribe({
      next: () => {
        this.toastService.success('Task deleted.');
        this.taskToDelete = null;
        this.reload();
      },
      error: () => this.toastService.error('Unable to delete task. Please try again.'),
    });
  }

  private reload(): void {
    this.taskFilterService.updateFilter({ page: this.page });
  }

  private setPageMeta(): void {
    const meta: Record<TaskListView, { title: string; empty: string }> = {
      ALL: { title: 'All Tasks', empty: 'No tasks found.' },
      TODAY: { title: 'Today', empty: "You're all caught up 🎉" },
      UPCOMING: { title: 'Upcoming', empty: 'No upcoming tasks.' },
      OVERDUE: { title: 'Overdue', empty: 'No overdue tasks.' },
      COMPLETED: { title: 'Completed', empty: 'No completed tasks yet.' },
      ARCHIVED: { title: 'Archived', empty: 'No archived tasks.' },
    };
    const current = meta[this.view];
    this.pageTitle = current.title;
    this.emptyTitle = current.empty;
    this.emptyMessage =
      this.taskFilterService.current.search
        ? 'No tasks found matching your search.'
        : current.empty;
    this.emptyIcon = this.view === 'TODAY' ? '🎉' : '✨';
  }
}
