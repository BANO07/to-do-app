import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar" [class.sidebar--open]="open">
      <div class="sidebar__brand">
        <span class="sidebar__logo" aria-hidden="true">✓</span>
        <span>Todo App</span>
      </div>

      <nav aria-label="Main navigation">
        @for (item of navItems; track item.route) {
          <a
            routerLink="{{ item.route }}"
            routerLinkActive="active"
            (click)="navigate.emit()"
          >
            <span aria-hidden="true">{{ item.icon }}</span>
            {{ item.label }}
          </a>
        }
      </nav>
    </aside>
    @if (open) {
      <div class="sidebar-backdrop" (click)="close.emit()" aria-hidden="true"></div>
    }
  `,
  styles: [
    `
      .sidebar {
        width: var(--sidebar-width);
        background: var(--surface);
        backdrop-filter: var(--glass-blur);
        -webkit-backdrop-filter: var(--glass-blur);
        border-right: 1px solid var(--border);
        padding: var(--content-padding) 1rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        min-height: 100%;
      }
      .sidebar__brand {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-weight: 700;
        font-size: 1.125rem;
        padding: 0 0.5rem;
      }
      .sidebar__logo {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: var(--primary);
        color: white;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      nav {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      a {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: var(--nav-link-padding);
        border-radius: 10px;
        color: var(--text-muted);
        text-decoration: none;
        font-weight: 500;
      }
      a:hover, a.active {
        background: var(--primary-soft);
        color: var(--primary);
      }
      .sidebar-backdrop {
        display: none;
      }
      @media (max-width: 1024px) {
        .sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          z-index: 800;
          transform: translateX(-100%);
          transition: transform 0.2s ease;
        }
        .sidebar--open {
          transform: translateX(0);
        }
        .sidebar-backdrop {
          display: block;
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          z-index: 700;
        }
      }
    `,
  ],
})
export class SidebarComponent {
  @Input() open = false;
  @Output() close = new EventEmitter<void>();
  @Output() navigate = new EventEmitter<void>();

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: '🏠' },
    { label: 'Today', route: '/tasks/today', icon: '☀️' },
    { label: 'Upcoming', route: '/tasks/upcoming', icon: '📅' },
    { label: 'All Tasks', route: '/tasks/all', icon: '📋' },
    { label: 'Completed', route: '/tasks/completed', icon: '✅' },
    { label: 'Archived', route: '/tasks/archived', icon: '📦' },
    { label: 'Categories', route: '/categories', icon: '🏷️' },
    { label: 'AI Assistant', route: '/ai', icon: '✨' },
    { label: 'Settings', route: '/settings', icon: '⚙️' },
  ];
}
