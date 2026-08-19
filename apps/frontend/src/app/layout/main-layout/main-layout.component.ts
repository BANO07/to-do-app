import { Component, HostListener, inject, OnDestroy } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { AuthService } from '../../core/services/auth.service';
import { TaskFilterService } from '../../core/services/task-filter.service';
import { UiShortcutService } from '../../core/services/ui-shortcut.service';
import { AiChatPanelComponent } from '../../features/ai/ai-chat-panel.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent, AiChatPanelComponent],
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
      <app-ai-chat-panel />
    </div>
  `,
  styles: [
    `
      .layout {
        display: flex;
        min-height: 100vh;
        background: transparent;
      }
      .layout__main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .layout__content {
        padding: var(--content-padding);
        max-width: 1100px;
        width: 100%;
        margin: 0 auto;
      }
    `,
  ],
})
export class MainLayoutComponent implements OnDestroy {
  readonly authService = inject(AuthService);
  readonly taskFilterService = inject(TaskFilterService);
  private readonly shortcuts = inject(UiShortcutService);
  private readonly router = inject(Router);

  sidebarOpen = false;

  private readonly focusSub = this.shortcuts.focusSearch$.subscribe(() => {
    const input = document.getElementById('search') as HTMLInputElement | null;
    input?.focus();
    input?.select();
  });

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    const inField =
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      target?.isContentEditable;

    if (event.key === '/' && !inField) {
      event.preventDefault();
      this.shortcuts.triggerFocusSearch();
      return;
    }

    if (inField && event.key !== 'Escape') {
      return;
    }

    if (event.key === 'Escape') {
      this.shortcuts.triggerClosePanel();
      return;
    }

    if (event.key === 'n' || event.key === 'N') {
      if (inField) return;
      event.preventDefault();
      if (!this.router.url.includes('/tasks')) {
        void this.router.navigate(['/tasks/all'], { queryParams: { new: '1' } });
      } else {
        this.shortcuts.triggerNewTask();
      }
    }
  }

  ngOnDestroy(): void {
    this.focusSub.unsubscribe();
  }
}
