import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { CalendarService } from '../../../core/services/calendar.service';
import { CalendarConnectionStatus, CalendarEvent } from '../../../core/models/app.models';
import { AuthService } from '../../../core/services/auth.service';
import { TaskService } from '../../../core/services/task.service';
import { DashboardSummary, Task, TaskStatus } from '../../../core/models/app.models';
import { TaskCardComponent } from '../../../shared/components/task-card/task-card.component';
import { TaskSkeletonComponent } from '../../../shared/components/task-skeleton/task-skeleton.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ToastService } from '../../../core/services/toast.service';
import { COMPLETION_RATE_HELP, formatCompletionRate } from '../../../core/utils/completion-rate';

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
            <span>Open</span>
            <strong>{{ summary.todayOpen }}</strong>
            <small>Due today</small>
          </article>
          <article class="stat-card">
            <span>In Progress</span>
            <strong>{{ summary.todayInProgress }}</strong>
            <small>Due today</small>
          </article>
          <article class="stat-card">
            <span>Completed</span>
            <strong>{{ summary.todayCompleted }}</strong>
            <small>Due today</small>
          </article>
          <article class="stat-card">
            <span>High Priority</span>
            <strong>{{ summary.todayHighPriority }}</strong>
            <small>Due today</small>
          </article>
          <article class="stat-card">
            <span>Overdue</span>
            <strong>{{ summary.overdueCount }}</strong>
          </article>
          <article class="stat-card">
            <span>Active</span>
            <strong>{{ summary.totalActiveTasks }}</strong>
            <small>Open + in progress</small>
          </article>
          <article
            class="stat-card stat-card--wide"
            [title]="completionRateHelp"
          >
            <span>Completion rate today</span>
            <strong>{{ completionRate.value }}</strong>
            <small>{{ completionRate.hint }}</small>
          </article>
        </div>

        <!-- Calendar widget -->
        <section class="panel panel--calendar">
          <div class="panel__header">
            <h2>🗓️ Today's Calendar</h2>
            <a routerLink="/calendar">View calendar</a>
          </div>
          @if (!calendarConnection?.connected) {
            <div class="calendar-cta">
              <span>Connect Google Calendar to see events here</span>
              <a routerLink="/calendar" class="btn-link">Connect →</a>
            </div>
          } @else if (todayEvents.length === 0) {
            <p class="panel__empty">No events scheduled for today.</p>
          } @else {
            <div class="event-list">
              @for (event of todayEvents; track event.id) {
                <div class="event-item">
                  <div class="event-item__time">
                    @if (event.isAllDay) {
                      <span>All day</span>
                    } @else {
                      <span>{{ formatEventTime(event.startAt) }}</span>
                    }
                  </div>
                  <div class="event-item__title">{{ event.title }}</div>
                  @if (event.location) {
                    <div class="event-item__location">📍 {{ event.location }}</div>
                  }
                </div>
              }
            </div>
          }
        </section>

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
                  [showActions]="false"
                  (statusChange)="onStatusChange(task, $event)"
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
      .calendar-cta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: var(--text-secondary);
        font-size: 0.875rem;
        padding: 0.5rem 0;
      }
      .btn-link {
        color: var(--primary);
        text-decoration: none;
        font-weight: 500;
      }
      .panel__empty {
        color: var(--text-secondary);
        font-size: 0.875rem;
        padding: 0.5rem 0;
      }
      .event-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .event-item {
        display: flex;
        align-items: baseline;
        gap: 0.75rem;
        padding: 0.5rem 0.75rem;
        background: var(--surface-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        font-size: 0.875rem;
      }
      .event-item__time {
        color: var(--primary);
        font-weight: 600;
        min-width: 60px;
        flex-shrink: 0;
        font-size: 0.75rem;
      }
      .event-item__title {
        flex: 1;
        font-weight: 500;
      }
      .event-item__location {
        color: var(--text-secondary);
        font-size: 0.75rem;
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
export class DashboardPageComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly taskService = inject(TaskService);
  private readonly toastService = inject(ToastService);
  private readonly calendarService = inject(CalendarService);
  private readonly destroy$ = new Subject<void>();
  private loadingInFlight = false;

  summary: DashboardSummary | null = null;
  todayTasks: Task[] = [];
  calendarConnection: CalendarConnectionStatus | null = null;
  todayEvents: CalendarEvent[] = [];
  loading = true;
  readonly completionRateHelp = COMPLETION_RATE_HELP;

  get completionRate(): { value: string; hint: string } {
    if (!this.summary) {
      return { value: '—', hint: 'No tasks due today' };
    }
    return formatCompletionRate(
      this.summary.todayTotal,
      this.summary.completionPercentage,
    );
  }

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
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboard(): void {
    if (this.loadingInFlight) {
      return;
    }
    this.loadingInFlight = true;
    this.loading = true;

    forkJoin({
      summary: this.taskService.getDashboardSummary(),
      today: this.taskService.getTasks({ view: 'TODAY', limit: 5, page: 1 }),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ summary, today }) => {
          this.summary = summary;
          this.todayTasks = today.items;
          this.loading = false;
          this.loadingInFlight = false;
        },
        error: () => {
          this.toastService.error('Something went wrong while loading your dashboard.');
          this.loading = false;
          this.loadingInFlight = false;
        },
      });

    // Load calendar connection and today's events (non-blocking)
    this.calendarService
      .getConnection()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (conn) => {
          this.calendarConnection = conn;
          if (conn.connected) {
            this.calendarService
              .getTodayEvents()
              .pipe(takeUntil(this.destroy$))
              .subscribe({ next: (events) => { this.todayEvents = events; } });
          }
        },
      });
  }

  formatEventTime(isoStr: string): string {
    return new Date(isoStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  onStatusChange(task: Task, status: TaskStatus): void {
    if (status === task.status) {
      return;
    }
    const request =
      status === 'COMPLETED'
        ? this.taskService.completeTask(task.id)
        : task.status === 'COMPLETED' && status === 'TODO'
          ? this.taskService.reopenTask(task.id)
          : this.taskService.updateTask(task.id, { status });

    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loadingInFlight = false;
        this.loadDashboard();
      },
      error: () => this.toastService.error('Unable to update task. Please try again.'),
    });
  }
}
