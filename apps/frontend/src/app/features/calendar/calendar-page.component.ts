import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CalendarService } from '../../core/services/calendar.service';
import { CalendarConnectionStatus, CalendarEvent } from '../../core/models/app.models';

interface CalendarDay {
  date: Date;
  dateStr: string;
  isToday: boolean;
  isCurrentMonth: boolean;
  events: CalendarEvent[];
}

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="calendar-page">
      <header class="calendar-header">
        <div class="calendar-header__title">
          <h1>Calendar</h1>
          <p class="subtitle">Google Calendar integration</p>
        </div>
        <div class="calendar-header__actions">
          @if (connection?.connected) {
            <button class="btn btn--ghost btn--sm" (click)="onSync()" [disabled]="syncing">
              {{ syncing ? 'Syncing…' : '🔄 Sync' }}
            </button>
            <button class="btn btn--danger btn--sm" (click)="onDisconnect()">
              Disconnect
            </button>
          } @else {
            <button class="btn btn--primary" (click)="onConnect()" [disabled]="connecting">
              {{ connecting ? 'Redirecting…' : '🗓️ Connect Google Calendar' }}
            </button>
          }
          <div class="month-nav">
            <button class="btn btn--ghost btn--icon" (click)="prevMonth()" aria-label="Previous month">‹</button>
            <span class="month-label">{{ monthLabel }}</span>
            <button class="btn btn--ghost btn--icon" (click)="nextMonth()" aria-label="Next month">›</button>
          </div>
        </div>
      </header>

      @if (statusMessage) {
        <div class="alert" [class.alert--success]="statusType === 'success'" [class.alert--error]="statusType === 'error'">
          {{ statusMessage }}
        </div>
      }

      @if (connection?.connected && connection?.providerAccountId) {
        <p class="connected-account">Connected as <strong>{{ connection!.providerAccountId }}</strong></p>
      }

      @if (loading) {
        <div class="loading-state">Loading calendar…</div>
      } @else {
        <div class="calendar-grid">
          <div class="calendar-weekdays">
            @for (day of weekDays; track day) {
              <div class="calendar-weekday">{{ day }}</div>
            }
          </div>
          <div class="calendar-days">
            @for (day of calendarDays; track day.dateStr) {
              <div
                class="calendar-day"
                [class.calendar-day--today]="day.isToday"
                [class.calendar-day--other-month]="!day.isCurrentMonth"
              >
                <span class="calendar-day__number">{{ day.date.getDate() }}</span>
                <div class="calendar-day__events">
                  @for (event of day.events.slice(0, 3); track event.id) {
                    <div
                      class="calendar-event"
                      [class.calendar-event--all-day]="event.isAllDay"
                      [class.calendar-event--tentative]="event.status === 'TENTATIVE'"
                      [title]="event.title + (event.location ? ' @ ' + event.location : '')"
                    >
                      @if (!event.isAllDay) {
                        <span class="calendar-event__time">{{ formatTime(event.startAt) }}</span>
                      }
                      <span class="calendar-event__title">{{ event.title }}</span>
                    </div>
                  }
                  @if (day.events.length > 3) {
                    <div class="calendar-event calendar-event--more">+{{ day.events.length - 3 }} more</div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      @if (!connection?.connected && !loading) {
        <div class="empty-state">
          <div class="empty-state__icon">🗓️</div>
          <h3>Connect Google Calendar</h3>
          <p>Sync your Google Calendar events to see them here and let AI plan your day with meetings in mind.</p>
          <button class="btn btn--primary btn--lg" (click)="onConnect()" [disabled]="connecting">
            {{ connecting ? 'Redirecting to Google…' : 'Connect Google Calendar' }}
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .calendar-page {
      padding: var(--content-padding);
      max-width: 1100px;
    }
    .calendar-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .calendar-header__title h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .calendar-header__title .subtitle {
      margin: 0.25rem 0 0;
      color: var(--text-secondary);
      font-size: 0.875rem;
    }
    .calendar-header__actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .month-nav {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .month-label {
      font-weight: 600;
      min-width: 140px;
      text-align: center;
    }
    .connected-account {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin: -0.75rem 0 1rem;
    }
    .alert {
      padding: 0.75rem 1rem;
      border-radius: var(--radius);
      margin-bottom: 1rem;
      font-size: 0.875rem;
    }
    .alert--success { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    .alert--error { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
    .loading-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-secondary);
    }
    .calendar-grid {
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .calendar-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      background: var(--surface-elevated);
      border-bottom: 1px solid var(--border);
    }
    .calendar-weekday {
      padding: 0.5rem;
      text-align: center;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .calendar-days {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
    }
    .calendar-day {
      min-height: 100px;
      padding: 0.5rem;
      border-right: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }
    .calendar-day:nth-child(7n) { border-right: none; }
    .calendar-day--today .calendar-day__number {
      background: var(--primary);
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .calendar-day--other-month {
      opacity: 0.4;
    }
    .calendar-day__number {
      font-size: 0.8125rem;
      font-weight: 600;
      display: block;
      margin-bottom: 0.25rem;
    }
    .calendar-day__events {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .calendar-event {
      font-size: 0.6875rem;
      padding: 2px 4px;
      border-radius: 3px;
      background: rgba(99, 102, 241, 0.2);
      color: var(--primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: default;
    }
    .calendar-event--all-day {
      background: rgba(99, 102, 241, 0.35);
    }
    .calendar-event--tentative {
      opacity: 0.6;
      border-left: 2px solid var(--primary);
    }
    .calendar-event--more {
      background: transparent;
      color: var(--text-secondary);
    }
    .calendar-event__time {
      margin-right: 3px;
      opacity: 0.8;
    }
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
    }
    .empty-state__icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    .empty-state h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 0.5rem;
    }
    .empty-state p {
      color: var(--text-secondary);
      max-width: 400px;
      margin: 0 auto 1.5rem;
    }
    .btn { padding: 0.5rem 1rem; border-radius: var(--radius); border: none; cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: opacity 0.15s; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn--primary { background: var(--primary); color: white; }
    .btn--ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .btn--danger { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
    .btn--icon { padding: 0.375rem 0.625rem; }
    .btn--sm { font-size: 0.8125rem; padding: 0.375rem 0.75rem; }
    .btn--lg { padding: 0.75rem 1.5rem; font-size: 1rem; }
  `],
})
export class CalendarPageComponent implements OnInit, OnDestroy {
  readonly weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  connection: CalendarConnectionStatus | null = null;
  events: CalendarEvent[] = [];
  calendarDays: CalendarDay[] = [];
  loading = true;
  connecting = false;
  syncing = false;
  statusMessage = '';
  statusType: 'success' | 'error' = 'success';

  private currentYear = new Date().getFullYear();
  private currentMonth = new Date().getMonth();
  private subs = new Subscription();

  get monthLabel(): string {
    return new Date(this.currentYear, this.currentMonth, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  constructor(
    private readonly calendarService: CalendarService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdRef: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Handle OAuth callback params
    this.subs.add(
      this.route.queryParams.subscribe((params) => {
        if (params['connected'] === 'true') {
          this.showStatus('Google Calendar connected successfully!', 'success');
          void this.router.navigate([], { queryParams: {}, replaceUrl: true });
        } else if (params['error']) {
          const msg = params['error'] === 'access_denied'
            ? 'Calendar access was denied.'
            : 'Failed to connect Google Calendar. Please try again.';
          this.showStatus(msg, 'error');
          void this.router.navigate([], { queryParams: {}, replaceUrl: true });
        }
      }),
    );

    this.loadConnection();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadConnection(): void {
    this.loading = true;
    this.subs.add(
      this.calendarService.getConnection().subscribe({
        next: (conn) => {
          this.connection = conn;
          if (conn.connected) {
            this.loadEvents();
          } else {
            this.loading = false;
            this.buildCalendarDays([]);
            this.cdRef.markForCheck();
          }
        },
        error: () => {
          this.loading = false;
          this.cdRef.markForCheck();
        },
      }),
    );
  }

  loadEvents(): void {
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    const from = firstDay.toISOString().slice(0, 10);
    const to = lastDay.toISOString().slice(0, 10);

    this.subs.add(
      this.calendarService.getEvents(from, to).subscribe({
        next: (events) => {
          this.events = events;
          this.loading = false;
          this.buildCalendarDays(events);
          this.cdRef.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.buildCalendarDays([]);
          this.cdRef.markForCheck();
        },
      }),
    );
  }

  prevMonth(): void {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.loadEvents();
  }

  nextMonth(): void {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.loadEvents();
  }

  onConnect(): void {
    this.connecting = true;
    this.subs.add(
      this.calendarService.getAuthUrl().subscribe({
        next: (url) => {
          window.location.href = url;
        },
        error: (err) => {
          this.connecting = false;
          const msg =
            err?.graphQLErrors?.[0]?.message ??
            err?.message ??
            'Failed to get authorization URL. Please check your Google OAuth configuration.';
          this.showStatus(msg, 'error');
          this.cdRef.markForCheck();
        },
      }),
    );
  }

  onDisconnect(): void {
    this.subs.add(
      this.calendarService.disconnect().subscribe({
        next: () => {
          this.connection = { connected: false };
          this.events = [];
          this.buildCalendarDays([]);
          this.showStatus('Google Calendar disconnected.', 'success');
          this.cdRef.markForCheck();
        },
      }),
    );
  }

  onSync(): void {
    this.syncing = true;
    this.subs.add(
      this.calendarService.sync().subscribe({
        next: (result) => {
          this.syncing = false;
          if (result.success) {
            this.showStatus(`Synced ${result.eventsUpserted} events.`, 'success');
            this.loadEvents();
          } else {
            this.showStatus(result.message ?? 'Sync failed.', 'error');
          }
          this.cdRef.markForCheck();
        },
        error: () => {
          this.syncing = false;
          this.showStatus('Sync failed. Please try again.', 'error');
          this.cdRef.markForCheck();
        },
      }),
    );
  }

  formatTime(isoStr: string): string {
    return new Date(isoStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  private buildCalendarDays(events: CalendarEvent[]): void {
    const firstOfMonth = new Date(this.currentYear, this.currentMonth, 1);
    const lastOfMonth = new Date(this.currentYear, this.currentMonth + 1, 0);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const days: CalendarDay[] = [];

    // Fill leading blank days (previous month)
    const startDow = firstOfMonth.getDay();
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(this.currentYear, this.currentMonth, -i);
      days.push(this.buildDay(d, false, todayStr, events));
    }

    // Current month days
    for (let d = 1; d <= lastOfMonth.getDate(); d++) {
      const date = new Date(this.currentYear, this.currentMonth, d);
      days.push(this.buildDay(date, true, todayStr, events));
    }

    // Fill trailing days to complete the grid
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(this.currentYear, this.currentMonth + 1, i);
        days.push(this.buildDay(d, false, todayStr, events));
      }
    }

    this.calendarDays = days;
  }

  private buildDay(
    date: Date,
    isCurrentMonth: boolean,
    todayStr: string,
    events: CalendarEvent[],
  ): CalendarDay {
    const dateStr = date.toISOString().slice(0, 10);
    const dayEvents = events.filter((e) => {
      const eventDate = e.startAt.slice(0, 10);
      return eventDate === dateStr;
    });
    return {
      date,
      dateStr,
      isToday: dateStr === todayStr,
      isCurrentMonth,
      events: dayEvents,
    };
  }

  private showStatus(message: string, type: 'success' | 'error'): void {
    this.statusMessage = message;
    this.statusType = type;
    setTimeout(() => {
      this.statusMessage = '';
      this.cdRef.markForCheck();
    }, 5000);
  }
}
