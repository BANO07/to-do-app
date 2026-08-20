import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Apollo } from 'apollo-angular';
import { forkJoin, Subscription } from 'rxjs';
import { TASKS_QUERY, UPDATE_TASK_MUTATION } from '../../../core/graphql/operations';
import { Task, TaskStatus } from '../../../core/models/app.models';

interface KanbanColumn {
  id: TaskStatus;
  label: string;
  icon: string;
  tasks: Task[];
  isDragOver: boolean;
}

@Component({
  selector: 'app-kanban-page',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kanban-page">
      <header class="kanban-header">
        <div>
          <h1>Kanban Board</h1>
          <p class="subtitle">Drag tasks between columns to update their status</p>
        </div>
        <button class="btn btn--ghost btn--sm" (click)="loadTasks()" [disabled]="loading">
          {{ loading ? 'Loading…' : '🔄 Refresh' }}
        </button>
      </header>

      @if (error) {
        <div class="error-banner">⚠️ {{ error }}</div>
      }

      @if (loading) {
        <div class="loading-state">Loading tasks…</div>
      } @else {
        <div class="kanban-board">
          @for (col of columns; track col.id) {
            <div
              class="kanban-column"
              [class.kanban-column--drag-over]="col.isDragOver"
              (dragover)="onDragOver($event, col)"
              (dragleave)="onDragLeave($event, col)"
              (drop)="onDrop($event, col)"
            >
              <div class="kanban-column__header">
                <span class="kanban-column__icon" aria-hidden="true">{{ col.icon }}</span>
                <span class="kanban-column__title">{{ col.label }}</span>
                <span class="kanban-column__count">{{ col.tasks.length }}</span>
              </div>
              <div class="kanban-column__cards">
                @for (task of col.tasks; track task.id) {
                  <div
                    class="kanban-card"
                    [class.kanban-card--urgent]="task.priority === 'URGENT'"
                    [class.kanban-card--high]="task.priority === 'HIGH'"
                    draggable="true"
                    (dragstart)="onDragStart($event, task)"
                    (dragend)="onDragEnd($event)"
                    [attr.aria-label]="'Task: ' + task.title + ', ' + task.status + ' priority: ' + task.priority"
                    role="listitem"
                  >
                    <div class="kanban-card__header">
                      <span
                        class="kanban-card__priority"
                        [title]="task.priority + ' priority'"
                        aria-hidden="true"
                      >{{ priorityIcon(task.priority) }}</span>
                      @if (task.category) {
                        <span class="kanban-card__category">{{ task.category.icon ?? '' }} {{ task.category.name }}</span>
                      }
                    </div>
                    <p class="kanban-card__title">{{ task.title }}</p>
                    @if (task.dueDate) {
                      <p class="kanban-card__due" [class.overdue]="isOverdue(task)">
                        📅 {{ formatDate(task.dueDate) }}
                      </p>
                    }
                    @if (task.progress && task.progress.total > 0) {
                      <div class="kanban-card__progress" [title]="task.progress.completed + '/' + task.progress.total + ' subtasks'">
                        <div
                          class="kanban-card__progress-bar"
                          [style.width.%]="task.progress.percentage"
                        ></div>
                      </div>
                    }
                  </div>
                }
                @if (col.tasks.length === 0) {
                  <div class="kanban-column__empty" aria-live="polite">No tasks</div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .kanban-page {
      padding: var(--content-padding);
      height: 100%;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .kanban-header {
      margin-bottom: 1.5rem;
      flex-shrink: 0;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }
    .kanban-header h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .kanban-header .subtitle {
      margin: 0.25rem 0 0;
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    .error-banner {
      background: rgba(239, 68, 68, 0.12);
      color: var(--danger);
      border: 1px solid rgba(239, 68, 68, 0.25);
      border-radius: var(--radius, 8px);
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      font-size: 0.875rem;
    }
    .loading-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-muted);
    }
    .kanban-board {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1rem;
      flex: 1;
      overflow-x: auto;
      min-height: 0;
    }
    .kanban-column {
      background: var(--surface);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      border: 1px solid var(--border);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      min-height: 300px;
      transition: border-color 0.15s, background 0.15s;
    }
    .kanban-column--drag-over {
      border-color: var(--primary);
      background: var(--primary-soft);
    }
    .kanban-column__header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1rem;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .kanban-column__title {
      flex: 1;
      font-weight: 600;
      font-size: 0.9375rem;
    }
    .kanban-column__count {
      background: var(--surface-muted);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 1px 8px;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
    }
    .kanban-column__cards {
      flex: 1;
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      overflow-y: auto;
    }
    .kanban-column__empty {
      text-align: center;
      padding: 1.5rem;
      color: var(--text-muted);
      font-size: 0.875rem;
      font-style: italic;
    }
    .kanban-card {
      background: var(--surface-muted);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem;
      cursor: grab;
      transition: box-shadow 0.15s, transform 0.1s;
      user-select: none;
    }
    .kanban-card:active { cursor: grabbing; }
    .kanban-card:hover {
      box-shadow: var(--shadow-md);
    }
    .kanban-card--urgent {
      border-left: 3px solid var(--danger);
    }
    .kanban-card--high {
      border-left: 3px solid var(--primary);
    }
    .kanban-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.375rem;
    }
    .kanban-card__priority { font-size: 0.75rem; }
    .kanban-card__category {
      font-size: 0.6875rem;
      color: var(--text-muted);
      background: var(--surface);
      padding: 1px 6px;
      border-radius: 999px;
      border: 1px solid var(--border);
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .kanban-card__title {
      margin: 0 0 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
      line-height: 1.4;
      word-break: break-word;
    }
    .kanban-card__due {
      margin: 0;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .kanban-card__due.overdue {
      color: var(--danger);
    }
    .kanban-card__progress {
      margin-top: 0.5rem;
      height: 3px;
      background: var(--border);
      border-radius: 999px;
      overflow: hidden;
    }
    .kanban-card__progress-bar {
      height: 100%;
      background: var(--primary);
      border-radius: 999px;
      transition: width 0.2s;
    }
    .btn { padding: 0.5rem 1rem; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 500; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn--ghost { background: var(--surface-muted); border: 1px solid var(--border); color: var(--text-primary); }
    .btn--sm { font-size: 0.8125rem; padding: 0.375rem 0.75rem; }
    @media (max-width: 1024px) {
      .kanban-board { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 640px) {
      .kanban-board { grid-template-columns: 1fr; }
      .kanban-column { min-height: 150px; }
    }
  `],
})
export class KanbanPageComponent implements OnInit, OnDestroy {
  columns: KanbanColumn[] = [
    { id: 'TODO', label: 'Backlog / Todo', icon: '📋', tasks: [], isDragOver: false },
    { id: 'IN_PROGRESS', label: 'In Progress', icon: '🔄', tasks: [], isDragOver: false },
    { id: 'COMPLETED', label: 'Completed', icon: '✅', tasks: [], isDragOver: false },
    { id: 'ARCHIVED', label: 'Archived', icon: '📦', tasks: [], isDragOver: false },
  ];

  loading = true;
  error = '';
  private draggedTask: Task | null = null;
  private subs = new Subscription();

  constructor(
    private readonly apollo: Apollo,
    private readonly cdRef: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadTasks();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadTasks(): void {
    this.loading = true;
    this.error = '';

    // Use separate queries:
    // - view:'ALL' returns TODO + IN_PROGRESS (excludes COMPLETED and ARCHIVED server-side)
    // - view:'COMPLETED' returns all completed tasks (not just today)
    // - view:'ARCHIVED' returns archived tasks
    const allQuery = this.apollo.query<{ tasks: { items: Task[] } }>({
      query: TASKS_QUERY,
      variables: { filter: { view: 'ALL', limit: 100, page: 1 } },
      fetchPolicy: 'network-only',
    });

    const completedQuery = this.apollo.query<{ tasks: { items: Task[] } }>({
      query: TASKS_QUERY,
      variables: { filter: { view: 'COMPLETED', limit: 100, page: 1 } },
      fetchPolicy: 'network-only',
    });

    const archivedQuery = this.apollo.query<{ tasks: { items: Task[] } }>({
      query: TASKS_QUERY,
      variables: { filter: { view: 'ARCHIVED', limit: 100, page: 1 } },
      fetchPolicy: 'network-only',
    });

    this.subs.add(
      forkJoin({ all: allQuery, completed: completedQuery, archived: archivedQuery }).subscribe({
        next: ({ all, completed, archived }) => {
          const allTasks = all.data.tasks.items;
          const completedTasks = completed.data.tasks.items;
          const archivedTasks = archived.data.tasks.items;
          this.distributeTasks(allTasks, completedTasks, archivedTasks);
          this.loading = false;
          this.cdRef.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.graphQLErrors?.[0]?.message ?? 'Failed to load tasks. Please try again.';
          this.cdRef.markForCheck();
        },
      }),
    );
  }

  onDragStart(event: DragEvent, task: Task): void {
    this.draggedTask = task;
    event.dataTransfer?.setData('text/plain', task.id);
    (event.target as HTMLElement).style.opacity = '0.5';
  }

  onDragEnd(event: DragEvent): void {
    (event.target as HTMLElement).style.opacity = '';
    this.draggedTask = null;
    this.columns.forEach((c) => (c.isDragOver = false));
    this.cdRef.markForCheck();
  }

  onDragOver(event: DragEvent, col: KanbanColumn): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    if (!col.isDragOver) {
      this.columns.forEach((c) => (c.isDragOver = false));
      col.isDragOver = true;
      this.cdRef.markForCheck();
    }
  }

  onDragLeave(event: DragEvent, col: KanbanColumn): void {
    // Only clear drag-over if leaving the column itself, not a child element
    const related = event.relatedTarget as Node | null;
    const colEl = event.currentTarget as HTMLElement;
    if (!related || !colEl.contains(related)) {
      col.isDragOver = false;
      this.cdRef.markForCheck();
    }
  }

  onDrop(event: DragEvent, targetCol: KanbanColumn): void {
    event.preventDefault();
    targetCol.isDragOver = false;

    if (!this.draggedTask || this.draggedTask.status === targetCol.id) {
      this.cdRef.markForCheck();
      return;
    }

    const task = this.draggedTask;
    const oldStatus = task.status;
    const newStatus = targetCol.id as TaskStatus;

    // Optimistic update
    const sourceCol = this.columns.find((c) => c.id === oldStatus);
    if (sourceCol) {
      sourceCol.tasks = sourceCol.tasks.filter((t) => t.id !== task.id);
    }
    targetCol.tasks = [...targetCol.tasks, { ...task, status: newStatus }];
    this.cdRef.markForCheck();

    // Persist to backend
    this.subs.add(
      this.apollo
        .mutate({
          mutation: UPDATE_TASK_MUTATION,
          variables: { id: task.id, input: { status: newStatus } },
        })
        .subscribe({
          error: (err) => {
            // Rollback optimistic update on failure
            targetCol.tasks = targetCol.tasks.filter((t) => t.id !== task.id);
            if (sourceCol) {
              sourceCol.tasks = [...sourceCol.tasks, task];
            }
            this.error = err?.graphQLErrors?.[0]?.message ?? 'Failed to update task status. Please try again.';
            this.cdRef.markForCheck();
          },
        }),
    );
  }

  priorityIcon(priority: string): string {
    switch (priority) {
      case 'URGENT': return '🔴';
      case 'HIGH': return '🟠';
      case 'MEDIUM': return '🟡';
      default: return '⚪';
    }
  }

  isOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === 'COMPLETED' || task.status === 'ARCHIVED') {
      return false;
    }
    return new Date(task.dueDate) < new Date();
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  private distributeTasks(
    allTasks: Task[],
    completedTasks: Task[],
    archivedTasks: Task[],
  ): void {
    // view:'ALL' returns TODO + IN_PROGRESS tasks (excludes COMPLETED and ARCHIVED)
    const todoCol = this.columns.find((c) => c.id === 'TODO')!;
    const inProgressCol = this.columns.find((c) => c.id === 'IN_PROGRESS')!;
    const completedCol = this.columns.find((c) => c.id === 'COMPLETED')!;
    const archivedCol = this.columns.find((c) => c.id === 'ARCHIVED')!;

    todoCol.tasks = allTasks.filter((t) => t.status === 'TODO');
    inProgressCol.tasks = allTasks.filter((t) => t.status === 'IN_PROGRESS');
    completedCol.tasks = completedTasks;
    archivedCol.tasks = archivedTasks;
  }
}
