import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { ThemePickerComponent } from '../../../shared/components/theme-picker/theme-picker.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ThemePickerComponent],
  template: `
    <div class="login-page">
      <div class="login-page__toolbar">
        <app-theme-picker [compact]="true" />
      </div>
      <div class="login-card glass-panel">
        <div class="login-card__logo" aria-hidden="true">✓</div>
        <h1>Todo App</h1>
        <p>Your personal productivity workspace. Sign in to manage tasks, categories, and stay organized.</p>
        <button type="button" class="btn btn--google" (click)="login()">
          <span aria-hidden="true">G</span>
          Continue with Google
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .login-page {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        position: relative;
      }
      .login-page__toolbar {
        position: absolute;
        top: 1rem;
        right: 1rem;
      }
      .login-card {
        width: min(420px, 100%);
        border-radius: 20px;
        padding: 2rem;
        box-shadow: var(--shadow-lg);
        text-align: center;
      }
      .login-card__logo {
        width: 56px;
        height: 56px;
        margin: 0 auto 1rem;
        border-radius: 16px;
        background: linear-gradient(135deg, var(--primary), #a855f7);
        color: white;
        display: grid;
        place-items: center;
        font-size: 1.5rem;
        font-weight: 700;
        box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
      }
      h1 {
        margin: 0 0 0.5rem;
      }
      p {
        margin: 0 0 1.5rem;
        color: var(--text-muted);
      }
      .btn--google {
        width: 100%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        background: var(--input-bg);
        color: var(--text-primary);
        border: 1px solid var(--border);
      }
      .btn--google span {
        width: 24px;
        height: 24px;
        border-radius: 999px;
        background: #4285f4;
        color: white;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
      }
    `,
  ],
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);

  login(): void {
    this.authService.loginWithGoogle();
  }
}
