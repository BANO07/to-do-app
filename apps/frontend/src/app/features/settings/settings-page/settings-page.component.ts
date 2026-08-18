import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  NotificationPreferences,
  PushSubscriptionRecord,
} from '../../../core/models/app.models';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';
import { ThemePickerComponent } from '../../../shared/components/theme-picker/theme-picker.component';
import { PreferencesPanelComponent } from '../../../shared/components/preferences-panel/preferences-panel.component';
import { COMMON_TIMEZONES, listIanaTimezones } from '../../../core/utils/date-time';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    UserAvatarComponent,
    ThemePickerComponent,
    PreferencesPanelComponent,
  ],
  template: `
    <section class="settings-page">
      <header>
        <p class="eyebrow">Account</p>
        <h1>Settings</h1>
      </header>

      @if (authService.currentUser; as user) {
        <div class="profile-card glass-panel">
          <app-user-avatar [name]="user.name" [avatarUrl]="user.avatarUrl" [size]="72" />
          <div>
            <h2>{{ user.name }}</h2>
            <p>{{ user.email }}</p>
            <small>Member since {{ user.createdAt | date: 'mediumDate' }}</small>
          </div>
        </div>
      }

      <div class="settings-card glass-panel">
        <h3>Timezone</h3>
        <p>Used for Today, Overdue, recurrence, and reminder times.</p>
        <select
          [ngModel]="selectedTimezone"
          (ngModelChange)="saveTimezone($event)"
          aria-label="IANA timezone"
        >
          @for (zone of timezones; track zone) {
            <option [value]="zone">{{ zone }}</option>
          }
        </select>
      </div>

      <div class="settings-card glass-panel">
        <h3>Appearance</h3>
        <p>Background style, accent color, and light or dark mode.</p>
        <app-theme-picker />
      </div>

      <div class="settings-card glass-panel">
        <h3>Notifications</h3>
        <p>Control which reminder channels can deliver for your account.</p>
        @if (notificationPreferences; as prefs) {
          <label class="toggle-row">
            <span>Reminder notifications</span>
            <input
              type="checkbox"
              [checked]="prefs.reminderEnabled"
              (change)="updateNotificationPreference('reminderEnabled', checkboxChecked($event))"
            />
          </label>
          <label class="toggle-row">
            <span>In-app notifications</span>
            <input
              type="checkbox"
              [checked]="prefs.inAppEnabled"
              (change)="updateNotificationPreference('inAppEnabled', checkboxChecked($event))"
            />
          </label>
          <label class="toggle-row">
            <span>Email notifications</span>
            <input
              type="checkbox"
              [checked]="prefs.emailEnabled"
              [disabled]="!prefs.emailAvailable"
              (change)="updateNotificationPreference('emailEnabled', checkboxChecked($event))"
            />
          </label>
          @if (!prefs.emailAvailable) {
            <small>Email delivery is not configured on the server.</small>
          }
        } @else {
          <p>Loading notification preferences…</p>
        }
      </div>

      <div class="settings-card glass-panel">
        <h3>Push Notifications</h3>
        <p>Enable browser push on this device only when you explicitly want reminder alerts.</p>
        <div class="push-status">
          <span>Browser support</span>
          <strong>{{
            pushNotificationService.isSupported() ? 'Supported' : 'Not supported'
          }}</strong>
        </div>
        <div class="push-status">
          <span>Permission</span>
          <strong>{{ pushNotificationService.permissionState() }}</strong>
        </div>
        <div class="push-status">
          <span>Saved subscriptions</span>
          <strong>{{ pushSubscriptions.length }}</strong>
        </div>
        @if (notificationPreferences; as prefs) {
          @if (!prefs.pushAvailable) {
            <small>Push delivery is not configured on the server.</small>
          }
          <div class="push-actions">
            <button
              type="button"
              class="btn btn--primary"
              [disabled]="pushBusy || !pushNotificationService.isSupported() || !prefs.pushAvailable"
              (click)="enablePush(prefs)"
            >
              Enable Push Notifications
            </button>
            <button
              type="button"
              class="btn btn--ghost"
              [disabled]="pushBusy || (!prefs.pushEnabled && pushSubscriptions.length === 0)"
              (click)="disablePush()"
            >
              Disable Push Notifications
            </button>
          </div>
        }
      </div>

      <div class="settings-card glass-panel">
        <h3>Preferences</h3>
        <p>Motion, layout, and default landing page.</p>
        <app-preferences-panel />
      </div>

      <button type="button" class="btn btn--danger" (click)="logout()">Logout</button>
    </section>
  `,
  styles: [
    `
      header { margin-bottom: 1.25rem; }
      .eyebrow { margin: 0; color: var(--text-muted); }
      h1 { margin: 0.25rem 0 0; }
      .profile-card,
      .settings-card {
        display: flex;
        gap: 1rem;
        align-items: center;
        padding: 1.25rem;
        border-radius: 16px;
        margin-bottom: 1.25rem;
      }
      .settings-card {
        flex-direction: column;
        align-items: stretch;
      }
      .settings-card h3 {
        margin: 0 0 0.25rem;
      }
      .settings-card p {
        margin: 0 0 1rem;
        color: var(--text-muted);
        font-size: 0.875rem;
      }
      .toggle-row,
      .push-status {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
        padding: 0.25rem 0;
      }
      .push-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-top: 0.75rem;
      }
      select {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 0.75rem 0.875rem;
        background: var(--input-bg);
        color: var(--text-primary);
        font: inherit;
      }
      h2 { margin: 0 0 0.25rem; }
      p { margin: 0; color: var(--text-muted); }
      small { color: var(--text-muted); }
    `,
  ],
})
export class SettingsPageComponent {
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly pushNotificationService = inject(PushNotificationService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  readonly timezones = this.buildTimezoneOptions();
  notificationPreferences: NotificationPreferences | null = null;
  pushSubscriptions: PushSubscriptionRecord[] = [];
  pushBusy = false;

  constructor() {
    this.loadNotificationSettings();
  }

  get selectedTimezone(): string {
    return this.authService.currentUser?.ianaTimezone || 'UTC';
  }

  saveTimezone(timezone: string): void {
    if (timezone === this.authService.currentUser?.ianaTimezone) {
      return;
    }
    this.authService.updateTimezone(timezone).subscribe({
      next: () => this.toastService.success('Timezone updated.'),
      error: () => this.toastService.error('Unable to update timezone.'),
    });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
    });
  }

  checkboxChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  updateNotificationPreference(
    key: keyof Pick<
      NotificationPreferences,
      'inAppEnabled' | 'emailEnabled' | 'pushEnabled' | 'reminderEnabled'
    >,
    value: boolean,
  ): void {
    this.notificationService
      .updateNotificationPreferences({ [key]: value })
      .subscribe({
        next: (preferences) => {
          this.notificationPreferences = preferences;
          this.toastService.success('Notification preferences updated.');
        },
        error: () =>
          this.toastService.error('Unable to update notification preferences.'),
      });
  }

  enablePush(preferences: NotificationPreferences): void {
    this.pushBusy = true;
    this.pushNotificationService.enablePush(preferences).subscribe({
      next: () => {
        this.pushBusy = false;
        this.toastService.success('Push notifications enabled.');
        this.loadNotificationSettings();
      },
      error: () => {
        this.pushBusy = false;
        this.toastService.error('Unable to enable push notifications.');
      },
    });
  }

  disablePush(): void {
    this.pushBusy = true;
    this.pushNotificationService.disablePush(this.pushSubscriptions).subscribe({
      next: () => {
        this.pushBusy = false;
        this.toastService.success('Push notifications disabled.');
        this.loadNotificationSettings();
      },
      error: () => {
        this.pushBusy = false;
        this.toastService.error('Unable to disable push notifications.');
      },
    });
  }

  private buildTimezoneOptions(): string[] {
    const all = listIanaTimezones();
    const current = this.authService.currentUser?.ianaTimezone;
    const preferred = [...COMMON_TIMEZONES];
    if (current && !preferred.includes(current)) {
      preferred.unshift(current);
    }
    const rest = all.filter((zone) => !preferred.includes(zone));
    return [...preferred, ...rest];
  }

  private loadNotificationSettings(): void {
    forkJoin({
      preferences: this.notificationService.getNotificationPreferences(),
      subscriptions: this.notificationService.getPushSubscriptions(),
    }).subscribe({
      next: ({ preferences, subscriptions }) => {
        this.notificationPreferences = preferences;
        this.pushSubscriptions = subscriptions;
      },
      error: () => {
        this.toastService.error('Unable to load notification settings.');
      },
    });
  }
}
