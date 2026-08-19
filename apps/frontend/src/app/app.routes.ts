import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { DefaultRedirectComponent } from './core/components/default-redirect.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login-page/login-page.component').then(
        (m) => m.LoginPageComponent,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    component: MainLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', component: DefaultRedirectComponent },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page/dashboard-page.component').then(
            (m) => m.DashboardPageComponent,
          ),
      },
      {
        path: 'tasks/all',
        data: { view: 'ALL' },
        loadComponent: () =>
          import('./features/tasks/tasks-page/tasks-page.component').then(
            (m) => m.TasksPageComponent,
          ),
      },
      {
        path: 'tasks/today',
        data: { view: 'TODAY' },
        loadComponent: () =>
          import('./features/tasks/tasks-page/tasks-page.component').then(
            (m) => m.TasksPageComponent,
          ),
      },
      {
        path: 'tasks/upcoming',
        data: { view: 'UPCOMING' },
        loadComponent: () =>
          import('./features/tasks/tasks-page/tasks-page.component').then(
            (m) => m.TasksPageComponent,
          ),
      },
      {
        path: 'tasks/completed',
        data: { view: 'COMPLETED' },
        loadComponent: () =>
          import('./features/tasks/tasks-page/tasks-page.component').then(
            (m) => m.TasksPageComponent,
          ),
      },
      {
        path: 'tasks/archived',
        data: { view: 'ARCHIVED' },
        loadComponent: () =>
          import('./features/tasks/tasks-page/tasks-page.component').then(
            (m) => m.TasksPageComponent,
          ),
      },
      {
        path: 'tasks/overdue',
        data: { view: 'OVERDUE' },
        loadComponent: () =>
          import('./features/tasks/tasks-page/tasks-page.component').then(
            (m) => m.TasksPageComponent,
          ),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/categories/categories-page/categories-page.component').then(
            (m) => m.CategoriesPageComponent,
          ),
      },
      {
        path: 'ai',
        loadComponent: () =>
          import('./features/ai/ai-page.component').then(
            (m) => m.AiPageComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings-page/settings-page.component').then(
            (m) => m.SettingsPageComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
