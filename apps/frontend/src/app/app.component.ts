import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './shared/components/toast/toast-container.component';
import { AppBackgroundComponent } from './shared/components/app-background/app-background.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent, AppBackgroundComponent],
  template: `
    <app-background />
    <div class="app-shell">
      <router-outlet />
    </div>
    <app-toast-container />
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }
      .app-shell {
        position: relative;
        z-index: 1;
        min-height: 100vh;
      }
    `,
  ],
})
export class AppComponent {}
