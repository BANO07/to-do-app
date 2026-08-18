import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { Notification, User } from '../../core/models/app.models';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { ThemePickerComponent } from '../../shared/components/theme-picker/theme-picker.component';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule, UserAvatarComponent, ThemePickerComponent],
  template: `
    <header class="topbar">
      <button type="button" class="btn-icon mobile-only" (click)="menuToggle.emit()" aria-label="Open menu">
        ☰
      </button>

      <div class="topbar__search">
        <label class="sr-only" for="search">Search tasks</label>
        <input
          id="search"
          type="search"
          placeholder="Search tasks... (press /)"
          [(ngModel)]="searchValue"
          (ngModelChange)="onSearchChange($event)"
        />
      </div>

      <div class="topbar__user">
        <app-theme-picker [compact]="true" />
        <div class="notifications" [class.notifications--open]="notificationsOpen">
          <button
            type="button"
            class="btn-icon notifications__trigger"
            (click)="toggleNotifications(); $event.stopPropagation()"
            aria-label="Open notifications"
          >
            🔔
            @if (unreadCount > 0) {
              <span class="notifications__badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
            }
          </button>

          @if (notificationsOpen) {
            <div class="notifications__panel glass-panel" (click)="$event.stopPropagation()">
              <div class="notifications__header">
                <div>
                  <strong>Notifications</strong>
                  <span>{{ unreadCount }} unread</span>
                </div>
                <button
                  type="button"
                  class="btn btn--ghost"
                  (click)="markAllRead()"
                  [disabled]="unreadCount === 0"
                >
                  Mark all read
                </button>
              </div>

              @if (notificationsLoading) {
                <p class="notifications__state">Loading notifications…</p>
              } @else if (notificationsError) {
                <p class="notifications__state notifications__state--error">
                  {{ notificationsError }}
                </p>
              } @else if (notifications.length === 0) {
                <p class="notifications__state">No notifications yet.</p>
              } @else {
                <ul class="notifications__list">
                  @for (notification of notifications; track notification.id) {
                    <li>
                      <div
                        class="notifications__item"
                        [class.notifications__item--unread]="!notification.readAt"
                      >
                        <button
                          type="button"
                          class="notifications__item-main"
                          (click)="openNotification(notification)"
                        >
                        <div class="notifications__item-header">
                          <strong>{{ notification.title }}</strong>
                          <span>{{ relativeTime(notification.createdAt) }}</span>
                        </div>
                        <p>{{ notification.message }}</p>
                        </button>
                        <div class="notifications__item-meta">
                          <span>{{ notification.channel.replace('_', ' ') }}</span>
                          @if (!notification.readAt) {
                            <button
                              type="button"
                              class="btn btn--ghost"
                              (click)="markRead(notification, $event)"
                            >
                              Mark read
                            </button>
                          }
                        </div>
                      </div>
                    </li>
                  }
                </ul>
              }
            </div>
          }
        </div>
        @if (user) {
          <app-user-avatar [name]="user.name" [avatarUrl]="user.avatarUrl" [size]="40" />
          <div class="user-meta">
            <strong>{{ user.name }}</strong>
            <span>{{ user.email }}</span>
          </div>
          <button type="button" class="btn btn--ghost" (click)="logout()">Logout</button>
        }
      </div>
    </header>
  `,
  styles: [
    `
      .topbar {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: var(--topbar-padding);
        border-bottom: 1px solid var(--border);
        background: var(--surface);
        backdrop-filter: var(--glass-blur);
        -webkit-backdrop-filter: var(--glass-blur);
        position: sticky;
        top: 0;
        z-index: 100;
      }
      .topbar__search {
        flex: 1;
      }
      .topbar__search input {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 0.75rem 1rem;
        background: var(--surface-muted);
      }
      .topbar__user {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        position: relative;
      }
      .notifications {
        position: relative;
      }
      .notifications__trigger {
        position: relative;
      }
      .notifications__badge {
        position: absolute;
        top: -6px;
        right: -6px;
        min-width: 18px;
        height: 18px;
        padding: 0 0.35rem;
        border-radius: 999px;
        background: var(--danger);
        color: white;
        font-size: 0.7rem;
        line-height: 18px;
      }
      .notifications__panel {
        position: absolute;
        top: calc(100% + 0.75rem);
        right: 0;
        width: min(380px, calc(100vw - 2rem));
        padding: 1rem;
        border-radius: 16px;
        border: 1px solid var(--border);
        background: var(--surface);
        box-shadow: var(--shadow-md);
        z-index: 120;
      }
      .notifications__header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
        margin-bottom: 0.75rem;
      }
      .notifications__header span {
        display: block;
        color: var(--text-muted);
        font-size: 0.75rem;
      }
      .notifications__list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 24rem;
        overflow: auto;
      }
      .notifications__item {
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--surface-muted);
        padding: 0.75rem;
      }
      .notifications__item--unread {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 8%, var(--surface));
      }
      .notifications__item-main {
        width: 100%;
        border: none;
        background: transparent;
        text-align: left;
        padding: 0;
        cursor: pointer;
      }
      .notifications__item-header,
      .notifications__item-meta {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
      }
      .notifications__item-header span,
      .notifications__item-meta span {
        color: var(--text-muted);
        font-size: 0.75rem;
      }
      .notifications__item p {
        margin: 0.5rem 0;
        color: var(--text-muted);
        font-size: 0.875rem;
      }
      .notifications__state {
        margin: 0;
        color: var(--text-muted);
        font-size: 0.875rem;
      }
      .notifications__state--error {
        color: var(--danger);
      }
      .user-meta {
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }
      .user-meta span {
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .mobile-only {
        display: none;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        border: 0;
      }
      @media (max-width: 1024px) {
        .mobile-only {
          display: inline-flex;
        }
        .user-meta {
          display: none;
        }
      }
    `,
  ],
})
export class TopbarComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private searchTimeout?: ReturnType<typeof setTimeout>;
  private readonly destroy$ = new Subject<void>();

  @Input() user: User | null = null;
  @Input() search = '';
  @Output() menuToggle = new EventEmitter<void>();
  @Output() searchChange = new EventEmitter<string>();

  searchValue = '';
  unreadCount = 0;
  notificationsOpen = false;
  notificationsLoading = false;
  notificationsError = '';
  notifications: Notification[] = [];

  ngOnInit(): void {
    this.refreshUnreadCount();
    this.notificationService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe((count) => (this.unreadCount = count));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:click')
  closeNotifications(): void {
    this.notificationsOpen = false;
  }

  onSearchChange(value: string): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.searchChange.emit(value), 300);
  }

  toggleNotifications(): void {
    this.notificationsOpen = !this.notificationsOpen;
    if (this.notificationsOpen) {
      this.loadNotifications();
    }
  }

  loadNotifications(): void {
    this.notificationsLoading = true;
    this.notificationsError = '';
    this.notificationService
      .getNotifications({ page: 1, limit: 8 })
      .subscribe({
        next: (result) => {
          this.notifications = result.items;
          this.notificationsLoading = false;
          this.refreshUnreadCount();
        },
        error: () => {
          this.notificationsLoading = false;
          this.notificationsError = 'Unable to load notifications.';
        },
      });
  }

  markRead(notification: Notification, event: Event): void {
    event.stopPropagation();
    this.notificationService.markNotificationRead(notification.id).subscribe({
      next: (updated) => {
        this.notifications = this.notifications.map((item) =>
          item.id === updated.id ? { ...item, readAt: updated.readAt } : item,
        );
        this.refreshUnreadCount();
      },
    });
  }

  markAllRead(): void {
    this.notificationService.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications = this.notifications.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        }));
        this.unreadCount = 0;
      },
    });
  }

  openNotification(notification: Notification): void {
    const navigate = () =>
      this.router.navigate(
        notification.taskId ? ['/tasks/all'] : ['/dashboard'],
        notification.taskId
          ? { queryParams: { taskId: notification.taskId } }
          : undefined,
      );

    if (!notification.readAt) {
      this.notificationService.markNotificationRead(notification.id).subscribe({
        next: () => {
          this.notificationsOpen = false;
          this.refreshUnreadCount();
          void navigate();
        },
        error: () => void navigate(),
      });
      return;
    }

    this.notificationsOpen = false;
    void navigate();
  }

  relativeTime(value: string): string {
    const diffMs = new Date(value).getTime() - Date.now();
    const minutes = Math.round(diffMs / 60000);
    if (Math.abs(minutes) < 1) {
      return 'just now';
    }
    if (Math.abs(minutes) < 60) {
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
        minutes,
        'minute',
      );
    }
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) {
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
        hours,
        'hour',
      );
    }
    const days = Math.round(hours / 24);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      days,
      'day',
    );
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
    });
  }

  private refreshUnreadCount(): void {
    this.notificationService.refreshUnreadCount().subscribe({
      error: () => undefined,
    });
  }
}
