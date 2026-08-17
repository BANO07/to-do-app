import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, UserAvatarComponent],
  template: `
    <section class="settings-page">
      <header>
        <p class="eyebrow">Account</p>
        <h1>Settings</h1>
      </header>

      @if (authService.currentUser; as user) {
        <div class="profile-card">
          <app-user-avatar [name]="user.name" [avatarUrl]="user.avatarUrl" [size]="72" />
          <div>
            <h2>{{ user.name }}</h2>
            <p>{{ user.email }}</p>
            <small>Member since {{ user.createdAt | date: 'mediumDate' }}</small>
          </div>
        </div>
      }

      <button type="button" class="btn btn--danger" (click)="logout()">Logout</button>
    </section>
  `,
  styles: [
    `
      header { margin-bottom: 1.25rem; }
      .eyebrow { margin: 0; color: var(--text-muted); }
      h1 { margin: 0.25rem 0 0; }
      .profile-card {
        display: flex;
        gap: 1rem;
        align-items: center;
        padding: 1.25rem;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--surface);
        margin-bottom: 1.25rem;
      }
      h2 { margin: 0 0 0.25rem; }
      p { margin: 0; color: var(--text-muted); }
      small { color: var(--text-muted); }
    `,
  ],
})
export class SettingsPageComponent {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
    });
  }
}
