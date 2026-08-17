import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TaskService } from '../../../core/services/task.service';
import { DashboardSummary, Task, TaskConnection } from '../../../core/models/app.models';
import { TaskCardComponent } from '../../../shared/components/task-card/task-card.component';
import { TaskSkeletonComponent } from '../../../shared/components/task-skeleton/task-skeleton.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TaskCardComponent,
    TaskSkeletonComponent,
    EmptyStateComponent,
  ],
  template: `
    <section class="dashboard">
      <header class="dashboard__header">
        <div>
          <p class="eyebrow">Dashboard</p>
          <h1>Good {{ greeting }}, {{ firstName }} 👋</h1>
        </div>
        <a routerLink="/tasks/all" class="btn btn--primary">+ Add Task</a>
      </header>

      @if (loading) {
        <app-task-skeleton />
      } @else if (summary) {
        <div class="stats-grid">
          <article class="stat-card">
            <span>Today</span>
            <strong>{{ summary.todayTotal }}</strong>
            <small>Tasks</small>
          </article>
          <article class="stat-card">
            <span>Completed</span>
            <strong>{{ summary.todayCompleted }}</strong>
            <small>Today</small>
          </article>
          <article class="stat-card">
            <span>Pending</span>
            <strong>{{ summary.todayPending }}</strong>
            <small>Today</small>
          </article>
          <article class="stat-card">
            <span>High Priority</span>
            <strong>{{ summary.todayHighPriority }}</strong>
            <small>Today</small>
          </article>
          <article class="stat-card">
            <span>Overdue</span>
            <strong>{{ summary.overdueCount }}</strong>
          </article>
          <article class="stat-card">
            <span>Active</span>
            <strong>{{ summary.totalActiveTasks }}</strong>
          </article>
          <article class="stat-card stat-card--wide">
            <span>Completion rate today</span>
            <strong>{{ summary.completionPercentage }}%</strong>
          </article>
        </div>

        <section class="panel">
          <div class="panel__header">
            <h2>Today's Tasks</h2>
            <a routerLink="/tasks/today">View all</a>
          </div>
          @if (todayTasks.length === 0) {
            <app-empty-state
              icon="🎉"
              title="You're all caught up"
              message="No tasks scheduled for today."
            />
          } @else {
            <div class="task-list">
              @for (task of todayTasks; track task.id) {
                <app-task-card
                  [task]="task"
                  (toggleComplete)="onToggleComplete($event)"
                  (edit)="noop()"
                  (archive)="noop()"
                  (remove)="noop()"
                />
              }
            </div>
          }
        </section>
      }
    </section>
  `,
  styles: [
    `
      .dashboard__header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: start;
        margin-bottom: 1.5rem;
      }
      .eyebrow {
        margin: 0 0 0.25rem;
        color: var(--text-muted);
        font-size: 0.875rem;
      }
      h1 {
        margin: 0;
        font-size: clamp(1.5rem, 3vw, 2rem);
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 0.875rem;
        margin-bottom: 1.5rem;
      }
      .stat-card {
        background: var(--surface);
        backdrop-filter: var(--glass-blur);
        -webkit-backdrop-filter: var(--glass-blur);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .stat-card span, .stat-card small {
        color: var(--text-muted);
        font-size: 0.8125rem;
      }
      .stat-card strong {
        font-size: 1.75rem;
      }
      .stat-card--wide {
        grid-column: span 2;
      }
      .panel {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 1.25rem;
      }
      .panel__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }
      .panel__header h2 {
        margin: 0;
        font-size: 1.125rem;
      }
      .panel__header a {
        color: var(--primary);
        text-decoration: none;
        font-weight: 600;
      }
      .task-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      @media (max-width: 640px) {
        .dashboard__header {
          flex-direction: column;
        }
        .stat-card--wide {
          grid-column: span 1;
        }
      }
    `,
  ],
})
export class DashboardPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly taskService = inject(TaskService);
  private readonly toastService = inject(ToastService);

  summary: DashboardSummary | null = null;
  todayTasks: Task[] = [];
  loading = true;

  get firstName(): string {
    return this.authService.currentUser?.name.split(' ')[0] ?? 'there';
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  ngOnInit(): void {
    this.taskService.getDashboardSummary().subscribe({
      next: (summary) => {
        this.summary = summary;
        this.loading = false;
      },
      error: () => {
        this.toastService.error('Something went wrong while loading your dashboard.');
        this.loading = false;
      },
    });

    this.taskService
      .getTasks({ view: 'TODAY', limit: 5, page: 1 })
      .subscribe({
        next: (connection: TaskConnection) => {
          this.todayTasks = connection.items;
        },
      });
  }

  onToggleComplete(task: Task): void {
    const request =
      task.status === 'COMPLETED'
        ? this.taskService.reopenTask(task.id)
        : this.taskService.completeTask(task.id);

    request.subscribe({
      next: () => this.ngOnInit(),
      error: () => this.toastService.error('Unable to update task. Please try again.'),
    });
  }

  noop(): void {}
}
