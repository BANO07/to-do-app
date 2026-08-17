import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';
import { ThemePickerComponent } from '../../../shared/components/theme-picker/theme-picker.component';
import { PreferencesPanelComponent } from '../../../shared/components/preferences-panel/preferences-panel.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, UserAvatarComponent, ThemePickerComponent, PreferencesPanelComponent],
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
        <h3>Appearance</h3>
        <p>Background style, accent color, and light or dark mode.</p>
        <app-theme-picker />
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
      h2 { margin: 0 0 0.25rem; }
      p { margin: 0; color: var(--text-muted); }
      small { color: var(--text-muted); }
    `,
  ],
})
export class SettingsPageComponent {
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
    });
  }
}
