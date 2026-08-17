import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/app.models';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { ThemePickerComponent } from '../../shared/components/theme-picker/theme-picker.component';

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
export class TopbarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private searchTimeout?: ReturnType<typeof setTimeout>;

  @Input() user: User | null = null;
  @Input() search = '';
  @Output() menuToggle = new EventEmitter<void>();
  @Output() searchChange = new EventEmitter<string>();

  searchValue = '';

  onSearchChange(value: string): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.searchChange.emit(value), 300);
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
    });
  }
}
