import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { AuthService } from '../../core/services/auth.service';
import { TaskFilterService } from '../../core/services/task-filter.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <div class="layout">
      <app-sidebar
        [open]="sidebarOpen"
        (close)="sidebarOpen = false"
        (navigate)="sidebarOpen = false"
      />
      <div class="layout__main">
        <app-topbar
          [user]="authService.currentUser"
          (menuToggle)="sidebarOpen = true"
          (searchChange)="taskFilterService.setSearch($event)"
        />
        <main class="layout__content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      .layout {
        display: flex;
        min-height: 100vh;
        background: var(--bg);
      }
      .layout__main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .layout__content {
        padding: 1.25rem;
        max-width: 1100px;
        width: 100%;
        margin: 0 auto;
      }
    `,
  ],
})
export class MainLayoutComponent {
  readonly authService = inject(AuthService);
  readonly taskFilterService = inject(TaskFilterService);
  sidebarOpen = false;
}
